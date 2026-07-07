// ==========================================================================
// STATE VARIABLES & CHANNELS
// ==========================================================================
let currentInput = '0';
let historyInput = '';
let isEvaluated = false;
let currentExpression = ''; // The math expression that got locked
let activeCalcMode = 'standard'; // 'standard' or 'scientific'

// Subscription, Paywall & Timer State
let subscriptionActive = false;
let basePrice = 1.99;
let currentPrice = basePrice;
let activeGame = null; // 'blackjack', 'roulette', 'poker', 'dice', 'mines', 'crash', 'trading'

let paywallTimer = null;
let paywallTimeLeft = 60; // 60 seconds limit
let pendingCalculationResult = ''; // Result to display after unlock

// Suits and Card Definitions for Games
const SUITS = [
    { symbol: '♥', color: 'red-suit' }, { symbol: '♦', color: 'red-suit' },
    { symbol: '♣', color: 'black-suit' }, { symbol: '♠', color: 'black-suit' }
];
const RANKS = [
    { name: '2', val: 2 }, { name: '3', val: 3 }, { name: '4', val: 4 },
    { name: '5', val: 5 }, { name: '6', val: 6 }, { name: '7', val: 7 },
    { name: '8', val: 8 }, { name: '9', val: 9 }, { name: '10', val: 10 },
    { name: 'J', val: 10 }, { name: 'Q', val: 10 }, { name: 'K', val: 10 }, { name: 'A', val: 11 }
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
    setTimeout(() => { toast.remove(); }, 4000);
}

// ==========================================================================
// CALCULATOR MODE SWITCHING & INPUTS
// ==========================================================================
function toggleCalcMode(mode) {
    activeCalcMode = mode;
    
    const btnStd = document.getElementById('btn-mode-standard');
    const btnSci = document.getElementById('btn-mode-scientific');
    const sciKeypad = document.getElementById('scientific-keypad');
    
    if (mode === 'standard') {
        btnStd.classList.add('active');
        btnSci.classList.remove('active');
        sciKeypad.classList.add('hide');
    } else {
        btnStd.classList.remove('active');
        btnSci.classList.add('active');
        sciKeypad.classList.remove('hide');
    }
    
    clearCalculator();
}

function updateDisplay() {
    const displayElement = document.getElementById('calc-display');
    const historyElement = document.getElementById('calc-history');
    
    displayElement.textContent = formatDisplayNumber(currentInput);
    historyElement.textContent = historyInput;
}

function formatDisplayNumber(numStr) {
    if (numStr === 'Error') return 'Error';
    
    // Format operators nicely for display
    const parts = numStr.split(/([\+\-\*\/%\^\(\)]|sin|cos|tan|log|ln|√|π|e)/);
    return parts.map(part => {
        if (/[\+\-\*\/%\^]/.test(part)) {
            if (part === '/') return ' ÷ ';
            if (part === '*') return ' × ';
            if (part === '-') return ' − ';
            if (part === '+') return ' + ';
            if (part === '%') return ' % ';
            if (part === '^') return ' ^ ';
            return ` ${part} `;
        }
        return part;
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
    
    // Find characters after last operator/function boundary
    const segments = currentInput.split(/[\+\-\*\/%\^\(\)]/);
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
    if (/[\+\-\*\/%\^]/.test(lastChar)) {
        currentInput = currentInput.slice(0, -1) + op;
    } else {
        currentInput += op;
    }
    updateDisplay();
}

function appendSciFunction(fnName) {
    if (isEvaluated) {
        currentInput = '';
        isEvaluated = false;
    }
    
    if (fnName === 'sqr') {
        // Appends square power to current expression
        currentInput += '^2';
    } else {
        if (currentInput === '0') {
            currentInput = fnName;
        } else {
            currentInput += fnName;
        }
    }
    updateDisplay();
}

function appendConstant(constantChar) {
    if (isEvaluated) {
        currentInput = constantChar;
        isEvaluated = false;
    } else {
        if (currentInput === '0') {
            currentInput = constantChar;
        } else {
            currentInput += constantChar;
        }
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
    
    // Delete functions as a single block if possible (e.g. sin(, cos(, log(, ln()
    const matchFn = currentInput.match(/(sin\(|cos\(|tan\(|log\(|ln\(|√\()$/);
    if (matchFn) {
        currentInput = currentInput.slice(0, -matchFn[0].length);
    } else if (currentInput.length > 1) {
        currentInput = currentInput.slice(0, -1);
    } else {
        currentInput = '0';
    }
    
    if (currentInput === '') {
        currentInput = '0';
    }
    updateDisplay();
}

// ==========================================================================
// MATHEMATICAL EVALUATION PARSER
// ==========================================================================
function parseScientificExpression(expr) {
    let parsed = expr;
    
    // 1. Replace Constants (protect inside words by specifying boundary rules)
    parsed = parsed.replace(/π/g, 'Math.PI');
    parsed = parsed.replace(/\be\b/g, 'Math.E');
    
    // 2. Replace scientific math functions
    parsed = parsed.replace(/sin\(/g, 'Math.sin(');
    parsed = parsed.replace(/cos\(/g, 'Math.cos(');
    parsed = parsed.replace(/tan\(/g, 'Math.tan(');
    parsed = parsed.replace(/log\(/g, 'Math.log10(');
    parsed = parsed.replace(/ln\(/g, 'Math.log(');
    parsed = parsed.replace(/√\(/g, 'Math.sqrt(');
    
    // 3. Replace Power notation
    parsed = parsed.replace(/\^/g, '**');
    
    return parsed;
}

function handleEquals() {
    if (currentInput === '0' || /[\+\-\*\/%\^]$/.test(currentInput)) {
        return;
    }

    currentExpression = currentInput;
    
    let result = '';
    try {
        // Parse screens representation to JS Math object calls
        const parsedExpression = parseScientificExpression(currentExpression);
        
        // Sanitize to only permit numbers, Math attributes, operators, decimals, and parentheses
        const sanitized = parsedExpression.replace(/[^0-9\+\-\*\/\%\.\(\)MathPIEsinclog1rt\*\*]/g, '');
        
        const evalResult = new Function(`return (${sanitized})`)();
        
        if (evalResult === Infinity || isNaN(evalResult)) {
            result = 'Error';
        } else {
            // Precision scaling
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
        currentInput = pendingCalculationResult;
        historyInput = currentExpression + ' =';
        isEvaluated = true;
        updateDisplay();
        showToast('Cálculo premium completado', 'success');
    } else {
        // Evaluate dynamic difficulty and base price
        const difficulty = calculateDifficulty(currentExpression);
        basePrice = difficulty.price;
        currentPrice = difficulty.price;
        updatePricesUI();
        
        // Update difficulty badge
        const badge = document.getElementById('difficulty-badge');
        if (badge) {
            badge.textContent = difficulty.name;
            badge.className = `badge ${difficulty.class}`;
        }
        
        // Trigger Countdown Expiry Timer
        startPaywallCountdown();
        
        openModal('paywall-modal');
        document.getElementById('locked-expression').textContent = formatDisplayNumber(currentExpression);
    }
}

// Dynamic difficulty pricing calculator
function calculateDifficulty(expression) {
    const operators = (expression.match(/[\+\-\*\/%]/g) || []).length;
    const decimals = (expression.match(/\./g) || []).length;
    
    // Detect scientific operators
    const sciOperators = (expression.match(/(sin|cos|tan|log|ln|√|\^)/g) || []).length;
    const constants = (expression.match(/(π|e)/g) || []).length;
    
    let score = 1;
    score += operators * 0.75;
    score += decimals * 0.5;
    score += sciOperators * 2.5; // High value for complex math
    score += constants * 1.5;
    
    const numbers = expression.split(/[\+\-\*\/%\^\(\)]/).map(parseFloat);
    const hasLargeNum = numbers.some(n => !isNaN(n) && Math.abs(n) > 99);
    if (hasLargeNum) score += 0.75;
    
    if (score >= 5.0) {
        return { name: 'Científica / Ultra', price: 9.99, class: 'badge-scientific' };
    } else if (score >= 4.0) {
        return { name: 'Avanzada', price: 4.99, class: 'badge-advanced' };
    } else if (score >= 2.0) {
        return { name: 'Media', price: 2.49, class: 'badge-medium' };
    } else {
        return { name: 'Simple', price: 0.99, class: 'badge-simple' };
    }
}

// ==========================================================================
// COUNTDOWN EXPIRY TIMER LOGIC
// ==========================================================================
function startPaywallCountdown() {
    stopPaywallCountdown(); // Clear any running timer
    paywallTimeLeft = 60;
    
    updateTimerUI();
    
    paywallTimer = setInterval(() => {
        paywallTimeLeft--;
        updateTimerUI();
        
        if (paywallTimeLeft <= 0) {
            handlePaywallExpiry();
        }
    }, 1000);
}

function stopPaywallCountdown() {
    if (paywallTimer) {
        clearInterval(paywallTimer);
        paywallTimer = null;
    }
}

function updateTimerUI() {
    const timeText = `${paywallTimeLeft}s`;
    
    // Update labels in Paywall & Selector
    const paywallText = document.getElementById('paywall-countdown');
    const selectorText = document.getElementById('selector-countdown');
    
    if (paywallText) {
        paywallText.textContent = timeText;
        paywallText.classList.toggle('danger-alert', paywallTimeLeft <= 10);
    }
    if (selectorText) {
        selectorText.textContent = timeText;
        selectorText.classList.toggle('danger-alert', paywallTimeLeft <= 10);
    }
    
    // Update in-game countdown texts
    document.querySelectorAll('.game-countdown-text').forEach(el => {
        el.textContent = timeText;
        el.classList.toggle('danger-alert', paywallTimeLeft <= 10);
    });
}

function handlePaywallExpiry() {
    stopPaywallCountdown();
    
    // Close all game/payment views
    closeModal('paywall-modal');
    closeModal('selector-modal');
    closeModal('payment-modal');
    if (activeGame) {
        closeModal(`${activeGame}-modal`);
        if (activeGame === 'crash') stopCrashLoop();
        if (activeGame === 'trading') stopTradingLoop();
        activeGame = null;
    }
    
    // Wipe current calculator expression & results
    clearCalculator();
    showToast('¡Tiempo agotado! Has perdido la operación y el resultado.', 'danger');
}

function closePaywallModal() {
    stopPaywallCountdown();
    closeModal('paywall-modal');
    clearCalculator(); // Forfeits results if closed manually
}

// ==========================================================================
// MODAL MANAGEMENT
// ==========================================================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}

// ==========================================================================
// MOCK PAYMENT PROCESSOR
// ==========================================================================
function openPaymentModal() {
    closeModal('paywall-modal');
    openModal('payment-modal');
    
    document.getElementById('payment-form').classList.remove('hide');
    document.getElementById('payment-success-panel').classList.add('hide');
    document.getElementById('payment-form').reset();
    resetCardPreview();
}

function updateCardPreview() {
    const holderInput = document.getElementById('card-holder').value;
    const numberInput = document.getElementById('card-number').value;
    const expiryInput = document.getElementById('card-expiry').value;
    
    let formattedNumber = numberInput.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
    document.getElementById('card-number').value = formattedNumber;
    document.getElementById('card-number-display').textContent = formattedNumber || '•••• •••• •••• ••••';
    
    document.getElementById('card-holder-val').textContent = holderInput.toUpperCase() || 'NOMBRE APELLIDO';
    
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
    const numEl = document.getElementById('card-number');
    const expEl = document.getElementById('card-expiry');
    if (numEl) {
        numEl.addEventListener('keypress', (e) => {
            if (e.which < 48 || e.which > 57) e.preventDefault();
        });
    }
    if (expEl) {
        expEl.addEventListener('keypress', (e) => {
            if (e.which < 48 || e.which > 57) e.preventDefault();
        });
    }
}

function handlePaymentSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('btn-submit-payment');
    const payText = document.getElementById('btn-pay-text');
    const spinner = document.getElementById('btn-pay-spinner');
    
    submitBtn.disabled = true;
    payText.classList.add('hide');
    spinner.classList.remove('hide');
    
    setTimeout(() => {
        submitBtn.disabled = false;
        payText.classList.remove('hide');
        spinner.classList.add('hide');
        
        document.getElementById('payment-form').classList.add('hide');
        document.getElementById('payment-success-panel').classList.remove('hide');
        
        subscriptionActive = true;
        currentPrice = basePrice; // Reset price
        updatePricesUI();
    }, 1800);
}

function finishPaymentUnlock() {
    closeModal('payment-modal');
    
    currentInput = pendingCalculationResult;
    historyInput = currentExpression + ' =';
    isEvaluated = true;
    updateDisplay();
    
    showToast('¡Resultado desbloqueado con éxito!', 'success');
}

// ==========================================================================

// ==========================================================================
// NAVIGATION & STAKES CONTROLLER
// ==========================================================================
function getNextPrice() {
    return (currentPrice * 2).toFixed(2);
}

function updatePricesUI() {
    const formattedPrice = currentPrice.toFixed(2);
    const nextPrice = getNextPrice();
    
    document.getElementById('sub-price').textContent = formattedPrice;
    document.getElementById('pay-button-amount').textContent = `$${formattedPrice}`;
    document.getElementById('selector-price-preview').textContent = `$${nextPrice}`;
    
    document.querySelectorAll('.next-price-text').forEach(el => {
        el.textContent = `$${nextPrice}`;
    });
}

function openGameSelector() {
    closeModal('paywall-modal');
    updatePricesUI();
    openModal('selector-modal');
}

function closeGameSelectorAndReturn() {
    closeModal('selector-modal');
    openModal('paywall-modal');
}

function selectGame(gameName) {
    closeModal('selector-modal');
    activeGame = gameName;
    updatePricesUI();
    
    if (gameName === 'blackjack') {
        openModal('blackjack-modal');
        startNewBlackjackRound();
    } else if (gameName === 'roulette') {
        openModal('roulette-modal');
        initRouletteGame();
    } else if (gameName === 'poker') {
        openModal('poker-modal');
        initPokerGame();
    } else if (gameName === 'dice') {
        openModal('dice-modal');
        initDiceGame();
    } else if (gameName === 'mines') {
        openModal('mines-modal');
        initMinesGame();
    } else if (gameName === 'crash') {
        openModal('crash-modal');
        setTimeout(() => {
            resizeCanvases();
            initCrashGame();
        }, 150);
    } else if (gameName === 'trading') {
        openModal('trading-modal');
        setTimeout(() => {
            resizeCanvases();
            initTradingGame();
        }, 150);
    }
}

function resizeCanvases() {
    const crashArena = document.querySelector('.crash-arena');
    const crashCanvas = document.getElementById('crash-canvas');
    if (crashArena && crashCanvas) {
        crashCanvas.width = crashArena.clientWidth || 340;
        crashCanvas.height = crashArena.clientHeight || 180;
    }
    const chartContainer = document.querySelector('.stock-chart-container');
    const tradingCanvas = document.getElementById('trading-canvas');
    if (chartContainer && tradingCanvas) {
        tradingCanvas.width = chartContainer.clientWidth || 340;
        tradingCanvas.height = chartContainer.clientHeight || 150;
    }
}

function closeGameAndReturn() {
    const gameModalId = `${activeGame}-modal`;
    closeModal(gameModalId);
    
    if (activeGame === 'crash') stopCrashLoop();
    if (activeGame === 'trading') stopTradingLoop();
    
    if (subscriptionActive) {
        stopPaywallCountdown();
        finishPaymentUnlock();
    } else {
        openGameSelector();
    }
    activeGame = null;
}

// ==========================================================================
// GAME SESSIONS HANDLER
// ==========================================================================
function resolveGameSession(outcome, gameName, statusTextEl, statusBannerEl, exitBtnEl, resetBtnEl) {
    if (outcome === 'win') {
        subscriptionActive = true;
        currentPrice = basePrice;
        updatePricesUI();
        stopPaywallCountdown(); // Safe stop
        
        statusBannerEl.className = 'game-status-banner toast-success';
        statusTextEl.innerHTML = `<span class="status-victory">¡VICTORIA!</span> El resultado ha sido desbloqueado gratis.`;
        showToast('¡Desbloqueo gratuito obtenido!', 'success');
        
        if (exitBtnEl) {
            exitBtnEl.classList.add('btn-action-main');
            exitBtnEl.classList.remove('hide');
        }
        if (resetBtnEl) resetBtnEl.classList.add('hide');
    } else if (outcome === 'lose') {
        currentPrice = currentPrice * 2;
        updatePricesUI();
        
        statusBannerEl.className = 'game-status-banner toast-danger';
        statusTextEl.innerHTML = `<span class="status-defeat">DERROTA.</span> La penalización duplicó la suscripción.`;
        showToast('Has perdido. La suscripción subió de precio.', 'danger');
        
        if (exitBtnEl) exitBtnEl.classList.remove('hide');
        if (resetBtnEl) {
            resetBtnEl.classList.remove('hide');
            resetBtnEl.classList.remove('btn-action-main');
            resetBtnEl.classList.add('btn-action-exit');
        }
    } else if (outcome === 'push') {
        statusBannerEl.className = 'game-status-banner toast-info';
        statusTextEl.innerHTML = `<span class="status-push">EMPATE (PUSH).</span> El precio se mantiene. Juega otra vez.`;
        showToast('Empate. Inténtalo de nuevo.', 'info');
        
        if (exitBtnEl) exitBtnEl.classList.remove('hide');
        if (resetBtnEl) {
            resetBtnEl.classList.remove('hide');
            resetBtnEl.classList.add('btn-action-main');
        }
    }
}

// ==========================================================================
// GAME 1: BLACKJACK
// ==========================================================================
let blackjackDeck = [];
let blackjackPlayerHand = [];
let blackjackDealerHand = [];
let blackjackGameState = 'idle';

function startNewBlackjackRound() {
    blackjackDeck = [];
    for (let suit of SUITS) {
        for (let rank of RANKS) {
            blackjackDeck.push({ rank: rank.name, value: rank.val, symbol: suit.symbol, color: suit.color });
        }
    }
    for (let i = blackjackDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blackjackDeck[i], blackjackDeck[j]] = [blackjackDeck[j], blackjackDeck[i]];
    }

    blackjackPlayerHand = [blackjackDeck.pop(), blackjackDeck.pop()];
    blackjackDealerHand = [blackjackDeck.pop(), blackjackDeck.pop()];
    blackjackGameState = 'player-turn';
    
    document.getElementById('btn-hit').disabled = false;
    document.getElementById('btn-stand').disabled = false;
    document.getElementById('btn-hit').classList.remove('hide');
    document.getElementById('btn-stand').classList.remove('hide');
    document.getElementById('btn-bj-reset').classList.add('hide');
    document.getElementById('btn-bj-exit').classList.add('hide');
    
    const banner = document.getElementById('blackjack-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('blackjack-status-text').textContent = '¿Pides carta o te plantas?';
    
    updateBlackjackUI();
    
    if (getHandScore(blackjackPlayerHand) === 21) {
        blackjackGameState = 'dealer-turn';
        updateBlackjackUI();
        setTimeout(() => {
            if (getHandScore(blackjackDealerHand) === 21) resolveBlackjack('push');
            else resolveBlackjack('win');
        }, 500);
    }
}

function updateBlackjackUI() {
    const dContainer = document.getElementById('dealer-cards');
    const pContainer = document.getElementById('player-cards');
    dContainer.innerHTML = '';
    pContainer.innerHTML = '';
    
    blackjackDealerHand.forEach((card, i) => {
        const isFaceUp = (blackjackGameState === 'player-turn' && i === 1) ? false : true;
        dContainer.appendChild(createCardDOM(card, isFaceUp));
    });
    
    blackjackPlayerHand.forEach(card => {
        pContainer.appendChild(createCardDOM(card, true));
    });
    
    document.getElementById('player-score').textContent = getHandScore(blackjackPlayerHand);
    if (blackjackGameState === 'player-turn') {
        document.getElementById('dealer-score').textContent = blackjackDealerHand[0].rank === 'A' ? '11' : blackjackDealerHand[0].value;
    } else {
        document.getElementById('dealer-score').textContent = getHandScore(blackjackDealerHand);
    }
}

function blackjackHit() {
    if (blackjackGameState !== 'player-turn') return;
    blackjackPlayerHand.push(blackjackDeck.pop());
    updateBlackjackUI();
    if (getHandScore(blackjackPlayerHand) > 21) {
        resolveBlackjack('lose');
    }
}

function blackjackStand() {
    if (blackjackGameState !== 'player-turn') return;
    blackjackGameState = 'dealer-turn';
    updateBlackjackUI();
    
    document.getElementById('btn-hit').disabled = true;
    document.getElementById('btn-stand').disabled = true;
    
    let interval = setInterval(() => {
        const dScore = getHandScore(blackjackDealerHand);
        if (dScore < 17) {
            blackjackDealerHand.push(blackjackDeck.pop());
            updateBlackjackUI();
        } else {
            clearInterval(interval);
            const pScore = getHandScore(blackjackPlayerHand);
            if (dScore > 21) resolveBlackjack('win');
            else if (pScore > dScore) resolveBlackjack('win');
            else if (pScore < dScore) resolveBlackjack('lose');
            else resolveBlackjack('push');
        }
    }, 600);
}

function resolveBlackjack(outcome) {
    blackjackGameState = 'resolved';
    document.getElementById('btn-hit').classList.add('hide');
    document.getElementById('btn-stand').classList.add('hide');
    
    const textEl = document.getElementById('blackjack-status-text');
    const bannerEl = document.getElementById('blackjack-status-banner');
    const exitBtn = document.getElementById('btn-bj-exit');
    const resetBtn = document.getElementById('btn-bj-reset');
    
    resolveGameSession(outcome, 'blackjack', textEl, bannerEl, exitBtn, resetBtn);
}

// ==========================================================================
// GAME 2: ROULETTE
// ==========================================================================
let rouletteSelectedBet = null;
const rouletteRedNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function initRouletteGame() {
    rouletteSelectedBet = null;
    document.getElementById('bet-number-val').value = '';
    document.getElementById('bet-btn-red').classList.remove('active');
    document.getElementById('bet-btn-black').classList.remove('active');
    document.getElementById('bet-number-val').classList.remove('active');
    
    document.getElementById('btn-spin-wheel').disabled = false;
    document.getElementById('btn-spin-wheel').classList.remove('hide');
    document.getElementById('btn-roulette-exit').classList.remove('btn-action-main');
    
    const banner = document.getElementById('roulette-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('roulette-status-text').textContent = 'Elige una apuesta (Rojo, Negro o Número) y gira.';
    document.getElementById('roulette-wheel-visual').style.transform = 'rotate(0deg)';
}

function setRouletteBet(type) {
    rouletteSelectedBet = type;
    document.getElementById('bet-btn-red').classList.toggle('active', type === 'red');
    document.getElementById('bet-btn-black').classList.toggle('active', type === 'black');
    document.getElementById('bet-number-val').classList.toggle('active', type === 'number');
    if (type !== 'number') document.getElementById('bet-number-val').value = '';
}

function playRouletteSpin() {
    if (!rouletteSelectedBet) {
        showToast('Elige una apuesta antes de girar', 'danger');
        return;
    }
    
    let exactNumber = null;
    if (rouletteSelectedBet === 'number') {
        const inputVal = document.getElementById('bet-number-val').value;
        if (inputVal === '' || inputVal < 0 || inputVal > 36) {
            showToast('Ingresa un número válido del 0 al 36', 'danger');
            return;
        }
        exactNumber = parseInt(inputVal);
    }
    
    document.getElementById('btn-spin-wheel').disabled = true;
    const statusText = document.getElementById('roulette-status-text');
    statusText.textContent = '¡La ruleta está girando...! No va más.';
    
    const winningNumber = Math.floor(Math.random() * 37);
    const spinDegrees = 1440 + Math.floor(Math.random() * 360);
    document.getElementById('roulette-wheel-visual').style.transform = `rotate(${spinDegrees}deg)`;
    
    setTimeout(() => {
        let color = 'Verde (0)';
        let won = false;
        
        if (winningNumber !== 0) {
            if (rouletteRedNumbers.includes(winningNumber)) {
                color = 'Rojo';
                if (rouletteSelectedBet === 'red') won = true;
            } else {
                color = 'Negro';
                if (rouletteSelectedBet === 'black') won = true;
            }
        }
        
        if (rouletteSelectedBet === 'number' && exactNumber === winningNumber) {
            won = true;
        }
        
        const banner = document.getElementById('roulette-status-banner');
        const exitBtn = document.getElementById('btn-roulette-exit');
        const spinBtn = document.getElementById('btn-spin-wheel');
        spinBtn.classList.add('hide');
        
        if (won) {
            statusText.innerHTML = `Ganó el número <strong>${winningNumber} (${color})</strong>.`;
            resolveGameSession('win', 'roulette', statusText, banner, exitBtn, null);
        } else {
            statusText.innerHTML = `Cayó el número <strong>${winningNumber} (${color})</strong>. Has fallado.`;
            resolveGameSession('lose', 'roulette', statusText, banner, exitBtn, null);
            
            setTimeout(() => {
                spinBtn.textContent = 'Girar de nuevo';
                spinBtn.classList.remove('hide');
                spinBtn.disabled = false;
            }, 1000);
        }
    }, 4000);
}

// ==========================================================================
// GAME 3: POKER (VIDEO POKER)
// ==========================================================================
let pokerDeck = [];
let pokerHand = [];
let pokerHolds = [false, false, false, false, false];
let pokerStep = 1;

function initPokerGame() {
    pokerHand = [];
    pokerHolds = [false, false, false, false, false];
    pokerStep = 1;
    
    document.getElementById('btn-poker-deal').disabled = false;
    document.getElementById('btn-poker-deal').classList.remove('hide');
    document.getElementById('btn-poker-deal').textContent = 'Repartir';
    document.getElementById('btn-poker-exit').classList.remove('btn-action-main');
    
    const banner = document.getElementById('poker-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('poker-status-text').textContent = 'Presiona "Repartir" para recibir tus primeras 5 cartas.';
    
    for (let i = 0; i < 5; i++) {
        document.getElementById(`poker-card-${i}`).innerHTML = '<div class="card-face card-back"></div>';
        document.getElementById(`hold-badge-${i}`).classList.add('hide');
    }
}

function handlePokerDeal() {
    const dealBtn = document.getElementById('btn-poker-deal');
    const statusText = document.getElementById('poker-status-text');
    
    if (pokerStep === 1) {
        pokerDeck = [];
        for (let suit of SUITS) {
            for (let rank of RANKS) {
                pokerDeck.push({ rank: rank.name, value: rank.val, symbol: suit.symbol, color: suit.color });
            }
        }
        for (let i = pokerDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pokerDeck[i], pokerDeck[j]] = [pokerDeck[j], pokerDeck[i]];
        }
        
        pokerHand = [pokerDeck.pop(), pokerDeck.pop(), pokerDeck.pop(), pokerDeck.pop(), pokerDeck.pop()];
        pokerHolds = [false, false, false, false, false];
        renderPokerHand();
        
        pokerStep = 2;
        dealBtn.textContent = 'Cambiar y Evaluar';
        statusText.textContent = 'Selecciona las cartas que deseas MANTENER, luego presiona Cambiar.';
    } else if (pokerStep === 2) {
        dealBtn.disabled = true;
        for (let i = 0; i < 5; i++) {
            if (!pokerHolds[i]) pokerHand[i] = pokerDeck.pop();
        }
        renderPokerHand();
        
        const evaluation = evaluatePokerHand(pokerHand);
        const win = evaluation.payout;
        const banner = document.getElementById('poker-status-banner');
        const exitBtn = document.getElementById('btn-poker-exit');
        dealBtn.classList.add('hide');
        
        if (win) {
            statusText.innerHTML = `¡VICTORIA! Mano obtenida: <strong>${evaluation.name}</strong>.`;
            resolveGameSession('win', 'poker', statusText, banner, exitBtn, null);
        } else {
            statusText.innerHTML = `DERROTA. Mano obtenida: <strong>${evaluation.name}</strong> (Se necesita Pareja de J o mejor).`;
            resolveGameSession('lose', 'poker', statusText, banner, exitBtn, null);
            
            setTimeout(() => {
                dealBtn.textContent = 'Repartir de nuevo';
                dealBtn.classList.remove('hide');
                dealBtn.disabled = false;
                pokerStep = 1;
            }, 1000);
        }
    }
}

function togglePokerHold(index) {
    if (pokerStep !== 2) return;
    pokerHolds[index] = !pokerHolds[index];
    document.getElementById(`hold-badge-${index}`).classList.toggle('hide', !pokerHolds[index]);
}

function renderPokerHand() {
    pokerHand.forEach((card, i) => {
        document.getElementById(`poker-card-${i}`).innerHTML = `
            <div class="card-face card-front ${card.color}" style="position:relative; width:100%; height:100%; backface-visibility:visible; transform:none;">
                <div class="card-top-left">
                    <span class="card-rank">${card.rank}</span>
                    <span class="card-suit">${card.symbol}</span>
                </div>
                <div class="card-center-suit">${card.symbol}</div>
            </div>
        `;
    });
}

function evaluatePokerHand(hand) {
    const rankCounts = {};
    const suits = [];
    const values = [];
    
    hand.forEach(c => {
        rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
        suits.push(c.symbol);
        
        let rVal = c.value;
        if (c.rank === 'J') rVal = 11;
        if (c.rank === 'Q') rVal = 12;
        if (c.rank === 'K') rVal = 13;
        if (c.rank === 'A') rVal = 14;
        values.push(rVal);
    });
    
    values.sort((a,b) => a - b);
    const isFlush = suits.every(s => s === suits[0]);
    
    let isStraight = false;
    if (values[4] - values[0] === 4 && new Set(values).size === 5) {
        isStraight = true;
    }
    if (!isStraight && values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5 && values[4] === 14) {
        isStraight = true;
    }
    
    const counts = Object.values(rankCounts).sort((a,b) => b - a);
    
    if (isFlush && isStraight && values[4] === 14 && values[0] !== 2) {
        return { name: 'Escalera Real (Royal Flush)', payout: true };
    }
    if (isFlush && isStraight) {
        return { name: 'Escalera de Color (Straight Flush)', payout: true };
    }
    if (counts[0] === 4) {
        return { name: 'Póker (Four of a Kind)', payout: true };
    }
    if (counts[0] === 3 && counts[1] === 2) {
        return { name: 'Full House', payout: true };
    }
    if (isFlush) {
        return { name: 'Color (Flush)', payout: true };
    }
    if (isStraight) {
        return { name: 'Escalera (Straight)', payout: true };
    }
    if (counts[0] === 3) {
        return { name: 'Trío (Three of a Kind)', payout: true };
    }
    if (counts[0] === 2 && counts[1] === 2) {
        return { name: 'Doble Pareja (Two Pair)', payout: true };
    }
    if (counts[0] === 2) {
        let pairRank = '';
        for (let r in rankCounts) {
            if (rankCounts[r] === 2) pairRank = r;
        }
        const highPairs = ['J', 'Q', 'K', 'A'];
        if (highPairs.includes(pairRank)) {
            return { name: `Pareja de ${pairRank} (Jacks or Better)`, payout: true };
        } else {
            return { name: `Pareja de ${pairRank}`, payout: false };
        }
    }
    return { name: 'Carta Alta', payout: false };
}

// ==========================================================================
// GAME 4: DICE
// ==========================================================================
let diceSelectedBet = null;

function initDiceGame() {
    diceSelectedBet = null;
    document.getElementById('bet-dice-under').classList.remove('active');
    document.getElementById('bet-dice-seven').classList.remove('active');
    document.getElementById('bet-dice-over').classList.remove('active');
    
    document.getElementById('btn-roll-dice').disabled = false;
    document.getElementById('btn-roll-dice').classList.remove('hide');
    document.getElementById('btn-dice-exit').classList.remove('btn-action-main');
    
    const banner = document.getElementById('dice-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('dice-status-text').textContent = 'Elige si la suma será Menor, Mayor o Igual a 7.';
    
    setDiePips(document.getElementById('die-1'), 1);
    setDiePips(document.getElementById('die-2'), 1);
}

function setDiceBet(type) {
    diceSelectedBet = type;
    document.getElementById('bet-dice-under').classList.toggle('active', type === 'under');
    document.getElementById('bet-dice-seven').classList.toggle('active', type === 'seven');
    document.getElementById('bet-dice-over').classList.toggle('active', type === 'over');
}

function rollDiceGame() {
    if (!diceSelectedBet) {
        showToast('Elige una opción de apuesta antes de tirar', 'danger');
        return;
    }
    
    const rollBtn = document.getElementById('btn-roll-dice');
    const statusText = document.getElementById('dice-status-text');
    rollBtn.disabled = true;
    statusText.textContent = '¡Lanzando los dados...!';
    
    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');
    die1.classList.add('rolling');
    die2.classList.add('rolling');
    
    const val1 = Math.floor(Math.random() * 6) + 1;
    const val2 = Math.floor(Math.random() * 6) + 1;
    const sum = val1 + val2;
    
    setTimeout(() => {
        die1.classList.remove('rolling');
        die2.classList.remove('rolling');
        setDiePips(die1, val1);
        setDiePips(die2, val2);
        
        let targetMatch = false;
        if (diceSelectedBet === 'under' && sum < 7) targetMatch = true;
        if (diceSelectedBet === 'seven' && sum === 7) targetMatch = true;
        if (diceSelectedBet === 'over' && sum > 7) targetMatch = true;
        
        const banner = document.getElementById('dice-status-banner');
        const exitBtn = document.getElementById('btn-dice-exit');
        rollBtn.classList.add('hide');
        
        if (targetMatch) {
            statusText.innerHTML = `¡Tirada: <strong>${val1} + ${val2} = ${sum}</strong>! Ganaste.`;
            resolveGameSession('win', 'dice', statusText, banner, exitBtn, null);
        } else {
            statusText.innerHTML = `Tirada: <strong>${val1} + ${val2} = ${sum}</strong>. Has fallado.`;
            resolveGameSession('lose', 'dice', statusText, banner, exitBtn, null);
            
            setTimeout(() => {
                rollBtn.textContent = 'Lanzar de nuevo';
                rollBtn.classList.remove('hide');
                rollBtn.disabled = false;
            }, 1000);
        }
    }, 700);
}

// ==========================================================================
// GAME 5: MINES
// ==========================================================================
let minesGrid = [];
let minesCount = 5;
let minesGemsFound = 0;
let minesActiveMultiplier = 1.00;
let minesGameState = 'not-started';

function initMinesGame() {
    minesGemsFound = 0;
    minesActiveMultiplier = 1.00;
    minesGameState = 'not-started';
    document.getElementById('mines-gems-found').textContent = '0/20';
    document.getElementById('mines-multiplier').textContent = '1.00x';
    
    document.getElementById('btn-mines-start').disabled = false;
    document.getElementById('btn-mines-start').classList.remove('hide');
    document.getElementById('btn-mines-cashout').classList.add('hide');
    document.getElementById('btn-mines-exit').classList.remove('btn-action-main');
    
    const banner = document.getElementById('mines-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('mines-status-text').textContent = 'Presiona "Iniciar Juego" para colocar las 5 minas.';
    
    const gridContainer = document.getElementById('mines-grid');
    gridContainer.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mine-cell';
        cell.textContent = '?';
        gridContainer.appendChild(cell);
    }
}

function startMinesGame() {
    minesGemsFound = 0;
    minesActiveMultiplier = 1.00;
    minesGameState = 'playing';
    
    document.getElementById('btn-mines-start').classList.add('hide');
    document.getElementById('btn-mines-cashout').classList.remove('hide');
    document.getElementById('btn-mines-cashout').disabled = true;
    
    const banner = document.getElementById('mines-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('mines-status-text').textContent = '¡Encuentra gemas! Pero ten cuidado con las 5 minas.';
    
    minesGrid = Array(25).fill('gem');
    let placedMines = 0;
    while (placedMines < minesCount) {
        const randIndex = Math.floor(Math.random() * 25);
        if (minesGrid[randIndex] !== 'mine') {
            minesGrid[randIndex] = 'mine';
            placedMines++;
        }
    }
    
    const gridContainer = document.getElementById('mines-grid');
    gridContainer.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mine-cell';
        cell.addEventListener('click', () => handleMineCellClick(i, cell));
        gridContainer.appendChild(cell);
    }
}

function handleMineCellClick(index, cellEl) {
    if (minesGameState !== 'playing') return;
    if (cellEl.classList.contains('revealed')) return;
    
    cellEl.classList.add('revealed');
    if (minesGrid[index] === 'mine') {
        minesGameState = 'exploded';
        cellEl.classList.add('mine');
        cellEl.innerHTML = '<i class="fa-solid fa-bomb"></i>';
        revealAllMines();
        
        const banner = document.getElementById('mines-status-banner');
        const statusText = document.getElementById('mines-status-text');
        const cashoutBtn = document.getElementById('btn-mines-cashout');
        const startBtn = document.getElementById('btn-mines-start');
        const exitBtn = document.getElementById('btn-mines-exit');
        
        cashoutBtn.classList.add('hide');
        statusText.innerHTML = '<strong>¡BOMBA!</strong> Explotaste.';
        resolveGameSession('lose', 'mines', statusText, banner, exitBtn, null);
        
        setTimeout(() => {
            startBtn.classList.remove('hide');
            startBtn.disabled = false;
            startBtn.textContent = 'Intentar de nuevo';
        }, 1000);
    } else {
        cellEl.classList.add('gem');
        cellEl.innerHTML = '<i class="fa-solid fa-gem"></i>';
        minesGemsFound++;
        minesActiveMultiplier = 1.00 + (minesGemsFound * 0.20);
        
        document.getElementById('mines-gems-found').textContent = `${minesGemsFound}/20`;
        document.getElementById('mines-multiplier').textContent = `${minesActiveMultiplier.toFixed(2)}x`;
        document.getElementById('btn-mines-cashout').disabled = false;
        
        if (minesGemsFound === 20) cashoutMinesGame();
    }
}

function cashoutMinesGame() {
    if (minesGameState !== 'playing' || minesGemsFound === 0) return;
    minesGameState = 'cashed-out';
    document.getElementById('btn-mines-cashout').classList.add('hide');
    
    const banner = document.getElementById('mines-status-banner');
    const statusText = document.getElementById('mines-status-text');
    const exitBtn = document.getElementById('btn-mines-exit');
    
    statusText.innerHTML = `¡Cobraste un multiplicador de <strong>${minesActiveMultiplier.toFixed(2)}x</strong>!`;
    resolveGameSession('win', 'mines', statusText, banner, exitBtn, null);
}

// ==========================================================================
// GAME 6: CRASH ROCKET
// ==========================================================================
let crashMultiplier = 1.00;
let crashPoint = 1.00;
let crashTimer = null;
let crashGameState = 'idle';
let crashCanvas, crashCtx;
let crashX = 0, crashY = 180;

function initCrashGame() {
    crashGameState = 'idle';
    crashMultiplier = 1.00;
    document.getElementById('crash-multiplier-text').textContent = '1.00x';
    document.getElementById('crash-multiplier-text').className = 'crash-multiplier';
    
    document.getElementById('btn-crash-launch').disabled = false;
    document.getElementById('btn-crash-launch').classList.remove('hide');
    document.getElementById('btn-crash-cashout').classList.add('hide');
    document.getElementById('btn-crash-exit').classList.remove('btn-action-main');
    
    const banner = document.getElementById('crash-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('crash-status-text').textContent = 'Inicia el despegue. ¡Retírate a tiempo!';
    
    crashCanvas = document.getElementById('crash-canvas');
    crashCtx = crashCanvas.getContext('2d');
    drawCrashBackground();
}

function launchCrashRocket() {
    crashGameState = 'running';
    crashMultiplier = 1.00;
    crashX = 10;
    crashY = 170;
    
    document.getElementById('btn-crash-launch').classList.add('hide');
    document.getElementById('btn-crash-cashout').classList.remove('hide');
    document.getElementById('btn-crash-cashout').disabled = false;
    
    const banner = document.getElementById('crash-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('crash-status-text').textContent = 'El cohete está ascendiendo...';
    
    const rand = Math.random();
    if (rand < 0.1) crashPoint = 1.01 + Math.random() * 0.1;
    else if (rand < 0.6) crashPoint = 1.11 + Math.random() * 0.9;
    else if (rand < 0.9) crashPoint = 2.01 + Math.random() * 2.0;
    else crashPoint = 4.01 + Math.random() * 4.0;
    
    crashTimer = setInterval(() => {
        crashMultiplier += 0.03 + (crashMultiplier * 0.015);
        document.getElementById('crash-multiplier-text').textContent = `${crashMultiplier.toFixed(2)}x`;
        
        crashX += 1.8;
        crashY -= (crashCanvas.height - crashY) * 0.03 + 0.5;
        if (crashX > crashCanvas.width - 20) crashX = crashCanvas.width - 20;
        if (crashY < 20) crashY = 20;
        
        drawCrashBackground();
        crashCtx.strokeStyle = 'var(--accent-purple)';
        crashCtx.lineWidth = 4;
        crashCtx.beginPath();
        crashCtx.moveTo(10, 170);
        crashCtx.quadraticCurveTo(crashX / 2, 170, crashX, crashY);
        crashCtx.stroke();
        
        crashCtx.fillStyle = 'var(--accent-cyan)';
        crashCtx.beginPath();
        crashCtx.arc(crashX, crashY, 6, 0, 2 * Math.PI);
        crashCtx.fill();
        
        if (crashMultiplier >= crashPoint) {
            clearInterval(crashTimer);
            crashGameState = 'crashed';
            
            crashCtx.fillStyle = 'var(--danger-red)';
            crashCtx.beginPath();
            crashCtx.arc(crashX, crashY, 15, 0, 2 * Math.PI);
            crashCtx.fill();
            
            const multText = document.getElementById('crash-multiplier-text');
            multText.textContent = `¡EXPLOTÓ! @ ${crashMultiplier.toFixed(2)}x`;
            multText.className = 'crash-multiplier crashed';
            
            const launchBtn = document.getElementById('btn-crash-launch');
            const cashoutBtn = document.getElementById('btn-crash-cashout');
            const statusText = document.getElementById('crash-status-text');
            const exitBtn = document.getElementById('btn-crash-exit');
            
            cashoutBtn.classList.add('hide');
            statusText.innerHTML = `<strong>¡BOOM!</strong> El cohete explotó.`;
            resolveGameSession('lose', 'crash', statusText, banner, exitBtn, null);
            
            setTimeout(() => {
                launchBtn.classList.remove('hide');
                launchBtn.disabled = false;
                launchBtn.textContent = 'Despegar de nuevo';
            }, 1000);
        }
    }, 80);
}

function cashoutCrashRocket() {
    if (crashGameState !== 'running') return;
    clearInterval(crashTimer);
    crashGameState = 'cashed-out';
    document.getElementById('btn-crash-cashout').classList.add('hide');
    
    const multText = document.getElementById('crash-multiplier-text');
    multText.textContent = `Cobrado @ ${crashMultiplier.toFixed(2)}x`;
    multText.className = 'crash-multiplier cashed-out';
    
    const banner = document.getElementById('crash-status-banner');
    const statusText = document.getElementById('crash-status-text');
    const exitBtn = document.getElementById('btn-crash-exit');
    
    statusText.innerHTML = `¡Aseguraste tu ganancia en <strong>${crashMultiplier.toFixed(2)}x</strong>!`;
    resolveGameSession('win', 'crash', statusText, banner, exitBtn, null);
}

function stopCrashLoop() {
    if (crashTimer) clearInterval(crashTimer);
}

// ==========================================================================
// GAME 7: STOCK TRADING SIMULATION
// ==========================================================================
let tradingBalance = 1000.00;
const tradingTarget = 1500.00;
let tradingShares = 0;
let tradingStockPrice = 100.00;
let tradingTimeLeft = 30;
let tradingTimerInterval = null;
let tradingChartHistory = [100];
let tradingCanvas, tradingCtx;
let tradingGameState = 'idle';

function initTradingGame() {
    tradingGameState = 'idle';
    tradingBalance = 1000.00;
    tradingShares = 0;
    tradingStockPrice = 100.00;
    tradingTimeLeft = 30;
    tradingChartHistory = [100];
    
    document.getElementById('trading-balance').textContent = '$1,000.00';
    document.getElementById('trading-timer').textContent = '30s';
    document.getElementById('trading-stock-price').textContent = '$100.00';
    document.getElementById('trading-stock-price').className = 'stock-price';
    document.getElementById('trading-shares-owned').textContent = '0';
    
    document.getElementById('btn-trading-start').disabled = false;
    document.getElementById('btn-trading-start').classList.remove('hide');
    document.getElementById('btn-trading-buy').classList.add('hide');
    document.getElementById('btn-trading-sell').classList.add('hide');
    document.getElementById('btn-trading-exit').classList.remove('btn-action-main');
    
    const banner = document.getElementById('trading-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('trading-status-text').textContent = 'Alcanza $1,500 en 30 segundos comprando y vendiendo.';
    
    tradingCanvas = document.getElementById('trading-canvas');
    tradingCtx = tradingCanvas.getContext('2d');
    drawTradingChart();
}

function startTradingGame() {
    tradingGameState = 'trading';
    tradingBalance = 1000.00;
    tradingShares = 0;
    tradingStockPrice = 100.00;
    tradingTimeLeft = 30;
    tradingChartHistory = [100, 100];
    
    document.getElementById('btn-trading-start').classList.add('hide');
    document.getElementById('btn-trading-buy').classList.remove('hide');
    document.getElementById('btn-trading-sell').classList.remove('hide');
    
    document.getElementById('trading-balance').textContent = '$1,000.00';
    document.getElementById('trading-timer').textContent = '30s';
    document.getElementById('trading-stock-price').textContent = '$100.00';
    document.getElementById('trading-shares-owned').textContent = '0';
    
    const banner = document.getElementById('trading-status-banner');
    banner.className = 'game-status-banner';
    document.getElementById('trading-status-text').textContent = '¡Negociando! MATH CORP oscila rápidamente.';
    
    drawTradingChart();
    
    tradingTimerInterval = setInterval(() => {
        tradingTimeLeft--;
        document.getElementById('trading-timer').textContent = `${tradingTimeLeft}s`;
        
        const changePercent = (Math.random() * 18.5 - 8.0) / 100;
        const prevPrice = tradingStockPrice;
        tradingStockPrice = tradingStockPrice * (1 + changePercent);
        if (tradingStockPrice < 5) tradingStockPrice = 5;
        
        tradingChartHistory.push(tradingStockPrice);
        if (tradingChartHistory.length > 25) tradingChartHistory.shift();
        
        const priceEl = document.getElementById('trading-stock-price');
        priceEl.textContent = `$${tradingStockPrice.toFixed(2)}`;
        priceEl.className = 'stock-price' + (tradingStockPrice >= prevPrice ? ' up' : ' down');
        
        drawTradingChart();
        
        if (tradingTimeLeft <= 0) {
            clearInterval(tradingTimerInterval);
            tradingGameState = 'finished';
            
            if (tradingShares > 0) {
                tradingBalance += tradingShares * tradingStockPrice;
                tradingShares = 0;
                document.getElementById('trading-balance').textContent = `$${tradingBalance.toFixed(2)}`;
                document.getElementById('trading-shares-owned').textContent = '0';
            }
            checkTradingResult();
        }
    }, 1000);
}

function buyStock() {
    if (tradingGameState !== 'trading') return;
    const maxShares = Math.floor(tradingBalance / tradingStockPrice);
    if (maxShares <= 0) {
        showToast('Saldo insuficiente', 'danger');
        return;
    }
    tradingBalance -= maxShares * tradingStockPrice;
    tradingShares += maxShares;
    document.getElementById('trading-balance').textContent = `$${tradingBalance.toFixed(2)}`;
    document.getElementById('trading-shares-owned').textContent = tradingShares;
}

function sellStock() {
    if (tradingGameState !== 'trading') return;
    if (tradingShares <= 0) return;
    
    const revenue = tradingShares * tradingStockPrice;
    tradingBalance += revenue;
    tradingShares = 0;
    
    document.getElementById('trading-balance').textContent = `$${tradingBalance.toFixed(2)}`;
    document.getElementById('trading-shares-owned').textContent = '0';
    
    if (tradingBalance >= tradingTarget) {
        clearInterval(tradingTimerInterval);
        tradingGameState = 'finished';
        checkTradingResult();
    }
}

function checkTradingResult() {
    document.getElementById('btn-trading-buy').classList.add('hide');
    document.getElementById('btn-trading-sell').classList.add('hide');
    const banner = document.getElementById('trading-status-banner');
    const statusText = document.getElementById('trading-status-text');
    const startBtn = document.getElementById('btn-trading-start');
    const exitBtn = document.getElementById('btn-trading-exit');
    
    if (tradingBalance >= tradingTarget) {
        statusText.innerHTML = `¡Meta lograda! Capital: <strong>$${tradingBalance.toFixed(2)}</strong>.`;
        resolveGameSession('win', 'trading', statusText, banner, exitBtn, null);
    } else {
        statusText.innerHTML = `Fracaso. Saldo: <strong>$${tradingBalance.toFixed(2)}</strong> (Meta: $1,500).`;
        resolveGameSession('lose', 'trading', statusText, banner, exitBtn, null);
        
        setTimeout(() => {
            startBtn.classList.remove('hide');
            startBtn.disabled = false;
            startBtn.textContent = 'Intentar de nuevo';
        }, 1000);
    }
}

function stopTradingLoop() {
    if (tradingTimerInterval) clearInterval(tradingTimerInterval);
}

// ==========================================================================
// GAME HELPERS & GRAPHICS
// ==========================================================================
function drawCrashBackground() {
    crashCtx.clearRect(0, 0, crashCanvas.width, crashCanvas.height);
    crashCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    crashCtx.lineWidth = 1;
    for (let i = 40; i < crashCanvas.width; i += 40) {
        crashCtx.beginPath(); crashCtx.moveTo(i, 0); crashCtx.lineTo(i, crashCanvas.height); crashCtx.stroke();
    }
    for (let j = 30; j < crashCanvas.height; j += 30) {
        crashCtx.beginPath(); crashCtx.moveTo(0, j); crashCtx.lineTo(crashCanvas.width, j); crashCtx.stroke();
    }
}

function setDiePips(dieEl, val) {
    dieEl.innerHTML = '';
    const pipPositions = {
        1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
    };
    const pips = pipPositions[val] || [];
    for (let i = 0; i < 9; i++) {
        const gridCell = document.createElement('div');
        if (pips.includes(i)) {
            const pip = document.createElement('span');
            pip.className = 'die-dot';
            gridCell.appendChild(pip);
        }
        dieEl.appendChild(gridCell);
    }
}
