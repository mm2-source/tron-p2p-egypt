export function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('page-active'));
    const target = document.getElementById(pageName + 'Page');
    if (target) target.classList.add('page-active');
}

export function setMarket(type, button) {
    document.querySelectorAll('#p2pPage .tab-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
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
