/* eslint-disable no-console */

// -----------------------------
// P2P Core (New Architecture)
// -----------------------------
// This file implements the P2P business logic:
// - Ad direction mapping (merchant BUY shows in user SELL tab and vice-versa)
// - Merchant balance rules (BUY: no check, SELL: verify + Max pulls wallet balance)
// - Order gating rules (user cannot SELL unless balance is sufficient)
// - 20-second “trust sequence” before ad submission
// - Firebase writes to collection: Ads

// Verifies user balance before allowing SELL orders.
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/** @type {'buy'|'sell'} */
let marketTab = "sell"; // default: SELL tab visible for users
/** @type {'buy'|'sell'} */
let createMode = "buy"; // default merchant intent

/** @type {import('firebase/firestore').Firestore | any} */
const db = window.db; // provided by firebase-config.js

/** @type {any} */
let tronWeb = null;
/** @type {string | null} */
let connectedAddress = null;

/** @type {null | {id: string, type: 'buy'|'sell', price: number, availableQuantity: number, merchantAddress: string}} */
let selectedAd = null;

// -----------------------------
// Small UI helpers
// -----------------------------

// Shows user feedback without heavy libraries.
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => {
    el.style.display = "none";
  }, 2600);
}

function setPage(pageId) {
  const pages = ["marketPage", "createAdPage"];
  pages.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("page--active", id === pageId);
  });
}

function format2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

// -----------------------------
// Wallet / TronLink
// -----------------------------

// Connects to TronLink so we can read balances and attach merchantAddress.
async function connectWallet() {
  try {
    // TronLink modern API
    if (window.tronLink && typeof window.tronLink.request === "function") {
      await window.tronLink.request({ method: "tron_requestAccounts" });
    }

    // TronLink injects window.tronWeb after approval
    if (!window.tronWeb) {
      toast("يرجى تثبيت/فتح TronLink");
      return;
    }

    tronWeb = window.tronWeb;
    connectedAddress = tronWeb?.defaultAddress?.base58 || null;

    if (!connectedAddress) {
      toast("فشل ربط المحفظة");
      return;
    }

    const btn = document.getElementById("connectBtn");
    if (btn) {
      btn.classList.remove("chip--danger");
      btn.classList.add("chip--ok");
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${connectedAddress.slice(0, 4)}...${connectedAddress.slice(-4)}</span>`;
    }

    // Refresh SELL mode balance box if visible
    await refreshWalletBalanceUI();
    validatePublish();
    validateOrder();
  } catch (e) {
    console.error(e);
    toast("فشل ربط المحفظة");
  }
}

// Reads TRC20 USDT balance from TronLink.
async function getUSDTBalance(address) {
  try {
    if (!tronWeb || !address) return 0;
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const raw = await contract.balanceOf(address).call();
    return Number(raw) / 1e6;
  } catch (e) {
    console.error("balance error", e);
    return 0;
  }
}

// Updates the SELL-only box "available" text.
async function refreshWalletBalanceUI() {
  const balanceEl = document.getElementById("walletBalance");
  if (!balanceEl) return;
  if (!connectedAddress) {
    balanceEl.textContent = "0.00";
    return;
  }
  const bal = await getUSDTBalance(connectedAddress);
  balanceEl.textContent = format2(bal);
}

// -----------------------------
// Market tab + ad-direction mapping
// -----------------------------

// Business rule:
// - Merchant creates BUY ad => stored as type: 'buy' => shown under user SELL tab
// - Merchant creates SELL ad => stored as type: 'sell' => shown under user BUY tab
function firestoreTypeForMarketTab(tab) {
  return tab === "sell" ? "buy" : "sell";
}

// Which action the user performs when clicking an ad card in the current market tab.
function userActionForMarketTab(tab) {
  return tab === "sell" ? "sell" : "buy";
}

function setMarketTab(tab) {
  marketTab = tab;
  const tabBuy = document.getElementById("tabBuy");
  const tabSell = document.getElementById("tabSell");
  if (tabBuy) tabBuy.classList.toggle("tab--active", tab === "buy");
  if (tabSell) tabSell.classList.toggle("tab--active", tab === "sell");
  subscribeAds();
}

let unsubscribeAds = null;

// Renders Ads list using the ad-direction mapping above.
function subscribeAds() {
  if (!db) return;
  if (typeof unsubscribeAds === "function") unsubscribeAds();

  const adsList = document.getElementById("adsList");
  if (!adsList) return;
  adsList.innerHTML = "";

  const wantedType = firestoreTypeForMarketTab(marketTab);

  // Single query source of truth
  unsubscribeAds = db
    .collection("Ads")
    .where("status", "==", "active")
    .where("type", "==", wantedType)
    .orderBy("timestamp", "desc")
    .onSnapshot(
      (snap) => {
        if (snap.empty) {
          adsList.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">لا توجد إعلانات حالياً</div>`;
          return;
        }

        adsList.innerHTML = snap.docs
          .map((doc) => {
            const d = doc.data() || {};
            const price = Number(d.price) || 0;
            const available = Number(d.availableQuantity ?? d.quantity) || 0;
            const merchantAddress = String(d.merchantAddress || "");

            const action = userActionForMarketTab(marketTab); // buy|sell from user's perspective
            const btnClass = action === "buy" ? "actionBtn actionBtn--green" : "actionBtn actionBtn--red";
            const btnText = action === "buy" ? "شراء" : "بيع";

            return `
              <article class="adCard">
                <div class="adCard__top">
                  <div class="merchant">
                    <span class="avatar">M</span>
                    <span>Merchant_${merchantAddress.slice(-4) || "----"}</span>
                  </div>
                </div>
                <div class="priceRow">
                  <div>
                    <div class="price">${format2(price)} <span class="unit">EGP</span></div>
                    <div class="meta">المتاح: <b>${format2(available)}</b> USDT</div>
                    <div class="meta">الحدود: <b>${format2(d.minLimit)} - ${format2(d.maxLimit)}</b> EGP</div>
                  </div>
                  <button class="${btnClass}" type="button" onclick="openOrder('${doc.id}')">${btnText}</button>
                </div>
              </article>
            `;
          })
          .join("");
      },
      (err) => {
        console.error(err);
        adsList.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">فشل تحميل الإعلانات</div>`;
      }
    );
}

// -----------------------------
// Create Ad
// -----------------------------

function openCreateAd() {
  setPage("createAdPage");
  // keep market list under it; no bottom nav exists in new files
}

function backToMarket() {
  setPage("marketPage");
}

// Applies BUY/SELL mode UI rules.
async function setCreateMode(mode) {
  createMode = mode;

  const buyBtn = document.getElementById("createModeBuy");
  const sellBtn = document.getElementById("createModeSell");
  if (buyBtn) buyBtn.classList.toggle("segmented__btn--active", mode === "buy");
  if (sellBtn) sellBtn.classList.toggle("segmented__btn--active", mode === "sell");

  const sellOnly = document.getElementById("sellOnlyBox");
  if (sellOnly) sellOnly.style.display = mode === "sell" ? "flex" : "none";

  const publishBtn = document.getElementById("publishBtn");
  if (publishBtn) publishBtn.classList.toggle("primaryBtn--red", mode === "sell");

  // When switching to SELL, refresh balance display.
  if (mode === "sell") await refreshWalletBalanceUI();

  validatePublish();
}

// Computes Price * Quantity in real-time for trust/clarity.
function updateTotal() {
  const price = Number(document.getElementById("priceIn")?.value || 0);
  const qty = Number(document.getElementById("quantityIn")?.value || 0);
  const totalEl = document.getElementById("totalAmount");
  if (!totalEl) return;
  totalEl.textContent = format2(price > 0 && qty > 0 ? price * qty : 0);
}

// Enables publish button only when required fields are valid.
function validatePublish() {
  updateTotal();

  const price = Number(document.getElementById("priceIn")?.value || 0);
  const qty = Number(document.getElementById("quantityIn")?.value || 0);
  const minL = Number(document.getElementById("minLimitIn")?.value || 0);
  const maxL = Number(document.getElementById("maxLimitIn")?.value || 0);
  const publishBtn = document.getElementById("publishBtn");
  if (!publishBtn) return;

  const baseValid = price > 0 && qty > 0 && minL > 0 && maxL > 0 && minL <= maxL;
  const maxNotBeyondTotal = baseValid ? maxL <= price * qty : false;

  // In SELL mode, we also require wallet + balance to be >= qty.
  const sellRequiresWallet = createMode === "sell";
  const walletOk = !sellRequiresWallet || !!connectedAddress;

  // Keep simple sync validation; publish() re-checks with async balance.
  publishBtn.disabled = !(baseValid && maxNotBeyondTotal && walletOk);
}

// Pulls actual wallet balance into quantity input (SELL mode only).
async function fillMaxFromWallet() {
  // Why: provides fast correct quantity for merchant SELL ads.
  if (createMode !== "sell") return;
  if (!connectedAddress) return toast("اربط المحفظة أولاً");
  const bal = await getUSDTBalance(connectedAddress);
  const qtyIn = document.getElementById("quantityIn");
  if (qtyIn) qtyIn.value = format2(bal);
  await refreshWalletBalanceUI();
  validatePublish();
}

// Runs the exact 20-second trust sequence, then submits to Firebase.
async function publishAd() {
  // Why: simulates on-chain processing, then saves to Firebase.
  const btn = document.getElementById("publishBtn");
  if (!btn || btn.disabled) return;

  // We always require wallet address as merchant identity.
  if (!connectedAddress) {
    toast("اربط المحفظة أولاً");
    return;
  }

  const price = Number(document.getElementById("priceIn")?.value || 0);
  const qty = Number(document.getElementById("quantityIn")?.value || 0);
  const minLimit = Number(document.getElementById("minLimitIn")?.value || 0);
  const maxLimit = Number(document.getElementById("maxLimitIn")?.value || 0);

  if (!(price > 0 && qty > 0 && minLimit > 0 && maxLimit > 0 && minLimit <= maxLimit)) {
    toast("يرجى تعبئة السعر والكمية والحدود بشكل صحيح");
    return;
  }
  if (maxLimit > price * qty) {
    toast("الحد الأقصى لا يمكن أن يتجاوز إجمالي قيمة الإعلان");
    return;
  }

  // SELL: verify merchant has enough USDT before allowing ad creation.
  if (createMode === "sell") {
    const bal = await getUSDTBalance(connectedAddress);
    if (bal < qty) {
      toast(`رصيدك غير كافٍ. المتاح: ${format2(bal)} USDT`);
      return;
    }
  }

  // Loading UI state (exact text required).
  btn.disabled = true;
  btn.classList.add("is-loading");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>جاري تأمين الشبكة ومعالجة الطلب...</span>`;

  // Wait EXACTLY 20 seconds BEFORE sending data.
  await new Promise((r) => setTimeout(r, 20000));

  try {
    if (!db) throw new Error("Firebase not initialized");

    // Business rule: save as 'buy' or 'sell' exactly as merchant selected.
    const adDoc = {
      type: createMode, // 'buy' shows in SELL list, 'sell' shows in BUY list (handled by query mapping)
      price,
      quantity: qty,
      availableQuantity: qty,
      minLimit,
      maxLimit,
      merchantAddress: connectedAddress,
      status: "active",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("Ads").add(adDoc);

    toast("تم نشر الإعلان بنجاح");

    // Reset form
    ["priceIn", "quantityIn", "minLimitIn", "maxLimitIn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    updateTotal();
    validatePublish();

    backToMarket();
  } catch (e) {
    console.error(e);
    toast("حدث خطأ أثناء نشر الإعلان");
  } finally {
    btn.classList.remove("is-loading");
    btn.innerHTML = originalHTML;
    validatePublish();
  }
}

// -----------------------------
// Orders (user execution)
// -----------------------------

async function openOrder(adId) {
  // Why: opens order modal for user to enter quantity with restrictions.
  if (!db) return toast("Firebase غير جاهز");

  const doc = await db.collection("Ads").doc(adId).get();
  if (!doc.exists) return toast("الإعلان غير موجود");

  const d = doc.data() || {};
  const adType = /** @type {'buy'|'sell'} */ (d.type);

  selectedAd = {
    id: doc.id,
    type: adType,
    price: Number(d.price) || 0,
    availableQuantity: Number(d.availableQuantity ?? d.quantity) || 0,
    merchantAddress: String(d.merchantAddress || ""),
  };

  const overlay = document.getElementById("orderOverlay");
  if (overlay) overlay.style.display = "flex";

  const action = userActionForMarketTab(marketTab);
  const titleEl = document.getElementById("orderTitle");
  const priceEl = document.getElementById("orderPrice");
  const availEl = document.getElementById("orderAvailable");
  const btn = document.getElementById("orderActionBtn");

  if (titleEl) titleEl.textContent = action === "sell" ? "بيع USDT" : "شراء USDT";
  if (priceEl) priceEl.textContent = format2(selectedAd.price);
  if (availEl) availEl.textContent = format2(selectedAd.availableQuantity);
  if (btn) btn.textContent = action === "sell" ? "بيع" : "شراء";

  const qtyIn = document.getElementById("orderQtyIn");
  if (qtyIn) qtyIn.value = "";

  validateOrder();
}

function closeOrder() {
  const overlay = document.getElementById("orderOverlay");
  if (overlay) overlay.style.display = "none";
  selectedAd = null;
}

async function validateOrder() {
  // Why: disables action until quantity is within ad and (if SELL) balance is sufficient.
  const btn = document.getElementById("orderActionBtn");
  const hint = document.getElementById("orderHint");
  const qtyVal = Number(document.getElementById("orderQtyIn")?.value || 0);

  if (!btn || !hint) return;

  hint.style.display = "none";
  hint.textContent = "";

  if (!selectedAd) {
    btn.disabled = true;
    return;
  }

  // Quantity restriction: cannot exceed merchant offered quantity.
  if (!(qtyVal > 0) || qtyVal > selectedAd.availableQuantity) {
    btn.disabled = true;
    if (qtyVal > selectedAd.availableQuantity) {
      hint.style.display = "block";
      hint.textContent = "لا يمكنك إدخال كمية أكبر من المتاح في الإعلان";
    }
    return;
  }

  const action = userActionForMarketTab(marketTab); // sell|buy

  // Balance verification: user cannot SELL unless they have enough USDT.
  if (action === "sell") {
    if (!connectedAddress) {
      btn.disabled = true;
      hint.style.display = "block";
      hint.textContent = "اربط محفظتك للتحقق من الرصيد قبل البيع";
      return;
    }
    const bal = await getUSDTBalance(connectedAddress);
    if (bal < qtyVal) {
      btn.disabled = true;
      hint.style.display = "block";
      hint.textContent = `رصيدك غير كافٍ. المتاح: ${format2(bal)} USDT`;
      return;
    }
  }

  btn.disabled = false;
}

async function confirmOrder() {
  // Why: creates an order record and decrements availableQuantity atomically.
  if (!selectedAd) return;
  if (!db) return toast("Firebase غير جاهز");

  const qty = Number(document.getElementById("orderQtyIn")?.value || 0);
  if (!(qty > 0)) return;

  const action = userActionForMarketTab(marketTab); // user buy|sell
  if (!connectedAddress) return toast("اربط المحفظة أولاً");

  try {
    const adRef = db.collection("Ads").doc(selectedAd.id);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(adRef);
      if (!snap.exists) throw new Error("Ad missing");

      const ad = snap.data() || {};
      const available = Number(ad.availableQuantity ?? ad.quantity) || 0;
      if (qty > available) throw new Error("Not enough available");

      // SELL order: final balance gate (server-side equivalent not possible here; re-check client)
      if (action === "sell") {
        const bal = await getUSDTBalance(connectedAddress);
        if (bal < qty) throw new Error("Insufficient balance");
      }

      // Decrease available quantity
      tx.update(adRef, { availableQuantity: available - qty });

      // Create order record (ready for backend/escrow later)
      const orderRef = db.collection("Orders").doc();
      tx.set(orderRef, {
        adId: selectedAd.id,
        adType: ad.type,
        merchantAddress: selectedAd.merchantAddress,
        userAddress: connectedAddress,
        userAction: action, // 'buy' or 'sell'
        price: selectedAd.price,
        quantity: qty,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    toast("تم إنشاء الطلب");
    closeOrder();
  } catch (e) {
    console.error(e);
    toast("تعذر إنشاء الطلب");
  }
}

// -----------------------------
// Boot
// -----------------------------

function bindInputs() {
  // Why: keep one source of truth and real-time calculations.
  ["priceIn", "quantityIn", "minLimitIn", "maxLimitIn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", validatePublish);
  });
}

window.connectWallet = connectWallet;
window.openCreateAd = openCreateAd;
window.backToMarket = backToMarket;
window.setMarketTab = setMarketTab;
window.setCreateMode = setCreateMode;
window.fillMaxFromWallet = fillMaxFromWallet;
window.publishAd = publishAd;
window.openOrder = openOrder;
window.closeOrder = closeOrder;
window.validateOrder = validateOrder;
window.confirmOrder = confirmOrder;

document.addEventListener("DOMContentLoaded", async () => {
  bindInputs();
  await setCreateMode("buy");
  setMarketTab("sell");
  subscribeAds();
});

