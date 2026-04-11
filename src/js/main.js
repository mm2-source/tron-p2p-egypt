import { connectWallet, getUSDTBalance, tronWebInstance } from './tron.js';
import * as ui from './ui.js';

firebase.initializeApp({
    apiKey: "AIzaSy...",
    authDomain: "mustafa-dbece.firebaseapp.com",
    databaseURL: "https://mustafa-dbece-default-rtdb.firebaseio.com",
    projectId: "mustafa-dbece"
});

const db = firebase.firestore();
const rtdb = firebase.database();

let marketType = "buy";
let currentOrderId = null;
let chatListener = null;

const ESCROW_CONTRACT = "PUT_CONTRACT_HERE";

// ================= NAV =================
window.changeNav = (page, index) => {
    window.showPage(page);

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.nav-item')[index].classList.add('active');
};

// ================= SHOW PAGE =================
window.showPage = (id) => {
    ui.showPage(id);

    if (id === "p2p") renderMarket();
    if (id === "orders") renderOrders("pending");
    if (id === "ads") renderMyAds();
};

// ================= WALLET =================
window.connectWallet = connectWallet;

// ================= MARKET =================
function renderMarket() {
    const container = document.getElementById("marketList");

    db.collection("ads")
        .where("status", "==", "active")
        .where("type", "==", marketType)
        .onSnapshot(snap => {

            if (snap.empty) {
                container.innerHTML = "لا يوجد عروض";
                return;
            }

            container.innerHTML = snap.docs.map(doc => {
                const a = doc.data();
                const color = a.type === "buy" ? "green" : "red";

                return `
                <div class="border p-3 mb-2">
                    <div>${a.price} EGP</div>
                    <div>${a.amount} USDT</div>
                    <div>${a.payment}</div>
                    <button onclick="openOrder('${doc.id}')" 
                        class="bg-${color}-500 text-white px-4 py-2">
                        دخول
                    </button>
                </div>`;
            }).join('');
        });
}

// ================= OPEN ORDER =================
window.openOrder = async (id) => {

    if (!tronWebInstance) return Swal.fire("اربط المحفظة");

    const doc = await db.collection("ads").doc(id).get();
    const ad = doc.data();

    const myAddr = tronWebInstance.defaultAddress.base58;

    if (ad.owner === myAddr)
        return Swal.fire("لا يمكنك التعامل مع نفسك");

    if (ad.type === "sell") {
        const bal = await getUSDTBalance(myAddr);
        if (bal < ad.amount)
            return Swal.fire("رصيد غير كافي");
    }

    const orderId = "ORD-" + Date.now();

    await db.collection("orders").doc(orderId).set({
        ...ad,
        orderId,
        buyerAddr: myAddr,
        status: "pending",
        isPaid: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + 900000
    });

    rtdb.ref("chats/" + orderId).push({
        sender: "system",
        text: "تم فتح الطلب"
    });

    showPage("orders");
};

// ================= ORDERS =================
function renderOrders(status) {
    const container = document.getElementById("ordersList");

    db.collection("orders")
        .where("status", "==", status)
        .onSnapshot(snap => {

            container.innerHTML = snap.docs.map(d => {
                const o = d.data();

                return `
                <div class="border p-3 mb-2">
                    <div>${o.price}</div>
                    <div>${o.amount}</div>
                    <div>${o.status}</div>

                    <button onclick="openChat('${o.orderId}')">شات</button>

                    ${!o.isPaid ? `<button onclick="confirmPayment('${o.orderId}')">تم الدفع</button>` : ""}

                    ${o.isPaid ? `<button onclick="releaseCrypto('${o.orderId}')">تحرير</button>` : ""}
                </div>`;
            }).join('');
        });
}

// ================= ACTIONS =================
window.confirmPayment = (id) => {
    db.collection("orders").doc(id).update({ isPaid: true });
};

window.releaseCrypto = (id) => {
    db.collection("orders").doc(id).update({ status: "completed" });
};

window.cancelOrder = (id) => {
    db.collection("orders").doc(id).update({ status: "cancelled" });
};

// ================= CHAT =================
window.openChat = (id) => {
    currentOrderId = id;

    document.getElementById("chatBox")?.style?.setProperty("display", "flex");

    if (chatListener) rtdb.ref("chats/" + id).off();

    chatListener = rtdb.ref("chats/" + id).on("value", snap => {
        const data = snap.val() || {};
        const box = document.getElementById("chatMessages");

        box.innerHTML = Object.values(data).map(m =>
            `<div>${m.sender}: ${m.text}</div>`
        ).join('');
    });
};

// ================= INIT =================
window.onload = async () => {
    try { await connectWallet(); } catch {}
    renderMarket();
};
