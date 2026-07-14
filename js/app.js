const SUPABASE_URL = 'https://zzgbfxjmesxkdvayqkhs.supabase.co';
const SUPABASE_BUCKET = 'puzzle-images';

function getMonsterImageUrl(n) {
    const name = String(n).padStart(4, '0') + '.webp';
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${name}`;
}

let gameState = {
    points: 0,
    inventory: [],
    unlocked: false,
    seed: null,
    lastDate: null,
    dailyCount: 0
};

let questionsPool = [];
let availableRanges = {};
let currentRound = [];
let currentIndex = 0;
let isAnswering = false;
let secretBuffer = [];

const monsterDB = [
    { id: 1, name: "Slime", rarity: "Common" },
    { id: 5, name: "Goblin", rarity: "Uncommon" },
    { id: 9, name: "Gargoyle", rarity: "Rare" },
    { id: 12, name: "Wraith", rarity: "Epic" },
    { id: 15, name: "Dragon", rarity: "Legendary" },
    { id: 17, name: "Kraken", rarity: "Cosmic" }
];

const ticketCosts = { cheap: 50, normal: 200, expensive: 1000 };

const IMG_SIZE = 512;
const BLOCK_SIZE = 8;
const GRID_DIM = IMG_SIZE / BLOCK_SIZE;
const TOTAL_BLOCKS = GRID_DIM * GRID_DIM;

const sellPrices = {
    "Common": 10,
    "Uncommon": 30,
    "Rare": 100,
    "Epic": 300,
    "Legendary": 1000,
    "Cosmic": 3000
};

const rarityColors = {
    "Common": "#808080",
    "Uncommon": "#2ecc71",
    "Rare": "#3498db",
    "Epic": "#9b59b6",
    "Legendary": "#f39c12",
    "Cosmic": "#e91e63"
};

const RARITY_RANGES = {
    "Common":    { start: 1,    end: 999 },
    "Uncommon":  { start: 1000, end: 1999 },
    "Rare":      { start: 2000, end: 2999 },
    "Epic":      { start: 3000, end: 3999 },
    "Legendary": { start: 4000, end: 4999 },
    "Cosmic":    { start: 9000, end: 9999 }
};

function saveData() {
    localStorage.setItem('monsterData', JSON.stringify(gameState));
}

function loadData() {
    const saved = localStorage.getItem('monsterData');
    if (saved) {
        gameState = JSON.parse(saved);
        if (Array.isArray(gameState.inventory)) {
            gameState.inventory = gameState.inventory.map(entry => {
                if (entry && typeof entry === 'object') return entry;
                return { id: entry, imgNum: null };
            });
        }
    }
}

async function loadQuestions() {
    const response = await fetch('./data/questions.json');
    questionsPool = await response.json();
}

async function loadImageRanges() {
    try {
        const response = await fetch('./data/image-ranges.json');
        availableRanges = await response.json();
    } catch (e) {
        availableRanges = RARITY_RANGES;
    }
}

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function updateScoreDisplay() {
    const el = document.getElementById('score-display');
    if (el) el.textContent = 'Points: ' + gameState.points;
    const ticketsEl = document.getElementById('tickets-points');
    if (ticketsEl) ticketsEl.textContent = 'Points: ' + gameState.points;
}

function startRound() {
    currentRound = shuffleArray(questionsPool).slice(0, 5);
    currentIndex = 0;
    renderQuestion(currentIndex);
}

function renderQuestion(index) {
    const questionText = document.getElementById('question-text');
    const roundInfo = document.getElementById('round-info');
    const buttons = document.querySelectorAll('.option-btn');

    if (index >= currentRound.length) {
        questionText.textContent = 'Round complete! Tap "New Round" to play again.';
        roundInfo.textContent = '';
        buttons.forEach(btn => { btn.textContent = ''; });
        showNewRoundButton();
        return;
    }

    isAnswering = false;
    const q = currentRound[index];
    questionText.textContent = q.q;
    roundInfo.textContent = 'Question ' + (index + 1) + ' of ' + currentRound.length;

    buttons.forEach((btn, i) => {
        btn.textContent = q.options[i];
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });
}

function handleAnswer(buttonIndex) {
    if (isAnswering) return;
    isAnswering = true;

    const buttons = document.querySelectorAll('.option-btn');
    const correctIndex = currentRound[currentIndex].answer;

    buttons.forEach(btn => { btn.disabled = true; });

    if (buttonIndex === correctIndex) {
        buttons[buttonIndex].classList.add('correct');
        awardPoints();
    } else {
        buttons[buttonIndex].classList.add('wrong');
        buttons[correctIndex].classList.add('correct');
    }

    setTimeout(() => {
        currentIndex++;
        renderQuestion(currentIndex);
    }, 1500);
}

function awardPoints() {
    const today = new Date().toDateString();
    if (gameState.lastDate !== today) {
        gameState.lastDate = today;
        gameState.dailyCount = 0;
    }

    let earned;
    if (gameState.dailyCount < 5) {
        earned = 50;
        gameState.dailyCount++;
    } else {
        earned = 10;
    }

    gameState.points += earned;
    updateScoreDisplay();
    saveData();
}

function showNewRoundButton() {
    const container = document.getElementById('quiz-container');
    if (document.getElementById('new-round-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'new-round-btn';
    btn.textContent = 'New Round';
    btn.className = 'option-btn';
    btn.style.gridColumn = '1 / -1';
    btn.addEventListener('click', () => {
        btn.remove();
        startRound();
    });
    container.appendChild(btn);
}

function attachOptionListeners() {
    document.querySelectorAll('.option-btn').forEach((btn, i) => {
        btn.addEventListener('click', () => handleAnswer(i));
    });
}

function handleSecretClick(num) {
    secretBuffer.push(num);
    if (secretBuffer.length > 5) {
        secretBuffer.shift();
    }

    if (secretBuffer.join(',') === '5,3,4,1,2') {
        gameState.unlocked = true;
        saveData();
        updateNavVisibility();
        secretBuffer = [];
    }
}

function updateNavVisibility() {
    const lockedButtons = ['tickets-view', 'gallery-view'];
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (lockedButtons.includes(btn.dataset.target)) {
            btn.classList.toggle('hidden', !gameState.unlocked);
        }
    });
    const hideBtn = document.getElementById('hide-features-btn');
    if (hideBtn) hideBtn.classList.toggle('hidden', !gameState.unlocked);
}

function hideMonsterFeatures() {
    gameState.unlocked = false;
    saveData();
    updateNavVisibility();
    switchView('quiz-view');
}

function attachHideFeaturesListener() {
    const btn = document.getElementById('hide-features-btn');
    if (btn) {
        btn.addEventListener('click', hideMonsterFeatures);
    }
}

function attachSecretListeners() {
    document.querySelectorAll('.secret-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            handleSecretClick(parseInt(btn.dataset.num));
        });
    });
}

function attachClearSaveListener() {
    const btn = document.getElementById('clear-save-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            localStorage.removeItem('monsterData');
            gameState = {
                points: 0,
                inventory: [],
                unlocked: false,
                seed: null,
                lastDate: null,
                dailyCount: 0
            };
            updateScoreDisplay();
            updateNavVisibility();
            const seedInput = document.getElementById('seed-input');
            if (seedInput) seedInput.value = '';
        });
    }
}

function switchView(targetId) {
    const sections = document.querySelectorAll('main section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(targetId).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === targetId);
    });

    if (targetId === 'tickets-view') {
        updateTicketsUI();
    }
    if (targetId === 'gallery-view') {
        renderGallery();
    }
}

function setSeed() {
    const input = document.getElementById('seed-input');
    const val = input.value.trim();
    if (!/^\d{6}$/.test(val)) {
        showModal("Invalid Key", "Please enter exactly 6 digits.", null);
        return;
    }
    gameState.seed = val;
    saveData();
    showModal("Key Set", "Your image key has been saved.", null);
}

function attachSeedListener() {
    const btn = document.getElementById('set-seed-btn');
    if (btn) {
        btn.addEventListener('click', setSeed);
    }
    const input = document.getElementById('seed-input');
    if (input) {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, 6);
        });
        if (gameState.seed) {
            input.value = gameState.seed;
        }
    }
}

function mulberry32(a) {
    return function() {
        a |= 0;
        a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function generateShuffleOrder(seed) {
    const order = [];
    for (let i = 0; i < TOTAL_BLOCKS; i++) order.push(i);

    const rand = mulberry32(parseInt(seed, 10));
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

async function decryptImage(imageSrc, seed) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
    });

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = IMG_SIZE;
    sourceCanvas.height = IMG_SIZE;
    const srcCtx = sourceCanvas.getContext('2d');
    srcCtx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE);

    const destCanvas = document.createElement('canvas');
    destCanvas.width = IMG_SIZE;
    destCanvas.height = IMG_SIZE;
    const destCtx = destCanvas.getContext('2d');

    const perm = generateShuffleOrder(seed);

    for (let i = 0; i < TOTAL_BLOCKS; i++) {
        const srcBlock = perm[i];
        const srcCol = srcBlock % GRID_DIM;
        const srcRow = Math.floor(srcBlock / GRID_DIM);
        const destCol = i % GRID_DIM;
        const destRow = Math.floor(i / GRID_DIM);

        destCtx.drawImage(
            sourceCanvas,
            srcCol * BLOCK_SIZE, srcRow * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE,
            destCol * BLOCK_SIZE, destRow * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE
        );
    }

    const imageData = destCtx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
    }
    destCtx.putImageData(imageData, 0, 0);

    return destCanvas.toDataURL("image/webp");
}

function generatePlaceholder(monster) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = rarityColors[monster.rarity] || '#333';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(64, 50, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 120, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(monster.name, 64, 124);

    return canvas.toDataURL("image/png");
}

function getMonsterImageRange(monster) {
    const tier = monsterDB.filter(m => m.rarity === monster.rarity);
    const index = tier.findIndex(m => m.id === monster.id);
    const span = availableRanges[monster.rarity] || RARITY_RANGES[monster.rarity];
    const total = span.end - span.start + 1;
    const per = Math.floor(total / tier.length);
    const rangeStart = span.start + index * per;
    const rangeEnd = (index === tier.length - 1) ? span.end : rangeStart + per - 1;
    return { start: rangeStart, end: rangeEnd };
}

function pickImageNumber(monster) {
    const { start, end } = getMonsterImageRange(monster);
    return start + Math.floor(Math.random() * (end - start + 1));
}

async function loadMonsterImage(monster, imgNum) {
    const targets = [];
    if (imgNum != null) {
        targets.push(imgNum);
    } else {
        const { start, end } = getMonsterImageRange(monster);
        const count = end - start + 1;
        for (let attempt = 0; attempt < 3; attempt++) {
            targets.push(start + Math.floor(Math.random() * count));
        }
    }
    for (const n of targets) {
        try {
            return await decryptImage(getMonsterImageUrl(n), gameState.seed);
        } catch (e) { }
    }
    try {
        return await decryptImage(getMonsterImageUrl(0), gameState.seed);
    } catch (e) { }
    return generatePlaceholder(monster);
}

async function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    const keyOverlay = document.getElementById('key-required-overlay');

    if (!gameState.seed) {
        grid.classList.add('hidden');
        keyOverlay.classList.remove('hidden');
        return;
    }
    keyOverlay.classList.add('hidden');
    grid.classList.remove('hidden');

    grid.innerHTML = '';

    if (gameState.inventory.length === 0) {
        grid.innerHTML = '<p class="gallery-empty">No monsters yet. Win some from scratch tickets!</p>';
        return;
    }

    for (const entry of gameState.inventory) {
        const monster = monsterDB.find(m => m.id === entry.id);
        if (!monster) continue;

        const card = document.createElement('div');
        card.className = 'gallery-card';

        const img = document.createElement('img');
        img.alt = monster.name;

        img.src = await loadMonsterImage(monster, entry.imgNum);

        const nameEl = document.createElement('p');
        nameEl.textContent = monster.name;

        const badge = document.createElement('span');
        badge.className = 'rarity-badge rarity-' + monster.rarity;
        badge.textContent = monster.rarity;

        card.appendChild(img);
        card.appendChild(nameEl);
        card.appendChild(badge);

        card.addEventListener('click', () => openMonsterDetail(monster, img.src));
        grid.appendChild(card);
    }
}

function openMonsterDetail(monster, imgSrc) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const imgEl = document.getElementById('modal-image');
    const sellBtn = document.getElementById('modal-sell');

    titleEl.textContent = monster.name;
    bodyEl.innerHTML = '<span class="rarity-badge rarity-' + monster.rarity + '">' + monster.rarity + '</span><br>Sell value: ' + sellPrices[monster.rarity] + ' pts';

    imgEl.src = imgSrc;
    imgEl.classList.remove('hidden');
    imgEl.style.cursor = 'zoom-in';
    imgEl.onclick = () => showFullscreenImage(imgSrc);

    sellBtn.dataset.sellLabel = 'Sell for ' + sellPrices[monster.rarity] + ' pts';
    sellBtn.classList.remove('hidden');
    attachHoldToSell(sellBtn, () => sellMonster(monster));

    overlay.classList.remove('hidden');
}

function attachHoldToSell(btn, onConfirm) {
    if (!btn._holdWired) {
        btn.innerHTML = '<span class="sell-fill"></span><span class="sell-label"></span>';
        let holdTimer = null;

        const startHold = (e) => {
            e.preventDefault();
            const fill = btn.querySelector('.sell-fill');
            btn.classList.remove('holding');
            fill.style.transition = 'none';
            fill.style.width = '0%';
            void fill.offsetWidth;
            fill.style.transition = '';
            fill.style.width = '';
            btn.classList.add('holding');
            holdTimer = setTimeout(() => {
                holdTimer = null;
                btn.classList.remove('holding');
                fill.style.width = '0%';
                if (btn._holdCallback) btn._holdCallback();
            }, 2000);
        };

        const cancelHold = () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            btn.classList.remove('holding');
            const fill = btn.querySelector('.sell-fill');
            if (fill) fill.style.width = '0%';
        };

        btn.addEventListener('mousedown', startHold);
        btn.addEventListener('touchstart', startHold, { passive: false });
        btn.addEventListener('mouseup', cancelHold);
        btn.addEventListener('mouseleave', cancelHold);
        btn.addEventListener('touchend', cancelHold);
        btn.addEventListener('touchcancel', cancelHold);
        btn._holdWired = true;
    }

    btn.querySelector('.sell-label').textContent = btn.dataset.sellLabel || 'Sell';
    btn._holdCallback = onConfirm;
}

function sellMonster(monster) {
    const index = gameState.inventory.findIndex(e => e.id === monster.id);
    if (index === -1) return;

    gameState.inventory.splice(index, 1);
    gameState.points += sellPrices[monster.rarity];
    saveData();
    updateScoreDisplay();
    updateTicketsUI();
    closeModal();
    renderGallery();
}

function attachGalleryListeners() {
    const sellBtn = document.getElementById('modal-sell');
    sellBtn.classList.add('hidden');
}

function updateTicketsUI() {
    const pointsEl = document.getElementById('tickets-points');
    if (pointsEl) pointsEl.textContent = 'Points: ' + gameState.points;

    document.querySelectorAll('.ticket-card').forEach(card => {
        const cost = ticketCosts[card.dataset.type];
        if (gameState.points < cost) {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }
    });
}

function rollRarity(ticketType) {
    const roll = Math.floor(Math.random() * 100) + 1;

    if (ticketType === 'cheap') {
        if (roll <= 65) return "Common";
        return "Uncommon";
    }
    if (ticketType === 'normal') {
        if (roll <= 60) return "Uncommon";
        if (roll <= 90) return "Rare";
        return "Epic";
    }
    if (ticketType === 'expensive') {
        if (roll <= 45) return "Rare";
        if (roll <= 75) return "Epic";
        if (roll <= 92) return "Legendary";
        return "Cosmic";
    }
    return "Common";
}

function selectMonster(rarity) {
    const owned = new Set(gameState.inventory.map(e => e.id));
    const available = monsterDB.filter(m => m.rarity === rarity && !owned.has(m.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}

function buyTicket(ticketType) {
    const cost = ticketCosts[ticketType];
    if (gameState.points < cost) return;

    gameState.points -= cost;
    saveData();
    updateScoreDisplay();
    updateTicketsUI();

    if (Math.random() >= 0.5) {
        showModal("Better luck next time!", "Your ticket revealed nothing. Try again!", null);
        return;
    }

    const rarity = rollRarity(ticketType);
    const monster = selectMonster(rarity);

    if (monster) {
        gameState.inventory.push({ id: monster.id, imgNum: pickImageNumber(monster) });
        saveData();
        showModal("You caught a monster!", monster.name, monster.rarity);
    } else {
        const refund = Math.ceil(cost / 2);
        gameState.points += refund;
        saveData();
        updateScoreDisplay();
        updateTicketsUI();
        showModal("Duplicate found!", "All monsters of that rarity are owned! Refunded " + refund + " points.", null);
    }
}

function showModal(title, body, rarity) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const imgEl = document.getElementById('modal-image');
    const sellBtn = document.getElementById('modal-sell');

    titleEl.textContent = title;
    bodyEl.innerHTML = rarity
        ? body + '<br><span class="rarity-badge rarity-' + rarity + '">' + rarity + '</span>'
        : body;

    imgEl.classList.add('hidden');
    sellBtn.classList.add('hidden');

    overlay.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function showFullscreenImage(src) {
    const overlay = document.getElementById('fullscreen-overlay');
    const img = document.getElementById('fullscreen-image');
    img.src = src;
    overlay.classList.remove('hidden');
}

function closeFullscreen() {
    document.getElementById('fullscreen-overlay').classList.add('hidden');
}

function attachTicketListeners() {
    document.querySelectorAll('.ticket-card').forEach(card => {
        card.addEventListener('click', () => {
            if (!card.classList.contains('disabled')) {
                buyTicket(card.dataset.type);
            }
        });
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    const fullscreen = document.getElementById('fullscreen-overlay');
    if (fullscreen) {
        fullscreen.addEventListener('click', closeFullscreen);
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchView(btn.dataset.target);
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.warn('Service Worker registration failed:', err);
        });
    });
}

loadData();
updateScoreDisplay();
updateNavVisibility();
attachOptionListeners();
attachSecretListeners();
attachClearSaveListener();
attachTicketListeners();
attachSeedListener();
attachHideFeaturesListener();
loadImageRanges();
loadQuestions().then(() => {
    startRound();
});
