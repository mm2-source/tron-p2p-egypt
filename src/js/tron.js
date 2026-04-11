export let tronWebInstance = null;

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export async function connectWallet() {
    if (!window.tronLink) {
        Swal.fire("ثبت TronLink");
        return false;
    }

    await window.tronLink.request({ method: "tron_requestAccounts" });

    tronWebInstance = window.tronLink.tronWeb;

    const addr = tronWebInstance.defaultAddress.base58;

    document.getElementById("walletStatus").innerText =
        addr.slice(0,4) + "..." + addr.slice(-4);

    return true;
}

export async function getUSDTBalance(address) {
    try {
        const contract = await window.tronLink.tronWeb
            .contract()
            .at(USDT_CONTRACT);

        const bal = await contract.balanceOf(address).call();
        return Number(bal) / 1e6;
    } catch {
        return 0;
    }
}
