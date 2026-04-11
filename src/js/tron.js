// src/js/tron.js
export let tronWebInstance = null;
export let currentUserAddress = null;

const USDT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // USDT TRC20

export async function connectWallet() {
    if (typeof window.tronLink === "undefined") {
        Swal.fire("TronLink غير مثبت", "يرجى تثبيت TronLink أولاً", "warning");
        return false;
    }

    try {
        await window.tronLink.request({ method: "tron_requestAccounts" });
        tronWebInstance = window.tronLink.tronWeb;
        currentUserAddress = tronWebInstance.defaultAddress.base58;

        const balance = await getUSDTBalance(currentUserAddress);

        // تحديث شريط المحفظة
        const walletEl = document.getElementById("walletStatus");
        walletEl.innerHTML = `
            \( {currentUserAddress.substring(0, 6)}... \){currentUserAddress.substring(currentUserAddress.length - 4)}
            <span class="text-green-600">(${balance.toFixed(2)} USDT)</span>
        `;
        walletEl.className = "px-5 py-2.5 bg-green-50 text-green-700 text-sm font-bold rounded-3xl border border-green-200 cursor-pointer";

        Swal.fire({
            title: "تم الربط بنجاح",
            html: `العنوان: <b>\( {currentUserAddress}</b><br>الرصيد: <b> \){balance.toFixed(2)} USDT</b>`,
            icon: "success"
        });

        return true;
    } catch (err) {
        console.error(err);
        Swal.fire("فشل الربط", err.message || "حدث خطأ أثناء الاتصال", "error");
        return false;
    }
}

export async function getUSDTBalance(address) {
    if (!tronWebInstance) return 0;

    try {
        const contract = await tronWebInstance.contract().at(USDT_ADDRESS);
        const balanceHex = await contract.balanceOf(address).call();
        return Number(balanceHex) / 1_000_000; // USDT لديه 6 أرقام عشرية
    } catch (error) {
        console.error("خطأ في جلب رصيد USDT:", error);
        return 0;
    }
}
