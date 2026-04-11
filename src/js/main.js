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

    Swal.fire('تم النشر', 'الإعلان تم نشره مؤقتاً', 'success');
    showPage('p2p');
}

window.connectWallet = connectWallet;
window.showPage = showPage;
window.setMarket = setMarket;
window.setFormType = setFormType;
window.createAd = createAd;

window.onload = () => {
    showPage('p2p');
};
