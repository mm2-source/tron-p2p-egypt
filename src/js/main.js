import { connectWallet, getUSDTBalance, tronWebInstance } from './tron.js';
import * as ui from './ui.js';

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

// --- مكان العقد الذكي (Escrow) ---
const ESCROW_CONTRACT = "TRON_CONTRACT_HERE";

// 1. نشر إعلان مع التحقق من الرصيد (شرط أساسي للأخضر)
async function validateAndSubmit() {
    const isConnected = await connectWallet();
    if (!isConnected) return;

    const isBuy = document.getElementById('formBuy').classList.contains('bg-white');
    const type = isBuy ? 'buy' : 'sell'; // buy=أخضر (بيع التاجر)، sell=أحمر (شراء التاجر)
    const price = document.getElementById('inPrice').value;
    const amount = document.getElementById('inAmount').value;
    const min = document.getElementById('inMin').value;
    const max = document.getElementById('inMax').value;
    const payment = document.getElementById('inPayment').value;
    const myAddr = tronWebInstance.defaultAddress.base58;

    if (!price || !amount) return Swal.fire("نقص بيانات", "كمل البيانات يا بطل", "warning");

    // منطق الحجز: إذا كان التاجر يبيع (أخضر)، لازم نحجز الـ USDT
    if (type === 'buy') {
        const bal = await getUSDTBalance(myAddr);
        if (bal < parseFloat(amount)) {
            return Swal.fire("رصيد غير كافٍ", "لازم يكون معاك USDT في محفظتك عشان تنشر إعلان بيع أخضر", "error");
        }
        // هنا يتم استدعاء العقد الذكي لاحقاً لعمل Lock للعملات
        console.log("Escrow: Locking " + amount + " USDT...");
    }

    await db.collection("ads").add({
        type, price, amount, min, max, payment, 
        owner: myAddr,
        status: 'active',
        userName: "Shark " + myAddr.substring(0,4),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    Swal.fire("تم النشر", "إعلانك ظهر في قائمة P2P بنجاح", "success");
    window.showPage('p2p');
}

// 2. عرض السوق بشكل OKX الاحترافي
function renderMarket() {
    const container = document.getElementById('marketList');
    // إذا كنت في تبويب شراء، ابحث عن إعلانات البيع (الأخضر) والعكس
    const searchType = marketType === 'buy' ? 'buy' : 'sell';

    db.collection("ads").where("status", "==", "active").where("type", "==", searchType)
    .onSnapshot(snap => {
        if(snap.empty) { 
            container.innerHTML = `<div class="text-center mt-20 text-gray-300">لا توجد عروض حالية</div>`; 
            return; 
        }
        
        container.innerHTML = snap.docs.map(doc => {
            const a = doc.data();
            const color = a.type === 'buy' ? 'green' : 'red';
            return `
            <div class="border-b pb-5">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="flex items-center gap-1 mb-2">
                            <div class="w-5 h-5 bg-gradient-to-tr from-gray-700 to-black rounded-full flex items-center justify-center text-[8px] text-white">★</div>
                            <span class="text-xs font-bold">${a.userName}</span>
                            <span class="text-[9px] text-gray-400">• متصل</span>
                        </div>
                        <div class="text-2xl font-black price-font">${a.price} <span class="text-[10px] font-normal">EGP</span></div>
                        <div class="text-[11px] text-gray-500 mt-1">متاح: ${a.amount} USDT</div>
                        <div class="text-[11px] text-gray-500">الحد: ${a.min} - ${a.max} EGP</div>
                        <div class="payment-line text-[10px] font-bold text-gray-800">${a.payment}</div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="text-[10px] text-gray-400">98.5% إكمال</span>
                        <button onclick="openOrder('${doc.id}')" class="bg-${color}-500 text-white px-8 py-2 rounded-lg font-bold shadow-sm active:scale-95 transition-all">
                            ${marketType === 'buy' ? 'شراء' : 'بيع'}
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    });
}

// 3. فتح طلب (الأولدر) والتحقق من الطرف الآخر
async function openOrder(adId) {
    const adDoc = await db.collection("ads").doc(adId).get();
    const ad = adDoc.data();
    const myAddr = tronWebInstance.defaultAddress.base58;

    if (ad.owner === myAddr) return Swal.fire("عفواً", "لا يمكنك الشراء من نفسك", "info");

    // إذا كان المشتري يبيع للتاجر (إعلان أحمر)، نتأكد من رصيد المشتري فوراً
    if (ad.type === 'sell') {
        const bal = await getUSDTBalance(myAddr);
        if (bal < parseFloat(ad.amount)) return Swal.fire("رصيد ناقص", "لا تملك رصيد USDT للبيع لهذا التاجر", "error");
    }

    const orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    await db.collection("orders").doc(orderId).set({
        ...ad,
        orderId,
        buyerAddr: myAddr,
        status: 'pending',
        isPaid: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    rtdb.ref('chats/' + orderId).push({ sender: 'System', text: 'تم فتح الطلب بنجاح. تواصل مع الطرف الآخر.' });
    window.showPage('orders');
}

// 4. عرض الطلبات مع التحكم الكامل (إلغاء، تحرير، شات)
function renderOrders(status, btn = null) {
    if(btn) {
        document.querySelectorAll('.order-tab').forEach(t => t.className = "order-tab text-gray-400 pb-2 text-sm");
        btn.className = "order-tab active border-b-2 border-black pb-2 text-sm font-bold";
    }

    const container = document.getElementById('ordersList');
    const myAddr = tronWebInstance.defaultAddress.base58;

    db.collection("orders").where("status", "==", status)
    .onSnapshot(snap => {
        const myOrders = snap.docs.filter(d => d.data().buyerAddr === myAddr || d.data().owner === myAddr);
        
        if(myOrders.length === 0) {
            container.innerHTML = `<div class="text-center mt-10 text-gray-400">لا توجد طلبات هنا</div>`;
            return;
        }

        container.innerHTML = myOrders.map(doc => {
            const o = doc.data();
            const isOwner = o.owner === myAddr; // هل أنا صاحب الإعلان؟
            
            return `
            <div class="order-card bg-white border p-4 rounded-2xl shadow-sm border-gray-100">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-bold text-gray-400 uppercase">#${o.orderId}</span>
                    <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded" onclick="openChat('${o.orderId}')">
                        <i class="fa-solid fa-comment-dots"></i> دردشة
                    </span>
                </div>
                <div class="flex justify-between items-center">
                    <div>
                        <div class="text-xl font-black price-font">${o.price} EGP</div>
                        <div class="text-[11px] text-gray-500">${o.amount} USDT • ${o.payment}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] ${o.status==='pending'?'text-orange-500':'text-gray-400'} font-bold">${o.status==='pending'?'قيد التنفيذ':o.status}</div>
                    </div>
                </div>
                
                ${o.status === 'pending' ? `
                    <div class="flex gap-2 mt-4">
                        ${!o.isPaid && !isOwner ? `<button onclick="confirmPayment('${o.orderId}')" class="flex-1 bg-black text-white py-3 rounded-xl text-xs font-bold shadow-lg">تم الدفع</button>` : ''}
                        
                        ${o.isPaid && isOwner ? `<button onclick="releaseCrypto('${o.orderId}')" class="flex-1 bg-green-600 text-white py-3 rounded-xl text-xs font-bold">تحرير العملات</button>` : ''}
                        
                        ${(o.type === 'buy' && !isOwner) || (o.type === 'sell' && isOwner) ? 
                            `<button onclick="cancelOrder('${o.orderId}')" class="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl text-xs font-bold">إلغاء</button>` 
                        : ''}
                    </div>
                ` : ''}
            </div>`;
        }).join('');
    });
}

// 5. وظائف التحكم (Window Global)
window.confirmPayment = (id) => {
    db.collection("orders").doc(id).update({ isPaid: true });
    rtdb.ref('chats/' + id).push({ sender: 'System', text: 'قام المشتري بالدفع، يرجى تحرير العملات.' });
};

window.releaseCrypto = (id) => {
    Swal.fire({
        title: 'تحرير العملات؟',
        text: "تأكد من استلام المبلغ في حسابك البنكي أولاً",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، تحرير',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection("orders").doc(id).update({ status: 'completed' });
            Swal.fire('تم التحرير', 'وصلت العملات للمشتري بنجاح', 'success');
        }
    });
};

window.cancelOrder = (id) => {
    Swal.fire({
        title: 'هل تريد الإلغاء؟',
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، إلغاء الطلب'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection("orders").doc(id).update({ status: 'cancelled' });
        }
    });
};

// الشات
window.openChat = (id) => {
    currentOrderId = id;
    document.getElementById('chatBox').style.display = 'flex';
    document.getElementById('chatOrderTitle').innerText = id;
    
    rtdb.ref('chats/' + id).on('value', snap => {
        const msgs = snap.val();
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        if(msgs) {
            Object.values(msgs).forEach(m => {
                const isSys = m.sender === 'System';
                container.innerHTML += `
                    <div class="flex ${isSys ? 'justify-center' : 'justify-start'}">
                        <div class="${isSys ? 'bg-gray-200 text-gray-600' : 'bg-white border text-black'} px-4 py-2 rounded-2xl text-xs shadow-sm max-w-[80%]">
                            ${!isSys ? `<div class="font-bold text-[8px] mb-1 opacity-50">${m.sender}</div>` : ''}
                            ${m.text}
                        </div>
                    </div>`;
            });
            container.scrollTop = container.scrollHeight;
        }
    });
};

window.sendChatMessage = () => {
    const input = document.getElementById('chatInput');
    if(!input.value || !currentOrderId) return;
    const myAddr = tronWebInstance.defaultAddress.base58;
    rtdb.ref('chats/' + currentOrderId).push({
        sender: myAddr.substring(0,6),
        text: input.value
    });
    input.value = '';
};

window.closeChat = () => document.getElementById('chatBox').style.display = 'none';

// الربط النهائي بالأزرار
window.showPage = (id) => {
    ui.showPage(id);
    if(id === 'p2p') renderMarket();
    if(id === 'orders') renderOrders('pending');
    if(id === 'ads') renderMyAds();
};

window.validateAndSubmit = validateAndSubmit;
window.setMarket = (t, b) => {
    marketType = t;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.className = 'tab-btn py-2 text-gray-400 font-bold');
    b.className = 'tab-btn active border-b-2 border-black py-2 font-bold';
    renderMarket();
};

window.setFormType = (type) => ui.setFormType(type);

window.onload = async () => {
    await connectWallet();
    renderMarket();
};
                
