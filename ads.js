/* eslint-disable no-console */

// -----------------------------
// ads.js (Modular)
// -----------------------------
// Why this file exists:
// - Market listing (P2P page)
// - Ad creation (20s trust sequence)
// - My Ads control panel (Active/Inactive tabs, edit, delete, empty state)
// - Global navigation between pages + header (+) visibility logic

window.P2P = window.P2P || {};
window.P2P.ads = window.P2P.ads || {};
window.P2P.state = window.P2P.state || {};

const db = window.db;

// Shared state
window.P2P.state.marketTab = window.P2P.state.marketTab || "sell"; // user-facing tabs: buy|sell
window.P2P.state.createMode = window.P2P.state.createMode || "buy"; // merchant intent: buy|sell
window.P2P.state.currentPageKey = window.P2P.state.currentPageKey || "p2p";
window.P2P.state.myAdsTab = window.P2P.state.myAdsTab || "active"; // active|inactive

let unsubscribeAds = null;
let unsubMyAds = null;

function setPage(pageId) {
  const pages = ["marketPage", "createAdPage", "ordersPage", "adsPage", "chatPage", "profilePage"];
  pages.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("page--active", id === pageId);
  });

  const bottomNav = document.getElementById("bottomNav");
  if (bottomNav) bottomNav.style.display = pageId === "createAdPage" ? "none" : "flex";

  updateHeaderForPageId(pageId);
}

function updateHeaderForPageId(pageId) {
  const mapBack = {
    marketPage: "p2p",
    ordersPage: "orders",
    adsPage: "ads",
    chatPage: "chat",
    profilePage: "profile",
    createAdPage: "createAd",
  };
  updateHeaderForPageKey(mapBack[pageId] || "p2p");
}

function updateHeaderForPageKey(pageKey) {
  window.P2P.state.currentPageKey = pageKey;
  const plusBtn = document.getElementById("headerPlusBtn");
  const bal = document.getElementById("headerBalance");
  if (!plusBtn || !bal) return;

  // (+) ONLY on My Ads page header
  plusBtn.style.display = pageKey === "ads" ? "inline-flex" : "none";
  // Balance on P2P / Orders / Chat / Profile
  bal.style.display = ["p2p", "orders", "chat", "profile"].includes(pageKey) ? "inline-flex" : "none";

  if (["p2p", "orders", "chat", "profile"].includes(pageKey) && window.P2P.refreshHeaderBalanceUI) {
    window.P2P.refreshHeaderBalanceUI();
  }
}

function navTo(pageKey) {
  window.P2P.state.currentPageKey = pageKey;
  const map = {
    p2p: "marketPage",
    orders: "ordersPage",
    ads: "adsPage",
    chat: "chatPage",
    profile: "profilePage",
  };
  setPage(map[pageKey] || "marketPage");

  const items = document.querySelectorAll(".bottomNav__item");
  items.forEach((el) => el.classList.remove("bottomNav__item--active"));
  const idx = { p2p: 0, orders: 1, ads: 2, chat: 3, profile: 4 }[pageKey] ?? 0;
  if (items[idx]) items[idx].classList.add("bottomNav__item--active");

  updateHeaderForPageKey(pageKey);

  // Kick subscribers when opening a page
  if (pageKey === "ads") subscribeMyAds();
  if (pageKey === "p2p") subscribeAds();
}

// Business rule:
// - Merchant creates BUY ad => stored type 'buy' => shown under user SELL tab
// - Merchant creates SELL ad => stored type 'sell' => shown under user BUY tab
function firestoreTypeForMarketTab(tab) {
  return tab === "sell" ? "buy" : "sell";
}

function userActionForMarketTab(tab) {
  return tab === "sell" ? "sell" : "buy";
}

function setMarketTab(tab) {
  window.P2P.state.marketTab = tab;
  document.getElementById("tabBuy")?.classList.toggle("tab--active", tab === "buy");
  document.getElementById("tabSell")?.classList.toggle("tab--active", tab === "sell");
  subscribeAds();
}

function subscribeAds() {
  if (!db) return;
  if (typeof unsubscribeAds === "function") unsubscribeAds();

  const adsList = document.getElementById("adsList");
  if (!adsList) return;
  adsList.innerHTML = "";

  const wantedType = firestoreTypeForMarketTab(window.P2P.state.marketTab);

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

        const action = userActionForMarketTab(window.P2P.state.marketTab);
        adsList.innerHTML = snap.docs
          .map((doc) => {
            const d = doc.data() || {};
            const price = Number(d.price) || 0;
            const available = Number(d.availableQuantity ?? d.quantity) || 0;
            const merchantAddress = String(d.merchantAddress || "");

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
                    <div class="price">${window.P2P.utils.format2(price)} <span class="unit">EGP</span></div>
                    <div class="meta">المتاح: <b>${window.P2P.utils.format2(available)}</b> USDT</div>
                    <div class="meta">الحدود: <b>${window.P2P.utils.format2(d.minLimit)} - ${window.P2P.utils.format2(d.maxLimit)}</b> EGP</div>
                  </div>
                  <button class="${btnClass}" type="button" onclick="openOrder('${doc.id}')">${btnText}</button>
                </div>
              </article>
            `;
          })
          .join("");
      },
      () => {
        adsList.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">فشل تحميل الإعلانات</div>`;
      }
    );
}

function openCreateAd() {
  setPage("createAdPage");
}

function showCreateAdForm() {
  // Why: single, clean entry-point used by My Ads empty state button.
  openCreateAd();
}

function backToMarket() {
  navTo("p2p");
}

async function setCreateMode(mode) {
  window.P2P.state.createMode = mode;

  document.getElementById("createModeBuy")?.classList.toggle("segmented__btn--active", mode === "buy");
  document.getElementById("createModeSell")?.classList.toggle("segmented__btn--active", mode === "sell");

  const sellOnly = document.getElementById("sellOnlyBox");
  if (sellOnly) sellOnly.style.display = mode === "sell" ? "flex" : "none";

  const publishBtn = document.getElementById("publishBtn");
  if (publishBtn) publishBtn.classList.toggle("primaryBtn--red", mode === "sell");

  if (mode === "sell" && window.P2P.refreshWalletBalanceUI) await window.P2P.refreshWalletBalanceUI();
  validatePublish();
}

function togglePaymentDropdown() {
  const dd = document.getElementById("paymentDropdown");
  if (!dd) return;
  dd.style.display = dd.style.display === "none" || !dd.style.display ? "block" : "none";
}

function selectPayment(v) {
  const t = document.getElementById("selectedPaymentText");
  if (t) t.textContent = v;
  const dd = document.getElementById("paymentDropdown");
  if (dd) dd.style.display = "none";
  validatePublish();
}

function updateTotal() {
  const price = Number(document.getElementById("priceIn")?.value || 0);
  const qty = Number(document.getElementById("quantityIn")?.value || 0);
  const totalEl = document.getElementById("totalAmount");
  if (!totalEl) return;
  totalEl.textContent = window.P2P.utils.format2(price > 0 && qty > 0 ? price * qty : 0);
}

function validatePublish() {
  updateTotal();

  const price = Number(document.getElementById("priceIn")?.value || 0);
  const qty = Number(document.getElementById("quantityIn")?.value || 0);
  const minL = Number(document.getElementById("minLimitIn")?.value || 0);
  const maxL = Number(document.getElementById("maxLimitIn")?.value || 0);
  const payment = (document.getElementById("selectedPaymentText")?.textContent || "").trim();

  const publishBtn = document.getElementById("publishBtn");
  if (!publishBtn) return;

  const baseValid = price > 0 && qty > 0 && minL > 0 && maxL > 0 && minL <= maxL;
  const maxNotBeyondTotal = baseValid ? maxL <= price * qty : false;
  const paymentOk = payment && payment !== "اختر طريقة الدفع";

  // SELL requires wallet connected; async balance is checked inside publishAd()
  const sellRequiresWallet = window.P2P.state.createMode === "sell";
  const walletOk = !sellRequiresWallet || !!window.P2P.state.connectedAddress;

  publishBtn.disabled = !(baseValid && maxNotBeyondTotal && paymentOk && walletOk);
}

async function fillMaxFromWallet() {
  if (window.P2P.state.createMode !== "sell") return;
  const addr = window.P2P.state.connectedAddress;
  if (!addr) return window.P2P.toast("اربط المحفظة أولاً");
  const bal = await window.P2P.getUSDTBalance(addr);
  const qtyIn = document.getElementById("quantityIn");
  if (qtyIn) qtyIn.value = window.P2P.utils.format2(bal);
  if (window.P2P.refreshWalletBalanceUI) await window.P2P.refreshWalletBalanceUI();
  validatePublish();
}

async function publishAd() {
  const btn = document.getElementById("publishBtn");
  if (!btn || btn.disabled) return;

  const addr = window.P2P.state.connectedAddress;
  if (!addr) return window.P2P.toast("اربط المحفظة أولاً");

  const price = Number(document.getElementById("priceIn")?.value || 0);
  const qty = Number(document.getElementById("quantityIn")?.value || 0);
  const minLimit = Number(document.getElementById("minLimitIn")?.value || 0);
  const maxLimit = Number(document.getElementById("maxLimitIn")?.value || 0);
  const paymentMethod = (document.getElementById("selectedPaymentText")?.textContent || "").trim();

  if (!(price > 0 && qty > 0 && minLimit > 0 && maxLimit > 0 && minLimit <= maxLimit)) {
    return window.P2P.toast("يرجى تعبئة السعر والكمية والحدود بشكل صحيح");
  }
  if (!paymentMethod || paymentMethod === "اختر طريقة الدفع") return window.P2P.toast("يرجى اختيار طريقة الدفع");
  if (maxLimit > price * qty) return window.P2P.toast("الحد الأقصى لا يمكن أن يتجاوز إجمالي قيمة الإعلان");

  // Merchant SELL must have enough balance
  if (window.P2P.state.createMode === "sell") {
    const bal = await window.P2P.getUSDTBalance(addr);
    if (bal < qty) return window.P2P.toast(`رصيدك غير كافٍ. المتاح: ${window.P2P.utils.format2(bal)} USDT`);
  }

  btn.disabled = true;
  btn.classList.add("is-loading");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>جاري تأمين الشبكة ومعالجة الطلب...</span>`;

  await new Promise((r) => setTimeout(r, 20000));

  try {
    const editingId = btn.dataset.editingId || "";
    const adDoc = {
      type: window.P2P.state.createMode,
      price,
      quantity: qty,
      availableQuantity: qty,
      minLimit,
      maxLimit,
      paymentMethod,
      merchantAddress: addr,
      status: "active",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (editingId) {
      await db.collection("Ads").doc(editingId).update({
        type: adDoc.type,
        price: adDoc.price,
        quantity: adDoc.quantity,
        availableQuantity: adDoc.availableQuantity,
        minLimit: adDoc.minLimit,
        maxLimit: adDoc.maxLimit,
        paymentMethod: adDoc.paymentMethod,
        status: "active",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      delete btn.dataset.editingId;
    } else {
      await db.collection("Ads").add(adDoc);
    }

    window.P2P.toast("تم نشر الإعلان بنجاح");

    ["priceIn", "quantityIn", "minLimitIn", "maxLimitIn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    document.getElementById("selectedPaymentText").textContent = "اختر طريقة الدفع";
    updateTotal();
    validatePublish();

    navTo("ads");
  } catch (e) {
    console.error(e);
    window.P2P.toast("حدث خطأ أثناء نشر الإعلان");
  } finally {
    btn.classList.remove("is-loading");
    btn.innerHTML = originalHTML;
    validatePublish();
  }
}

function setMyAdsTab(tab) {
  window.P2P.state.myAdsTab = tab;
  document.getElementById("myAdsTabActive")?.classList.toggle("tab--active", tab === "active");
  document.getElementById("myAdsTabInactive")?.classList.toggle("tab--active", tab === "inactive");
  subscribeMyAds();
}

function subscribeMyAds() {
  if (!db) return;
  const addr = window.P2P.state.connectedAddress;
  if (!addr) return;
  if (typeof unsubMyAds === "function") unsubMyAds();

  const list = document.getElementById("myAdsList");
  const empty = document.getElementById("myAdsEmpty");
  const activeCount = document.getElementById("myAdsActiveCount");
  if (!list) return;

  // We keep one listener and filter in memory to avoid double subscriptions.
  unsubMyAds = db
    .collection("Ads")
    .where("merchantAddress", "==", addr)
    .orderBy("timestamp", "desc")
    .onSnapshot((snap) => {
      const ads = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

      const activeAds = ads.filter((a) => a.status === "active");
      if (activeCount) activeCount.textContent = String(activeAds.length);

      const tab = window.P2P.state.myAdsTab;
      const filtered = tab === "active" ? activeAds : ads.filter((a) => a.status !== "active");

      if (filtered.length === 0) {
        list.innerHTML = "";
        if (empty) empty.style.display = "block";
        return;
      }

      if (empty) empty.style.display = "none";

      list.innerHTML = filtered
        .map((a) => {
          const amount = Number(a.quantity) || 0;
          const available = Number(a.availableQuantity ?? a.quantity) || 0;

          return `
            <article class="adCard">
              <div class="adCard__top">
                <div class="merchant">
                  <span class="avatar">M</span>
                  <span>${a.id}</span>
                </div>
                ${a.status === "active" ? `<span class="badge">نشط</span>` : ``}
              </div>

              <div class="priceRow">
                <div>
                  <div class="price">${window.P2P.utils.format2(a.price)} <span class="unit">EGP</span></div>
                  <div class="meta">الحدود: <b>${window.P2P.utils.format2(a.minLimit)} - ${window.P2P.utils.format2(a.maxLimit)}</b> EGP</div>
                  <div class="meta">الكمية: <b>${window.P2P.utils.format2(amount)}</b> USDT • المتاح: <b>${window.P2P.utils.format2(available)}</b> USDT</div>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                  <button class="actionBtn actionBtn--green" type="button" onclick="editMyAd('${a.id}')">تعديل</button>
                  <button class="actionBtn actionBtn--red" type="button" onclick="cancelMyAd('${a.id}')">إلغاء</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    });
}

async function editMyAd(adId) {
  if (!db) return;
  const doc = await db.collection("Ads").doc(adId).get();
  if (!doc.exists) return window.P2P.toast("الإعلان غير موجود");
  const a = doc.data() || {};

  document.getElementById("priceIn").value = a.price ?? "";
  document.getElementById("quantityIn").value = a.quantity ?? "";
  document.getElementById("minLimitIn").value = a.minLimit ?? "";
  document.getElementById("maxLimitIn").value = a.maxLimit ?? "";
  document.getElementById("selectedPaymentText").textContent = a.paymentMethod || "اختر طريقة الدفع";

  await setCreateMode(a.type === "sell" ? "sell" : "buy");

  const publishBtn = document.getElementById("publishBtn");
  if (publishBtn) publishBtn.dataset.editingId = adId;

  openCreateAd();
  validatePublish();
}

async function cancelMyAd(adId) {
  const ok = confirm("هل أنت متأكد من إلغاء هذا الإعلان؟");
  if (!ok) return;
  await db.collection("Ads").doc(adId).delete();
  window.P2P.toast("تم إلغاء الإعلان");
}

function bindAdsInputs() {
  ["priceIn", "quantityIn", "minLimitIn", "maxLimitIn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", validatePublish);
  });
}

// Expose globals for inline HTML handlers (keeps HTML clean).
window.navTo = navTo;
window.setMarketTab = setMarketTab;
window.openCreateAd = openCreateAd;
window.showCreateAdForm = showCreateAdForm;
window.backToMarket = backToMarket;
window.setCreateMode = setCreateMode;
window.fillMaxFromWallet = fillMaxFromWallet;
window.togglePaymentDropdown = togglePaymentDropdown;
window.selectPayment = selectPayment;
window.publishAd = publishAd;
window.setMyAdsTab = setMyAdsTab;
window.editMyAd = editMyAd;
window.cancelMyAd = cancelMyAd;

document.addEventListener("DOMContentLoaded", async () => {
  bindAdsInputs();
  await setCreateMode("buy");
  setMarketTab("sell");
  navTo("p2p");
  subscribeAds();
});

document.addEventListener("p2p:walletConnected", () => {
  // After wallet connects, refresh dependent sections.
  subscribeMyAds();
  if (window.P2P.refreshWalletBalanceUI) window.P2P.refreshWalletBalanceUI();
  validatePublish();
});

