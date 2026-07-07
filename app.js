// ==========================================================================
// STATE VARIABLES
// ==========================================================================
let currentInput = '0';
let historyInput = '';
let isEvaluated = false;
let currentExpression = ''; // The exact math expression that got locked

// Subscription & Paywall State
let subscriptionActive = false;
const basePrice = 1.99;
let currentPrice = basePrice;

// Blackjack State
let deck = [];
let playerHand = [];
let dealerHand = [];
let gameState = 'betting'; // 'betting', 'player-turn', 'dealer-turn', 'resolved'
let pendingCalculationResult = ''; // Holds the result to display after unlock

// Suits and Card Definitions
const SUITS = [
    { name: 'hearts', symbol: '♥', color: 'red-suit' },
    { name: 'diamonds', symbol: '♦', color: 'red-suit' },
    { name: 'clubs', symbol: '♣', color: 'black-suit' },
    { name: 'spades', symbol: '♠', color: 'black-suit' }
];
const RANKS = [
    { name: '2', val: 2 }, { name: '3', val: 3 }, { name: '4', val: 4 },
    { name: '5', val: 5 }, { name: '6', val: 6 }, { name: '7', val: 7 },
    { name: '8', val: 8 }, { name: '9', val: 9 }, { name: '10', val: 10 },
    { name: 'J', val: 10 }, { name: 'Q', val: 10 }, { name: 'K', val: 10 },
    { name: 'A', val: 11 } // Dynamic value logic handles 1 or 11
];

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    updatePricesUI();
    setupCardInputListeners();
});

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds (aligns with CSS animation)
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ==========================================================================
// CALCULATOR LOGIC
// ==========================================================================
function updateDisplay() {
    const displayElement = document.getElementById('calc-display');
    const historyElement = document.getElementById('calc-history');
    
    displayElement.textContent = formatDisplayNumber(currentInput);
    historyElement.textContent = historyInput;
}

function formatDisplayNumber(numStr) {
    if (numStr === 'Error') return 'Error';
    
    // Split by operator to avoid formatting the whole expression as one number
    const parts = numStr.split(/([\+\-\*\/%])/);
    return parts.map(part => {
        if (/[\+\-\*\/%]/.test(part)) {
            // Replace operators with pretty symbols
            if (part === '/') return ' ÷ ';
            if (part === '*') return ' × ';
            if (part === '-') return ' − ';
            if (part === '+') return ' + ';
            if (part === '%') return ' % ';
            return ` ${part} `;
        }
        
        // Format normal numbers with commas
        const dotIndex = part.indexOf('.');
        if (dotIndex !== -1) {
            const integerPart = part.substring(0, dotIndex);
            const decimalPart = part.substring(dotIndex);
            return parseFloat(integerPart).toLocaleString('es') + decimalPart;
        } else {
            const parsed = parseFloat(part);
            return isNaN(parsed) ? part : parsed.toLocaleString('es');
        }
    }).join('');
}

function appendNumber(num) {
    if (isEvaluated) {
        currentInput = num;
        isEvaluated = false;
    } else {
        if (currentInput === '0') {
            currentInput = num;
        } else {
            currentInput += num;
        }
    }
    updateDisplay();
}

function appendDecimal() {
    if (isEvaluated) {
        currentInput = '0.';
        isEvaluated = false;
        updateDisplay();
        return;
    }
    
    // Find last number segment (after the last operator)
    const segments = currentInput.split(/[\+\-\*\/%]/);
    const lastSegment = segments[segments.length - 1];
    
    if (!lastSegment.includes('.')) {
        currentInput += '.';
    }
    updateDisplay();
}

function appendOperator(op) {
    if (isEvaluated) {
        isEvaluated = false;
    }
    
    const lastChar = currentInput.slice(-1);
    // If last char is already an operator, replace it
    if (/[\+\-\*\/%]/.test(lastChar)) {
        currentInput = currentInput.slice(0, -1) + op;
    } else {
        currentInput += op;
    }
    updateDisplay();
}

function clearCalculator() {
    currentInput = '0';
    historyInput = '';
    isEvaluated = false;
    updateDisplay();
}

function deleteLastChar() {
    if (isEvaluated) {
        clearCalculator();
        return;
    }
    
    if (currentInput.length > 1) {
        currentInput = currentInput.slice(0, -1);
    } else {
        currentInput = '0';
    }
    updateDisplay();
}

function handleEquals() {
    if (currentInput === '0' || /[\+\-\*\/%]$/.test(currentInput)) {
        return; // Empty or incomplete expression
    }

    currentExpression = currentInput;
    
    // Evaluate safely
    let result = '';
    try {
        // Sanitize to only allow numbers, operators and decimal points
        const sanitized = currentExpression.replace(/[^0-9\+\-\*\/\%\.]/g, '');
        // Evaluate the mathematical result
        const evalResult = new Function(`return (${sanitized})`)();
        
        if (evalResult === Infinity || isNaN(evalResult)) {
            result = 'Error';
        } else {
            // Keep decimal precision reasonable
            result = Number(Math.round(evalResult + 'e+8') + 'e-8').toString();
        }
    } catch (e) {
        result = 'Error';
    }

    if (result === 'Error') {
        currentInput = 'Error';
        historyInput = '';
        updateDisplay();
        return;
    }

    pendingCalculationResult = result;

    if (subscriptionActive) {
        // Direct calculation if premium subscription is active
        currentInput = pendingCalculationResult;
        historyInput = currentExpression + ' =';
        isEvaluated = true;
        updateDisplay();
        showToast('Cálculo premium completado', 'success');
    } else {
        // Block and trigger the paywall
        openModal('paywall-modal');
        document.getElementById('locked-expression').textContent = formatDisplayNumber(currentExpression);
    }
}

// ==========================================================================
// MODAL MANAGEMENT
// ==========================================================================
function openModal(id) {
    document.getElementById(id).classList.add('show');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

// ==========================================================================
// PRICING MANAGEMENT
// ==========================================================================
function updatePricesUI() {
    const formattedPrice = currentPrice.toFixed(2);
    const nextPrice = (currentPrice * 2).toFixed(2);
    
    document.getElementById('sub-price').textContent = formattedPrice;
    document.getElementById('pay-button-amount').textContent = `$${formattedPrice}`;
    document.getElementById('pay-button-amount').parentElement.setAttribute('data-price', formattedPrice);
    document.getElementById('next-price-preview').textContent = `$${nextPrice}`;
}

// ==========================================================================
// MOCK PAYMENT PROCESSOR
// ==========================================================================
function openPaymentModal() {
    closeModal('paywall-modal');
    openModal('payment-modal');
    
    // Reset form & success panel state
    document.getElementById('payment-form').classList.remove('hide');
    document.getElementById('payment-success-panel').classList.add('hide');
    document.getElementById('payment-form').reset();
    resetCardPreview();
}

function updateCardPreview() {
    const holderInput = document.getElementById('card-holder').value;
    const numberInput = document.getElementById('card-number').value;
    const expiryInput = document.getElementById('card-expiry').value;
    
    // Update Number Preview
    let formattedNumber = numberInput.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
    document.getElementById('card-number').value = formattedNumber; // Set input value with formatting
    document.getElementById('card-number-display').textContent = formattedNumber || '•••• •••• •••• ••••';
    
    // Update Holder Preview
    document.getElementById('card-holder-val').textContent = holderInput.toUpperCase() || 'NOMBRE APELLIDO';
    
    // Update Expiry Preview
    let formattedExpiry = expiryInput;
    if (expiryInput.length === 2 && !expiryInput.includes('/')) {
        formattedExpiry = expiryInput + '/';
        document.getElementById('card-expiry').value = formattedExpiry;
    }
    document.getElementById('card-expiry-val').textContent = formattedExpiry || 'MM/AA';
}

function resetCardPreview() {
    document.getElementById('card-number-display').textContent = '•••• •••• •••• ••••';
    document.getElementById('card-holder-val').textContent = 'NOMBRE APELLIDO';
    document.getElementById('card-expiry-val').textContent = 'MM/AA';
}

function setupCardInputListeners() {
    // Prevent typing non-numeric characters for card number and expiry
    document.getElementById('card-number').addEventListener('keypress', (e) => {
        if (e.which < 48 || e.which > 57) e.preventDefault();
    });
    
    document.getElementById('card-expiry').addEventListener('keypress', (e) => {
        if (e.which < 48 || e.which > 57) e.preventDefault();
    });
}

function handlePaymentSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('btn-submit-payment');
    const payText = document.getElementById('btn-pay-text');
    const spinner = document.getElementById('btn-pay-spinner');
    
    // Show spinner & disable button
    submitBtn.disabled = true;
    payText.classList.add('hide');
    spinner.classList.remove('hide');
    
    // Simulate server transaction
    setTimeout(() => {
        submitBtn.disabled = false;
        payText.classList.remove('hide');
        spinner.classList.add('hide');
        
        // Show success animation
        document.getElementById('payment-form').classList.add('hide');
        document.getElementById('payment-success-panel').classList.remove('hide');
        
        // Grant premium access
        subscriptionActive = true;
        currentPrice = basePrice; // Reset price
        updatePricesUI();
    }, 1800);
}

function finishPaymentUnlock() {
    closeModal('payment-modal');
    
    // Display result on calculator
    currentInput = pendingCalculationResult;
    historyInput = currentExpression + ' =';
    isEvaluated = true;
    updateDisplay();
    
    showToast('¡Resultado desbloqueado con éxito!', 'success');
}

// ==========================================================================
// BLACKJACK LOGIC (CASINO QUANTUM)
// ==========================================================================
function openBlackjackGame() {
    closeModal('paywall-modal');
    openModal('blackjack-modal');
    
    startNewBlackjackRound();
}

function createDeck() {
    let newDeck = [];
    for (let suit of SUITS) {
        for (let rank of RANKS) {
            newDeck.push({
                rank: rank.name,
                value: rank.val,
                symbol: suit.symbol,
                color: suit.color,
                suitName: suit.name
            });
        }
    }
    return newDeck;
}

function shuffleDeck(deckToShuffle) {
    for (let i = deckToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckToShuffle[i], deckToShuffle[j]] = [deckToShuffle[j], deckToShuffle[i]];
    }
    return deckToShuffle;
}

function startNewBlackjackRound() {
    deck = shuffleDeck(createDeck());
    playerHand = [];
    dealerHand = [];
    gameState = 'player-turn';
    
    // Deal initial cards
    playerHand.push(deck.pop());
    dealerHand.push(deck.pop());
    playerHand.push(deck.pop());
    dealerHand.push(deck.pop()); // Second dealer card is face down
    
    // Setup Controls
    document.getElementById('btn-hit').disabled = false;
    document.getElementById('btn-stand').disabled = false;
    document.getElementById('btn-hit').classList.remove('hide');
    document.getElementById('btn-stand').classList.remove('hide');
    
    document.getElementById('btn-bj-reset').classList.add('hide');
    document.getElementById('btn-bj-exit').classList.add('hide');
    
    // Reset status banner
    const statusBanner = document.getElementById('game-status-banner');
    statusBanner.className = 'game-status-banner';
    document.getElementById('game-status-text').textContent = '¿Pides carta o te plantas?';
    
    updateBlackjackUI();
    
    // Check for immediate Blackjack
    checkInitialBlackjack();
}

function getHandScore(hand) {
    let score = 0;
    let aces = 0;
    
    for (let card of hand) {
        score += card.value;
        if (card.rank === 'A') {
            aces++;
        }
    }
    
    // Adjust aces from 11 to 1 if score busts
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

function updateBlackjackUI() {
    const dealerCardsContainer = document.getElementById('dealer-cards');
    const playerCardsContainer = document.getElementById('player-cards');
    
    dealerCardsContainer.innerHTML = '';
    playerCardsContainer.innerHTML = '';
    
    // Render Dealer Hand
    dealerHand.forEach((card, index) => {
        // Hide dealer's second card if it's player's turn
        const isFaceUp = (gameState === 'player-turn' && index === 1) ? false : true;
        dealerCardsContainer.appendChild(createCardDOM(card, isFaceUp));
    });
    
    // Render Player Hand
    playerHand.forEach(card => {
        playerCardsContainer.appendChild(createCardDOM(card, true));
    });
    
    // Render Scores
    const playerVal = getHandScore(playerHand);
    document.getElementById('player-score').textContent = playerVal;
    
    if (gameState === 'player-turn') {
        // Dealer score shows only first card value
        document.getElementById('dealer-score').textContent = dealerHand[0].rank === 'A' ? '11' : dealerHand[0].value;
    } else {
        document.getElementById('dealer-score').textContent = getHandScore(dealerHand);
    }
}

function createCardDOM(card, isFaceUp) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card' + (isFaceUp ? '' : ' flipped');
    
    cardEl.innerHTML = `
        <div class="card-face card-front ${card.color}">
            <div class="card-top-left">
                <span class="card-rank">${card.rank}</span>
                <span class="card-suit">${card.symbol}</span>
            </div>
            <div class="card-center-suit">${card.symbol}</div>
        </div>
        <div class="card-face card-back"></div>
    `;
    
    return cardEl;
}

function blackjackHit() {
    if (gameState !== 'player-turn') return;
    
    playerHand.push(deck.pop());
    updateBlackjackUI();
    
    const playerScore = getHandScore(playerHand);
    if (playerScore > 21) {
        // Player busted immediately
        resolveBlackjackRound('bust');
    }
}

function blackjackStand() {
    if (gameState !== 'player-turn') return;
    
    gameState = 'dealer-turn';
    updateBlackjackUI();
    
    // Disable action buttons
    document.getElementById('btn-hit').disabled = true;
    document.getElementById('btn-stand').disabled = true;
    
    // Dealer logic: draw cards until total is 17 or higher
    let dealerDrawInterval = setInterval(() => {
        const dealerScore = getHandScore(dealerHand);
        
        if (dealerScore < 17) {
            dealerHand.push(deck.pop());
            updateBlackjackUI();
        } else {
            clearInterval(dealerDrawInterval);
            evaluateDealerScore();
        }
    }, 800); // 800ms gap to create dealer suspense
}

function checkInitialBlackjack() {
    const pScore = getHandScore(playerHand);
    const dScore = getHandScore(dealerHand);
    
    if (pScore === 21) {
        gameState = 'dealer-turn';
        updateBlackjackUI();
        
        // Immediate stand if player hits natural blackjack
        setTimeout(() => {
            if (dScore === 21) {
                resolveBlackjackRound('push');
            } else {
                resolveBlackjackRound('blackjack');
            }
        }, 600);
    }
}

function evaluateDealerScore() {
    const playerScore = getHandScore(playerHand);
    const dealerScore = getHandScore(dealerHand);
    
    if (dealerScore > 21) {
        resolveBlackjackRound('dealer-bust');
    } else if (playerScore > dealerScore) {
        resolveBlackjackRound('win');
    } else if (playerScore < dealerScore) {
        resolveBlackjackRound('lose');
    } else {
        resolveBlackjackRound('push');
    }
}

function resolveBlackjackRound(outcome) {
    gameState = 'resolved';
    updateBlackjackUI();
    
    // Hide standard play buttons
    document.getElementById('btn-hit').classList.add('hide');
    document.getElementById('btn-stand').classList.add('hide');
    
    // Show exit and replay buttons
    document.getElementById('btn-bj-reset').classList.remove('hide');
    document.getElementById('btn-bj-exit').classList.remove('hide');
    
    const statusBanner = document.getElementById('game-status-banner');
    const statusText = document.getElementById('game-status-text');
    
    if (outcome === 'win' || outcome === 'dealer-bust' || outcome === 'blackjack') {
        // Player Wins!
        statusBanner.classList.add('toast-success');
        statusText.innerHTML = `<span class="status-victory">¡GANASTE EL DESAFÍO!</span> Te ganaste el resultado gratis.`;
        
        // Unlock result and reset price
        subscriptionActive = true;
        currentPrice = basePrice;
        updatePricesUI();
        
        showToast('¡Desbloqueo gratuito obtenido!', 'success');
        
        // Automatically make exit prominent
        document.getElementById('btn-bj-exit').classList.add('btn-action-main');
        document.getElementById('btn-bj-reset').classList.remove('btn-action-main');
        document.getElementById('btn-bj-reset').classList.add('btn-action-exit');
    } else if (outcome === 'lose' || outcome === 'bust') {
        // Player Loses!
        statusBanner.classList.add('toast-danger');
        statusText.innerHTML = `<span class="status-defeat">LA BANCA GANA.</span> El precio de suscripción ha subido.`;
        
        // Increase subscription price (double it)
        currentPrice = currentPrice * 2;
        updatePricesUI();
        
        showToast('Has perdido. El precio de la suscripción aumentó.', 'danger');
    } else if (outcome === 'push') {
        // Tie (Push)
        statusBanner.classList.add('toast-info');
        statusText.innerHTML = `<span class="status-push">EMPATE (PUSH).</span> Se mantiene el precio. Juega de nuevo para desempatar.`;
        showToast('Empate. Intenta jugar otra mano.', 'info');
    }
}

function closeBlackjackAndReturn() {
    closeModal('blackjack-modal');
    
    if (subscriptionActive) {
        // If they won, proceed to unlock calculation
        finishPaymentUnlock();
    } else {
        // If they lost/drew, send them back to the paywall with updated prices
        openModal('paywall-modal');
    }
}
