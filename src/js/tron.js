export let tronWebInstance = null;
const USDT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function connectWallet() {
    if (typeof window.tronLink === "undefined") return false;
    await window.tronLink.request({ method: "tron_requestAccounts" });
    tronWebInstance = window.tronLink.tronWeb;
    const addr = tronWebInstance.defaultAddress.base58;
    const bal = await getUSDTBalance(addr);
    
    document.getElementById("walletStatus").innerHTML = `${addr.substring(0,4)}...${addr.slice(-4)} | ${bal.toFixed(2)} USDT`;
    document.getElementById("walletStatus").classList.replace('bg-red-50','bg-green-50');
    document.getElementById("walletStatus").classList.replace('text-red-600','text-green-600');
    return true;
}

export async function getUSDTBalance(address) {
    try {
        const contract = await window.tronLink.tronWeb.contract().at(USDT_ADDRESS);
        const balance = await contract.balanceOf(address).call();
        return Number(balance) / 1000000;
    } catch (e) { return 0; }
}
