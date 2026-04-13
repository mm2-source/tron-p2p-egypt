/* eslint-disable no-console */

// -----------------------------
// orders.js (Modular)
// -----------------------------
// Why this file exists:
// - Order creation workflow (uses Ads availability)
// - Orders list tabs: Active / Completed / Canceled
// - Countdown + payment confirmation + release logic (escrow placeholder)

window.P2P = window.P2P || {};
window.P2P.orders = window.P2P.orders || {};
window.P2P.state = window.P2P.state || {};

const db = window.db;
const ORDER_WINDOW_MS = 15 * 60 * 1000;

window.P2P.state.ordersTab = window.P2P.state.ordersTab || "active";

/** @type {null | {id: string, type: 'buy'|'sell', price: number, availableQuantity: number, merchantAddress: string}} */
let selectedAd = null;

let unsubOrders = null;

function userActionForMarketTab(tab) {
  // Must match ads.js business logic.
  return tab === "sell" ? "sell" : "buy";
}

async function openOrder(adId) {
  if (!db) return window.P2P.toast("Firebase غير جاهز");

  const doc = await db.collection("Ads").doc(adId).get();
  if (!doc.exists) return window.P2P.toast("الإعلان غير موجود");

  const d = doc.data() || {};
  selectedAd = {
    id: doc.id,
    type: d.type,
    price: Number(d.price) || 0,
    availableQuantity: Number(d.availableQuantity ?? d.quantity) || 0,
    merchantAddress: String(d.merchantAddress || ""),
  };

  document.getElementById("orderOverlay").style.display = "flex";
  document.getElementById("orderPrice").textContent = window.P2P.utils.format2(selectedAd.price);
  document.getElementById("orderAvailable").textContent = window.P2P.utils.format2(selectedAd.availableQuantity);

  const action = userActionForMarketTab(window.P2P.state.marketTab || "sell");
  document.getElementById("orderTitle").textContent = action === "sell" ? "بيع USDT" : "شراء USDT";
  document.getElementById("orderActionBtn").textContent = action === "sell" ? "بيع" : "شراء";

  const qtyIn = document.getElementById("orderQtyIn");
  if (qtyIn) qtyIn.value = "";
  await validateOrder();
}

function closeOrder() {
  document.getElementById("orderOverlay").style.display = "none";
  selectedAd = null;
}

async function validateOrder() {
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

  if (!(qtyVal > 0) || qtyVal > selectedAd.availableQuantity) {
    btn.disabled = true;
    if (qtyVal > selectedAd.availableQuantity) {
      hint.style.display = "block";
      hint.textContent = "لا يمكنك إدخال كمية أكبر من المتاح في الإعلان";
    }
    return;
  }

  const action = userActionForMarketTab(window.P2P.state.marketTab || "sell");

  // Balance verification: user cannot SELL unless balance is sufficient.
  if (action === "sell") {
    const addr = window.P2P.state.connectedAddress;
    if (!addr) {
      btn.disabled = true;
      hint.style.display = "block";
      hint.textContent = "اربط محفظتك للتحقق من الرصيد قبل البيع";
      return;
    }
    const bal = await window.P2P.getUSDTBalance(addr);
    if (bal < qtyVal) {
      btn.disabled = true;
      hint.style.display = "block";
      hint.textContent = `رصيدك غير كافٍ. المتاح: ${window.P2P.utils.format2(bal)} USDT`;
      return;
    }
  }

  btn.disabled = false;
}

async function confirmOrder() {
  if (!selectedAd) return;
  if (!db) return window.P2P.toast("Firebase غير جاهز");

  const qty = Number(document.getElementById("orderQtyIn")?.value || 0);
  if (!(qty > 0)) return;

  const addr = window.P2P.state.connectedAddress;
  if (!addr) return window.P2P.toast("اربط المحفظة أولاً");

  const action = userActionForMarketTab(window.P2P.state.marketTab || "sell");
  const now = Date.now();
  const expiresAt = now + ORDER_WINDOW_MS;
  let createdOrderId = null;

  try {
    const adRef = db.collection("Ads").doc(selectedAd.id);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(adRef);
      if (!snap.exists) throw new Error("Ad missing");

      const ad = snap.data() || {};
      const available = Number(ad.availableQuantity ?? ad.quantity) || 0;
      if (qty > available) throw new Error("Not enough available");

      if (action === "sell") {
        const bal = await window.P2P.getUSDTBalance(addr);
        if (bal < qty) throw new Error("Insufficient balance");
      }

      tx.update(adRef, { availableQuantity: available - qty });

      const orderRef = db.collection("Orders").doc();
      createdOrderId = orderRef.id;
      tx.set(orderRef, {
        adId: selectedAd.id,
        adType: ad.type,
        merchantAddress: selectedAd.merchantAddress,
        userAddress: addr,
        userAction: action,
        price: selectedAd.price,
        quantity: qty,
        status: "active",
        paymentConfirmed: false,
        released: false,
        expiresAt,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    window.P2P.toast("تم إنشاء الطلب");
    closeOrder();

    // Notify ad owner (optional hook for later push notifications)
    if (createdOrderId) {
      await db.collection("Notifications").add({
        to: selectedAd.merchantAddress,
        from: addr,
        orderId: createdOrderId,
        type: "new_order",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (window.P2P.chat?.openChat) window.P2P.chat.openChat(createdOrderId);
    }
  } catch (e) {
    console.error(e);
    window.P2P.toast("تعذر إنشاء الطلب");
  }
}

function setOrdersTab(tab) {
  window.P2P.state.ordersTab = tab;
  document.getElementById("ordersTabActive")?.classList.toggle("tab--active", tab === "active");
  document.getElementById("ordersTabCompleted")?.classList.toggle("tab--active", tab === "completed");
  document.getElementById("ordersTabCanceled")?.classList.toggle("tab--active", tab === "canceled");
  subscribeOrders();
}

function canCancelOrder(order, myAddr) {
  if (order.userAction === "buy") return order.userAddress === myAddr;
  return order.merchantAddress === myAddr;
}

function subscribeOrders() {
  if (!db) return;
  const addr = window.P2P.state.connectedAddress;
  if (!addr) return;
  if (typeof unsubOrders === "function") unsubOrders();

  const list = document.getElementById("ordersList");
  if (!list) return;

  unsubOrders = db
    .collection("Orders")
    .where("status", "==", window.P2P.state.ordersTab)
    .onSnapshot((snap) => {
      const mine = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => o.userAddress === addr || o.merchantAddress === addr);

      if (mine.length === 0) {
        list.innerHTML = `<div class="meta" style="text-align:center; padding: 30px 0;">لا توجد طلبات</div>`;
        return;
      }

      list.innerHTML = mine
        .sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0))
        .map((o) => {
          const isMerchant = o.merchantAddress === addr;
          const actionLabel = o.userAction === "buy" ? "شراء" : "بيع";

          const showRelease = isMerchant && o.userAction === "buy" && o.paymentConfirmed && !o.released && o.status === "active";
          const showPayConfirm = !isMerchant && o.userAction === "buy" && !o.paymentConfirmed && o.status === "active";
          const showCancel = o.status === "active" && canCancelOrder(o, addr);

          return `
            <article class="adCard">
              <div class="adCard__top">
                <div class="merchant">
                  <span class="avatar">#</span>
                  <span>${o.id}</span>
                </div>
                <button class="icon-btn" type="button" onclick="openChat('${o.id}')" aria-label="Chat"><i class="fa-solid fa-comments"></i></button>
              </div>
              <div class="meta">نوع: <b>${actionLabel}</b> • الكمية: <b>${window.P2P.utils.format2(o.quantity)}</b> USDT • السعر: <b>${window.P2P.utils.format2(o.price)}</b> EGP</div>
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
  await db.collection("Orders").doc(orderId).update({
    paymentConfirmed: true,
    paymentConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  window.P2P.toast("تم تأكيد الدفع");
}

async function cancelOrder(orderId) {
  await db.collection("Orders").doc(orderId).update({
    status: "canceled",
    canceledAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  window.P2P.toast("تم إلغاء الطلب");
}

async function releaseOrder(orderId) {
  // ESCROW CONTRACT PLACEHOLDER:
  // await releaseUSDT(orderId)
  await db.collection("Orders").doc(orderId).update({
    released: true,
    status: "completed",
    releasedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  window.P2P.toast("تم التحرير");
}

// Expose globals used by HTML handlers.
window.openOrder = openOrder;
window.closeOrder = closeOrder;
window.validateOrder = validateOrder;
window.confirmOrder = confirmOrder;
window.setOrdersTab = setOrdersTab;
window.confirmPayment = confirmPayment;
window.cancelOrder = cancelOrder;
window.releaseOrder = releaseOrder;

document.addEventListener("p2p:walletConnected", () => {
  subscribeOrders();
});

