// src/js/main.js
import { connectWallet, getUSDTBalance } from './tron.js';

let ads = [];
let orders = [];
let marketType = 'buy';

async function validateAndSubmit() {
    const isConnected = await connectWallet();
    if (!isConnected) return;

    const isBuy = document.getElementById('formBuy').classList.contains('bg-white');
    const type = isBuy ? 'buy' : 'sell';
    const price = document.getElementById('inPrice').value;
    const amount = document.getElementById('inAmount').value;

    if (!price || !amount) {
        return Swal.fire('نقص بيانات', 'املأ السعر والكمية', 'error');
    }

    if (type === 'sell') {
        const balance = await getUSDTBalance();
        if (balance < parseFloat(amount)) {
            return Swal.fire('رصيد غير كافي', `رصيدك: ${balance.toFixed(2)} USDT`, 'warning');
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

function setFormType(t) {
    const buyBtn = document.getElementById('formBuy');
    const sellBtn = document.getElementById('formSell');
    const submitBtn = document.getElementById('submitBtn');

    if (t === 'buy') {
        buyBtn.className = "flex-1 py-4 rounded-2xl font-bold bg-white text-green-600 shadow";
        sellBtn.className = "flex-1 py-4 rounded-2xl font-bold text-gray-400";
        submitBtn.className = "w-full py-5 rounded-3xl font-bold text-lg shadow-lg submit-btn bg-emerald-600 text-white";
    } else {
        sellBtn.className = "flex-1 py-4 rounded-2xl font-bold bg-white text-red-600 shadow";
        buyBtn.className = "flex-1 py-4 rounded-2xl font-bold text-gray-400";
        submitBtn.className = "w-full py-5 rounded-3xl font-bold text-lg shadow-lg submit-btn bg-red-500 text-white";
    }
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
                <i class="fa-solid fa-magnifying-glass text-6xl text-gray-300 mx-auto block"></i>
                <p class="mt-6 text-xl font-medium">لم يتم العثور على إعلانات</p>
                <button onclick="showPage('create')" class="mt-10 bg-black text-white px-12 py-4 rounded-3xl font-bold">
                    إنشاء إعلان
                </button>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(a => `
        <div class="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm">
            <span class="\( {a.type==='buy' ? 'text-green-600' : 'text-red-600'} font-bold"> \){a.type.toUpperCase()} USDT</span>
            <div class="text-2xl font-black price-font mt-2">${a.price} EGP</div>
            <div class="text-sm text-gray-500">${a.amount} USDT</div>
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
            <div class="flex justify-between text-xs">
                <span class="font-mono">${o.orderId}</span>
                <span class="text-blue-500">دردشة</span>
            </div>
            <div class="font-bold mt-2">${o.type === 'buy' ? 'بيع' : 'شراء'} USDT</div>
            <div class="text-lg">${o.price} EGP</div>
            ${status === 'pending' ? `
            <div class="flex gap-3 mt-5">
                <button onclick="updateStatus('${o.orderId}', 'cancelled')" 
                        class="flex-1 py-3 bg-white border border-gray-300 rounded-3xl text-sm font-medium">ملغي</button>
                <button onclick="updateStatus('${o.orderId}', 'completed')" 
                        class="flex-1 py-3 bg-emerald-600 text-white rounded-3xl text-sm font-medium">مكتملة</button>
            </div>` : ''}
        </div>
    `).join('');
}

function updateStatus(id, newStatus) {
    const order = orders.find(o => o.orderId === id);
    if (order) {
        order.status = newStatus;
        renderOrders('pending');
        Swal.fire('تم التحديث', '', 'success');
    }
}

function setMarket(t, b) {
    marketType = t;
    document.querySelectorAll('#p2pPage .tab-btn').forEach(btn => btn.classList.remove('active'));
    b.classList.add('active');
}

function renderMarket() {
    document.getElementById('marketList').innerHTML = `<div class="text-center mt-20 text-gray-400">لا توجد إعلانات حالياً</div>`;
}

// ربط الدوال
window.connectWallet = connectWallet;
window.showPage = showPage;
window.setFormType = setFormType;
window.validateAndSubmit = validateAndSubmit;
window.renderMyAds = renderMyAds;
window.renderOrders = renderOrders;
window.updateStatus = updateStatus;
window.setMarket = setMarket;

window.onload = () => showPage('p2p');
