// src/js/main.js
import { connectWallet, getUSDTBalance } from './tron.js';

let ads = [];
let orders = [];
let marketType = 'buy';

async function validateAndSubmit() {
    const isConnected = await connectWallet();
    if (!isConnected) return Swal.fire("خطأ", "يرجى ربط المحفظة", "error");

    const isBuy = document.getElementById('formBuy').classList.contains('bg-white');
    const type = isBuy ? 'buy' : 'sell';
    const price = document.getElementById('inPrice').value;
    const amount = document.getElementById('inAmount').value;

    if (!price || !amount) return Swal.fire('بيانات ناقصة', 'املأ كل الحقول', 'warning');

    if (type === 'sell') {
        const balance = await getUSDTBalance(window.tronLink.tronWeb.defaultAddress.base58);
        if (balance < parseFloat(amount)) return Swal.fire('رصيد غير كافي', `رصيدك ${balance.toFixed(2)} USDT`, 'error');
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
        user: "Al-Prince",
        successRate: "99.2%",
        ordersCount: Math.floor(Math.random() * 500) + 50
    };

    ads.unshift(newAd);
    Swal.fire('تم النشر', 'إعلانك متاح الآن', 'success');
    showPage('ads');
}

function renderMarket() {
    const container = document.getElementById('marketList');
    const displayType = marketType === 'buy' ? 'sell' : 'buy';
    const filtered = ads.filter(a => a.type === displayType && a.isActive);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center mt-20 text-gray-400 text-xs italic">لا توجد إعلانات حالياً</div>`;
        return;
    }

    container.innerHTML = filtered.map(a => `
        <div class="pb-4 border-b border-gray-50 flex justify-between items-center">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-[8px] font-bold">A</div>
                    <span class="text-xs font-bold">${a.user}</span>
                    <span class="text-[9px] text-gray-400">${a.ordersCount} طلب | ${a.successRate}</span>
                </div>
                <div class="text-xl font-black price-font">${a.price} <span class="text-[10px] font-normal text-gray-400">EGP</span></div>
                <div class="text-[10px] text-gray-500">الكمية: ${a.amount} USDT</div>
                <div class="mt-1"><span class="pay-tag">${a.payment}</span></div>
            </div>
            <button onclick="takeOrder(${a.id})" class="${marketType==='buy'?'bg-emerald-500':'bg-red-500'} text-white px-6 py-2 rounded-full text-xs font-bold shadow-sm">
                ${marketType === 'buy' ? 'شراء' : 'بيع'}
            </button>
        </div>
    `).join('');
}

function takeOrder(adId) {
    const ad = ads.find(a => a.id === adId);
    if (ad) {
        const newOrder = { 
            ...ad, 
            orderId: 'ORD-' + Math.floor(1000 + Math.random() * 9000), 
            status: 'pending' 
        };
        orders.unshift(newOrder);
        Swal.fire('تم فتح الطلب', 'انتقل لصفحة الطلبات للمتابعة', 'success');
        showPage('orders');
    }
}

function switchOrderTab(status, btn) {
    document.querySelectorAll('#ordersPage .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderOrders(status);
}

function renderOrders(status) {
    const container = document.getElementById('ordersList');
    const filtered = orders.filter(o => o.status === status);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center mt-20 text-gray-400 text-xs italic">لا توجد طلبات هنا</div>`;
        return;
    }

    container.innerHTML = filtered.map(o => `
        <div class="p-4 border border-gray-100 rounded-2xl bg-white">
            <div class="flex justify-between text-[10px] text-gray-400 mb-2">
                <span>#${o.orderId}</span>
                <span class="text-blue-500 font-bold">دردشة</span>
            </div>
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold">${o.type === 'buy' ? 'بيع' : 'شراء'} USDT</div>
                    <div class="text-lg font-black price-font">${o.price} EGP</div>
                </div>
                <div class="text-[10px] text-gray-500">الكمية: ${o.amount}</div>
            </div>
            ${status === 'pending' ? `
            <div class="flex gap-2 mt-4">
                <button onclick="updateStatus('${o.orderId}', 'cancelled')" class="flex-1 py-2 bg-gray-50 text-gray-500 rounded-xl text-xs font-bold">إلغاء</button>
                <button onclick="updateStatus('${o.orderId}', 'completed')" class="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تأكيد</button>
            </div>` : `
            <div class="mt-3 pt-3 border-t border-dashed border-gray-50 text-[10px] font-bold ${status==='completed'?'text-emerald-500':'text-red-400'} text-center uppercase">الحالة: ${status}</div>
            `}
        </div>
    `).join('');
}

function updateStatus(id, newStatus) {
    const order = orders.find(o => o.orderId === id);
    if (order) {
        order.status = newStatus;
        renderOrders('pending');
        Swal.fire({ title: 'تم التحديث', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    }
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
        container.innerHTML = `<div class="text-center mt-20 text-xs text-gray-400 italic">لا توجد إعلانات</div>`;
        return;
    }

    container.innerHTML = filtered.map(a => `
        <div class="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[10px] font-bold ${a.type==='buy'?'text-green-600':'text-red-600'} uppercase">${a.type} USDT</span>
                <button onclick="toggleAdStatus(${a.id})" class="text-[10px] text-blue-500 border border-blue-100 px-2 py-1 rounded">${a.isActive?'إيقاف':'تفعيل'}</button>
            </div>
            <div class="text-xl font-black price-font">${a.price} EGP</div>
            <div class="text-[10px] text-gray-500">الكمية: ${a.amount} | الدفع: ${a.payment}</div>
        </div>
    `).join('');
}

function toggleAdStatus(id) {
    const ad = ads.find(a => a.id === id);
    ad.isActive = !ad.isActive;
    renderMyAds(ad.isActive ? 'inactive' : 'active');
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

function setMarket(type, btn) {
    marketType = type;
    document.querySelectorAll('#p2pPage .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMarket();
}

function setFormType(t) {
    const b = document.getElementById('formBuy'), s = document.getElementById('formSell');
    if(t==='buy'){ b.className="flex-1 py-3 rounded-xl font-bold bg-white text-green-600 shadow"; s.className="flex-1 py-3 rounded-xl font-bold text-gray-400"; }
    else { s.className="flex-1 py-3 rounded-xl font-bold bg-white text-red-600 shadow"; b.className="flex-1 py-3 rounded-xl font-bold text-gray-400"; }
}

// ربط الدوال بالنافذة
window.connectWallet = connectWallet;
window.showPage = showPage;
window.setFormType = setFormType;
window.validateAndSubmit = validateAndSubmit;
window.renderMyAds = renderMyAds;
window.switchOrderTab = switchOrderTab;
window.updateStatus = updateStatus;
window.setMarket = setMarket;
window.takeOrder = takeOrder;
window.toggleAdStatus = toggleAdStatus;

window.onload = () => showPage('p2p');
