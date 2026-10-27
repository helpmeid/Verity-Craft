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
let currentTurnIndex = 0;
let currentTurnPlayerId = 'host';
let gamePlayerId = 'host';
let gameMessage = '';
let winnerId = null;
let pendingJoinRequests = [];
let currentJoinRequest = null;
let brandTapCount = 0;
let brandTapTimeout = null;
const CARD_OPTIONS = [
    'Verity',
    'Freakyity',
    'Negativity',
    'Positivity',
    'Curiosity',
    'Clarity',
    'Sincerity',
    'Serenity',
    'Velocity',
    'Gravity',
    'Infinity',
    'Duality',
    'Reality',
    'Mystery',
    'Empathy',
    'Loyalty',
    'Audacity',
    'Sanity',
    'Absurdity',
    'Creativity',
    'Resilience',
    'Humility',
    'Eternity',
    'Lucidity',
    'Spookity',
    'Dreamity',
    'Glitchity',
    'Riftity',
    'Jollity',
    'Oddity',
    'Falsity',
    'Loveity',
    'Cruelty'
];
const VERITY_FAMILY = new Set(CARD_OPTIONS.slice(0, -3));
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
let activeEffectSettings = { ...EFFECT_DEFAULTS };

function openSettings() {
    const dialog = document.getElementById('settings-dialog');
    showSettingsPanel('settings-main-panel');
    dialog.appendChild(document.getElementById('cursor-glow'));
    dialog.showModal();
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

function getLobbySettings() {
    const allowedCards = Array.from(document.querySelectorAll('#card-options input:checked'), (checkbox) => checkbox.dataset.cardName);
    return {
        cardsPerPlayer: parseInt(document.getElementById('card-count').value, 10),
        allowedCards,
        allowSpectators: document.getElementById('allow-spectators').checked
    };
}

function sendLobbySettings() {
    if (!isHost) return;
    const message = { type: 'LOBBY_SETTINGS', settings: getLobbySettings() };
    hostConnections.forEach((player, connection) => {
        if (connection.open) connection.send(message);
    });
}

function updateGuestSettings(settings) {
    const cardList = settings.allowedCards.length ? settings.allowedCards.join(', ') : 'None selected yet';
    document.getElementById('guest-lobby-settings').innerText =
        `Host settings\nCards per player: ${settings.cardsPerPlayer}\nCard pool: ${cardList}\nEliminated players: ${settings.allowSpectators ? 'can spectate' : 'cannot spectate'}`;
    document.getElementById('guest-lobby-settings').hidden = false;
}

function returnToMenu() {
    const activePeer = peer;
    peer = null;
    conn = null;
    isHost = false;
    myHand = [];
    gameSettings = {};
    gameStarted = false;
    hostConnections.clear();
    gamePlayers = [];
    myDiscardPile = [];
    currentTurnIndex = 0;
    currentTurnPlayerId = 'host';
    gamePlayerId = 'host';
    gameMessage = '';
    winnerId = null;
    document.getElementById('winner-overlay').hidden = true;
    pendingJoinRequests = [];
    currentJoinRequest = null;
    opponentName = 'Waiting for player';

    if (activePeer && !activePeer.destroyed) activePeer.destroy();
    document.getElementById('join-request-panel').hidden = true;

    document.getElementById('host-code-bar').hidden = true;
    document.getElementById('host-settings').style.display = 'none';
    document.getElementById('guest-lobby-settings').hidden = true;
    document.getElementById('guest-lobby-settings').innerText = 'Waiting for host settings...';
    document.getElementById('display-lobby-id').innerText = '-';
    document.getElementById('lobby-status').innerText = 'Waiting for player to join...';
    document.getElementById('start-game-button').disabled = true;
    document.getElementById('start-game-button').innerText = 'Waiting for player';
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
    try {
        savedTheme = localStorage.getItem('verity-craft-theme') || 'light';
        savedDarkMode = localStorage.getItem('verity-craft-dark-mode');
        savedPalette = localStorage.getItem('verity-craft-color-theme') || 'verdant';
        savedPlayerName = localStorage.getItem('verity-craft-player-name') || '';
        secretThemeUnlocked = localStorage.getItem('verity-craft-secret-unlocked') === 'true';
    } catch (error) {
        // Use the default theme when browser storage is unavailable.
    }
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

// Change App Screen View
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Host setup
function createLobby() {
    isHost = true;
    gameStarted = false;
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
            connection.send({ type: 'JOIN_REQUEST', name: getPlayerName() });
        }
    });

    connection.on('error', showConnectionError);
    connection.on('close', () => {
        if (hostSide) {
            hostConnections.delete(connection);
            const removedIndex = gamePlayers.findIndex((player) => player.connection === connection);
            if (removedIndex >= 0) {
                const [removedPlayer] = gamePlayers.splice(removedIndex, 1);
                if (removedIndex < currentTurnIndex) currentTurnIndex -= 1;
                currentTurnIndex %= gamePlayers.length;
                broadcastGameState(`${removedPlayer.name} left the game.`);
            } else {
                updateHostLobbyStatus();
            }
        } else {
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
}

function handleHostMessage(connection, data) {
    if (data.type === 'JOIN_REQUEST') {
        const name = (data.name || 'Player').slice(0, 20);
        if (gameStarted) {
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
    }
}

function handleGuestMessage(data) {
    if (data.type === 'JOIN_ACCEPTED') {
        opponentName = data.hostName || 'Lobby owner';
        updateGuestSettings(data.settings);
        document.getElementById('lobby-status').innerText = data.inGame
            ? 'The owner accepted you. Joining the current round...'
            : 'The owner accepted you. Waiting for the game to start...';
    } else if (data.type === 'JOIN_REJECTED') {
        document.getElementById('lobby-status').innerText = 'The lobby owner declined your request.';
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
        gamePlayers = data.players;
        gamePlayerId = data.youId;
        currentTurnPlayerId = data.currentTurnId;
        gameMessage = data.message || '';
        winnerId = data.winnerId || null;
        renderGame();
    }
}

function acceptHostPlayer(connection, name) {
    const player = { id: connection.peer, name, hand: [], discardPile: [], connection };
    hostConnections.set(connection, player);
    const settings = gameStarted ? gameSettings : getLobbySettings();
    connection.send({
        type: 'JOIN_ACCEPTED',
        hostName: getPlayerName(),
        settings,
        inGame: gameStarted
    });

    if (gameStarted) {
        player.hand = dealHand(gameSettings);
        gamePlayers.push(player);
        winnerId = null;
        broadcastGameState(`${name} joined the round.`);
    } else {
        connection.send({ type: 'LOBBY_SETTINGS', settings });
        updateHostLobbyStatus();
    }
}

function dealHand(settings) {
    return Array.from({ length: settings.cardsPerPlayer }, () => {
        const allowedCards = settings.allowedCards;
        return allowedCards[Math.floor(Math.random() * allowedCards.length)];
    });
}

function getPublicGameState() {
    return {
        players: gamePlayers.map(({ id, name, hand, discardPile: playerDiscardPile }) => ({
            id,
            name,
            cardCount: hand.length,
            discardCount: playerDiscardPile.length
        })),
        currentTurnId: gamePlayers[currentTurnIndex]?.id || 'host',
        settings: gameSettings,
        message: gameMessage,
        winnerId
    };
}

function broadcastGameState(message = '') {
    if (message) gameMessage = message;
    currentTurnIndex = gamePlayers.length ? currentTurnIndex % gamePlayers.length : 0;
    currentTurnPlayerId = gamePlayers[currentTurnIndex]?.id || 'host';
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
                myDiscardPile: player.discardPile
            });
        }
    });
}

function processGuess(guesserId, targetId, cardName, guessedCount) {
    if (!gameStarted || winnerId || gamePlayers[currentTurnIndex]?.id !== guesserId) return;
    const guesser = gamePlayers.find((player) => player.id === guesserId);
    const target = gamePlayers.find((player) => player.id === targetId && player.id !== guesserId);
    const count = Number(guessedCount);
    if (!guesser || !target || !gameSettings.allowedCards.includes(cardName) || !Number.isInteger(count) || count < 1 || count > target.hand.length) return;

    const matchingCards = target.hand.filter((card) => card === cardName);
    if (matchingCards.length === count) {
        target.hand = target.hand.filter((card) => card !== cardName);
        guesser.discardPile.push(...matchingCards);
        gameMessage = `${guesser.name} guessed correctly. ${target.name} lost ${matchingCards.length} ${cardName} card${matchingCards.length === 1 ? '' : 's'}; they went to ${guesser.name}'s discard pile.`;
    } else {
        gameMessage = `${guesser.name} guessed ${target.name} had ${count} ${cardName} card${count === 1 ? '' : 's'}, but was wrong.`;
    }

    advanceTurnAfter(guesserId);
    broadcastGameState();
}

function advanceTurnAfter(playerId) {
    const activePlayers = gamePlayers.filter((player) => player.hand.length > 0);
    if (activePlayers.length <= 1) {
        winnerId = activePlayers[0]?.id || null;
        if (winnerId) currentTurnIndex = gamePlayers.findIndex((player) => player.id === winnerId);
        return;
    }

    winnerId = null;
    const playerIndex = gamePlayers.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= gamePlayers.length; offset += 1) {
        const nextIndex = (playerIndex + offset) % gamePlayers.length;
        if (gamePlayers[nextIndex].hand.length > 0) {
            currentTurnIndex = nextIndex;
            return;
        }
    }
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
        connection.send({ type: 'JOIN_REJECTED' });
        connection.close();
    }
    document.getElementById('join-request-panel').hidden = true;
    window.setTimeout(showNextJoinRequest, 0);
}

// Host triggers game start using settings UI
function startGame() {
    if (!isHost) return;
    const players = Array.from(hostConnections.entries()).filter(([connection]) => connection.open);
    if (players.length === 0) {
        document.getElementById('lobby-status').innerText = 'Wait for your friend to connect before starting.';
        return;
    }

    // Gather custom host settings
    const { cardsPerPlayer, allowedCards, allowSpectators } = getLobbySettings();

    if(allowedCards.length === 0) return alert("Select at least one card type!");

    gameSettings = { cardsPerPlayer, allowedCards, allowSpectators };
    gameStarted = true;
    winnerId = null;
    myDiscardPile = [];
    gamePlayers = [{ id: 'host', name: getPlayerName(), hand: dealHand(gameSettings), discardPile: [], connection: null }];
    players.forEach(([connection, player]) => {
        player.id = connection.peer;
        player.connection = connection;
        player.hand = dealHand(gameSettings);
        player.discardPile = [];
        gamePlayers.push(player);
    });
    currentTurnIndex = 0;
    broadcastGameState('The round started.');
}

function renderGameState(state) {
    gameStarted = true;
    gameSettings = state.settings;
    if (!isHost) gamePlayers = state.players;
    gamePlayerId = state.youId;
    currentTurnPlayerId = state.currentTurnId;
    gameMessage = state.message || '';
    winnerId = state.winnerId || null;
    myDiscardPile = state.myDiscardPile || [];
    myHand = state.hand;
    renderGame();
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

// Render the hand as information only; guesses are the only game action.
function renderGame() {
    showScreen('game-screen');
    updatePlayerNames();
    const localPlayer = gamePlayers.find((player) => player.id === gamePlayerId);
    const isOut = getPlayerCardCount(localPlayer) === 0;
    const canSpectate = gameSettings.allowSpectators !== false;
    document.getElementById('out-panel').hidden = !isOut;
    document.getElementById('out-message').innerText = canSpectate
        ? 'You have no cards left. You can spectate the rest of the round.'
        : 'You have no cards left. The host disabled spectating for this round.';
    document.getElementById('game-play-area').hidden = isOut && !canSpectate;
    renderWinnerOverlay();
    const selectedTargetId = document.getElementById('guess-target').value;
    const selectedCardName = document.getElementById('guess-card').value;
    const handContainer = document.getElementById('my-hand');
    handContainer.innerHTML = '';

    myHand.forEach((cardName, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.style.animationDelay = `${index * 65}ms`;
        if (cardName === 'Verity') {
            const character = document.createElement('img');
            character.className = 'card-verity';
            character.src = 'assets/download-removebg-preview.png';
            character.alt = 'Verity, a smiling yellow character';
            character.draggable = false;
            cardEl.appendChild(character);
        } else {
            cardEl.innerText = cardName;
        }
        handContainer.appendChild(cardEl);
    });

    const currentPlayer = gamePlayers.find((player) => player.id === currentTurnPlayerId);
    const isMyTurn = gamePlayerId === currentTurnPlayerId;
    document.getElementById('turn-status').innerText = winnerId
        ? 'The round is over.'
        : isOut
            ? 'You are out.'
            : isMyTurn
                ? 'Your turn: choose a player, card, and exact count.'
                : `${currentPlayer?.name || 'Another player'}'s turn.`;
    document.getElementById('arena-text').innerText = gameMessage || 'Make an exact-count guess to take matching cards.';
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
    const selectedCardPool = Array.isArray(gameSettings.allowedCards) ? gameSettings.allowedCards : [];
    selectedCardPool.forEach((cardName) => {
        const option = document.createElement('option');
        option.value = cardName;
        option.textContent = cardName;
        cardSelect.appendChild(option);
    });
    if (selectedCardPool.includes(selectedCardName)) cardSelect.value = selectedCardName;
    document.getElementById('guess-controls').hidden = !isMyTurn || isOut || winnerId !== null || targetSelect.options.length === 0;
    document.getElementById('submit-guess-button').disabled = !isMyTurn || isOut || winnerId !== null || targetSelect.options.length === 0;
    updateGuessCountOptions();
}

function renderWinnerOverlay() {
    const overlay = document.getElementById('winner-overlay');
    if (!winnerId) {
        overlay.hidden = true;
        return;
    }
    const winner = gamePlayers.find((player) => player.id === winnerId);
    if (!winner) return;
    document.getElementById('winner-title').innerText = winner.id === gamePlayerId ? 'You win!' : `${winner.name} wins!`;
    document.getElementById('winner-message').innerText = `${winner.name} is the last player standing.`;
    overlay.hidden = false;
}

function renderDiscardPile() {
    const container = document.getElementById('discard-pile');
    container.replaceChildren();
    document.getElementById('discard-count').innerText = String(myDiscardPile.length);
    const fragment = document.createDocumentFragment();
    myDiscardPile.forEach((cardName) => {
        const card = document.createElement('div');
        card.className = 'discarded-card';
        card.textContent = cardName;
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

function submitGuess() {
    if (!gameStarted || gamePlayerId !== currentTurnPlayerId) return;
    const targetId = document.getElementById('guess-target').value;
    const target = gamePlayers.find((player) => player.id === targetId);
    const guess = {
        targetId,
        cardName: document.getElementById('guess-card').value,
        guessedCount: Number(document.getElementById('guess-count').value)
    };
    if (!target || !gameSettings.allowedCards.includes(guess.cardName) || !Number.isInteger(guess.guessedCount) || guess.guessedCount < 1 || guess.guessedCount > getPlayerCardCount(target)) return;
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
    document.body.appendChild(document.getElementById('cursor-glow'));
    showSettingsPanel('settings-main-panel');
});

document.addEventListener('pointerdown', createClickParticles);
initializeSettings();
