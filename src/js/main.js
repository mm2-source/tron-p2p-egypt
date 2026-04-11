import { connectWallet, getUSDTBalance, tronWebInstance } from './tron.js';
import * as ui from './ui.js';

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rtdb = firebase.database();

let marketType = 'buy'; 
let currentOrderId = null;
let chatListener = null;

const ESCROW_CONTRACT = "PUT_YOUR_CONTRACT_HERE"; // 👈 حط عقدك هنا

// ================== نشر إعلان ==================
async function validateAndSubmit() {
    if (!(await connectWallet())) return;

    const isBuy = document.getElementById('formBuy').classList.contains('bg-white');
    const type = isBuy ? 'buy' : 'sell';

    const price = +inPrice.value;
    const amount = +inAmount.value;
    const min = +inMin.value;
    const max = +inMax.value;
    const payment = inPayment.value;

    const myAddr = tronWebInstance.defaultAddress.base58;

    if (!price || !amount) return Swal.fire("خطأ", "كمل البيانات", "warning");

    // 🔥 إعلان بيع (أخضر) = لازم نحجز USDT
    if (type === 'buy') {
        const bal = await getUSDTBalance(myAddr);

        if (bal < amount) {
            return Swal.fire("رصيد غير كافي", "لازم يكون معاك USDT", "error");
        }

        // 🔥 مكان الحجز الحقيقي
        try {
            /*
            const contract = await tronWebInstance.contract().at(ESCROW_CONTRACT);
            await contract.lockUSDT(amount * 1e6).send();
            */

            console.log("LOCKED:", amount);
        } catch(e) {
            return Swal.fire("خطأ", "فشل حجز العملات", "error");
        }
    }

    await db.collection("ads").add({
        type, price, amount, min, max, payment,
        owner: myAddr,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    Swal.fire("تم", "الإعلان نزل في السوق", "success");
    showPage('p2p');
}

// ================== السوق ==================
function renderMarket() {
    const container = document.getElementById('marketList');
    const searchType = marketType;

    db.collection("ads")
    .where("status", "==", "active")
    .where("type", "==", searchType)
    .onSnapshot(snap => {

        if (snap.empty) {
            container.innerHTML = `<div class="text-center mt-20 text-gray-300">لا يوجد عروض</div>`;
            return;
        }

        container.innerHTML = snap.docs.map(doc => {
            const a = doc.data();
            const btnClass = a.type === 'buy' ? 'bg-green-500' : 'bg-red-500';

            return `
            <div class="border-b pb-5">
                <div class="flex justify-between">
                    <div>
                        <div class="text-2xl font-black">${a.price} EGP</div>
                        <div class="text-xs">متاح: ${a.amount} USDT</div>
                        <div class="text-xs">الحد: ${a.min} - ${a.max}</div>
                        <div class="text-xs font-bold mt-1">${a.payment}</div>
                    </div>
                    <button onclick="openOrder('${doc.id}')" class="${btnClass} text-white px-6 py-2 rounded-lg">
                        ${marketType === 'buy' ? 'شراء' : 'بيع'}
                    </button>
                </div>
            </div>`;
        }).join('');
    });
}

// ================== فتح طلب ==================
async function openOrder(adId) {
    if (!tronWebInstance) return Swal.fire("اربط المحفظة");

    const adDoc = await db.collection("ads").doc(adId).get();
    const ad = adDoc.data();
    const myAddr = tronWebInstance.defaultAddress.base58;

    if (ad.owner === myAddr) return Swal.fire("لا يمكنك التعامل مع نفسك");

    // 🔥 لو إعلان شراء (أحمر) → لازم البائع يكون معاه USDT
    if (ad.type === 'sell') {
        const bal = await getUSDTBalance(myAddr);
        if (bal < ad.amount) return Swal.fire("معندكش USDT للبيع");
    }

    const orderId = "ORD-" + Date.now();

    await db.collection("orders").doc(orderId).set({
        ...ad,
        orderId,
        buyerAddr: myAddr,
        status: 'pending',
        isPaid: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000)
    });

    rtdb.ref('chats/' + orderId).push({
        sender: "System",
        text: "تم فتح الطلب"
    });

    Swal.fire("طلب جديد", "تم فتح الطلب", "success");

    showPage('orders');
}

// ================== الطلبات ==================
function renderOrders(status, btn=null) {
    const container = document.getElementById('ordersList');
    const myAddr = tronWebInstance?.defaultAddress?.base58;

    db.collection("orders").where("status","==",status)
    .onSnapshot(snap => {

        const myOrders = snap.docs.filter(d => {
            const o = d.data();
            return o.owner === myAddr || o.buyerAddr === myAddr;
        });

        if (!myOrders.length) {
            container.innerHTML = "لا يوجد طلبات";
            return;
        }

        container.innerHTML = myOrders.map(doc => {
            const o = doc.data();
            const isOwner = o.owner === myAddr;

            let timer = Math.max(0, o.expiresAt - Date.now());

            return `
            <div class="border p-3 rounded-xl">
                <div>${o.price} EGP</div>
                <div>${o.amount} USDT</div>
                <div>${Math.floor(timer/60000)}:${Math.floor((timer%60000)/1000)}</div>

                <button onclick="openChat('${o.orderId}')">شات</button>

                ${o.status === 'pending' ? `
                ${!o.isPaid && !isOwner ? `<button onclick="confirmPayment('${o.orderId}')">تم الدفع</button>`:''}
                ${o.isPaid && isOwner ? `<button onclick="releaseCrypto('${o.orderId}')">تحرير</button>`:''}
                ${(o.type === 'buy' && !isOwner) || (o.type === 'sell' && isOwner)
                    ? `<button onclick="cancelOrder('${o.orderId}')">إلغاء</button>`:''}
                `:''}
            </div>`;
        }).join('');
    });
}

// ================== التحكم ==================
window.confirmPayment = (id)=>{
    db.collection("orders").doc(id).update({isPaid:true});
};

window.releaseCrypto = async (id)=>{
    /*
    🔥 هنا تحط كود العقد
    await contract.release(orderId)
    */

    await db.collection("orders").doc(id).update({status:'completed'});
};

window.cancelOrder = (id)=>{
    db.collection("orders").doc(id).update({status:'cancelled'});
};

// ================== الشات ==================
window.openChat = (id)=>{
    currentOrderId = id;
    document.getElementById('chatBox').style.display='flex';

    if(chatListener) rtdb.ref('chats/'+id).off();

    chatListener = rtdb.ref('chats/'+id).on('value', snap=>{
        const msgs = snap.val();
        const box = document.getElementById('chatMessages');
        box.innerHTML='';

        if(msgs){
            Object.values(msgs).forEach(m=>{
                box.innerHTML += `<div>${m.sender}: ${m.text}</div>`;
            });
        }
    });
};

window.sendChatMessage = ()=>{
    if(!currentOrderId) return;

    const txt = chatInput.value;
    if(!txt) return;

    const myAddr = tronWebInstance.defaultAddress.base58;

    rtdb.ref('chats/'+currentOrderId).push({
        sender: myAddr.slice(0,6),
        text: txt
    });

    chatInput.value='';
};

// ================== إعلاناتي ==================
function renderMyAds(){
    const container = document.getElementById('myAdsList');
    const myAddr = tronWebInstance?.defaultAddress?.base58;

    db.collection("ads").where("owner","==",myAddr)
    .onSnapshot(snap=>{
        container.innerHTML = snap.docs.map(d=>{
            const a = d.data();
            return `<div>${a.price} - ${a.amount}</div>`;
        }).join('');
    });
}

// ================== Navigation ==================
window.showPage = (id)=>{
    ui.showPage(id);
    if(id==='p2p') renderMarket();
    if(id==='orders') renderOrders('pending');
    if(id==='ads') renderMyAds();
};

window.validateAndSubmit = validateAndSubmit;
window.setMarket = (t,b)=>{
    marketType = t;
    renderMarket();
};

window.setFormType = (t)=> ui.setFormType(t);

window.onload = async ()=>{
    try { await connectWallet(); } catch(e){}
    renderMarket();
};
