export let tronWebInstance = null;

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function connectWallet() {
    if (!window.tronLink) {
        Swal.fire("ثبت TronLink");
        return false;
    }

    await window.tronLink.request({ method: "tron_requestAccounts" });

    tronWebInstance = window.tronLink.tronWeb;

    return true;
}

export async function getUSDTBalance(address) {
    try {
        const contract = await window.tronLink.tronWeb.contract().at(USDT_CONTRACT);
        const balance = await contract.balanceOf(address).call();
        return Number(balance) / 1e6;
    } catch {
        return 0;
    }
}
