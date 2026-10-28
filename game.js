let peer = null;
let conn = null;
let isHost = false;
let myHand = [];
let gameSettings = {};
let opponentName = 'Waiting for player';
let lobbyCode = '';
let gameStarted = false;
let hostConnections = new Map();
let gamePlayers = [];
let myDiscardPile = [];
let unoDeck = [];
let unoDiscardPile = [];
let unoCurrentSuit = '';
let unoDirection = 1;
let unoDrawPileCount = 0;
let unoDrawnCardId = null;
let selectedUnoCardId = null;
let currentTurnIndex = 0;
let currentTurnPlayerId = 'host';
let lastObservedTurnPlayerId = null;
let turnDeadline = 0;
let turnTimerPlayerId = null;
let turnTimerHandle = null;
let turnCountdownInterval = null;
let turnNotificationTimeout = null;
let gamePlayerId = 'host';
let gameMessage = '';
let winnerId = null;
let winnerType = '';
let eliminationOrder = [];
let gameResults = [];
let roundId = '';
let returnToMenuTimer = null;
let gameFinished = false;
let coinBalance = 0;
let rewardedRoundIds = new Set();
let pendingJoinRequests = [];
let currentJoinRequest = null;
let wasKicked = false;
let versionMismatch = false;
let brandTapCount = 0;
let brandTapTimeout = null;
const GAME_VERSION = '1.0.0';
const CARD_OPTIONS = [
    'Verity',
    'Freakyity',
    'Negativity',
    'Positivity',
    'Curiosity',
    'Clarity',
    'Sincerity',
    'Velocity',
    'Infinity',
    'Duality',
    'Reality',
    'Audacity',
    'Sanity',
    'Absurdity',
    'Creativity',
    'Eternity',
    'Spookity',
    'Glitchity',
    'Riftity',
    'Jollity',
    'Oddity',
    'Falsity',
    'Loveity',
    'Cruelty'
];
const CHARACTER_ARTWORK = new Map(CARD_OPTIONS.map((cardName) => [
    cardName,
    `assets/cards/${cardName.toLowerCase()}.png`
]));
const VERITY_FAMILY = new Set(CARD_OPTIONS.slice(0, -3));
const LORD_VERITY_CORNERS = [
    { name: 'Lord Verity: Top Left', corner: 'top-left' },
    { name: 'Lord Verity: Top Right', corner: 'top-right' },
    { name: 'Lord Verity: Bottom Left', corner: 'bottom-left' },
    { name: 'Lord Verity: Bottom Right', corner: 'bottom-right' }
];
const LORD_VERITY_TRIPLE_START_CHANCE = 0.01;
const UNO_SUITS = ['Green', 'Blue', 'Red', 'Yellow'];
const UNO_ACTIONS = [
    { type: 'skip', value: 'Skipity', copies: 2 },
    { type: 'reverse', value: 'Reversity', copies: 2 },
    { type: 'draw-two', value: 'Drawity', copies: 2 }
];
const EFFECT_DEFAULTS = {
    cursorColor: 'theme',
    cursorShape: 'ring',
    cursorSize: '18',
    particleColor: 'theme',
    particleShape: 'dot',
    particleCount: '8',
    particleSize: '8',
    particleDuration: '500'
};
const EFFECT_CONTROLS = {
    cursorColor: 'cursor-color-select',
    cursorShape: 'cursor-shape-select',
    cursorSize: 'cursor-size-range',
    particleColor: 'particle-color-select',
    particleShape: 'particle-shape-select',
    particleCount: 'particle-count-range',
    particleSize: 'particle-size-range',
    particleDuration: 'particle-duration-range'
};
const EFFECT_OPTIONS = {
    cursorColor: ['theme', 'yellow', 'cyan', 'pink', 'green', 'orange', 'purple', 'white'],
    particleColor: ['theme', 'yellow', 'cyan', 'pink', 'green', 'orange', 'purple', 'white', 'black'],
    cursorShape: ['ring', 'dot', 'square', 'diamond', 'star'],
    particleShape: ['dot', 'ring', 'square', 'diamond', 'star']
};
const EFFECT_RANGES = {
    cursorSize: [10, 40, 2],
    particleSize: [4, 18, 2],
    particleCount: [4, 20, 4],
    particleDuration: [300, 1000, 100]
};
const EFFECT_COLORS = {
    theme: 'var(--accent)',
    yellow: '#ffd92f',
    cyan: '#38d9ff',
    pink: '#ff55b7',
    green: '#a7f432',
    orange: '#ff8a30',
    purple: '#bc8cff',
    white: '#ffffff',
    black: '#111111'
};
const END_GAME_RETURN_DELAY = 8000;
let activeEffectSettings = { ...EFFECT_DEFAULTS };

function openSettings() {
    const dialog = document.getElementById('settings-dialog');
    showSettingsPanel('settings-main-panel');
    dialog.appendChild(document.getElementById('cursor-glow'));
    dialog.showModal();
}

function restoreCursorToOpenDialog() {
    const cursorGlow = document.getElementById('cursor-glow');
    const openDialog = [document.getElementById('card-catalog-dialog'), document.getElementById('settings-dialog')]
        .find((dialog) => dialog.open);
    (openDialog || document.body).appendChild(cursorGlow);
}

function closeSettings() {
    document.getElementById('settings-dialog').close();
}

function showSettingsPanel(panelId) {
    document.querySelectorAll('.settings-panel').forEach((panel) => {
        panel.hidden = panel.id !== panelId;
    });
}

function getPlayerName() {
    return document.getElementById('player-name').value.trim() || 'Player';
}

function updateCoinBalance() {
    document.getElementById('coin-balance').innerText = String(coinBalance);
}

function awardRoundCoins(completedRoundId, result) {
    if (!completedRoundId || !result || rewardedRoundIds.has(completedRoundId)) return;
    rewardedRoundIds.add(completedRoundId);
    coinBalance += result.reward;
    if (rewardedRoundIds.size > 50) {
        rewardedRoundIds = new Set(Array.from(rewardedRoundIds).slice(-50));
    }
    try {
        localStorage.setItem('verity-craft-coins', String(coinBalance));
        localStorage.setItem('verity-craft-rewarded-rounds', JSON.stringify(Array.from(rewardedRoundIds)));
    } catch (error) {
        // Coins remain available for this session if browser storage is unavailable.
    }
    updateCoinBalance();
}

function savePlayerName(name) {
    const savedName = name.slice(0, 20);
    document.getElementById('player-name').value = savedName;
    document.getElementById('settings-player-name').value = savedName;
    try {
        localStorage.setItem('verity-craft-player-name', savedName);
    } catch (error) {
        // Keep the name available for this session if browser storage is unavailable.
    }
    updatePlayerNames();
    if (conn && conn.open) conn.send({ type: 'PLAYER_INFO', name: getPlayerName() });
}

function updatePlayerNames() {
    const opponents = gameStarted && gamePlayers.length
        ? gamePlayers.filter((player) => player.id !== gamePlayerId).map((player) => player.name).join(', ') || 'No opponents'
        : isHost ? Array.from(hostConnections.values(), (player) => player.name).join(', ') || 'Waiting for players' : opponentName;
    const names = `You: ${getPlayerName()} | Players: ${opponents}`;
    document.getElementById('lobby-player-names').innerText = names;
    document.getElementById('game-player-names').innerText = names;
}

function renderHostPlayerList(containerId) {
    const container = document.getElementById(containerId);
    container.hidden = !isHost;
    container.replaceChildren();
    if (!isHost) return;

    const heading = document.createElement('h3');
    heading.textContent = 'Manage players';
    container.appendChild(heading);
    const players = Array.from(hostConnections.values()).filter((player) => player.connection.open);
    if (!players.length) {
        const emptyState = document.createElement('p');
        emptyState.textContent = 'No players connected.';
        container.appendChild(emptyState);
        return;
    }

    players.forEach((player) => {
        const row = document.createElement('div');
        row.className = 'host-player-row';
        const name = document.createElement('span');
        const gamePlayer = gamePlayers.find((candidate) => candidate.connection === player.connection);
        name.textContent = gamePlayer?.isSpectator ? `${player.name} (spectating)` : player.name;
        const kickButton = document.createElement('button');
        kickButton.type = 'button';
        kickButton.className = 'secondary-button';
        kickButton.textContent = 'Kick';
        kickButton.setAttribute('aria-label', `Kick ${player.name}`);
        kickButton.addEventListener('click', () => kickPlayer(player.id, player.name));
        row.append(name, kickButton);
        container.appendChild(row);
    });
}

function getLobbySettings() {
    const allowedCards = Array.from(document.querySelectorAll('#card-options input:checked'), (checkbox) => checkbox.dataset.cardName);
    const turnDurationSeconds = document.getElementById('turn-duration-unlimited').checked
        ? 0
        : Number(document.getElementById('turn-duration').value);
    return {
        cardsPerPlayer: parseInt(document.getElementById('card-count').value, 10),
        allowedCards,
        allowSpectators: document.getElementById('allow-spectators').checked,
        allowLordVerity: document.getElementById('allow-lord-verity').checked,
        turnDurationSeconds,
        mode: document.getElementById('game-mode').value
    };
}

function updateTurnDurationControl() {
    const durationControl = document.getElementById('turn-duration');
    const isUnlimited = document.getElementById('turn-duration-unlimited').checked;
    const durationSeconds = Number(durationControl.value);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = String(durationSeconds % 60).padStart(2, '0');
    document.getElementById('turn-duration-value').value = `${minutes}:${seconds}`;
    durationControl.disabled = isUnlimited;
}

function updateHostModeSettings() {
    document.getElementById('guess-mode-settings').hidden = document.getElementById('game-mode').value === 'unoity';
}

function sendLobbySettings() {
    if (!isHost) return;
    const message = { type: 'LOBBY_SETTINGS', settings: getLobbySettings() };
    hostConnections.forEach((player, connection) => {
        if (connection.open) connection.send(message);
    });
}

function updateGuestSettings(settings) {
    const modeName = settings.mode === 'unoity' ? 'Unoity' : 'Guess the Variety';
    const guestSettings = document.getElementById('guest-lobby-settings');
    const turnDuration = Number(settings.turnDurationSeconds) || 0;
    const turnSetting = turnDuration ? `${turnDuration} seconds` : 'No time limit';
    const modeSettings = settings.mode === 'unoity'
        ? `Players joining mid-game: ${settings.allowSpectators ? 'can spectate' : 'cannot join'}`
        : `Cards per player: ${settings.cardsPerPlayer}\nCard pool: ${settings.allowedCards.length ? settings.allowedCards.join(', ') : 'None selected yet'}\nLord Verity: ${settings.allowLordVerity === false ? 'off' : 'on'}\nEliminated players: ${settings.allowSpectators ? 'can spectate' : 'cannot spectate'}`;
    guestSettings.innerText = `Host settings\nMode: ${modeName}\nTurn duration: ${turnSetting}\n${modeSettings}`;
    guestSettings.hidden = false;
}

function returnToMenu() {
    const activePeer = peer;
    peer = null;
    conn = null;
    clearTimeout(turnTimerHandle);
    clearInterval(turnCountdownInterval);
    turnTimerHandle = null;
    turnCountdownInterval = null;
    turnDeadline = 0;
    turnTimerPlayerId = null;
    lastObservedTurnPlayerId = null;
    clearTimeout(turnNotificationTimeout);
    turnNotificationTimeout = null;
    const turnNotification = document.getElementById('turn-notification');
    turnNotification.hidden = true;
    turnNotification.dataset.visible = 'false';
    clearTimeout(returnToMenuTimer);
    returnToMenuTimer = null;
    gameFinished = false;
    isHost = false;
    myHand = [];
    gameSettings = {};
    gameStarted = false;
    hostConnections.clear();
    gamePlayers = [];
    myDiscardPile = [];
    unoDeck = [];
    unoDiscardPile = [];
    unoCurrentSuit = '';
    unoDirection = 1;
    unoDrawPileCount = 0;
    unoDrawnCardId = null;
    selectedUnoCardId = null;
    currentTurnIndex = 0;
    currentTurnPlayerId = 'host';
    gamePlayerId = 'host';
    gameMessage = '';
    winnerId = null;
    winnerType = '';
    eliminationOrder = [];
    gameResults = [];
    roundId = '';
    document.getElementById('winner-overlay').hidden = true;
    pendingJoinRequests = [];
    currentJoinRequest = null;
    wasKicked = false;
    opponentName = 'Waiting for player';

    if (activePeer && !activePeer.destroyed) activePeer.destroy();
    document.getElementById('join-request-panel').hidden = true;

    document.getElementById('host-code-bar').hidden = true;
    document.getElementById('host-settings').style.display = 'none';
    document.getElementById('game-mode').value = 'guess-variety';
    updateHostModeSettings();
    document.getElementById('guest-lobby-settings').hidden = true;
    document.getElementById('guest-lobby-settings').innerText = 'Waiting for host settings...';
    document.getElementById('display-lobby-id').innerText = '-';
    document.getElementById('lobby-status').innerText = 'Waiting for player to join...';
    document.getElementById('start-game-button').disabled = true;
    document.getElementById('start-game-button').innerText = 'Waiting for player';
    renderHostPlayerList('host-lobby-players');
    renderHostPlayerList('host-game-players');
    document.getElementById('my-hand').innerHTML = '';
    document.getElementById('arena-text').innerText = 'Played cards will appear here';
    document.getElementById('turn-status').innerText = 'Game Started!';
    updatePlayerNames();
    showScreen('menu-screen');
}

function formatLobbyCode(input) {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

function generateLobbyCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function displayHostLobbyCode(code) {
    lobbyCode = code.toUpperCase();
    document.getElementById('display-lobby-id').innerText = lobbyCode;
    document.getElementById('host-lobby-code').innerText = lobbyCode;
    document.getElementById('host-code-bar').hidden = false;
}

async function copyLobbyCode() {
    try {
        await navigator.clipboard.writeText(lobbyCode);
        document.getElementById('lobby-status').innerText = 'Lobby code copied.';
    } catch (error) {
        document.getElementById('lobby-status').innerText = `Lobby code: ${lobbyCode}`;
    }
}

function setDarkMode(enabled) {
    document.body.dataset.theme = enabled ? 'dark' : 'light';
    try {
        localStorage.setItem('verity-craft-theme', document.body.dataset.theme);
        localStorage.setItem('verity-craft-dark-mode', String(enabled));
    } catch (error) {
        // The theme still applies for this page even if storage is unavailable.
    }
}

function setColorTheme(palette) {
    document.body.dataset.palette = palette;
    try {
        localStorage.setItem('verity-craft-color-theme', palette);
        if (palette === 'verity-secret') localStorage.setItem('verity-craft-secret-unlocked', 'true');
    } catch (error) {
        // The palette still applies for this page even if storage is unavailable.
    }
}

function unlockVerityTheme() {
    brandTapCount += 1;
    clearTimeout(brandTapTimeout);
    brandTapTimeout = setTimeout(() => { brandTapCount = 0; }, 1800);

    if (brandTapCount < 7) return;

    brandTapCount = 0;
    document.querySelector('#color-theme-select option[value="verity-secret"]').hidden = false;
    setColorTheme('verity-secret');
    document.getElementById('color-theme-select').value = 'verity-secret';
    openSettings();
}

function handleBrandClick() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.getElementById('verity-logo').animate([
            { transform: 'translateY(0) scale(1) rotate(0deg)' },
            { transform: 'translateY(-12px) scale(1.18) rotate(-8deg)' },
            { transform: 'translateY(2px) scale(.96) rotate(4deg)' },
            { transform: 'translateY(0) scale(1) rotate(0deg)' }
        ], { duration: 480, easing: 'cubic-bezier(.2,.8,.25,1)' });
        document.getElementById('brand-title').animate([
            { transform: 'scale(1)' },
            { transform: 'translateY(-5px) scale(1.12)' },
            { transform: 'scale(.98)' },
            { transform: 'scale(1)' }
        ], { duration: 420, easing: 'cubic-bezier(.2,.8,.25,1)' });
    }
    unlockVerityTheme();
}

function initializeSettings() {
    let savedTheme = 'light';
    let savedDarkMode = null;
    let savedPalette = 'verdant';
    let savedPlayerName = '';
    let secretThemeUnlocked = false;
    let savedCoins = 0;
    let savedRewardedRounds = [];
    try {
        savedTheme = localStorage.getItem('verity-craft-theme') || 'light';
        savedDarkMode = localStorage.getItem('verity-craft-dark-mode');
        savedPalette = localStorage.getItem('verity-craft-color-theme') || 'verdant';
        savedPlayerName = localStorage.getItem('verity-craft-player-name') || '';
        secretThemeUnlocked = localStorage.getItem('verity-craft-secret-unlocked') === 'true';
        savedCoins = Number(localStorage.getItem('verity-craft-coins') || 0);
        savedRewardedRounds = JSON.parse(localStorage.getItem('verity-craft-rewarded-rounds') || '[]');
    } catch (error) {
        // Use the default theme when browser storage is unavailable.
    }
    coinBalance = Number.isSafeInteger(savedCoins) && savedCoins >= 0 ? savedCoins : 0;
    rewardedRoundIds = new Set(Array.isArray(savedRewardedRounds)
        ? savedRewardedRounds.filter((id) => typeof id === 'string')
        : []);
    secretThemeUnlocked = secretThemeUnlocked || savedPalette === 'verity-secret';
    if (secretThemeUnlocked) {
        document.querySelector('#color-theme-select option[value="verity-secret"]').hidden = false;
    }
    const darkModeEnabled = savedDarkMode === null ? savedTheme === 'dark' : savedDarkMode === 'true';
    document.body.dataset.theme = darkModeEnabled ? 'dark' : 'light';
    const availablePalettes = ['classic', 'verdant', 'ocean', 'ember', 'rose', 'lavender', 'golden', 'ice', 'verity-secret'];
    document.body.dataset.palette = availablePalettes.includes(savedPalette) ? savedPalette : 'verdant';
    document.getElementById('dark-mode-toggle').checked = darkModeEnabled;
    document.getElementById('color-theme-select').value = document.body.dataset.palette;
    document.getElementById('player-name').value = savedPlayerName;
    document.getElementById('settings-player-name').value = savedPlayerName;
    updateCoinBalance();
    renderCardOptions();
    initializeEffectSettings();
    updatePlayerNames();
}

function initializeEffectSettings() {
    let savedSettings = {};
    try {
        savedSettings = JSON.parse(localStorage.getItem('verity-craft-effects') || '{}');
    } catch (error) {
        savedSettings = {};
    }

    if (!savedSettings.particleDuration && savedSettings.particleSpeed) {
        savedSettings.particleDuration = { slow: '800', normal: '500', fast: '300' }[savedSettings.particleSpeed];
    }
    activeEffectSettings = {};
    Object.entries(EFFECT_CONTROLS).forEach(([setting, controlId]) => {
        activeEffectSettings[setting] = normalizeEffectSetting(setting, savedSettings[setting]);
        document.getElementById(controlId).value = activeEffectSettings[setting];
    });
    updateEffectPreviews();
    applyEffectSettings();
}

function normalizeEffectSetting(setting, value) {
    if (EFFECT_OPTIONS[setting]) {
        return EFFECT_OPTIONS[setting].includes(value) ? value : EFFECT_DEFAULTS[setting];
    }
    const [minimum, maximum, step] = EFFECT_RANGES[setting];
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return EFFECT_DEFAULTS[setting];
    const boundedValue = Math.min(maximum, Math.max(minimum, numericValue));
    return String(minimum + Math.round((boundedValue - minimum) / step) * step);
}

function readEffectControls() {
    return Object.entries(EFFECT_CONTROLS).reduce((settings, [setting, controlId]) => {
        settings[setting] = normalizeEffectSetting(setting, document.getElementById(controlId).value);
        return settings;
    }, {});
}

function saveEffectSettings(group) {
    const draftSettings = readEffectControls();
    const settingsToApply = Object.keys(EFFECT_CONTROLS).filter((setting) => setting.startsWith(group));
    settingsToApply.forEach((setting) => {
        activeEffectSettings[setting] = draftSettings[setting];
    });
    try {
        localStorage.setItem('verity-craft-effects', JSON.stringify(activeEffectSettings));
    } catch (error) {
        // Settings still apply for this session when browser storage is unavailable.
    }
    applyEffectSettings();
}

function applyEffectSettings() {
    document.body.style.setProperty('--cursor-color', EFFECT_COLORS[activeEffectSettings.cursorColor]);
    document.body.style.setProperty('--cursor-size', `${activeEffectSettings.cursorSize}px`);
    document.body.style.setProperty('--particle-color', EFFECT_COLORS[activeEffectSettings.particleColor]);
    document.body.style.setProperty('--particle-size', `${activeEffectSettings.particleSize}px`);
    document.body.style.setProperty('--particle-duration', `${activeEffectSettings.particleDuration}ms`);
    document.body.dataset.cursorShape = activeEffectSettings.cursorShape;
    document.body.dataset.particleShape = activeEffectSettings.particleShape;
    document.getElementById('cursor-glow').dataset.shape = activeEffectSettings.cursorShape;
}

function updateEffectPreviews() {
    const settings = readEffectControls();
    const cursorPreview = document.getElementById('cursor-preview');
    cursorPreview.dataset.shape = settings.cursorShape;
    cursorPreview.style.setProperty('--cursor-color', EFFECT_COLORS[settings.cursorColor]);
    cursorPreview.style.setProperty('--cursor-size', `${settings.cursorSize}px`);
    document.getElementById('cursor-size-value').value = `${settings.cursorSize} px`;

    const particleStage = document.getElementById('particle-preview-stage');
    particleStage.replaceChildren();
    particleStage.style.setProperty('--particle-color', EFFECT_COLORS[settings.particleColor]);
    particleStage.style.setProperty('--particle-size', `${settings.particleSize}px`);
    const previewCount = Math.min(Number(settings.particleCount), 20);
    const radius = Math.max(28, Number(settings.particleSize) * 2.7);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < previewCount; index += 1) {
        const angle = (Math.PI * 2 * index) / previewCount;
        const particle = document.createElement('span');
        particle.className = 'particle-preview-dot';
        particle.dataset.shape = settings.particleShape;
        particle.style.transform = `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`;
        fragment.appendChild(particle);
    }
    particleStage.appendChild(fragment);
    document.getElementById('particle-size-value').value = `${settings.particleSize} px`;
    document.getElementById('particle-count-value').value = settings.particleCount;
    const duration = Number(settings.particleDuration);
    document.getElementById('particle-speed-value').value = duration < 450 ? 'Fast' : duration > 700 ? 'Slow' : 'Normal';
}

function renderCardOptions() {
    const container = document.getElementById('card-options');
    CARD_OPTIONS.forEach((cardName, index) => {
        const row = document.createElement('div');
        row.className = 'card-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `card-option-${index}`;
        checkbox.checked = true;
        checkbox.dataset.cardName = cardName;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = cardName;

        row.append(checkbox, label);
        container.appendChild(row);
    });
}

function selectCardOptions(mode) {
    document.querySelectorAll('#card-options input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = mode === 'all' || (mode === 'verity' && VERITY_FAMILY.has(checkbox.dataset.cardName));
    });
    sendLobbySettings();
}

function showConnectionError(error) {
    const type = error.type || 'connection';
    const detail = error.message || 'No additional details were provided.';
    const networkHint = ['network', 'socket-error', 'socket-closed', 'webrtc', 'peer-unavailable', 'server-error'].includes(type)
        ? ' School Wi-Fi may restrict peer-to-peer connections; ask the network administrator whether this game is allowed.'
        : '';
    document.getElementById('lobby-status').innerText = `Connection error (${type}): ${detail}.${networkHint}`;
}

function showVersionMismatch(remoteVersion, remotePlayer, closeGuestConnection = false) {
    versionMismatch = true;
    const remoteVersionLabel = typeof remoteVersion === 'string' && remoteVersion
        ? `v${remoteVersion}`
        : 'an older or unrecognized version';
    document.getElementById('lobby-status').innerText =
        `Failed: different game version. Your version is v${GAME_VERSION}; ${remotePlayer} uses ${remoteVersionLabel}. Both players need the same version.`;
    if (closeGuestConnection && conn?.open) conn.close();
}

function toggleDebugPanel() {
    const panel = document.getElementById('debug-menu-panel');
    const toggle = document.getElementById('debug-toggle-button');
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
}

// Change App Screen View
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Host setup
function createLobby() {
    isHost = true;
    wasKicked = false;
    versionMismatch = false;
    gameStarted = false;
    winnerType = '';
    hostConnections.clear();
    gamePlayers = [];
    myDiscardPile = [];
    currentTurnIndex = 0;
    currentTurnPlayerId = 'host';
    gamePlayerId = 'host';
    gameMessage = '';
    winnerId = null;
    lobbyCode = '';
    showScreen('lobby-screen');
    document.getElementById('display-lobby-id').innerText = 'Connecting...';
    document.getElementById('lobby-status').innerText = 'Connecting to the lobby service...';
    document.getElementById('host-settings').style.display = 'none';
    document.getElementById('host-code-bar').hidden = true;

    if (typeof Peer === 'undefined') {
        document.getElementById('lobby-status').innerText = 'PeerJS did not load. Check your internet connection, then reload this page.';
        return;
    }

    registerHostPeer();
}

function registerHostPeer(attempt = 0) {
    const code = generateLobbyCode();
    try {
        peer = new Peer(code);
    } catch (error) {
        document.getElementById('lobby-status').innerText = `Could not start lobby: ${error.message}`;
        return;
    }
    const hostPeer = peer;

    hostPeer.on('open', (id) => {
        if (peer !== hostPeer) return;
        displayHostLobbyCode(id);
        document.getElementById('lobby-status').innerText = 'Waiting for player to join...';
        document.getElementById('host-settings').style.display = 'block';
        updateHostModeSettings();
    });

    hostPeer.on('error', (error) => {
        if (peer !== hostPeer) return;
        if (error.type === 'unavailable-id' && attempt < 5) {
            hostPeer.destroy();
            registerHostPeer(attempt + 1);
            return;
        }
        document.getElementById('lobby-status').innerText = `Lobby connection failed: ${error.message || error.type || 'unknown error'}`;
    });

    hostPeer.on('connection', (connection) => {
        setupConnectionHandlers(connection);
        document.getElementById('lobby-status').innerText = gameStarted
            ? 'A player is requesting to join the current round...'
            : 'A player is connecting...';
    });
}

// Client / Guest setup
function joinLobby() {
    isHost = false;
    wasKicked = false;
    versionMismatch = false;
    const targetId = document.getElementById('join-id-input').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(targetId)) return alert('Enter the 5-character lobby code.');

    showScreen('lobby-screen');
    document.getElementById('display-lobby-id').innerText = targetId;
    document.getElementById('lobby-status').innerText = 'Connecting to the owner for approval...';
    document.getElementById('host-code-bar').hidden = true;

    if (typeof Peer === 'undefined') {
        document.getElementById('lobby-status').innerText = 'PeerJS did not load. Check your internet connection, then reload this page.';
        return;
    }

    try {
        peer = new Peer();
    } catch (error) {
        document.getElementById('lobby-status').innerText = `Could not join lobby: ${error.message}`;
        return;
    }

    peer.on('open', () => {
        conn = peer.connect(targetId);
        setupConnectionHandlers(conn);
    });

    peer.on('error', showConnectionError);
}

// Handle peer network events
function setupConnectionHandlers(connection) {
    const hostSide = isHost;
    if (!hostSide) conn = connection;

    connection.on('open', () => {
        if (hostSide) {
            document.getElementById('lobby-status').innerText = 'A player is requesting to join...';
        } else {
            document.getElementById('lobby-status').innerText = 'Waiting for the lobby owner to approve your request...';
            connection.send({ type: 'JOIN_REQUEST', name: getPlayerName(), version: GAME_VERSION });
        }
    });

    connection.on('error', showConnectionError);
    connection.on('close', () => {
        if (gameFinished || !peer) return;
        if (hostSide) {
            if (hostConnections.has(connection)) removeHostPlayer(connection, 'left the game.');
        } else {
            if (wasKicked || versionMismatch) return;
            document.getElementById('lobby-status').innerText = 'Connection closed. Check the code and rejoin the lobby.';
        }
    });

    connection.on('data', (data) => {
        if (hostSide) {
            handleHostMessage(connection, data);
        } else {
            handleGuestMessage(data);
        }
    });
}

function updateHostLobbyStatus() {
    const playerCount = Array.from(hostConnections.keys()).filter((connection) => connection.open).length;
    const startButton = document.getElementById('start-game-button');
    startButton.disabled = gameStarted || playerCount === 0;
    startButton.innerText = gameStarted ? 'Round in progress' : playerCount ? 'Start Game' : 'Waiting for player';
    if (gameStarted) {
        document.getElementById('lobby-status').innerText = `${playerCount} player${playerCount === 1 ? '' : 's'} in the round.`;
    } else {
        document.getElementById('lobby-status').innerText = playerCount
            ? `${playerCount} player${playerCount === 1 ? '' : 's'} connected. Choose settings and start.`
            : 'Waiting for player to join...';
    }
    updatePlayerNames();
    renderHostPlayerList('host-lobby-players');
    renderHostPlayerList('host-game-players');
}

function handleHostMessage(connection, data) {
    if (data.type === 'JOIN_REQUEST') {
        if (data.version !== GAME_VERSION) {
            showVersionMismatch(data.version, 'the other player');
            connection.send({ type: 'JOIN_REJECTED', version: GAME_VERSION });
            window.setTimeout(() => connection.close(), 100);
            return;
        }
        const name = (data.name || 'Player').slice(0, 20);
        if (gameFinished || winnerId) {
            connection.send({ type: 'JOIN_REJECTED', version: GAME_VERSION });
            connection.close();
        } else if (gameStarted) {
            if (!gameSettings.allowSpectators) {
                connection.send({ type: 'JOIN_REJECTED', version: GAME_VERSION });
                connection.close();
                return;
            }
            pendingJoinRequests.push({ connection, name });
            showNextJoinRequest();
        } else {
            acceptHostPlayer(connection, name);
        }
    } else if (data.type === 'PLAYER_INFO') {
        const player = hostConnections.get(connection);
        if (player) {
            player.name = (data.name || 'Player').slice(0, 20);
            const gamePlayer = gamePlayers.find((candidate) => candidate.connection === connection);
            if (gamePlayer) {
                gamePlayer.name = player.name;
                broadcastGameState();
            } else {
                updatePlayerNames();
            }
        }
    } else if (data.type === 'GUESS_MOVE') {
        const player = gamePlayers.find((candidate) => candidate.connection === connection);
        if (player) processGuess(player.id, data.targetId, data.cardName, data.guessedCount);
    } else if (data.type === 'UNO_PLAY') {
        const player = gamePlayers.find((candidate) => candidate.connection === connection);
        if (player) processUnoPlay(player.id, data.cardId, data.suit);
    } else if (data.type === 'UNO_DRAW') {
        const player = gamePlayers.find((candidate) => candidate.connection === connection);
        if (player) drawUnoCard(player.id);
    } else if (data.type === 'UNO_PASS') {
        const player = gamePlayers.find((candidate) => candidate.connection === connection);
        if (player) passUnoTurn(player.id);
    }
}

function handleGuestMessage(data) {
    if (versionMismatch) return;
    if (data.type === 'JOIN_ACCEPTED') {
        if (data.version !== GAME_VERSION) {
            showVersionMismatch(data.version, 'the lobby owner', true);
            return;
        }
        opponentName = data.hostName || 'Lobby owner';
        updateGuestSettings(data.settings);
        document.getElementById('lobby-status').innerText = data.inGame
            ? 'The owner accepted you. Joining as a spectator...'
            : 'The owner accepted you. Waiting for the game to start...';
    } else if (data.type === 'JOIN_REJECTED') {
        if (data.version !== GAME_VERSION) {
            showVersionMismatch(data.version, 'the lobby owner', true);
            return;
        }
        document.getElementById('lobby-status').innerText = 'The lobby owner declined your request.';
    } else if (data.type === 'KICKED') {
        wasKicked = true;
        gameStarted = false;
        document.getElementById('lobby-status').innerText = 'The lobby creator removed you from the game.';
        showScreen('lobby-screen');
    } else if (data.type === 'HOST_INFO') {
        opponentName = data.name || 'Lobby owner';
        updatePlayerNames();
    } else if (data.type === 'LOBBY_SETTINGS') {
        updateGuestSettings(data.settings);
    } else if (data.type === 'GAME_STATE') {
        gameStarted = true;
        gameSettings = data.settings;
        myHand = data.hand;
        myDiscardPile = data.myDiscardPile || [];
        unoDiscardPile = data.unoDiscardPile || [];
        unoCurrentSuit = data.unoCurrentSuit || '';
        unoDirection = data.unoDirection || 1;
        unoDrawPileCount = data.unoDrawPileCount || 0;
        unoDrawnCardId = data.unoDrawnCardId || null;
        gamePlayers = data.players;
        gamePlayerId = data.youId;
        currentTurnPlayerId = data.currentTurnId;
        gameMessage = data.message || '';
        winnerId = data.winnerId || null;
        winnerType = data.winnerType || '';
        gameResults = data.results || [];
        roundId = data.roundId || '';
        renderGame();
        finishGameForLocalPlayer();
    }
}

function acceptHostPlayer(connection, name) {
    const player = { id: connection.peer, name, hand: [], discardPile: [], lordVerityCorners: [], connection, isSpectator: false };
    hostConnections.set(connection, player);
    const settings = gameStarted ? gameSettings : getLobbySettings();
    connection.send({
        type: 'JOIN_ACCEPTED',
        version: GAME_VERSION,
        hostName: getPlayerName(),
        settings,
        inGame: gameStarted,
        spectating: gameStarted
    });

    if (gameStarted) {
        player.isSpectator = true;
        gamePlayers.push(player);
        broadcastGameState(`${name} joined as a spectator.`);
        renderHostPlayerList('host-game-players');
    } else {
        connection.send({ type: 'LOBBY_SETTINGS', settings });
        updateHostLobbyStatus();
    }
}

function dealHand(settings, cardCount = settings.cardsPerPlayer) {
    return Array.from({ length: cardCount }, () => {
        const allowedCards = settings.allowedCards;
        return allowedCards[Math.floor(Math.random() * allowedCards.length)];
    });
}

function getPublicGameState() {
    return {
        players: gamePlayers.map(({ id, name, hand, discardPile: playerDiscardPile, lordVerityCorners = [], isSpectator }) => ({
            id,
            name,
            cardCount: hand.length,
            discardCount: playerDiscardPile.length,
            lordVerityCorners,
            isSpectator
        })),
        currentTurnId: gamePlayers[currentTurnIndex]?.id || 'host',
        turnDeadline,
        settings: gameSettings,
        unoDiscardPile,
        unoTopCard: unoDiscardPile.at(-1) || null,
        unoCurrentSuit,
        unoDirection,
        unoDrawPileCount: unoDeck.length,
        unoDrawnCardId,
        message: gameMessage,
        winnerId,
        winnerType,
        results: gameResults,
        roundId
    };
}

function syncTurnTimer() {
    const turnDurationSeconds = Number(gameSettings.turnDurationSeconds) || 0;
    if (!isHost || !gameStarted || winnerId || turnDurationSeconds <= 0) {
        clearTimeout(turnTimerHandle);
        turnTimerHandle = null;
        turnDeadline = 0;
        turnTimerPlayerId = null;
        return;
    }
    if (turnTimerPlayerId === currentTurnPlayerId && turnDeadline > Date.now()) return;

    clearTimeout(turnTimerHandle);
    turnTimerPlayerId = currentTurnPlayerId;
    turnDeadline = Date.now() + turnDurationSeconds * 1000;
    const expectedDeadline = turnDeadline;
    const expectedPlayerId = currentTurnPlayerId;
    turnTimerHandle = window.setTimeout(
        () => expireCurrentTurn(expectedPlayerId, expectedDeadline),
        turnDurationSeconds * 1000
    );
}

function expireCurrentTurn(expectedPlayerId, expectedDeadline) {
    if (!isHost || !gameStarted || winnerId || currentTurnPlayerId !== expectedPlayerId || turnDeadline !== expectedDeadline) return;
    const remainingTime = expectedDeadline - Date.now();
    if (remainingTime > 0) {
        turnTimerHandle = window.setTimeout(
            () => expireCurrentTurn(expectedPlayerId, expectedDeadline),
            remainingTime
        );
        return;
    }

    const timedOutPlayer = gamePlayers.find((player) => player.id === expectedPlayerId);
    if (!timedOutPlayer || timedOutPlayer.isSpectator) return;
    turnTimerHandle = null;
    turnDeadline = 0;
    turnTimerPlayerId = null;
    selectedUnoCardId = null;
    if (gameSettings.mode === 'unoity') {
        unoDrawnCardId = null;
        advanceUnoTurn(1);
    } else {
        advanceTurnAfter(expectedPlayerId);
    }
    gameMessage = `${timedOutPlayer.name}'s turn timed out.`;
    broadcastGameState();
}

function broadcastGameState(message = '') {
    if (message) gameMessage = message;
    currentTurnIndex = gamePlayers.length ? currentTurnIndex % gamePlayers.length : 0;
    currentTurnPlayerId = gamePlayers[currentTurnIndex]?.id || 'host';
    syncTurnTimer();
    const publicState = getPublicGameState();
    const hostPlayer = gamePlayers.find((player) => player.id === 'host');
    if (hostPlayer) {
        renderGameState({ ...publicState, youId: 'host', hand: hostPlayer.hand, myDiscardPile: hostPlayer.discardPile });
    }
    gamePlayers.forEach((player) => {
        if (player.connection?.open) {
            player.connection.send({
                ...publicState,
                type: 'GAME_STATE',
                youId: player.id,
                hand: player.hand,
                myDiscardPile: player.discardPile,
                unoDiscardPile
            });
        }
    });
}

function processGuess(guesserId, targetId, cardName, guessedCount) {
    if (!gameStarted || winnerId || gameSettings.mode === 'unoity' || gamePlayers[currentTurnIndex]?.id !== guesserId) return;
    const guesser = gamePlayers.find((player) => player.id === guesserId);
    const target = gamePlayers.find((player) => player.id === targetId && player.id !== guesserId);
    const count = Number(guessedCount);
    if (!guesser || guesser.isSpectator || !target || !getGuessableCards().includes(cardName) || !Number.isInteger(count) || count < 1 || count > target.hand.length) return;

    const matchingCards = target.hand.filter((card) => card === cardName);
    if (matchingCards.length === count) {
        target.hand = target.hand.filter((card) => card !== cardName);
        guesser.discardPile.push(...matchingCards);
        const eliminatedTarget = target.hand.length === 0;
        if (eliminatedTarget && !eliminationOrder.includes(target.id)) {
            eliminationOrder.push(target.id);
        }
        let transferredCorners = [];
        if (eliminatedTarget && gameSettings.allowLordVerity !== false) {
            transferredCorners = target.lordVerityCorners || [];
            guesser.lordVerityCorners.push(...transferredCorners);
            target.lordVerityCorners = [];
        }
        gameMessage = eliminatedTarget && transferredCorners.length
            ? `${guesser.name} guessed correctly and eliminated ${target.name}, taking ${transferredCorners.length} Lord Verity corner${transferredCorners.length === 1 ? '' : 's'} from their assembly.`
            : `${guesser.name} guessed correctly. ${target.name} lost ${matchingCards.length} ${cardName} card${matchingCards.length === 1 ? '' : 's'}; they went to ${guesser.name}'s discard pile.`;
        if (gameSettings.allowLordVerity !== false && hasAllLordVerityCorners(guesser)) {
            finishRoundWithWinner(guesser, `Lord Verity! ${guesser.name} wins!`, 'lord-verity');
            broadcastGameState();
            return;
        }
    } else {
        gameMessage = `${guesser.name} guessed ${target.name} had ${count} ${cardName} card${count === 1 ? '' : 's'}, but was wrong.`;
    }

    advanceTurnAfter(guesserId);
    broadcastGameState();
}

function advanceTurnAfter(playerId) {
    const activePlayers = gamePlayers.filter((player) => !player.isSpectator && player.hand.length > 0);
    if (activePlayers.length <= 1) {
        if (activePlayers[0]) finishRoundWithWinner(activePlayers[0]);
        return;
    }

    winnerId = null;
    const playerIndex = gamePlayers.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= gamePlayers.length; offset += 1) {
        const nextIndex = (playerIndex + offset) % gamePlayers.length;
        if (!gamePlayers[nextIndex].isSpectator && gamePlayers[nextIndex].hand.length > 0) {
            currentTurnIndex = nextIndex;
            return;
        }
    }
}

function finishRoundWithWinner(winner, message = gameMessage, type = '') {
    winnerId = winner.id;
    winnerType = type;
    currentTurnIndex = gamePlayers.findIndex((player) => player.id === winner.id);
    gameMessage = message;
    const players = gamePlayers.filter((player) => !player.isSpectator);
    const playerCount = players.length;
    const winnerReward = 100 + Math.max(0, playerCount - 2) * 25;
    const finalOrder = [
        winner.id,
        ...eliminationOrder.filter((id) => id !== winner.id && players.some((player) => player.id === id)).reverse(),
        ...players.map((player) => player.id).filter((id) => id !== winner.id && !eliminationOrder.includes(id))
    ];
    gameResults = finalOrder.map((id, index) => {
        const placement = index + 1;
        const reward = placement === 1
            ? winnerReward
            : Math.max(10, Math.round(winnerReward * (playerCount - placement + 1) / (2 * playerCount)));
        return { id, placement, reward };
    });
}

function getGuessableCards() {
    return Array.isArray(gameSettings.allowedCards) ? gameSettings.allowedCards : [];
}

function hasAllLordVerityCorners(player) {
    const assembledCorners = new Set(player.lordVerityCorners || []);
    return LORD_VERITY_CORNERS.every(({ name }) => assembledCorners.has(name));
}

function dealLordVerityCorners(players) {
    if (!players.length) return;
    const shuffledCorners = shuffleCards([...LORD_VERITY_CORNERS]);
    if (players.length > 1 && Math.random() < LORD_VERITY_TRIPLE_START_CHANCE) {
        const tripleRecipient = players[Math.floor(Math.random() * players.length)];
        const remainingPlayers = players.filter((player) => player !== tripleRecipient);
        const otherRecipient = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
        shuffledCorners.slice(0, 3).forEach(({ name }) => tripleRecipient.lordVerityCorners.push(name));
        otherRecipient.lordVerityCorners.push(shuffledCorners[3].name);
        return;
    }

    shuffledCorners.forEach(({ name }) => {
        const eligiblePlayers = players.filter((player) => player.lordVerityCorners.length < 2);
        if (!eligiblePlayers.length) return;
        const recipient = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
        recipient.lordVerityCorners.push(name);
    });
}

function shuffleCards(cards) {
    for (let index = cards.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
    }
    return cards;
}

function createUnoDeck() {
    let nextId = 0;
    const deck = [];
    UNO_SUITS.forEach((suit) => {
        CARD_OPTIONS.forEach((value) => {
            deck.push({ id: `uno-${nextId++}`, suit, value, type: 'variety' });
        });
        UNO_ACTIONS.forEach(({ type, value, copies }) => {
            for (let copy = 0; copy < copies; copy += 1) {
                deck.push({ id: `uno-${nextId++}`, suit, value, type });
            }
        });
    });
    for (let copy = 0; copy < 4; copy += 1) {
        deck.push({ id: `uno-${nextId++}`, suit: null, value: 'Wildity', type: 'wild' });
        deck.push({ id: `uno-${nextId++}`, suit: null, value: 'Draw Fourity', type: 'draw-four' });
    }
    return shuffleCards(deck);
}

function drawUnoCard(player, amount = 1) {
    if (typeof player === 'string') {
        if (!gameStarted || winnerId || gameSettings.mode !== 'unoity' || gamePlayers[currentTurnIndex]?.id !== player) return;
        const currentPlayer = gamePlayers.find((candidate) => candidate.id === player);
        if (!currentPlayer || unoDrawnCardId || currentPlayer.hand.some((card) => isUnoCardPlayable(card))) return;
        const drawnCards = drawUnoCards(amount);
        currentPlayer.hand.push(...drawnCards);
        if (drawnCards.length) {
            unoDrawnCardId = drawnCards[0].id;
            gameMessage = `${currentPlayer.name} drew a card. They may play it if it matches or pass.`;
        } else {
            gameMessage = `${currentPlayer.name} drew no cards; the draw pile is empty.`;
            advanceUnoTurn(1);
        }
        broadcastGameState();
        return;
    }
    return drawUnoCards(amount);
}

function drawUnoCards(amount) {
    const cards = [];
    for (let index = 0; index < amount; index += 1) {
        if (!unoDeck.length) {
            const topCard = unoDiscardPile.pop();
            unoDeck = shuffleCards(unoDiscardPile.splice(0));
            if (topCard) unoDiscardPile.push(topCard);
        }
        const card = unoDeck.pop();
        if (!card) break;
        cards.push(card);
    }
    return cards;
}

function isUnoCardPlayable(card, topCard = unoDiscardPile.at(-1), activeSuit = unoCurrentSuit) {
    if (!card || card.type === 'wild' || card.type === 'draw-four') return Boolean(card);
    if (!topCard) return true;
    return card.suit === activeSuit || card.value === topCard.value;
}

function canPlayUnoCard(card, hand) {
    return isUnoCardPlayable(card) && (card.type !== 'draw-four'
        || !hand.some((heldCard) => heldCard.id !== card.id && heldCard.suit === unoCurrentSuit));
}

function processUnoPlay(playerId, cardId, chosenSuit) {
    if (!gameStarted || winnerId || gameSettings.mode !== 'unoity' || gamePlayers[currentTurnIndex]?.id !== playerId) return;
    const player = gamePlayers.find((candidate) => candidate.id === playerId);
    const cardIndex = player?.hand.findIndex((card) => card.id === cardId) ?? -1;
    if (!player || player.isSpectator || cardIndex < 0 || (unoDrawnCardId && cardId !== unoDrawnCardId)) return;
    const card = player.hand[cardIndex];
    if (!canPlayUnoCard(card, player.hand)) return;
    if ((card.type === 'wild' || card.type === 'draw-four') && !UNO_SUITS.includes(chosenSuit)) return;
    player.hand.splice(cardIndex, 1);

    unoDiscardPile.push(card);
    unoCurrentSuit = card.suit || (UNO_SUITS.includes(chosenSuit) ? chosenSuit : unoCurrentSuit);
    unoDrawnCardId = null;
    selectedUnoCardId = null;
    if (player.hand.length === 0) {
        finishRoundWithWinner(player, `${player.name} wins Unoity!`, 'unoity');
        broadcastGameState();
        return;
    }

    let skippedPlayers = 0;
    if (card.type === 'skip') {
        skippedPlayers = 1;
    } else if (card.type === 'reverse') {
        unoDirection *= -1;
        if (gamePlayers.length === 2) skippedPlayers = 1;
    } else if (card.type === 'draw-two' || card.type === 'draw-four') {
        const penalty = card.type === 'draw-two' ? 2 : 4;
        const nextPlayerIndex = getUnoNextPlayerIndex(currentTurnIndex, 1);
        const nextPlayer = gamePlayers[nextPlayerIndex];
        nextPlayer.hand.push(...drawUnoCards(penalty));
        skippedPlayers = 1;
        gameMessage = `${player.name} played ${getUnoCardLabel(card)}. ${nextPlayer.name} draws ${penalty} and misses a turn.`;
    }

    if (card.type !== 'draw-two' && card.type !== 'draw-four') {
        gameMessage = `${player.name} played ${getUnoCardLabel(card)}.`;
    }
    advanceUnoTurn(skippedPlayers + 1);
    broadcastGameState();
}

function passUnoTurn(playerId) {
    if (!gameStarted || winnerId || gameSettings.mode !== 'unoity' || gamePlayers[currentTurnIndex]?.id !== playerId || !unoDrawnCardId) return;
    unoDrawnCardId = null;
    selectedUnoCardId = null;
    gameMessage = `${gamePlayers[currentTurnIndex].name} passed after drawing.`;
    advanceUnoTurn(1);
    broadcastGameState();
}

function getUnoNextPlayerIndex(fromIndex, steps) {
    let index = fromIndex;
    if (!gamePlayers.length) return -1;
    for (let step = 0; step < steps; step += 1) {
        let attempts = 0;
        do {
            index = (index + unoDirection + gamePlayers.length) % gamePlayers.length;
            attempts += 1;
        } while (gamePlayers[index].isSpectator && attempts < gamePlayers.length);
    }
    return index;
}

function advanceUnoTurn(steps) {
    currentTurnIndex = getUnoNextPlayerIndex(currentTurnIndex, steps);
    currentTurnPlayerId = gamePlayers[currentTurnIndex]?.id || 'host';
}

function getUnoCardLabel(card) {
    return card.suit ? `${card.value} (${card.suit})` : card.value;
}

function getUnoCardArtwork(card) {
    const characterArtwork = CHARACTER_ARTWORK.get(card.value);
    if (characterArtwork) return characterArtwork;

    const cardIndex = Number.parseInt(card.id.slice('uno-'.length), 10);
    const characterIndex = Number.isInteger(cardIndex) ? Math.abs(cardIndex) % CARD_OPTIONS.length : 0;
    return CHARACTER_ARTWORK.get(CARD_OPTIONS[characterIndex]);
}

function showNextJoinRequest() {
    const panel = document.getElementById('join-request-panel');
    if (!panel.hidden || currentJoinRequest) return;
    currentJoinRequest = pendingJoinRequests.shift() || null;
    if (!currentJoinRequest) return;
    document.getElementById('join-request-message').innerText =
        `${currentJoinRequest.name} wants to join your current round.`;
    panel.hidden = false;
}

function answerJoinRequest(approved) {
    if (!currentJoinRequest) return;
    const { connection, name } = currentJoinRequest;
    currentJoinRequest = null;
    if (approved) {
        acceptHostPlayer(connection, name);
    } else {
        connection.send({ type: 'JOIN_REJECTED', version: GAME_VERSION });
        connection.close();
    }
    document.getElementById('join-request-panel').hidden = true;
    window.setTimeout(showNextJoinRequest, 0);
}

function kickPlayer(playerId, playerName) {
    if (!isHost || !window.confirm(`Kick ${playerName} from the game?`)) return;
    const player = Array.from(hostConnections.values()).find((candidate) => candidate.id === playerId);
    if (!player) return;
    if (player.connection.open) player.connection.send({ type: 'KICKED' });
    removeHostPlayer(player.connection, 'was kicked from the game.');
    if (player.connection.open) player.connection.close();
}

function removeHostPlayer(connection, message) {
    const removedPlayer = hostConnections.get(connection);
    if (!removedPlayer) return;
    hostConnections.delete(connection);
    const removedIndex = gamePlayers.findIndex((player) => player.connection === connection);
    if (removedIndex < 0) {
        updateHostLobbyStatus();
        return;
    }

    const [gamePlayer] = gamePlayers.splice(removedIndex, 1);
    const currentTurnWasRemoved = gamePlayer.id === currentTurnPlayerId;
    if (removedIndex < currentTurnIndex) currentTurnIndex -= 1;
    currentTurnIndex = gamePlayers.length ? Math.max(0, currentTurnIndex) % gamePlayers.length : 0;

    if (gameStarted && !winnerId) {
        if (gameSettings.mode === 'unoity') {
            const activePlayers = gamePlayers.filter((player) => !player.isSpectator);
            if (activePlayers.length === 1) {
                finishRoundWithWinner(activePlayers[0], `${activePlayers[0].name} wins Unoity!`, 'unoity');
            } else if (currentTurnWasRemoved && gamePlayers.length) {
                unoDrawnCardId = null;
                selectedUnoCardId = null;
                currentTurnIndex = (removedIndex - (unoDirection < 0 ? 1 : 0) + gamePlayers.length) % gamePlayers.length;
            }
            broadcastGameState(`${removedPlayer.name} ${message}`);
            return;
        }
        const activePlayers = gamePlayers.filter((player) => !player.isSpectator && player.hand.length > 0);
        if (activePlayers.length <= 1) {
            advanceTurnAfter(gamePlayer.id);
        } else if (currentTurnWasRemoved) {
            for (let offset = 0; offset < gamePlayers.length; offset += 1) {
                const nextIndex = (removedIndex + offset) % gamePlayers.length;
                if (!gamePlayers[nextIndex].isSpectator && gamePlayers[nextIndex].hand.length > 0) {
                    currentTurnIndex = nextIndex;
                    break;
                }
            }
        }
        broadcastGameState(`${removedPlayer.name} ${message}`);
    } else {
        updateHostLobbyStatus();
    }
}

// Host triggers game start using settings UI
function startGame(soloDebug = false) {
    if (!isHost && !soloDebug) return;
    const players = soloDebug ? [] : Array.from(hostConnections.entries()).filter(([connection]) => connection.open);
    if (players.length === 0 && !soloDebug) {
        document.getElementById('lobby-status').innerText = 'Wait for your friend to connect before starting.';
        return;
    }

    // Gather custom host settings
    const {
        cardsPerPlayer,
        allowedCards: selectedCards,
        allowSpectators,
        allowLordVerity,
        turnDurationSeconds: lobbyTurnDuration,
        mode: lobbyMode
    } = getLobbySettings();
    const mode = soloDebug ? document.getElementById('debug-game-mode').value : lobbyMode;
    const allowedCards = soloDebug && selectedCards.length === 0 ? CARD_OPTIONS : selectedCards;
    const turnDurationSeconds = soloDebug
        ? Number(document.getElementById('debug-turn-duration').value)
        : lobbyTurnDuration;

    if (mode !== 'unoity' && allowedCards.length === 0) return alert("Select at least one card type!");

    if (soloDebug) {
        isHost = true;
        hostConnections.clear();
    }
    gameSettings = { cardsPerPlayer, allowedCards, allowSpectators, allowLordVerity, turnDurationSeconds, mode };
    gameStarted = true;
    winnerId = null;
    winnerType = '';
    eliminationOrder = [];
    gameResults = [];
    roundId = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    gameFinished = false;
    myDiscardPile = [];
    unoDiscardPile = [];
    unoCurrentSuit = '';
    unoDirection = 1;
    unoDrawPileCount = 0;
    unoDrawnCardId = null;
    selectedUnoCardId = null;
    clearTimeout(turnNotificationTimeout);
    turnNotificationTimeout = null;
    const turnNotification = document.getElementById('turn-notification');
    turnNotification.hidden = true;
    turnNotification.dataset.visible = 'false';
    gamePlayers = [{ id: 'host', name: getPlayerName(), hand: [], discardPile: [], lordVerityCorners: [], connection: null, isSpectator: false }];
    players.forEach(([connection, player]) => {
        player.id = connection.peer;
        player.connection = connection;
        player.hand = [];
        player.discardPile = [];
        player.lordVerityCorners = [];
        gamePlayers.push(player);
    });
    if (soloDebug) {
        const opponentCount = Number(document.getElementById('debug-opponent-count').value);
        for (let index = 1; index <= opponentCount; index += 1) {
            gamePlayers.push({
                id: `debug-player-${index}`,
                name: `Test Player ${index}`,
                hand: [],
                discardPile: [],
                lordVerityCorners: [],
                connection: null,
                isSpectator: false
            });
        }
    }
    if (mode === 'unoity') {
        unoDeck = createUnoDeck();
        gamePlayers.forEach((player) => {
            player.hand = drawUnoCards(7);
        });
        let startingCardIndex = unoDeck.findIndex((card) => card.type === 'variety');
        if (startingCardIndex < 0) startingCardIndex = unoDeck.length - 1;
        const [startingCard] = unoDeck.splice(startingCardIndex, 1);
        unoDiscardPile.push(startingCard);
        unoCurrentSuit = startingCard.suit;
    } else {
        if (allowLordVerity) dealLordVerityCorners(gamePlayers);
        gamePlayers.forEach((player) => {
            player.hand = dealHand(gameSettings, cardsPerPlayer - player.lordVerityCorners.length);
        });
    }
    currentTurnIndex = 0;
    turnDeadline = 0;
    turnTimerPlayerId = null;
    lastObservedTurnPlayerId = null;
    broadcastGameState(soloDebug
        ? `Solo debug test started with ${gamePlayers.length - 1} simulated opponent${gamePlayers.length === 2 ? '' : 's'}.`
        : 'The round started.');
    renderHostPlayerList('host-game-players');
}

function startSoloDebugGame() {
    if (document.getElementById('debug-menu-panel').hidden) return;
    startGame(true);
}

function renderGameState(state) {
    gameStarted = true;
    gameSettings = state.settings;
    if (!isHost) gamePlayers = state.players;
    gamePlayerId = state.youId;
    currentTurnPlayerId = state.currentTurnId;
    turnDeadline = state.turnDeadline || 0;
    gameMessage = state.message || '';
    winnerId = state.winnerId || null;
    winnerType = state.winnerType || '';
    gameResults = state.results || [];
    roundId = state.roundId || '';
    myDiscardPile = state.myDiscardPile || [];
    unoDiscardPile = state.unoDiscardPile || [];
    unoCurrentSuit = state.unoCurrentSuit || '';
    unoDirection = state.unoDirection || 1;
    unoDrawPileCount = state.unoDrawPileCount || 0;
    unoDrawnCardId = state.unoDrawnCardId || null;
    myHand = state.hand;
    renderGame();
    finishGameForLocalPlayer();
}

function finishGameForLocalPlayer() {
    if (!winnerId || !gameResults.length) return;
    gameFinished = true;
    const localResult = gameResults.find((result) => result.id === gamePlayerId);
    awardRoundCoins(roundId, localResult);
    if (!returnToMenuTimer) {
        returnToMenuTimer = window.setTimeout(
            returnToMenu,
            END_GAME_RETURN_DELAY
        );
    }
}

function updateGuessCountOptions() {
    const targetId = document.getElementById('guess-target').value;
    const target = gamePlayers.find((player) => player.id === targetId);
    const countInput = document.getElementById('guess-count');
    const previousCount = Number(countInput.value);
    const maximum = getPlayerCardCount(target);
    countInput.max = String(maximum);
    countInput.value = maximum
        ? String(Number.isInteger(previousCount) && previousCount >= 1 && previousCount <= maximum ? previousCount : 1)
        : '';
    countInput.disabled = maximum === 0;
    document.getElementById('submit-guess-button').disabled = maximum === 0;
}

function getPlayerCardCount(player) {
    if (!player) return 0;
    return Array.isArray(player.hand) ? player.hand.length : player.cardCount || 0;
}

function createCharacterCard(cardName, className = 'card character-card') {
    const card = document.createElement('div');
    card.className = className;
    card.setAttribute('aria-label', `${cardName} character card`);

    const topRank = document.createElement('span');
    topRank.className = 'playing-card-rank';
    topRank.setAttribute('aria-hidden', 'true');
    topRank.textContent = cardName.charAt(0).toUpperCase();

    const artwork = document.createElement('img');
    artwork.className = 'character-card-art';
    artwork.src = CHARACTER_ARTWORK.get(cardName) || '';
    artwork.alt = `${cardName} character`;
    artwork.draggable = false;

    const name = document.createElement('span');
    name.className = 'playing-card-name';
    name.textContent = cardName;

    const bottomRank = document.createElement('span');
    bottomRank.className = 'playing-card-rank-bottom';
    bottomRank.setAttribute('aria-hidden', 'true');
    bottomRank.textContent = cardName.charAt(0).toUpperCase();

    card.append(topRank, artwork, name, bottomRank);
    return card;
}

function showCardCatalog() {
    const container = document.getElementById('card-catalog');
    const fragment = document.createDocumentFragment();
    CARD_OPTIONS.forEach((cardName) => {
        fragment.appendChild(createCharacterCard(cardName, 'card character-card catalog-card'));
    });
    if (gameSettings.allowLordVerity !== false) {
        LORD_VERITY_CORNERS.forEach(({ name: pieceName, corner }) => {
            const card = document.createElement('div');
            card.className = 'card character-card catalog-card';
            card.setAttribute('aria-label', pieceName);

            const topRank = document.createElement('span');
            topRank.className = 'playing-card-rank';
            topRank.setAttribute('aria-hidden', 'true');
            topRank.textContent = 'LV';

            const artwork = document.createElement('span');
            artwork.className = 'lord-corner-art catalog-lord-art';
            artwork.dataset.corner = corner;
            artwork.setAttribute('aria-hidden', 'true');

            const name = document.createElement('span');
            name.className = 'playing-card-name';
            name.textContent = pieceName;

            const bottomRank = document.createElement('span');
            bottomRank.className = 'playing-card-rank-bottom';
            bottomRank.setAttribute('aria-hidden', 'true');
            bottomRank.textContent = 'LV';

            card.append(topRank, artwork, name, bottomRank);
            fragment.appendChild(card);
        });
    }
    container.replaceChildren(fragment);
    const dialog = document.getElementById('card-catalog-dialog');
    dialog.appendChild(document.getElementById('cursor-glow'));
    dialog.showModal();
}

function closeCardCatalog() {
    document.getElementById('card-catalog-dialog').close();
}

function updateUnoHandLayout() {
    const handContainer = document.getElementById('my-hand');
    const cards = handContainer.querySelectorAll('.uno-card');
    if (!cards.length) {
        handContainer.style.removeProperty('--uno-overlap');
        return;
    }
    const cardWidth = cards[0].getBoundingClientRect().width;
    const availableWidth = handContainer.clientWidth - 28;
    const overlap = Math.min(cardWidth - 38, Math.max(0, cardWidth - availableWidth / cards.length));
    handContainer.style.setProperty('--uno-overlap', `${overlap}px`);
}

function updateTurnCountdown() {
    const timer = document.getElementById('turn-timer');
    const timerTrack = document.getElementById('turn-timer-track');
    const timerBar = document.getElementById('turn-timer-bar');
    const turnDurationSeconds = Number(gameSettings.turnDurationSeconds) || 0;
    const hasTimer = turnDurationSeconds > 0 && turnDeadline > 0 && !winnerId;
    timer.hidden = !hasTimer;
    timerTrack.hidden = !hasTimer;
    if (hasTimer) {
        const remainingMilliseconds = Math.max(0, turnDeadline - Date.now());
        const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
        const progress = Math.min(100, remainingMilliseconds / (turnDurationSeconds * 1000) * 100);
        timer.textContent = `${remainingSeconds} seconds remaining this turn.`;
        timerTrack.setAttribute('aria-valuenow', String(Math.round(progress)));
        timerBar.style.width = `${progress}%`;
        timerBar.style.backgroundColor = `hsl(${Math.round(progress * 1.2)} 75% 42%)`;
    }
}

function showTurnNotification() {
    const notification = document.getElementById('turn-notification');
    clearTimeout(turnNotificationTimeout);
    notification.hidden = false;
    notification.dataset.visible = 'true';
    turnNotificationTimeout = window.setTimeout(() => {
        notification.dataset.visible = 'false';
        notification.hidden = true;
        turnNotificationTimeout = null;
    }, 3200);
}

// Render the hand as information only; guesses are the only game action.
function renderGame() {
    showScreen('game-screen');
    updatePlayerNames();
    const isUnoity = gameSettings.mode === 'unoity';
    const localPlayer = gamePlayers.find((player) => player.id === gamePlayerId);
    const isOut = getPlayerCardCount(localPlayer) === 0;
    const canSpectate = gameSettings.allowSpectators !== false;
    document.getElementById('out-panel').hidden = isUnoity || !isOut;
    document.getElementById('out-message').innerText = canSpectate
        ? 'You are spectating the rest of the round.'
        : 'You have no cards left. The host disabled spectating for this round.';
    document.getElementById('game-play-area').hidden = !isUnoity && isOut && !canSpectate;
    document.getElementById('uno-table').hidden = !isUnoity;
    document.getElementById('arena').hidden = isUnoity;
    document.getElementById('guess-controls').hidden = isUnoity;
    document.getElementById('discard-panel').hidden = isUnoity;
    const lordVerityPanel = document.getElementById('lord-verity-panel');
    lordVerityPanel.hidden = isUnoity || gameSettings.allowLordVerity === false;
    renderLordVerityAssembly(localPlayer);
    document.getElementById('my-hand-title').innerText = isUnoity ? `Your Hand (${myHand.length})` : 'Your Hand';
    renderWinnerOverlay();
    renderOpponentCards();
    const selectedTargetId = document.getElementById('guess-target').value;
    const selectedCardName = document.getElementById('guess-card').value;
    const handContainer = document.getElementById('my-hand');
    document.querySelector('.game-columns').classList.toggle('unoity-layout', isUnoity);
    handContainer.classList.toggle('uno-hand', isUnoity);
    handContainer.classList.toggle('guess-hand', !isUnoity);
    if (!isUnoity) handContainer.style.removeProperty('--uno-overlap');
    handContainer.innerHTML = '';

    if (isUnoity) {
        renderUnoBoard(gamePlayerId === currentTurnPlayerId);
        renderUnoHand(gamePlayerId === currentTurnPlayerId);
    } else {
        myHand.forEach((cardName, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.style.animationDelay = `${index * 65}ms`;
            const lordCorner = LORD_VERITY_CORNERS.find(({ name }) => name === cardName);
            if (lordCorner) {
                cardEl.classList.add('lord-verity-piece');
                cardEl.setAttribute('aria-label', cardName);
                cardEl.title = cardName;
                const artwork = document.createElement('span');
                artwork.className = 'lord-corner-art';
                artwork.dataset.corner = lordCorner.corner;
                artwork.setAttribute('aria-hidden', 'true');
                const label = document.createElement('span');
                label.className = 'lord-corner-label';
                label.textContent = lordCorner.corner.replace('-', ' ');
                cardEl.append(artwork, label);
                handContainer.appendChild(cardEl);
            } else if (CHARACTER_ARTWORK.has(cardName)) {
                const characterCard = createCharacterCard(cardName);
                characterCard.style.animationDelay = `${index * 65}ms`;
                handContainer.appendChild(characterCard);
            } else {
                cardEl.innerText = cardName;
                handContainer.appendChild(cardEl);
            }
        });
    }

    const currentPlayer = gamePlayers.find((player) => player.id === currentTurnPlayerId);
    const isMyTurn = gamePlayerId === currentTurnPlayerId;
    const turnChanged = lastObservedTurnPlayerId !== null && lastObservedTurnPlayerId !== currentTurnPlayerId;
    lastObservedTurnPlayerId = currentTurnPlayerId;
    if (turnChanged && isMyTurn && !winnerId) showTurnNotification();
    document.getElementById('turn-status').innerText = winnerId
        ? 'The round is over.'
        : isOut && !isUnoity
            ? 'You are out.'
            : isMyTurn
                ? isUnoity ? 'Your turn: play a matching card or draw.' : 'Your turn: choose a player, card, and exact count.'
                : `${currentPlayer?.name || 'Another player'}'s turn.`;
    clearInterval(turnCountdownInterval);
    turnCountdownInterval = null;
    updateTurnCountdown();
    if (!document.getElementById('turn-timer').hidden) {
        turnCountdownInterval = window.setInterval(updateTurnCountdown, 1000);
    }
    document.getElementById('game-event-message').innerText = gameMessage || 'The round started.';
    renderDiscardPile();

    const targetSelect = document.getElementById('guess-target');
    targetSelect.replaceChildren();
    gamePlayers.filter((player) => player.id !== gamePlayerId).forEach((player) => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `${player.name} (${getPlayerCardCount(player)} cards)`;
        targetSelect.appendChild(option);
    });
    if (Array.from(targetSelect.options).some((option) => option.value === selectedTargetId)) {
        targetSelect.value = selectedTargetId;
    }

    const cardSelect = document.getElementById('guess-card');
    cardSelect.replaceChildren();
    const selectedCardPool = getGuessableCards();
    selectedCardPool.forEach((cardName) => {
        const option = document.createElement('option');
        option.value = cardName;
        option.textContent = cardName;
        cardSelect.appendChild(option);
    });
    if (selectedCardPool.includes(selectedCardName)) cardSelect.value = selectedCardName;
    if (!isUnoity) {
        document.getElementById('guess-controls').hidden = !isMyTurn || isOut || winnerId !== null || targetSelect.options.length === 0;
        document.getElementById('submit-guess-button').disabled = !isMyTurn || isOut || winnerId !== null || targetSelect.options.length === 0;
    }
    updateGuessCountOptions();
    renderHostPlayerList('host-game-players');
}

function renderOpponentCards() {
    const container = document.getElementById('opponent-cards');
    const opponents = gamePlayers.filter((player) => player.id !== gamePlayerId);
    const fragment = document.createDocumentFragment();
    if (!opponents.length) {
        const waiting = document.createElement('span');
        waiting.className = 'opponent-card-empty';
        waiting.textContent = 'Waiting for players';
        container.replaceChildren(waiting);
        return;
    }

    opponents.forEach((player) => {
        const lordVerityCount = gameSettings.mode !== 'unoity' && gameSettings.allowLordVerity !== false
            ? (player.lordVerityCorners || []).length
            : 0;
        const cardCount = getPlayerCardCount(player) + lordVerityCount;
        const playerCard = document.createElement('div');
        playerCard.className = 'opponent-card';
        playerCard.dataset.currentTurn = String(player.id === currentTurnPlayerId);

        const name = document.createElement('span');
        name.className = 'opponent-card-name';
        name.textContent = player.isSpectator ? `${player.name} (spectating)` : player.name;
        playerCard.appendChild(name);

        if (player.isSpectator) {
            const spectatorLabel = document.createElement('span');
            spectatorLabel.className = 'opponent-card-empty';
            spectatorLabel.textContent = 'Spectating';
            playerCard.appendChild(spectatorLabel);
        } else {
            const backs = document.createElement('div');
            backs.className = 'opponent-card-backs';
            backs.setAttribute('aria-hidden', 'true');
            const visibleCardCount = Math.min(cardCount, 5);
            for (let index = 0; index < visibleCardCount; index += 1) {
                const cardBack = document.createElement('span');
                cardBack.className = 'opponent-card-back';
                backs.appendChild(cardBack);
            }
            if (!cardCount) {
                const emptyHand = document.createElement('span');
                emptyHand.className = 'opponent-card-empty';
                emptyHand.textContent = 'No cards';
                backs.appendChild(emptyHand);
            }
            playerCard.appendChild(backs);

            const count = document.createElement('span');
            count.className = 'opponent-card-count';
            count.textContent = `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`;
            playerCard.appendChild(count);
        }
        fragment.appendChild(playerCard);
    });
    container.replaceChildren(fragment);
}

function renderUnoBoard(isMyTurn) {
    const topCard = unoDiscardPile.at(-1);
    const topCardElement = document.getElementById('uno-top-card');
    topCardElement.replaceChildren();
    topCardElement.setAttribute('aria-label', topCard ? `Top card: ${getUnoCardLabel(topCard)}` : 'No card');
    if (topCard) {
        const artwork = document.createElement('img');
        artwork.className = 'uno-top-card-art';
        artwork.src = getUnoCardArtwork(topCard);
        artwork.alt = '';
        artwork.draggable = false;
        topCardElement.appendChild(artwork);
    }
    topCardElement.dataset.suit = topCard?.suit?.toLowerCase() || 'wild';
    document.getElementById('uno-current-suit').innerText = `Current variety: ${unoCurrentSuit || 'Any'}`;
    document.getElementById('uno-direction').innerText = `Turn direction: ${unoDirection > 0 ? 'Clockwise' : 'Counterclockwise'}`;
    document.getElementById('uno-draw-pile-count').innerText = `${unoDrawPileCount} cards left to draw`;

    const selectedCard = myHand.find((card) => card.id === selectedUnoCardId);
    const needsSuitChoice = selectedCard?.type === 'wild' || selectedCard?.type === 'draw-four';
    document.getElementById('uno-wild-controls').hidden = !isMyTurn || !needsSuitChoice;
    document.getElementById('uno-play-selected').disabled = !isMyTurn || !needsSuitChoice || winnerId !== null;
    const hasPlayableCard = myHand.some((card) => canPlayUnoCard(card, myHand));
    document.getElementById('uno-draw-button').disabled = !isMyTurn || hasPlayableCard || Boolean(unoDrawnCardId) || winnerId !== null;
    document.getElementById('uno-pass-button').hidden = !isMyTurn || !unoDrawnCardId;
}

function renderLordVerityAssembly(player) {
    const container = document.getElementById('lord-verity-assembly');
    const collectedCorners = new Set(player?.lordVerityCorners || []);
    const fragment = document.createDocumentFragment();
    LORD_VERITY_CORNERS.forEach(({ name, corner }) => {
        const slot = document.createElement('div');
        slot.className = 'lord-verity-slot';
        slot.dataset.collected = String(collectedCorners.has(name));
        slot.setAttribute('aria-label', `${name}: ${collectedCorners.has(name) ? 'collected' : 'not collected'}`);
        if (collectedCorners.has(name)) {
            const artwork = document.createElement('span');
            artwork.className = 'lord-corner-art';
            artwork.dataset.corner = corner;
            artwork.setAttribute('aria-hidden', 'true');
            slot.appendChild(artwork);
        } else {
            slot.textContent = corner.replace('-', ' ');
        }
        fragment.appendChild(slot);
    });
    container.replaceChildren(fragment);
    document.getElementById('lord-verity-progress').textContent = `${collectedCorners.size} of ${LORD_VERITY_CORNERS.length} corners collected`;
}

function renderUnoHand(isMyTurn) {
    const handContainer = document.getElementById('my-hand');
    if (!myHand.some((card) => card.id === selectedUnoCardId)) selectedUnoCardId = null;
    myHand.forEach((card, index) => {
        const cardButton = document.createElement('button');
        cardButton.type = 'button';
        cardButton.className = 'card uno-card';
        cardButton.dataset.suit = card.suit?.toLowerCase() || 'wild';
        cardButton.style.animationDelay = `${index * 45}ms`;
        const artwork = document.createElement('img');
        artwork.className = 'uno-card-character';
        artwork.src = getUnoCardArtwork(card);
        artwork.alt = '';
        artwork.draggable = false;
        cardButton.appendChild(artwork);
        const isPlayable = canPlayUnoCard(card, myHand);
        cardButton.setAttribute('aria-label', `${getUnoCardLabel(card)}${isPlayable ? ', playable' : ', not playable'}`);
        cardButton.disabled = !isMyTurn || winnerId !== null || !isPlayable || (unoDrawnCardId && card.id !== unoDrawnCardId);
        if (card.id === selectedUnoCardId) cardButton.classList.add('selected');
        cardButton.addEventListener('click', () => {
            if (card.type === 'wild' || card.type === 'draw-four') {
                selectedUnoCardId = card.id;
                renderGame();
            } else {
                sendUnoPlay(card);
            }
        });
        handContainer.appendChild(cardButton);
    });
    updateUnoHandLayout();
}

function sendUnoPlay(card, suit = document.getElementById('uno-wild-suit').value) {
    if (isHost) {
        processUnoPlay('host', card.id, suit);
    } else if (conn?.open) {
        conn.send({ type: 'UNO_PLAY', cardId: card.id, suit });
    }
}

function playSelectedUnoCard() {
    const card = myHand.find((candidate) => candidate.id === selectedUnoCardId);
    if (card && (card.type === 'wild' || card.type === 'draw-four')) sendUnoPlay(card);
}

function drawUnoTurn() {
    if (isHost) {
        drawUnoCard('host');
    } else if (conn?.open) {
        conn.send({ type: 'UNO_DRAW' });
    }
}

function passUnoTurnFromUI() {
    if (isHost) {
        passUnoTurn('host');
    } else if (conn?.open) {
        conn.send({ type: 'UNO_PASS' });
    }
}

function renderWinnerOverlay() {
    const overlay = document.getElementById('winner-overlay');
    if (!winnerId) {
        overlay.hidden = true;
        return;
    }
    const winner = gamePlayers.find((player) => player.id === winnerId);
    if (!winner) return;
    const localResult = gameResults.find((result) => result.id === gamePlayerId);
    document.getElementById('winner-title').innerText = localResult?.placement === 1 ? 'You win!' : 'You lost';
    if (winnerType === 'unoity') {
        document.getElementById('winner-title').innerText = 'Unoity!';
        document.getElementById('winner-message').innerText = `${winner.name} wins!${localResult ? ` You earned ${localResult.reward} coins.` : ''}`;
    } else if (winnerType === 'lord-verity') {
        document.getElementById('winner-title').innerText = 'Lord Verity!';
        document.getElementById('winner-message').innerText = `${winner.name} wins!${localResult ? ` You earned ${localResult.reward} coins.` : ''}`;
    } else {
        document.getElementById('winner-message').innerText = localResult
            ? `${localResult.placement}${getPlacementSuffix(localResult.placement)} place. You earned ${localResult.reward} coins. Returning to the main menu...`
            : `${winner.name} is the last player standing. Returning to the main menu...`;
    }
    overlay.hidden = false;
}

function getPlacementSuffix(placement) {
    if (placement % 100 >= 11 && placement % 100 <= 13) return 'th';
    return ({ 1: 'st', 2: 'nd', 3: 'rd' })[placement % 10] || 'th';
}

function renderDiscardPile() {
    const container = document.getElementById('discard-pile');
    container.replaceChildren();
    document.getElementById('discard-count').innerText = String(myDiscardPile.length);
    const fragment = document.createDocumentFragment();
    myDiscardPile.forEach((cardName) => {
        const card = document.createElement('div');
        card.className = 'discarded-card';
        const lordCorner = LORD_VERITY_CORNERS.find(({ name }) => name === cardName);
        if (lordCorner) {
            card.classList.add('lord-corner-discard');
            card.setAttribute('aria-label', cardName);
            card.title = cardName;
            const artwork = document.createElement('span');
            artwork.className = 'lord-corner-art';
            artwork.dataset.corner = lordCorner.corner;
            artwork.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.textContent = lordCorner.corner.replace('-', ' ');
            card.append(artwork, label);
        } else {
            card.textContent = cardName;
        }
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

function submitGuess() {
    if (!gameStarted || gameSettings.mode === 'unoity' || gamePlayerId !== currentTurnPlayerId) return;
    const targetId = document.getElementById('guess-target').value;
    const target = gamePlayers.find((player) => player.id === targetId);
    const guess = {
        targetId,
        cardName: document.getElementById('guess-card').value,
        guessedCount: Number(document.getElementById('guess-count').value)
    };
    if (!target || !getGuessableCards().includes(guess.cardName) || !Number.isInteger(guess.guessedCount) || guess.guessedCount < 1 || guess.guessedCount > getPlayerCardCount(target)) return;
    if (isHost) {
        processGuess('host', guess.targetId, guess.cardName, guess.guessedCount);
    } else if (conn?.open) {
        conn.send({ type: 'GUESS_MOVE', ...guess });
        document.getElementById('guess-controls').hidden = true;
        document.getElementById('turn-status').innerText = 'Guess sent. Waiting for the next turn...';
    }
}

function createClickParticles(event) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const particleCount = Number(activeEffectSettings.particleCount);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < particleCount; index += 1) {
        const angle = (Math.PI * 2 * index) / particleCount;
        const particle = document.createElement('span');
        particle.className = 'click-particle';
        particle.dataset.shape = activeEffectSettings.particleShape;
        particle.style.left = `${event.clientX}px`;
        particle.style.top = `${event.clientY}px`;
        particle.style.setProperty('--particle-x', `${Math.cos(angle) * 34}px`);
        particle.style.setProperty('--particle-y', `${Math.sin(angle) * 34}px`);
        particle.addEventListener('animationend', () => particle.remove(), { once: true });
        fragment.appendChild(particle);
    }
    const settingsDialog = document.getElementById('settings-dialog');
    (settingsDialog.open ? settingsDialog : document.body).appendChild(fragment);
}

let cursorFrame = 0;
let cursorX = 0;
let cursorY = 0;
document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    cursorX = event.clientX;
    cursorY = event.clientY;
    if (cursorFrame) return;
    cursorFrame = requestAnimationFrame(() => {
        const cursorGlow = document.getElementById('cursor-glow');
        cursorGlow.style.opacity = '1';
        cursorGlow.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
        cursorFrame = 0;
    });
});

document.getElementById('settings-dialog').addEventListener('close', () => {
    restoreCursorToOpenDialog();
    showSettingsPanel('settings-main-panel');
});

document.getElementById('card-catalog-dialog').addEventListener('close', restoreCursorToOpenDialog);

window.addEventListener('resize', updateUnoHandLayout);
document.addEventListener('pointerdown', createClickParticles);
document.getElementById('game-version').textContent = `Version: ${GAME_VERSION}`;
initializeSettings();
