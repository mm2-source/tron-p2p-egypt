// src/js/tron.js
export let tronWebInstance = null;
export let currentUserAddress = null;

const USDT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function connectWallet() {
    if (typeof window.tronLink === "undefined") {
        Swal.fire("TronLink غير مثبت", "يرجى استخدام متصفح يدعم TronLink", "warning");
        return false;
    }

    try {
        await window.tronLink.request({ method: "tron_requestAccounts" });
        tronWebInstance = window.tronLink.tronWeb;
        currentUserAddress = tronWebInstance.defaultAddress.base58;

        const balance = await getUSDTBalance(currentUserAddress);

        const walletEl = document.getElementById("walletStatus");
        // اختصار العنوان: T...XXXX
        const shortAddr = `${currentUserAddress.substring(0, 4)}...${currentUserAddress.slice(-4)}`;
        
        walletEl.innerHTML = `${shortAddr} | <span class="text-green-600">${balance.toFixed(2)} USDT</span>`;
        walletEl.className = "text-[10px] bg-green-50 text-green-700 px-3 py-1.5 rounded-full font-bold border border-green-200 cursor-pointer";

        return true;
    } catch (err) {
        return false;
    }
}

export async function getUSDTBalance(address) {
    if (!tronWebInstance) return 0;
    try {
        const contract = await tronWebInstance.contract().at(USDT_ADDRESS);
        const balanceHex = await contract.balanceOf(address).call();
        return Number(balanceHex) / 1000000;
    } catch (error) {
        console.error("Balance Error:", error);
        return 0;
    }
}
