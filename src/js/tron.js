export let tronWebInstance = null;
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function connectWallet() {
    if (typeof window.tronLink === "undefined") return false;
    const res = await window.tronLink.request({ method: "tron_requestAccounts" });
    if(res.code !== 200) return false;
    
    tronWebInstance = window.tronLink.tronWeb;
    const addr = tronWebInstance.defaultAddress.base58;
    const bal = await getUSDTBalance(addr);
    
    const status = document.getElementById("walletStatus");
    status.innerHTML = `${addr.substring(0,4)}...${addr.slice(-4)} | ${bal.toFixed(1)} USDT`;
    status.className = "text-[10px] bg-green-50 text-green-600 px-3 py-1 rounded-full font-bold cursor-pointer border border-green-100";
    return true;
}

export async function getUSDTBalance(address) {
    try {
        const contract = await window.tronLink.tronWeb.contract().at(USDT_CONTRACT);
        const balance = await contract.balanceOf(address).call();
        return Number(balance) / 1000000;
    } catch (e) { return 0; }
}
