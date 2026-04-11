// src/js/main.js
import { connectWallet } from './tron.js';
import { showPage, setMarket, setFormType } from './ui.js';

async function createAd() {
    const isConnected = await connectWallet();
    if (!isConnected) return;

    const price = document.getElementById('priceInput').value;
    const amount = document.getElementById('amountInput').value;

    if (!price || !amount) {
        Swal.fire('بيانات ناقصة', 'يرجى إدخال السعر والكمية', 'error');
        return;
    }

    Swal.fire({
        title: 'تم نشر الإعلان',
        text: 'الإعلان تم إضافته بنجاح (مؤقتاً)',
        icon: 'success'
    });

    showPage('p2p');
}

// جعل الدوال متاحة في HTML
window.connectWallet = connectWallet;
window.showPage = showPage;
window.setMarket = setMarket;
window.setFormType = setFormType;
window.createAd = createAd;

// تشغيل عند تحميل الصفحة
window.onload = () => {
    showPage('p2p');
    console.log('%cTron P2P Egypt جاهز للعمل', 'color: #00b07c; font-weight: bold');
};
