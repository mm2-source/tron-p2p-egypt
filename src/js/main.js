// src/js/main.js
import { connectWallet, getUSDTBalance } from './tron.js';
import { showPage, setMarket, setFormType } from './ui.js';

let ads = [];
let orders = [];
let marketType = 'buy';

async function validateAndSubmit() {
    const isConnected = await connectWallet();
    if (!isConnected) return;

    const type = document.getElementById('formBuy').classList.contains('bg-white') ? 'buy' : 'sell';
    const price = parseFloat(document.getElementById('inPrice').value);
    const amount = parseFloat(document.getElementById('inAmount').value);

    if (!price || !amount) {
        Swal.fire('نقص بيانات', 'يرجى ملء السعر والكمية', 'error');
        return;
    }

    // لو نوع الإعلان بيع → نتحقق من الرصيد
    if (type === 'sell') {
        const balance = await getUSDTBalance();
        if (balance < amount) {
            Swal.fire('رصيد غير كافي', `رصيدك الحالي ${balance.toFixed(2)} USDT\nتحتاج ${amount} USDT`, 'warning');
            return;
        }
    }

    const newAd = {
        id: Date.now(),
        isActive: true,
        type: type,
        price: price,
        amount: amount,
        min: document.getElementById('inMin').value || "100",
        max: document.getElementById('inMax').value || (amount * price).toFixed(0),
        payment: document.getElementById('inPayment').value,
        user: "أنت",
        successRate: "98.5%",
        ordersCount: 12
    };

    ads.unshift(newAd);
    Swal.fire('تم النشر بنجاح', 'إعلانك الآن ظاهر في السوق', 'success');
    showPage('ads');
}

function renderMyAds(tab) {
    const container = document.getElementById('myAdsList');
    const filtered = ads.filter(a => tab === 'active' ? a.isActive : !a.isActive);

    document.getElementById('activeAdsCount').innerText = `نشط (${ads.filter(a => a.isActive).length})`;
    document.getElementById('inactiveAdsCount').innerText = `غير نشط (${ads.filter(a => !a.isActive).length})`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center mt-20">
                <div class="mx-auto w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <i class="fa-solid fa-magnifying-glass text-4xl text-gray-300"></i>
                </div>
                <p class="mt-6 text-gray-500 text-lg">لم يتم العثور على إعلانات</p>
                <p class="text-sm text-gray-400 mt-2">أنشئ إعلاناً لشراء أو بيع العملات الرقمية</p>
                <button onclick="showPage('create')" 
                        class="mt-8 bg-black text-white px-10 py-4 rounded-3xl font-bold">
                    إنشاء إعلان
                </button>
            </div>`;
        return;
    }

    // باقي الكود لعرض الإعلانات...
    container.innerHTML = filtered.map(a => `...`).join('');
}

// ربط الدوال بالـ window
window.connectWallet = connectWallet;
window.showPage = showPage;
window.setMarket = setMarket;
window.setFormType = setFormType;
window.validateAndSubmit = validateAndSubmit;

window.onload = () => {
    showPage('p2p');
};
