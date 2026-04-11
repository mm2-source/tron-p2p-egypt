// src/js/main.js
import { connectWallet, getUSDTBalance } from './tron.js';

let ads = [];
let orders = [];
let marketType = 'buy';

async function validateAndSubmit() {
    const isConnected = await connectWallet();
    if (!isConnected) return;

    const type = document.getElementById('formBuy').classList.contains('bg-white') ? 'buy' : 'sell';
    const price = document.getElementById('inPrice').value;
    const amount = document.getElementById('inAmount').value;

    if (!price || !amount) return Swal.fire('نقص بيانات', 'املأ السعر والكمية', 'error');

    if (type === 'sell') {
        const balance = await getUSDTBalance();
        if (balance < parseFloat(amount)) {
            return Swal.fire('رصيد غير كافي', `رصيدك ${balance.toFixed(2)} USDT فقط`, 'warning');
        }
    }

    const newAd = {
        id: Date.now(),
        isActive: true,
        type: type,
        price: price,
        amount: amount,
        min: document.getElementById('inMin').value || "100",
        max: document.getElementById('inMax').value || (amount * price),
        payment: document.getElementById('inPayment').value,
        user: "أنت",
        successRate: "98.5%",
        ordersCount: 12
    };
    ads.unshift(newAd);
    Swal.fire('تم النشر', 'إعلانك الآن في السوق', 'success');
    showPage('ads');
}

function renderMyAds(tab, btn) {
    if (btn) {
        document.querySelectorAll('#adsPage .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const container = document.getElementById('myAdsList');
    const filtered = ads.filter(a => tab === 'active' ? a.isActive : !a.isActive);

    document.getElementById('activeAdsCount').innerText = `نشط (${ads.filter(a => a.isActive).length})`;
    document.getElementById('inactiveAdsCount').innerText = `غير نشط (${ads.filter(a => !a.isActive).length})`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center mt-20">
                <div class="mx-auto w-28 h-28 flex items-center justify-center">
                    <i class="fa-solid fa-magnifying-glass text-6xl text-gray-300"></i>
                </div>
                <p class="mt-6 text-xl font-medium">لم يتم العثور على إعلانات</p>
                <p class="text-gray-500 mt-2">أنشئ إعلاناً لشراء أو بيع العملات الرقمية</p>
                <button onclick="showPage('create')" 
                        class="mt-10 bg-black text-white px-12 py-4 rounded-3xl font-bold text-lg">
                    إنشاء إعلان
                </button>
            </div>`;
        return;
    }

    // باقي عرض الإعلانات (نفس الكود القديم)
    container.innerHTML = filtered.map(a => `
        <div class="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[10px] font-black \( {a.type==='buy'?'text-green-500':'text-red-500'} uppercase"> \){a.type} USDT</span>
                <div class="flex gap-2">
                    <button onclick="toggleAdStatus(${a.id})" class="text-blue-500 text-[10px] border border-blue-100 px-3 py-1 rounded"> ${a.isActive ? 'إيقاف' : 'تفعيل'} </button>
                    <button onclick="hardDeleteAd(${a.id})" class="text-red-400 text-[10px] border border-red-50 px-3 py-1 rounded">حذف</button>
                </div>
            </div>
            <div class="text-xl font-black price-font">${a.price} <span class="text-xs font-normal">EGP</span></div>
            <div class="text-[11px] text-gray-500 mt-1">الكمية: ${a.amount} | الحدود: \( {a.min}- \){a.max}</div>
        </div>
    `).join('');
}

function renderOrders(status) {
    const container = document.getElementById('ordersList');
    const filtered = orders.filter(o => o.status === status);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center mt-20 text-gray-400">لا توجد طلبات ${status}</div>`;
        return;
    }

    container.innerHTML = filtered.map(o => `
        <div class="p-4 border rounded-2xl bg-gray-50">
            <div class="flex justify-between text-[10px] font-bold text-gray-400 mb-2">
                <span>${o.orderId}</span>
                <span class="text-blue-500">دردشة <i class="fa-solid fa-comment"></i></span>
            </div>
            <div class="text-lg font-black">${o.type==='buy' ? 'بيع' : 'شراء'} USDT</div>
            <div class="text-sm font-bold text-gray-700">${o.price} EGP</div>
            ${status === 'pending' ? `
            <div class="flex gap-2 mt-4">
                <button onclick="updateStatus('${o.orderId}', 'cancelled')" class="flex-1 py-3 bg-white border rounded-3xl text-xs font-bold">إلغاء</button>
                <button onclick="updateStatus('${o.orderId}', 'completed')" class="flex-1 py-3 bg-black text-white rounded-3xl text-xs font-bold">تأكيد</button>
            </div>` : ''}
        </div>
    `).join('');
}

function updateStatus(id, newS) {
    const o = orders.find(x => x.orderId === id);
    if (o) o.status = newS;
    renderOrders('pending');
    Swal.fire('تم', 'تم تحديث الطلب', 'success');
}

function toggleAdStatus(id) {
    const ad = ads.find(a => a.id === id);
    if (ad) ad.isActive = !ad.isActive;
    renderMyAds(ad.isActive ? 'inactive' : 'active');
}

function hardDeleteAd(id) {
    ads = ads.filter(a => a.id !== id);
    renderMyAds('inactive');
}

function takeOrder(id) {
    const ad = ads.find(a => a.id === id);
    const newOrder = { ...ad, orderId: 'ORD-' + Math.floor(1000 + Math.random() * 9000), status: 'pending' };
    orders.unshift(newOrder);
    Swal.fire('تم فتح الطلب', 'تابع التفاصيل في صفحة الطلبات', 'info');
    showPage('orders');
}

function setFormType(t) {
    const buy = document.getElementById('formBuy');
    const sell = document.getElementById('formSell');
    if (t === 'buy') {
        buy.className = "flex-1 py-3 rounded-lg font-bold bg-white text-green-600 shadow-sm";
        sell.className = "flex-1 py-3 rounded-lg font-bold text-gray-400";
    } else {
        sell.className = "flex-1 py-3 rounded-lg font-bold bg-white text-red-600 shadow-sm";
        buy.className = "flex-1 py-3 rounded-lg font-bold text-gray-400";
    }
}

function setMarket(t, b) {
    marketType = t;
    document.querySelectorAll('#p2pPage .tab-btn').forEach(btn => btn.classList.remove('active'));
    b.classList.add('active');
    renderMarket();
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id + 'Page').classList.add('page-active');
    document.getElementById('nav-' + id).classList.add('active');

    if (id === 'p2p') renderMarket();
    if (id === 'ads') renderMyAds('active');
    if (id === 'orders') renderOrders('pending');
}

function renderMarket() {
    const container = document.getElementById('marketList');
    const displayType = marketType === 'buy' ? 'sell' : 'buy';
    const filtered = ads.filter(a => a.type === displayType && a.isActive);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center mt-20 text-gray-400">لا توجد إعلانات حالياً</div>`;
        return;
    }

    container.innerHTML = filtered.map(a => `
        <div class="pb-4 border-b border-gray-50 flex justify-between items-start">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1 text-sm font-bold">
                    <div class="w-6 h-6 bg-black text-white rounded-full text-[10px] flex items-center justify-center font-black">${a.user[0]}</div>
                    \( {a.user} <span class="text-[10px] text-gray-400"> \){a.ordersCount} طلبات | ${a.successRate}</span>
                </div>
                <div class="text-2xl font-black price-font">${parseFloat(a.price).toFixed(2)} <span class="text-xs font-normal text-gray-400">EGP</span></div>
                <div class="text-[11px] text-gray-500 mt-1">الكمية <span class="text-black font-bold">${a.amount} USDT</span></div>
                <div class="text-[11px] text-gray-500">الحدود <span class="text-black font-bold">${a.min} - ${a.max} EGP</span></div>
                <div class="mt-2"><span class="pay-tag pay-\( {a.payment}"> \){a.payment === 'Vodafone' ? 'Vodafone Cash' : a.payment}</span></div>
            </div>
            <button onclick="takeOrder(\( {a.id})" class=" \){marketType==='buy'?'okx-bg-green':'bg-red-500 text-white'} px-8 py-2 rounded-full font-bold mt-4 shadow-sm">
                ${marketType==='buy'?'شراء':'بيع'}
            </button>
        </div>
    `).join('');
}

// ربط كل الدوال
window.validateAndSubmit = validateAndSubmit;
window.renderMyAds = renderMyAds;
window.renderOrders = renderOrders;
window.updateStatus = updateStatus;
window.toggleAdStatus = toggleAdStatus;
window.hardDeleteAd = hardDeleteAd;
window.takeOrder = takeOrder;
window.setFormType = setFormType;
window.setMarket = setMarket;
window.showPage = showPage;

window.onload = () => {
    showPage('p2p');
};
