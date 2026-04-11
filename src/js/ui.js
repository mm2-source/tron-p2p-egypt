export function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    const el = document.getElementById(id + 'Page');
    if (el) el.style.display = 'block';
}

export function setFormType(type) {
    const buy = document.getElementById('formBuy');
    const sell = document.getElementById('formSell');

    if (!buy || !sell) return;

    if (type === 'buy') {
        buy.className = "flex-1 py-3 bg-white text-green-600 font-bold";
        sell.className = "flex-1 py-3 text-gray-400";
    } else {
        sell.className = "flex-1 py-3 bg-white text-red-600 font-bold";
        buy.className = "flex-1 py-3 text-gray-400";
    }
}
