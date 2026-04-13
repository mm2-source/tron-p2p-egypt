/* eslint-disable no-console */

// -----------------------------
// P2P Ecosystem (Production)
// -----------------------------
// Business logic highlights (P2P reverse reaction):
// - Merchant BUY ad => stored type 'buy' => shown under user SELL tab (user sells to merchant)
// - Merchant SELL ad => stored type 'sell' => shown under user BUY tab (user buys from merchant)
// - Merchant SELL requires verified USDT balance (TronLink)
// - User cannot open SELL order unless USDT balance is sufficient
// - Orders create instant chat + countdown timer + notifications
//
// ESCROW CONTRACT PLACEHOLDER:
// - This is where we will integrate TronLink lock/unlock logic (lockUSDT/releaseUSDT)

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const ORDER_WINDOW_MS = 15 * 60 * 1000;

/** @type {'buy'|'sell'} */
let marketTab = "sell"; // user-facing market tab
/** @type {'buy'|'sell'} */
let createMode = "buy"; // merchant intent

/** @type {'active'|'completed'|'canceled'} */
let ordersTab = "active";

/** @type {import('firebase/firestore').Firestore | any} */
const db = window.db; // provided by firebase-config.js
const rtdb = window.rtdb; // provided by firebase-config.js (realtime chat)
const storage = window.storage; // provided by firebase-config.js (chat images)

/** @type {any} */
let tronWeb = null;
/** @type {string | null} */
let connectedAddress = null;

/** @type {null | {id: string, type: 'buy'|'sell', price: number, availableQuantity: number, merchantAddress: string}} */
let selectedAd = null;

/** @type {null | {id:string, expiresAt:number, orderDoc:any}} */
let activeChat = null;
let chatUnsub = null;
let chatTimerInt = null;

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
  const pages = ["marketPage", "createAdPage", "ordersPage", "adsPage", "chatPage", "profilePage"];
  pages.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("page--active", id === pageId);
  });

  // Keep bottom nav behind / hidden for create ad + chat overlays
  const bottomNav = document.getElementById("bottomNav");
  if (bottomNav) {
    bottomNav.style.display = pageId === "createAdPage" ? "none" : "flex";
  }
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
    renderProfile();
    subscribeOrders();
    subscribeMyAds();
    subscribeChatList();
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
          adsList.innerHTML = `
            <div style="text-align:center; padding: 34px 0;">
              <div style="font-size:36px; color: var(--muted);"><i class="fa-solid fa-circle-notch"></i></div>
              <div class="meta" style="margin-top:10px;">
                لم يتم العثور على إعلانات. أنشئ إعلاناً لشراء العملات الرقمية أو بيعها.
              </div>
            </div>
          `;
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

  // Payment method required (professional exchanges require it)
  const payment = (document.getElementById("selectedPaymentText")?.textContent || "").trim();
  const paymentOk = payment && payment !== "اختر طريقة الدفع";

  // In SELL mode, we also require wallet + balance to be >= qty.
  const sellRequiresWallet = createMode === "sell";
  const walletOk = !sellRequiresWallet || !!connectedAddress;

  // Keep simple sync validation; publish() re-checks with async balance.
  publishBtn.disabled = !(baseValid && maxNotBeyondTotal && walletOk && paymentOk);
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
  const paymentMethod = (document.getElementById("selectedPaymentText")?.textContent || "").trim();

  if (!(price > 0 && qty > 0 && minLimit > 0 && maxLimit > 0 && minLimit <= maxLimit)) {
    toast("يرجى تعبئة السعر والكمية والحدود بشكل صحيح");
    return;
  }
  if (!paymentMethod || paymentMethod === "اختر طريقة الدفع") {
    toast("يرجى اختيار طريقة الدفع");
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
      paymentMethod,
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
    const selectedPaymentText = document.getElementById("selectedPaymentText");
    if (selectedPaymentText) selectedPaymentText.textContent = "اختر طريقة الدفع";
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
    const now = Date.now();
    const expiresAt = now + ORDER_WINDOW_MS;
    let createdOrderId = null;

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
      createdOrderId = orderRef.id;
      tx.set(orderRef, {
        adId: selectedAd.id,
        adType: ad.type,
        merchantAddress: selectedAd.merchantAddress,
        userAddress: connectedAddress,
        userAction: action, // 'buy' or 'sell'
        price: selectedAd.price,
        quantity: qty,
        status: "active",
        paymentConfirmed: false, // buyer confirms payment
        released: false, // merchant releases coins after confirmation (escrow)
        expiresAt, // client millis for countdown
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    toast("تم إنشاء الطلب");
    closeOrder();

    // Notify ad owner (lightweight notification record)
    if (createdOrderId) {
      await db.collection("Notifications").add({
        to: selectedAd.merchantAddress,
        from: connectedAddress,
        orderId: createdOrderId,
        type: "new_order",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      openChat(createdOrderId);
    }
  } catch (e) {
    console.error(e);
    toast("تعذر إنشاء الطلب");
  }
}

// -----------------------------
// Orders UI + Chat + Nav
// -----------------------------

function bindInputs() {
  // Why: keep one source of truth and real-time calculations.
  ["priceIn", "quantityIn", "minLimitIn", "maxLimitIn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", validatePublish);
  });
}

// ---- Payment dropdown (create ad) ----
let selectedPayment = "";
function togglePaymentDropdown() {
  const dd = document.getElementById("paymentDropdown");
  if (!dd) return;
  dd.style.display = dd.style.display === "none" || !dd.style.display ? "block" : "none";
}
function selectPayment(v) {
  selectedPayment = v;
  const t = document.getElementById("selectedPaymentText");
  if (t) t.textContent = v;
  const dd = document.getElementById("paymentDropdown");
  if (dd) dd.style.display = "none";
  validatePublish();
}

// ---- Nav ----
function navTo(page) {
  const map = {
    p2p: "marketPage",
    orders: "ordersPage",
    ads: "adsPage",
    chat: "chatPage",
    profile: "profilePage",
  };
  const target = map[page] || "marketPage";
  setPage(target);

  const items = document.querySelectorAll(".bottomNav__item");
  items.forEach((el) => el.classList.remove("bottomNav__item--active"));
  const idx = { p2p: 0, orders: 1, ads: 2, chat: 3, profile: 4 }[page] ?? 0;
  if (items[idx]) items[idx].classList.add("bottomNav__item--active");
}

// ---- Orders ----
let unsubOrders = null;
function setOrdersTab(tab) {
  ordersTab = tab;
  document.getElementById("ordersTabActive")?.classList.toggle("tab--active", tab === "active");
  document.getElementById("ordersTabCompleted")?.classList.toggle("tab--active", tab === "completed");
  document.getElementById("ordersTabCanceled")?.classList.toggle("tab--active", tab === "canceled");
  subscribeOrders();
}

function canCancelOrder(order, myAddr) {
  // Buyer can cancel in 'buy' orders (userAction === 'buy').
  // In 'sell' orders, only the ad owner has control (merchantAddress).
  if (order.userAction === "buy") return order.userAddress === myAddr;
  return order.merchantAddress === myAddr;
}

function subscribeOrders() {
  if (!db) return;
  if (!connectedAddress) return;
  if (typeof unsubOrders === "function") unsubOrders();

  const list = document.getElementById("ordersList");
  if (!list) return;

  unsubOrders = db
    .collection("Orders")
    .where("status", "==", ordersTab)
    .onSnapshot(async (snap) => {
      const mine = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => o.userAddress === connectedAddress || o.merchantAddress === connectedAddress);

      if (mine.length === 0) {
        list.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">لا توجد طلبات</div>`;
        return;
      }

      list.innerHTML = mine
        .sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0))
        .map((o) => {
          const isMerchant = o.merchantAddress === connectedAddress;
          const actionLabel = o.userAction === "buy" ? "شراء" : "بيع";

          // Release button only after buyer confirms payment (for buy flow)
          const showRelease = isMerchant && o.userAction === "buy" && o.paymentConfirmed && !o.released && o.status === "active";
          const showPayConfirm = !isMerchant && o.userAction === "buy" && !o.paymentConfirmed && o.status === "active";
          const showCancel = o.status === "active" && canCancelOrder(o, connectedAddress);

          return `
            <article class="adCard">
              <div class="adCard__top">
                <div class="merchant">
                  <span class="avatar">#</span>
                  <span>${o.id}</span>
                </div>
                <button class="icon-btn" type="button" onclick="openChat('${o.id}')" aria-label="Chat"><i class="fa-solid fa-comments"></i></button>
              </div>
              <div class="meta">نوع: <b>${actionLabel}</b> • الكمية: <b>${format2(o.quantity)}</b> USDT • السعر: <b>${format2(o.price)}</b> EGP</div>
              <div class="priceRow" style="margin-top:12px;">
                <div class="meta">الحالة: <b>${o.status}</b></div>
                <div style="display:flex; gap:10px;">
                  ${showPayConfirm ? `<button class="actionBtn actionBtn--green" type="button" onclick="confirmPayment('${o.id}')">تم الدفع</button>` : ""}
                  ${showRelease ? `<button class="actionBtn actionBtn--green" type="button" onclick="releaseOrder('${o.id}')">تحرير</button>` : ""}
                  ${showCancel ? `<button class="actionBtn actionBtn--red" type="button" onclick="cancelOrder('${o.id}')">إلغاء</button>` : ""}
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    });
}

async function confirmPayment(orderId) {
  // Why: buyer confirmation gate before release.
  await db.collection("Orders").doc(orderId).update({
    paymentConfirmed: true,
    paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  toast("تم تأكيد الدفع");
}

async function cancelOrder(orderId) {
  await db.collection("Orders").doc(orderId).update({
    status: "canceled",
    canceledAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  toast("تم إلغاء الطلب");
}

async function releaseOrder(orderId) {
  // ESCROW CONTRACT PLACEHOLDER:
  // await releaseUSDT(orderId)
  await db.collection("Orders").doc(orderId).update({
    released: true,
    status: "completed",
    releasedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  toast("تم التحرير");
}

// ---- My Ads ----
let unsubMyAds = null;
function subscribeMyAds() {
  if (!db) return;
  if (!connectedAddress) return;
  if (typeof unsubMyAds === "function") unsubMyAds();

  const list = document.getElementById("myAdsList");
  if (!list) return;

  unsubMyAds = db
    .collection("Ads")
    .where("merchantAddress", "==", connectedAddress)
    .orderBy("timestamp", "desc")
    .onSnapshot((snap) => {
      if (snap.empty) {
        list.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">لا توجد إعلانات</div>`;
        return;
      }
      list.innerHTML = snap.docs
        .map((d) => {
          const a = d.data() || {};
          return `
            <article class="adCard">
              <div class="adCard__top">
                <div class="merchant">
                  <span class="avatar">M</span>
                  <span>${d.id}</span>
                </div>
              </div>
              <div class="meta">النوع: <b>${a.type}</b> • المتاح: <b>${format2(a.availableQuantity)}</b> USDT</div>
              <div class="meta">الحدود: <b>${format2(a.minLimit)} - ${format2(a.maxLimit)}</b> EGP</div>
              <div class="priceRow" style="margin-top:12px;">
                <div class="price">${format2(a.price)} <span class="unit">EGP</span></div>
                <button class="actionBtn actionBtn--red" type="button" onclick="deactivateAd('${d.id}')">إيقاف</button>
              </div>
            </article>
          `;
        })
        .join("");
    });
}

async function deactivateAd(adId) {
  await db.collection("Ads").doc(adId).update({ status: "inactive" });
  toast("تم إيقاف الإعلان");
}

// ---- Chat list ----
let unsubChatList = null;
function subscribeChatList() {
  if (!db) return;
  if (!connectedAddress) return;
  if (typeof unsubChatList === "function") unsubChatList();

  const list = document.getElementById("chatList");
  if (!list) return;

  unsubChatList = db
    .collection("Orders")
    .where("status", "==", "active")
    .onSnapshot((snap) => {
      const mine = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => o.userAddress === connectedAddress || o.merchantAddress === connectedAddress);

      if (mine.length === 0) {
        list.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">لا توجد محادثات</div>`;
        return;
      }

      list.innerHTML = mine
        .map((o) => {
          const peer = o.userAddress === connectedAddress ? o.merchantAddress : o.userAddress;
          return `
            <article class="adCard">
              <div class="adCard__top">
                <div class="merchant">
                  <span class="avatar"><i class="fa-solid fa-comments"></i></span>
                  <span>Order ${o.id}</span>
                </div>
                <button class="actionBtn actionBtn--green" type="button" onclick="openChat('${o.id}')">فتح</button>
              </div>
              <div class="meta">الطرف الآخر: <b>${String(peer).slice(0,4)}...${String(peer).slice(-4)}</b></div>
            </article>
          `;
        })
        .join("");
    });
}

// ---- Chat overlay + realtime messages ----
async function openChat(orderId) {
  if (!db) return;
  if (!connectedAddress) return toast("اربط المحفظة أولاً");

  const doc = await db.collection("Orders").doc(orderId).get();
  if (!doc.exists) return toast("الطلب غير موجود");

  const o = doc.data() || {};
  activeChat = { id: orderId, expiresAt: Number(o.expiresAt || (Date.now() + ORDER_WINDOW_MS)), orderDoc: o };

  const overlay = document.getElementById("chatOverlay");
  if (overlay) overlay.style.display = "flex";
  const idEl = document.getElementById("chatOrderId");
  if (idEl) idEl.textContent = `طلب: ${orderId}`;

  startChatTimer(activeChat.expiresAt);
  subscribeChatMessages(orderId);
}

function closeChat() {
  const overlay = document.getElementById("chatOverlay");
  if (overlay) overlay.style.display = "none";
  if (typeof chatUnsub === "function") chatUnsub();
  chatUnsub = null;
  activeChat = null;
  if (chatTimerInt) clearInterval(chatTimerInt);
  chatTimerInt = null;
}

function startChatTimer(expiresAt) {
  const timerEl = document.getElementById("chatTimer");
  if (chatTimerInt) clearInterval(chatTimerInt);
  chatTimerInt = setInterval(() => {
    const remain = Math.max(0, expiresAt - Date.now());
    const s = Math.floor(remain / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;
    if (remain <= 0) {
      clearInterval(chatTimerInt);
      chatTimerInt = null;
    }
  }, 1000);
}

function subscribeChatMessages(orderId) {
  if (!rtdb) return;
  const body = document.getElementById("chatBody");
  if (!body) return;

  const ref = rtdb.ref(`chats/${orderId}`);
  ref.off();
  ref.on("value", (snap) => {
    const raw = snap.val();
    const msgs = raw ? Object.values(raw) : [];
    body.innerHTML = msgs
      .sort((a, b) => (a.time || 0) - (b.time || 0))
      .map((m) => {
        const mine = m.sender === connectedAddress;
        const img = m.imageUrl ? `<img class="msg__img" src="${m.imageUrl}" alt="image" />` : "";
        return `
          <div class="msg ${mine ? "msg--me" : "msg--them"}">
            <div>${m.text ? String(m.text).replace(/</g, "&lt;") : ""}</div>
            ${img}
            <div class="msg__time">${new Date(m.time || Date.now()).toLocaleTimeString("ar-EG")}</div>
          </div>
        `;
      })
      .join("");
    body.scrollTop = body.scrollHeight;
  });

  chatUnsub = () => ref.off();
}

async function sendChatMessage() {
  if (!activeChat || !rtdb) return;
  if (!connectedAddress) return;

  const textEl = document.getElementById("chatText");
  const fileEl = document.getElementById("chatImage");
  const text = (textEl?.value || "").trim();
  const file = fileEl?.files?.[0] || null;
  if (!text && !file) return;

  let imageUrl = "";

  // Image upload support (Firebase Storage) with fallback to text-only
  if (file && storage) {
    try {
      const path = `chat-images/${activeChat.id}/${Date.now()}_${file.name}`;
      const ref = storage.ref().child(path);
      await ref.put(file);
      imageUrl = await ref.getDownloadURL();
    } catch (e) {
      console.error(e);
      toast("تعذر رفع الصورة");
    }
  }

  await rtdb.ref(`chats/${activeChat.id}`).push({
    sender: connectedAddress,
    text,
    imageUrl: imageUrl || null,
    time: Date.now(),
  });

  if (textEl) textEl.value = "";
  if (fileEl) fileEl.value = "";
}

// ---- Profile ----
function renderProfile() {
  const el = document.getElementById("profileAddress");
  if (!el) return;
  if (!connectedAddress) {
    el.textContent = "—";
    return;
  }
  el.textContent = `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-6)}`;
}

// ---- Filters (UI placeholders) ----
function openCurrencySelector() { toast("EGP"); }
function openAmountFilter() { toast("قريباً"); }
function openPaymentFilter() { toast("قريباً"); }
function openMoreFilters() { toast("قريباً"); }

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
window.togglePaymentDropdown = togglePaymentDropdown;
window.selectPayment = selectPayment;
window.navTo = navTo;
window.setOrdersTab = setOrdersTab;
window.openChat = openChat;
window.closeChat = closeChat;
window.sendChatMessage = sendChatMessage;
window.openCurrencySelector = openCurrencySelector;
window.openAmountFilter = openAmountFilter;
window.openPaymentFilter = openPaymentFilter;
window.openMoreFilters = openMoreFilters;

document.addEventListener("DOMContentLoaded", async () => {
  bindInputs();
  await setCreateMode("buy");
  setMarketTab("sell");
  subscribeAds();
  setOrdersTab("active");
  navTo("p2p");
});

