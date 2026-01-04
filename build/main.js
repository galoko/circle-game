
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; r.crossOrigin='anonymous'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
// ---- Seeded RNG (LCG) ----
// 32-bit LCG: x = (a*x + c) mod 2^32
// Returns float in [0, 1)
function makeLCG(seed) {
    let state = seed >>> 0;
    return function random() {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
// Pick a seed (fixed for deterministic runs; or change it per run)
const rand = makeLCG(0xdeadbea); // <= change seed here if you want
// Optional helpers
const randRange = (min, max) => min + (max - min) * rand();

const MAX_HIT_SOUNDS = 1;
let activeHitSounds = 0;
const SOUNDS = {
    SPAWN: [
        "545201__theplax__pop-1.wav",
        "545200__theplax__pop-2.wav",
        "545199__theplax__pop-3.wav",
        "545198__theplax__pop-4.wav",
    ],
    HIT: [
        "impactTin_medium_000.ogg",
        "impactTin_medium_001.ogg",
        "impactTin_medium_002.ogg",
        "impactTin_medium_003.ogg",
        "impactTin_medium_004.ogg",
    ],
    DEATH: [
        "545201__theplax__pop-1.wav",
        "545200__theplax__pop-2.wav",
        "545199__theplax__pop-3.wav",
        "545198__theplax__pop-4.wav",
    ],
    WIN: ["zapsplat_multimedia_game_sound_coin_collect_bonus_win_113262.mp3"],
    VOTE: ["634690__adhdreaming__lil-pip.wav"],
    BACKGROUND: ["Sketchbook 2024-12-21.ogg"],
    WINS_6: ["6_wins.wav"],
    WINS_7: ["7_wins.wav"],
};
/* =======================
   Internal module state
   ======================= */
let context = null;
let destination = null;
let audioElement = null;
let buffers = {};
/* =======================
   Helpers
   ======================= */
function waitForUserGesture() {
    return new Promise(resolve => {
        const handler = () => {
            window.removeEventListener("pointerdown", handler);
            window.removeEventListener("keydown", handler);
            resolve();
        };
        window.addEventListener("pointerdown", handler, { once: true });
        window.addEventListener("keydown", handler, { once: true });
    });
}
/* =======================
   Public API
   ======================= */
/** Call ONCE at startup */
async function initAudio() {
    await waitForUserGesture();
    context = new AudioContext();
    destination = context.createMediaStreamDestination();
    audioElement = new Audio();
    audioElement.srcObject = destination.stream;
    audioElement.autoplay = true;
    await context.resume();
    await preloadSounds(SOUNDS);
}
async function setOutputDevice(deviceId) {
    if (!audioElement) {
        throw new Error("Audio not initialized");
    }
    if (!("setSinkId" in audioElement)) {
        throw new Error("setSinkId not supported");
    }
    // @ts-ignore
    await audioElement.setSinkId(deviceId);
}
/** Play random one-shot from group */
function playOnceFromGroup(group, options = {}) {
    const list = buffers[group];
    if (!list?.length || !context || !destination)
        return;
    // 🚫 limit HIT spam
    if (group === "HIT" && activeHitSounds >= MAX_HIT_SOUNDS)
        return;
    const buffer = list[randRange(0, list.length - 1) | 0];
    const source = playBuffer(buffer, false, options);
    if (group === "HIT" && source) {
        activeHitSounds++;
        source.onended = () => {
            activeHitSounds--;
        };
    }
}
/** Play looping sound (music) */
function playLoop(group, options = {}) {
    const buffer = buffers[group]?.[0];
    if (!buffer || !context || !destination)
        return;
    playBuffer(buffer, true, options);
}
/* =======================
   Internal functions
   ======================= */
async function preloadSounds(sounds) {
    if (!context)
        throw new Error("AudioContext not initialized");
    const entries = Object.entries(sounds);
    await Promise.all(entries.map(async ([key, urls]) => {
        buffers[key] = await Promise.all(urls.map(async (url) => {
            const res = await fetch(`build/sounds/${url}`);
            const data = await res.arrayBuffer();
            return context.decodeAudioData(data);
        }));
    }));
}
function playBuffer(buffer, loop, options) {
    if (!context || !destination)
        return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    // 🔀 RANDOM PITCH (±5%)
    source.playbackRate.value = options.noRandom ? 1 : randRange(0.85, 1.15);
    // 🔊 Slight volume randomization (optional)
    gain.gain.value = (options.volume ?? 1.0) * (options.noRandom ? 1 : randRange(0.9, 1.05));
    source.connect(gain);
    gain.connect(destination);
    source.start();
    return source;
}
async function getAudioOutputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
        .filter(d => d.kind === "audiooutput")
        .map(d => ({
        deviceId: d.deviceId,
        label: d.label || "Unknown output device",
    }));
}
async function setLineOutputDevice() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await getAudioOutputDevices();
    const device = devices.find(d => d.label === "Line 1 (Virtual Audio Cable)");
    if (device) {
        setOutputDevice(device.deviceId);
    }
    stream.getTracks().forEach(t => t.stop());
}

const canvas = document.createElement("canvas");
const WIDTH = 1080;
const HEIGHT = 1920;
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.style.width = WIDTH / devicePixelRatio + "px";
canvas.style.height = HEIGHT / devicePixelRatio + "px";
canvas.style.position = "fixed";
canvas.style.left = "0";
canvas.style.bottom = "0";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");

function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

const confetti = [];
function spawnConfettiFirework() {
    const COLORS = ["#ff3b3b", "#ffcc00", "#2aff4e", "#2a7fff", "#b266ff", "#ff66cc", "#ffffff"];
    // launch rocket
    confetti.push({
        x: randRange(ctx.canvas.width * 0.2, ctx.canvas.width * 0.8),
        y: ctx.canvas.height + 20,
        vx: randRange(-60, 60),
        vy: randRange(-1200 * 2, -900 * 2),
        size: 12,
        rot: 0,
        vr: 0,
        color: COLORS[(randRange(0, 1) * COLORS.length) | 0],
        life: 0,
        ttl: randRange(0.8, 1.1),
        exploded: false,
    });
}
function stepConfetti(dt) {
    // optional: drip-confetti while the win screen is up
    if (randRange(0, 1) < dt * 0.6)
        spawnConfettiFirework();
    const GRAVITY = 1600;
    const DRAG = 0.985;
    for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.life += dt;
        // 🚀 rocket phase
        if (!p.exploded) {
            p.vy += GRAVITY * dt * 0.15;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life >= p.ttl) {
                // 💥 EXPLODE
                const COUNT = Math.round(randRange(240, 400)) | 0;
                for (let k = 0; k < COUNT; k++) {
                    const angle = (k / COUNT) * Math.PI * 2 + randRange(-0.2, 0.2);
                    const speed = randRange(300, 900);
                    confetti.push({
                        x: p.x,
                        y: p.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        size: randRange(6, 14) * 2,
                        rot: randRange(0, Math.PI * 2),
                        vr: randRange(-12, 12),
                        color: [
                            "#ff3b3b",
                            "#ffcc00",
                            "#2aff4e",
                            "#2a7fff",
                            "#b266ff",
                            "#ff66cc",
                            "#ffffff",
                        ][(randRange(0, 1) * 7) | 0],
                        life: 0,
                        ttl: randRange(1.8, 3.2),
                        exploded: true,
                    });
                }
                confetti.splice(i, 1);
                continue;
            }
        }
        else {
            // 🎉 falling confetti
            p.vy += GRAVITY * dt;
            p.vx *= DRAG;
            p.vy *= DRAG;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            if (p.life > p.ttl || p.y > ctx.canvas.height + 200) {
                confetti.splice(i, 1);
            }
        }
    }
}
function drawConfetti() {
    for (const p of confetti) {
        const fade = 1 - clamp((p.life - (p.ttl - 0.7)) / 0.7, 0, 1);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // rectangles + strips look more festive
        ctx.fillRect(-p.size * 0.5, -p.size * 0.15, p.size, p.size * 0.3);
        ctx.restore();
    }
}

let currentTime = 0;
let timescale = 40;
function getCurrentTime() {
    return currentTime;
}
function advanceTime(dt) {
    currentTime += dt;
}
function getTimescale() {
    return timescale;
}

let NextPlayerID = 1;
class Player {
    team;
    x;
    y;
    size;
    id = NextPlayerID++;
    HP = 1000;
    constructor(team, x, y, size = 1) {
        this.team = team;
        this.x = x;
        this.y = y;
        this.size = size;
        //
    }
    vx = 0;
    vy = 0;
    targetedBy = 0;
    target;
    retargetTimer = 0;
    attackCooldown = 0;
    attackSpeed = 1;
    attack = 25;
    // for animation
    attackedTime = 0;
    hitDirX = 0;
    hitDirY = 0;
    spawnTime = getCurrentTime();
    deathTime;
    dust;
}

let cameraScale = 25; // 1 meter = 100 pixels
let cameraRotation = 0; // current rotation (radians)
let boundsCenterX = 0;
let boundsCenterY = 0;
function getCamera() {
    return {
        cameraScale,
        cameraRotation,
        boundsCenterX,
        boundsCenterY,
    };
}
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
function updateEncompassingViewport() {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    const players = getPlayers();
    for (const player of players) {
        minX = Math.min(minX, player.x - player.size / 2);
        minY = Math.min(minY, player.y - player.size / 2);
        maxX = Math.max(maxX, player.x + player.size / 2);
        maxY = Math.max(maxY, player.y + player.size / 2);
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        minX = 0;
        minY = 0;
        maxX = 0;
        maxY = 0;
    }
    // center of current world AABB (computed earlier in your render loop)
    boundsCenterX = (minX + maxX) / 2;
    boundsCenterY = (minY + maxY) / 2;
    const boundsWidth = Math.max(1e-6, maxX - minX);
    const boundsHeight = Math.max(1e-6, maxY - minY);
    cameraScale = Math.min(ctx.canvas.width / boundsWidth, ctx.canvas.height / boundsHeight);
}
function getEncompassingViewport() {
    return { minX, minY, maxX, maxY };
}

const TEAM_A = 1;
const TEAM_B = 2;

const SPAWN_TEAM_A = 1;
const SPAWN_TEAM_B = 2;
const messages = [];
let lastMessageTime = 0;
let spawnVoteA = 0;
let spawnVoteA_Needed = 1;
let spawnVoteB = 0;
let spawnVoteB_Needed = 1;
function updateSpawnVoteA_Needed() {
    const players = getPlayers();
    const aliveCountA = players.filter(p => p.HP > 0 && p.team === TEAM_A).length;
    spawnVoteA_Needed = Math.max(1, Math.ceil(aliveCountA / 20));
}
function updateSpawnVoteB_Needed() {
    const players = getPlayers();
    const aliveCountB = players.filter(p => p.HP > 0 && p.team === TEAM_B).length;
    spawnVoteB_Needed = Math.max(1, Math.ceil(aliveCountB / 20));
}
function getVotingInfo() {
    return {
        spawnVoteA,
        spawnVoteA_Needed,
        spawnVoteB,
        spawnVoteB_Needed,
    };
}
function addMessage(msg) {
    messages.push(msg);
}
const userActivity = 1;
function simulateUserActivity() {
    if (getCurrentTime() - lastMessageTime > userActivity) {
        lastMessageTime = getCurrentTime();
        // spawn new players
        if (randRange(0, 1) < 0.5) {
            messages.push(SPAWN_TEAM_A);
        }
        else {
            messages.push(SPAWN_TEAM_B);
        }
    }
}
const shouldSimulate = getQueryParam("sim") !== null;
function stepMessages() {
    if (shouldSimulate) {
        simulateUserActivity();
    }
    updateSpawnVoteA_Needed();
    updateSpawnVoteB_Needed();
    const players = getPlayers();
    let { minX, minY, maxX, maxY } = getEncompassingViewport();
    let parsed = false;
    while (messages.length > 0) {
        const msg = messages.shift();
        switch (msg) {
            case SPAWN_TEAM_A: {
                spawnVoteA++;
                startVoteA_Anim();
                if (spawnVoteA >= spawnVoteA_Needed) {
                    spawnVoteA = 0;
                    players.push(new Player(TEAM_A, randRange(minX, maxX), randRange(minY, maxY)));
                    playOnceFromGroup("SPAWN");
                }
                parsed = true;
                break;
            }
            case SPAWN_TEAM_B: {
                spawnVoteB++;
                startVoteB_Anim();
                if (spawnVoteB >= spawnVoteB_Needed) {
                    spawnVoteB = 0;
                    updateSpawnVoteB_Needed();
                    players.push(new Player(TEAM_B, randRange(minX, maxX), randRange(minY, maxY)));
                    playOnceFromGroup("SPAWN");
                }
                parsed = true;
                break;
            }
        }
    }
    if (parsed) {
        // playOnceFromGroup("VOTE", { volume: 0.1 })
    }
}
const WS_URL = "ws://localhost:8585/sink";
let ws = null;
let reconnectTimer = null;
const RECONNECT_DELAY_MS = 1000;
function connect() {
    if (ws && ws.readyState === WebSocket.OPEN)
        return;
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
        console.log("WS connected");
        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };
    ws.onmessage = event => {
        console.log("WS message:", event.data);
        const data = JSON.parse(event.data);
        if (data.message) {
            let count6 = 0;
            let count7 = 0;
            for (const c of data.message) {
                if (c === "6")
                    count6++;
                else if (c === "7")
                    count7++;
            }
            const total = count6 + count7;
            if (total === 0) {
                return;
            }
            const r = randRange(0, 1) * total;
            if (r < count6) {
                messages.push(SPAWN_TEAM_A);
            }
            else {
                messages.push(SPAWN_TEAM_B);
            }
        }
    };
    ws.onerror = err => {
        console.error("WS error", err);
        ws?.close();
    };
    ws.onclose = () => {
        console.log("WS closed, reconnecting...");
        scheduleReconnect();
    };
}
/**
 * Schedule reconnect
 */
function scheduleReconnect() {
    if (reconnectTimer !== null)
        return;
    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, RECONNECT_DELAY_MS);
}
connect();

// animations
const VOTE_PUMP_DURATION = 0.25;
const DEATH_DURATION = 2;
const SPAWN_DURATION = 0.35;
const SPAWN_FADE_IN = 0.2;
const HIT_ANIMATION = 0.25; // seconds
let voteAnimA = 0;
let voteAnimB = 0;
function startVoteA_Anim() {
    voteAnimA = getCurrentTime() + VOTE_PUMP_DURATION;
}
function startVoteB_Anim() {
    voteAnimB = getCurrentTime() + VOTE_PUMP_DURATION;
}
// render functions
function drawVoteBar(x, y, width, height, votes, votesNeeded, color, label, pumpT) {
    const t = Math.max(0, Math.min(1, pumpT / VOTE_PUMP_DURATION));
    const scale = 1 + Math.sin(t * Math.PI) * 0.15;
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);
    // outline
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.strokeRect(0, 0, width, height);
    // fill
    const fillW = (votes / votesNeeded) * width;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, fillW, height);
    ctx.globalAlpha = 1;
    // text
    ctx.fillStyle = "white";
    ctx.font = 'bold 40px "VT323"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${label} (${votes}/${votesNeeded})`, width / 2, height / 2);
    ctx.restore();
}
// win screen
let winStartTime$1 = 0;
function setupWinScreen() {
    winStartTime$1 = getCurrentTime();
}
function winnerLabel() {
    return getTeamWon() === TEAM_A ? "6" : "7";
}
function drawWinScreen() {
    // overlay fade timing
    const t = clamp((getCurrentTime() - winStartTime$1) / 1.8, 0, 1);
    const a = easeOutQuad(t);
    // screen-space overlay
    ctx.resetTransform();
    ctx.save();
    // darken + tint
    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    // centered text
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    const msg = `Game over! ${winnerLabel()} wins!`;
    ctx.globalAlpha = clamp((t - 0.15) / 0.85, 0, 1);
    ctx.font = 'bold 100px "VT323"';
    ctx.fillText(msg, ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.strokeStyle = "black";
    ctx.restore();
    // confetti on top
    drawConfetti();
}
function renderScene() {
    // rendering
    ctx.resetTransform();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // draw vote labels
    const { cameraScale, cameraRotation, boundsCenterX, boundsCenterY } = getCamera();
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.scale(cameraScale, cameraScale);
    ctx.rotate(cameraRotation);
    ctx.translate(-boundsCenterX, -boundsCenterY);
    const players = getPlayers();
    for (const player of players) {
        const hitT = getCurrentTime() - player.attackedTime;
        if (hitT > 0 && hitT < HIT_ANIMATION) {
            const t = hitT / HIT_ANIMATION;
            const alpha = (1 - t) * 0.7;
            const nx = player.hitDirX;
            const ny = player.hitDirY;
            // perpendicular vector
            const px = -ny;
            const py = nx;
            const length = player.size * (1.2 + t * 0.6);
            const width = player.size * 0.4;
            const cx = player.x;
            const cy = player.y;
            const x0 = cx - nx * length;
            const y0 = cy - ny * length;
            const x1 = cx;
            const y1 = cy;
            const grad = ctx.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, `rgba(255, 0, 0, 0)`);
            grad.addColorStop(0.5, `rgba(255, 0, 0, ${alpha})`);
            grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(cx + px * width, cy + py * width);
            ctx.lineTo(cx - px * width, cy - py * width);
            ctx.lineTo(cx - nx * length - px * width, cy - ny * length - py * width);
            ctx.lineTo(cx - nx * length + px * width, cy - ny * length + py * width);
            ctx.closePath();
            ctx.fill();
        }
        const spawnT = getCurrentTime() - player.spawnTime;
        if (spawnT >= 0 && spawnT < SPAWN_DURATION) {
            const t = spawnT / SPAWN_DURATION;
            // --- unit alpha ---
            const alpha = clamp(t / SPAWN_FADE_IN, 0, 1);
            // --- glow ---
            const glowT = clamp(spawnT / 0.25, 0, 1);
            const glowAlpha = Math.sin(glowT * Math.PI) * 0.6;
            const baseRadius = player.size * 0.6;
            const glowRadius = baseRadius * (1.0 + 1.5 * (1 - t));
            ctx.save();
            ctx.globalAlpha = glowAlpha;
            ctx.fillStyle = "purple";
            ctx.beginPath();
            ctx.arc(player.x, player.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = alpha;
        }
        if (player.HP <= 0) {
            if (player.deathTime !== undefined && player.dust) {
                const t = clamp((getCurrentTime() - player.deathTime) / DEATH_DURATION, 0, 1);
                const fade = 1 - easeOutCubic(t);
                ctx.globalAlpha = fade;
                for (const d of player.dust) {
                    // movement continues outward from edge
                    const drift = t * d.speed;
                    const dx = d.offsetX + Math.cos(d.angle) * drift;
                    const dy = d.offsetY + Math.sin(d.angle) * drift - t * 0.4;
                    ctx.fillStyle = player.team === TEAM_A ? "red" : "blue";
                    ctx.beginPath();
                    ctx.arc(player.x + dx, player.y + dy, d.size * (1 - t), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "white";
                ctx.font = 'bold 0.8px "VT323"';
                ctx.translate(player.x, player.y);
                ctx.rotate(-cameraRotation);
                ctx.globalAlpha = fade * fade;
                ctx.fillText(player.team === TEAM_A ? "6" : "7", 0, 0);
                ctx.rotate(cameraRotation);
                ctx.translate(-player.x, -player.y);
                ctx.globalAlpha = 1;
            }
        }
        else {
            ctx.lineWidth = 0.02 + player.HP / 10000;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.strokeStyle = player.team === TEAM_A ? "red" : "blue";
            ctx.stroke();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "white";
            ctx.font = 'bold 0.8px "VT323"';
            ctx.translate(player.x, player.y);
            ctx.rotate(-cameraRotation);
            ctx.fillText(player.team === TEAM_A ? "6" : "7", 0, 0);
            ctx.rotate(cameraRotation);
            ctx.translate(-player.x, -player.y);
        }
        ctx.globalAlpha = 1;
    }
    // ===== adjust camera =====
    const teamWon = getTeamWon();
    if (!teamWon) {
        ctx.resetTransform();
        const { spawnVoteA, spawnVoteA_Needed, spawnVoteB, spawnVoteB_Needed } = getVotingInfo();
        const BAR_WIDTH = ctx.canvas.width * 0.8;
        const BAR_HEIGHT = 50;
        const BAR_X = (ctx.canvas.width - BAR_WIDTH) / 2;
        voteAnimA = Math.max(0, voteAnimA - getCurrentTime());
        voteAnimB = Math.max(0, voteAnimB - getCurrentTime());
        drawVoteBar(BAR_X, 40, BAR_WIDTH, BAR_HEIGHT, spawnVoteA, spawnVoteA_Needed, "red", "Send 6 to Spawn 6", voteAnimA);
        drawVoteBar(BAR_X, 110, BAR_WIDTH, BAR_HEIGHT, spawnVoteB, spawnVoteB_Needed, "blue", "Send 7 to Spawn 7", voteAnimB);
    }
    else {
        drawWinScreen();
    }
}

const players = [];
let teamWon = 0;
let winStartTime = 0;
function getPlayers() {
    return players;
}
function addPlayer(player) {
    players.push(player);
}
function getTeamWon() {
    return teamWon;
}
function generatePlayerGrid() {
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            addPlayer(new Player(TEAM_A, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1)));
            addPlayer(new Player(TEAM_B, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1) + 30));
        }
    }
}
function stepGameLogic() {
    const players = getPlayers();
    let teamAplayers = 0;
    let teamBplayers = 0;
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.HP <= 0) {
            if (p.target) {
                p.target.targetedBy--;
                p.target = undefined;
            }
            // died
            if (p.deathTime === undefined) {
                p.deathTime = getCurrentTime();
                playOnceFromGroup("DEATH");
                // spawn dust
                const COUNT = 32;
                p.dust = [];
                for (let i = 0; i < COUNT; i++) {
                    const angle = (i / COUNT) * Math.PI * 2 + randRange(-0.15, 0.15);
                    p.dust.push({
                        angle,
                        speed: randRange(0.6, 1.4),
                        size: randRange(0.06, 0.14),
                        // initial position ON THE EDGE
                        offsetX: (Math.cos(angle) * p.size) / 2,
                        offsetY: (Math.sin(angle) * p.size) / 2,
                    });
                }
            }
            else if (p.deathTime + DEATH_DURATION < getCurrentTime()) {
                players.splice(i, 1);
                i--;
                continue;
            }
        }
        else {
            if (p.team === TEAM_A) {
                teamAplayers++;
            }
            else {
                teamBplayers++;
            }
        }
    }
    if (teamWon == 0 && (teamAplayers == 0 || teamBplayers == 0)) {
        if (teamAplayers === 0) {
            teamWon = TEAM_B;
            playOnceFromGroup("WINS_7", { noRandom: true });
        }
        else if (teamBplayers == 0) {
            teamWon = TEAM_A;
            playOnceFromGroup("WINS_6", { noRandom: true });
        }
        winStartTime = getCurrentTime();
        playOnceFromGroup("WIN", { noRandom: true });
        setupWinScreen();
        spawnConfettiFirework(); // initial burst
    }
    if (teamWon !== 0 && winStartTime + 30 < getCurrentTime()) {
        teamWon = 0;
        players.length = 0;
        generatePlayerGrid();
    }
}

const COLLISION_STIFFNESS = 100; // how hard circles push apart
const COLLISION_DAMPING = 40; // velocity damping on collision
const GLOBAL_DAMPING = 0.98; // air resistance
function applyImpulseToCenter(player, fx, fy, dt) {
    player.vx += fx * dt;
    player.vy += fy * dt;
}
const ARENA_RADIUS = 12; // N (your max distance)
const ARENA_SOFTNESS = 3; // how early the pull starts
const ARENA_FORCE = 15;
function applyArenaConstraint(p, dt) {
    const { boundsCenterX, boundsCenterY } = getCamera();
    const dx = p.x - boundsCenterX;
    const dy = p.y - boundsCenterY;
    const dist = Math.hypot(dx, dy);
    const softRadius = ARENA_RADIUS - ARENA_SOFTNESS;
    if (dist <= softRadius)
        return;
    // smooth 0..1 when entering forbidden zone
    const t = (dist - softRadius) / ARENA_SOFTNESS;
    const strength = t * t; // quadratic = very smooth
    const nx = dx / dist;
    const ny = dy / dist;
    p.vx -= nx * ARENA_FORCE * strength * dt;
    p.vy -= ny * ARENA_FORCE * strength * dt;
}
function stepPhysics(dt) {
    const players = getPlayers();
    // --- Integrate velocity ---
    for (const p of players) {
        applyArenaConstraint(p, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // global damping
        p.vx *= GLOBAL_DAMPING;
        p.vy *= GLOBAL_DAMPING;
    }
    // --- Circle-circle collisions ---
    for (let i = 0; i < players.length; i++) {
        const a = players[i];
        for (let j = i + 1; j < players.length; j++) {
            const b = players[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist2 = dx * dx + dy * dy;
            const ra = a.size * 0.5;
            const rb = b.size * 0.5;
            const minDist = ra + rb;
            if (dist2 === 0 || dist2 >= minDist * minDist)
                continue;
            const dist = Math.sqrt(dist2);
            const nx = dx / dist;
            const ny = dy / dist;
            const penetration = minDist - dist;
            // --- Relative velocity ---
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const relVel = rvx * nx + rvy * ny;
            // --- Spring impulse ---
            const force = COLLISION_STIFFNESS * penetration - COLLISION_DAMPING * relVel;
            const impulseX = force * nx * dt;
            const impulseY = force * ny * dt;
            a.vx -= impulseX;
            a.vy -= impulseY;
            b.vx += impulseX;
            b.vy += impulseY;
        }
    }
}

function findBestEnemy(player) {
    const players = getPlayers();
    let best;
    let bestScore = Infinity;
    // tunables
    const DIST_WEIGHT = 10.0;
    const TARGET_WEIGHT = 2.0; // ↑ increase to reduce focus fire
    // precompute max distance (cheap & stable)
    let maxDist = 0;
    for (const other of players) {
        if (other.team === player.team || other.HP <= 0)
            continue;
        const dx = other.x - player.x;
        const dy = other.y - player.y;
        maxDist = Math.max(maxDist, Math.hypot(dx, dy));
    }
    maxDist ||= 1;
    for (const other of players) {
        if (other.team === player.team || other.HP <= 0)
            continue;
        const dx = other.x - player.x;
        const dy = other.y - player.y;
        const dist = Math.hypot(dx, dy);
        const normDist = dist / maxDist;
        const normTargeted = other.targetedBy;
        const score = DIST_WEIGHT * normDist + TARGET_WEIGHT * normTargeted;
        if (score < bestScore) {
            bestScore = score;
            best = other;
        }
    }
    return best;
}
const MAX_SPEED = 1;
const KP = 10; // attraction strength
const KD = 4; // damping (important!)
const ATTACK_DISTANCE = 0.1;
function applyMovementAI(player, dt) {
    // arrival slowing
    const speedFactor = 1;
    let desiredVx;
    let desiredVy;
    if (player.target) {
        const dx = player.target.x - player.x;
        const dy = player.target.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetDistance = player.size / 2 + player.target.size / 2 + ATTACK_DISTANCE / 2;
        if (dist < targetDistance)
            return;
        const nx = dx / dist;
        const ny = dy / dist;
        desiredVx = nx * MAX_SPEED * speedFactor;
        desiredVy = ny * MAX_SPEED * speedFactor;
    }
    else {
        desiredVx = 0 * speedFactor;
        desiredVy = 0 * speedFactor;
    }
    const errVx = desiredVx - player.vx;
    const errVy = desiredVy - player.vy;
    applyImpulseToCenter(player, KP * errVx - KD * player.vx, KP * errVy - KD * player.vy, dt);
}
function stepAI(dt) {
    const players = getPlayers();
    for (const p of players) {
        p.retargetTimer -= dt;
        if (!p.target || p.target.HP <= 0 || p.retargetTimer <= 0) {
            if (p.target) {
                p.target.targetedBy--;
            }
            p.target = findBestEnemy(p);
            if (p.target) {
                p.target.targetedBy++;
            }
            p.retargetTimer = randRange(0.5, 1);
        }
        if (p.target) {
            const dx = p.target.x - p.x;
            const dy = p.target.y - p.y;
            const distanceSq = dx * dx + dy * dy;
            const targetDistance = p.size / 2 + p.target.size / 2 + ATTACK_DISTANCE / 2;
            if (distanceSq < targetDistance * targetDistance) {
                if (p.attackCooldown < getCurrentTime()) {
                    p.target.HP -= p.attack * randRange(0.9, 1.1);
                    p.attackCooldown = getCurrentTime() + p.attackSpeed * randRange(0.9, 1.1);
                    applyImpulseToCenter(p.target, (dx / Math.sqrt(distanceSq)) * 5, (dy / Math.sqrt(distanceSq)) * 5, 1);
                    applyImpulseToCenter(p, (-dx / Math.sqrt(distanceSq)) * 5, (-dy / Math.sqrt(distanceSq)) * 5, 1);
                    // hit animation
                    {
                        const dx = p.target.x - p.x;
                        const dy = p.target.y - p.y;
                        const len = Math.hypot(dx, dy) || 1;
                        p.target.hitDirX = dx / len;
                        p.target.hitDirY = dy / len;
                        p.target.attackedTime = getCurrentTime();
                        playOnceFromGroup("HIT", { volume: randRange(0.1, 0.3) });
                    }
                }
            }
        }
        applyMovementAI(p, dt);
    }
}

let lastTimestamp;
let timeElapsed = 0;
function tick(time) {
    const DT = 1 / 60;
    // physics
    lastTimestamp ??= time;
    const delta = ((time - lastTimestamp) / 1000) * getTimescale();
    timeElapsed += delta;
    timeElapsed %= 2;
    while (timeElapsed >= DT) {
        if (!getTeamWon()) {
            stepMessages();
        }
        stepGameLogic();
        stepAI(DT);
        stepPhysics(DT);
        stepConfetti(DT);
        advanceTime(DT);
        timeElapsed -= DT;
    }
    lastTimestamp = time - timeElapsed * 1000;
    renderScene();
    updateEncompassingViewport();
    requestAnimationFrame(tick);
}
function startGameLoop() {
    requestAnimationFrame(tick);
}

await initAudio();
const playAudio = getQueryParam("audio") !== null;
if (!playAudio) {
    await setLineOutputDevice();
}
playLoop("BACKGROUND", { volume: 0.3 });
generatePlayerGrid();
updateSpawnVoteA_Needed();
updateSpawnVoteB_Needed();
startGameLoop();
//# sourceMappingURL=main.js.map
