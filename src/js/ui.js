// src/js/ui.js
export function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('page-active');
    });
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) targetPage.classList.add('page-active');
}

export function setMarket(type, button) {
    document.querySelectorAll('#p2pPage .tab-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    console.log(`تم التبديل إلى وضع: ${type}`);
    // سنضيف عرض الإعلانات لاحقاً
}

export function setFormType(type) {
    const buyBtn = document.getElementById('formBuyBtn');
    const sellBtn = document.getElementById('formSellBtn');

    if (type === 'buy') {
        buyBtn.classList.add('bg-white', 'shadow-sm');
        sellBtn.classList.remove('bg-white', 'shadow-sm');
        sellBtn.classList.add('text-gray-400');
    } else {
        sellBtn.classList.add('bg-white', 'shadow-sm');
        buyBtn.classList.remove('bg-white', 'shadow-sm');
        buyBtn.classList.add('text-gray-400');
    }
}
