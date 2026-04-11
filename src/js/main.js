import { connectWallet, getUSDTBalance } from './tron.js';
import * as ui from './ui.js';

// --- تهيئة Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyClJPT4UQsy9XmV4JB34rt0rYUB-FefyXY",
    authDomain: "mustafa-dbece.firebaseapp.com",
    databaseURL: "https://mustafa-dbece-default-rtdb.firebaseio.com",
    projectId: "mustafa-dbece",
    storageBucket: "mustafa-dbece.appspot.com",
    messagingSenderId: "692060842077",
    appId: "1:692060842077:web:04f0598199c58d403d05b4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rtdb = firebase.database();

let marketType = 'buy';
let currentOrderId = null;

// --- مكان وضع عقد حجز العملات (Escrow Contract) ---
const ESCROW_CONTRACT = "YOUR_SMART_CONTRACT_ADDRESS_HERE";

// 1. نشر إعلان مع التحقق
async function validateAndSubmit() {
    const isConnected = await connectWallet();
    if (!isConnected) return;

    const isBuy = document.getElementById('formBuy').classList.contains('bg-white');
    const type = isBuy ? 'buy' : 'sell'; // buy = أخضر (بيع)، sell = أحمر (شراء)
    const price = document.getElementById('inPrice').value;
    const amount = document.getElementById('inAmount').value;
    const min = document.getElementById('inMin').value;
    const max = document.getElementById('inMax').value;
    const payment = document.getElementById('inPayment').value;
    const owner = window.tronLink.tronWeb.defaultAddress.base58;

    if (!price || !amount) return Swal.fire("خطأ", "برجاء إكمال البيانات", "error");

    // التحقق من الرصيد لإعلان البيع (أخضر)
    if (type === 'buy') {
        const bal = await getUSDTBalance(owner);
        if (bal < parseFloat(amount)) return Swal.fire("رصيد غير كافٍ", "لا يمكنك النشر بدون رصيد USDT للحجز", "error");
        
        // تنبيه: هنا سيتم استدعاء العقد مستقبلاً
        console.log("سيتم حجز " + amount + " USDT في العقد الآن...");
    }

    await db.collection("ads").add({
        type, price, amount, min, max, payment, owner,
        status: 'active',
        userName: "Al-Prince " + owner.substring(0,4),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    Swal.fire("تم النشر", "إعلانك متاح الآن في السوق", "success");
    ui.showPage('p2p');
}

// 2. جلب السوق لحظياً
function renderMarket() {
    const container = document.getElementById('marketList');
    const displayType = marketType === 'buy' ? 'sell' : 'buy';

    db.collection("ads").where("status", "==", "active").where("type", "==", displayType)
    .onSnapshot(snap => {
        if(snap.empty) { container.innerHTML = '<div class="text-center text-gray-400 mt-10">لا يوجد عروض</div>'; return; }
        
        container.innerHTML = snap.docs.map(doc => {
            const a = doc.data();
            return `
            <div class="border-b pb-4">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <div class="w-5 h-5 bg-black rounded-full"></div>
                            <span class="text-xs font-bold">${a.userName}</span>
                        </div>
                        <div class="text-2xl font-black price-font">${a.price} <span class="text-xs font-normal">EGP</span></div>
                        <div class="text-[11px] text-gray-500">المتاح: ${a.amount} USDT</div>
                        <div class="text-[11px] text-gray-500">الحدود: ${a.min} - ${a.max} EGP</div>
                        <div class="mt-2 flex gap-2"><span class="pay-tag">${a.payment}</span></div>
                    </div>
                    <button onclick="openOrder('${doc.id}')" class="${marketType==='buy'?'bg-green-500':'bg-red-500'} text-white px-8 py-2 rounded-lg font-bold">
                        ${marketType === 'buy' ? 'شراء' : 'بيع'}
                    </button>
                </div>
            </div>`;
        }).join('');
    });
}

// 3. فتح طلب وشات
async function openOrder(adId) {
    const adDoc = await db.collection("ads").doc(adId).get();
    const ad = adDoc.data();
    const myAddr = window.tronLink.tronWeb.defaultAddress.base58;

    // إذا كان المشتري يبيع للتاجر (إعلان أحمر)، نتأكد من رصيد المشتري
    if (ad.type === 'sell') {
        const bal = await getUSDTBalance(myAddr);
        if (bal < parseFloat(ad.amount)) return Swal.fire("رصيد غير كافٍ", "لا تملك رصيد USDT للبيع لهذا التاجر", "error");
    }

    const orderId = "ORD-" + Date.now();
    await db.collection("orders").doc(orderId).set({
        ...ad,
        orderId,
        buyerAddr: myAddr,
        status: 'pending',
        isPaid: false,
        timer: 900, // 15 دقيقة
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    rtdb.ref('chats/' + orderId).push({ sender: 'System', text: 'تم فتح الطلب، برجاء التواصل هنا.' });
    ui.showPage('orders');
}

// 4. عرض الطلبات ومنطق الأزرار
function renderOrders(status) {
    const container = document.getElementById('ordersList');
    const myAddr = window.tronLink.tronWeb.defaultAddress.base58;

    db.collection("orders").where("status", "==", status)
    .onSnapshot(snap => {
        const myOrders = snap.docs.filter(d => d.data().buyerAddr === myAddr || d.data().owner === myAddr);
        container.innerHTML = myOrders.map(doc => {
            const o = doc.data();
            const isOwner = o.owner === myAddr;
            return `
            <div class="order-card bg-white shadow-sm">
                <div class="flex justify-between text-xs mb-3">
                    <span class="font-bold">#${o.orderId}</span>
                    <span class="text-blue-500 font-bold" onclick="openChat('${o.orderId}')">الدردشة</span>
                </div>
                <div class="text-lg font-black">${o.price} EGP</div>
                <div class="text-xs text-gray-500 mb-4">الكمية: ${o.amount} USDT</div>
                
                ${o.status === 'pending' ? `
                    <div class="flex gap-2">
                        ${!o.isPaid && !isOwner ? `<button onclick="confirmPayment('${o.orderId}')" class="flex-1 bg-black text-white py-2 rounded-lg text-xs font-bold">تم الدفع</button>` : ''}
                        ${o.isPaid && isOwner ? `<button onclick="releaseCrypto('${o.orderId}')" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold">تحرير العملات</button>` : ''}
                        ${o.type === 'buy' && !isOwner ? `<button onclick="updateOrderStatus('${o.orderId}', 'cancelled')" class="flex-1 bg-gray-100 text-gray-400 py-2 rounded-lg text-xs font-bold">إلغاء</button>` : ''}
                    </div>
                ` : `<div class="text-center font-bold uppercase text-xs">${o.status}</div>`}
            </div>`;
        }).join('');
    });
}

// الدوال الفرعية للتحكم في الطلبات
window.confirmPayment = (id) => db.collection("orders").doc(id).update({ isPaid: true });
window.releaseCrypto = (id) => {
    Swal.fire("تم!", "سيتم تحرير العملات من العقد الذكي فوراً", "success");
    db.collection("orders").doc(id).update({ status: 'completed' });
};
window.updateOrderStatus = (id, s) => db.collection("orders").doc(id).update({ status: s });

// ربط الدوال بـ Window
window.validateAndSubmit = validateAndSubmit;
window.openOrder = openOrder;
window.renderOrders = renderOrders;
window.setMarket = (t, b) => {
    marketType = t;
    document.querySelectorAll('#p2pPage .tab-btn').forEach(btn => btn.className = 'tab-btn py-2 text-gray-400');
    b.className = 'tab-btn active border-b-2 border-black py-2';
    renderMarket();
};

window.onload = () => { renderMarket(); renderOrders('pending'); };
                                                                      
