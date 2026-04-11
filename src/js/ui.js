export function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(id + 'Page');
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.replace('text-black', 'text-gray-400'));
    const activeNav = document.getElementById('nav-' + id);
    if (activeNav) activeNav.classList.replace('text-gray-400', 'text-black');
}

export function setFormType(type) {
    const buy = document.getElementById('formBuy');
    const sell = document.getElementById('formSell');
    if (type === 'buy') {
        buy.className = "flex-1 py-3 rounded-lg font-bold bg-white text-green-600 shadow-sm";
        sell.className = "flex-1 py-3 rounded-lg font-bold text-gray-400";
    } else {
        sell.className = "flex-1 py-3 rounded-lg font-bold bg-white text-red-600 shadow-sm";
        buy.className = "flex-1 py-3 rounded-lg font-bold text-gray-400";
    }
}
