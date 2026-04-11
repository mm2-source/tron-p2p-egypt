export function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
    document.getElementById(id + 'Page').classList.add('page-active');
}

export function setFormType(type) {
    const buy = document.getElementById('formBuy');
    const sell = document.getElementById('formSell');
    if (type === 'buy') {
        buy.className = "flex-1 py-2 rounded-lg font-bold bg-white text-green-600 shadow-sm";
        sell.className = "flex-1 py-2 rounded-lg font-bold text-gray-400";
    } else {
        sell.className = "flex-1 py-2 rounded-lg font-bold bg-white text-red-600 shadow-sm";
        buy.className = "flex-1 py-2 rounded-lg font-bold text-gray-400";
    }
}
