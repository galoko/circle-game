
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; r.crossOrigin='anonymous'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
"use strict";
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
const canvas = document.createElement("canvas");
const WIDTH = 1080;
const HEIGHT = 1920;
const height = document.body.clientHeight;
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.style.width = WIDTH / devicePixelRatio + "px";
canvas.style.height = HEIGHT / devicePixelRatio + "px";
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);
const TEAM_A = 1;
const TEAM_B = 2;
const players = [];
let NextPlayerID = 1;
const HIT_ANIMATION = 0.25; // seconds
let currentTime = 0;
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
        players.push(this);
    }
    vx = 0;
    vy = 0;
    targetedBy = 0;
    target;
    retargetTimer = 0;
    attackCooldown = 0;
    attackSpeed = 1;
    attack = 100;
    // for animation
    attackedTime = 0;
    hitDirX = 0;
    hitDirY = 0;
    spawnTime = currentTime;
}
for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
        new Player(TEAM_A, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1));
        new Player(TEAM_B, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1) + 30);
    }
}
let lastTimestamp;
let timeElapsed = 0;
let cameraX = 0;
let cameraY = 0;
let cameraScale = 25; // 1 meter = 100 pixels
let cameraRotation = 0; // current rotation (radians)
let boundsCenterX = 0;
let boundsCenterY = 0;
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
const COLLISION_STIFFNESS = 100; // how hard circles push apart
const COLLISION_DAMPING = 40; // velocity damping on collision
const GLOBAL_DAMPING = 0.98; // air resistance
function stepPhysics(dt) {
    // --- Integrate velocity ---
    for (const p of players) {
        if (p.HP <= 0)
            continue;
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
// ai stuff
function findBestEnemy(player) {
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
function applyImpulseToCenter(player, fx, fy, dt) {
    player.vx += fx * dt;
    player.vy += fy * dt;
}
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
let won = false;
function stepAI(dt) {
    if (won)
        return;
    let teamA = 0;
    let teamB = 0;
    for (const p of players) {
        if (p.HP <= 0) {
            if (p.target) {
                p.target.targetedBy--;
                p.target = undefined;
            }
            continue;
        }
        if (p.team === TEAM_A) {
            teamA++;
        }
        else {
            teamB++;
        }
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
                if (p.attackCooldown < currentTime) {
                    p.target.HP -= p.attack * randRange(0.9, 1.1);
                    p.attackCooldown = currentTime + p.attackSpeed * randRange(0.9, 1.1);
                    applyImpulseToCenter(p.target, (dx / Math.sqrt(distanceSq)) * 5, (dy / Math.sqrt(distanceSq)) * 5, 1);
                    applyImpulseToCenter(p, (-dx / Math.sqrt(distanceSq)) * 5, (-dy / Math.sqrt(distanceSq)) * 5, 1);
                    // animation
                    {
                        const dx = p.target.x - p.x;
                        const dy = p.target.y - p.y;
                        const len = Math.hypot(dx, dy) || 1;
                        p.target.hitDirX = dx / len;
                        p.target.hitDirY = dy / len;
                        p.target.attackedTime = currentTime;
                    }
                }
            }
        }
        applyMovementAI(p, dt);
    }
    if (teamA === 0 || teamB === 0) {
        alert(`Game over! ${teamB === 0 ? "Team 6" : "Team 7"} wins! Battle duration: ${Math.ceil(currentTime)} seconds.`);
        won = true;
    }
}
const SPAWN_TEAM_A = 1;
const SPAWN_TEAM_B = 2;
const messages = [];
let lastMessageTime = 0;
let spawnVoteA = 0;
let spawnVoteA_Needed = 1;
let spawnVoteB = 0;
let spawnVoteB_Needed = 1;
function updateSpawnVoteA_Needed() {
    const aliveCountA = players.filter(p => p.HP > 0 && p.team === TEAM_A).length;
    spawnVoteA_Needed = Math.ceil(aliveCountA / 5);
}
function updateSpawnVoteB_Needed() {
    const aliveCountB = players.filter(p => p.HP > 0 && p.team === TEAM_B).length;
    spawnVoteB_Needed = Math.ceil(aliveCountB / 5);
}
updateSpawnVoteA_Needed();
updateSpawnVoteB_Needed();
window.userActivity = 0.1;
function stepMessages() {
    if (currentTime - lastMessageTime > window.userActivity) {
        lastMessageTime = currentTime;
        // spawn new players
        if (rand() < 0.5) {
            messages.push(SPAWN_TEAM_A);
        }
        else {
            messages.push(SPAWN_TEAM_B);
        }
    }
    while (messages.length > 0) {
        const msg = messages.shift();
        switch (msg) {
            case SPAWN_TEAM_A: {
                spawnVoteA++;
                voteAnimA = VOTE_PUMP_DURATION;
                if (spawnVoteA >= spawnVoteA_Needed) {
                    spawnVoteA = 0;
                    updateSpawnVoteA_Needed();
                    new Player(TEAM_A, randRange(minX, maxX), randRange(minY, maxY));
                }
                break;
            }
            case SPAWN_TEAM_B: {
                spawnVoteB++;
                voteAnimB = VOTE_PUMP_DURATION;
                if (spawnVoteB >= spawnVoteB_Needed) {
                    spawnVoteB = 0;
                    updateSpawnVoteB_Needed();
                    new Player(TEAM_B, randRange(minX, maxX), randRange(minY, maxY));
                }
                break;
            }
        }
    }
}
// vote
// --- Vote animation state ---
let voteAnimA = 0;
let voteAnimB = 0;
const VOTE_PUMP_DURATION = 0.25; // seconds
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
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${label} (${votes}/${votesNeeded})`, width / 2, height / 2);
    ctx.restore();
}
function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
const SPAWN_DURATION = 0.35;
const SPAWN_FADE_IN = 0.2;
// damage
const TIMESCALE = 1;
// camera
function rotate(x, y, cos, sin) {
    return [x * cos - y * sin, x * sin + y * cos];
}
function tick(time) {
    const DT = 1 / 60;
    // physics
    lastTimestamp ??= time;
    const delta = ((time - lastTimestamp) / 1000) * TIMESCALE;
    timeElapsed += delta;
    timeElapsed %= DT * 5;
    while (timeElapsed >= DT) {
        stepMessages();
        stepAI(DT);
        stepPhysics(DT);
        currentTime += DT;
        timeElapsed -= DT;
    }
    lastTimestamp = time - timeElapsed * 1000;
    // rendering
    ctx.resetTransform();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // draw vote labels
    const BAR_WIDTH = ctx.canvas.width * 0.8;
    const BAR_HEIGHT = 50;
    const BAR_X = (ctx.canvas.width - BAR_WIDTH) / 2;
    voteAnimA = Math.max(0, voteAnimA - delta);
    voteAnimB = Math.max(0, voteAnimB - delta);
    drawVoteBar(BAR_X, 40, BAR_WIDTH, BAR_HEIGHT, spawnVoteA, spawnVoteA_Needed, "red", "To Spawn 6", voteAnimA);
    drawVoteBar(BAR_X, 110, BAR_WIDTH, BAR_HEIGHT, spawnVoteB, spawnVoteB_Needed, "blue", "To Spawn 7", voteAnimB);
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.scale(cameraScale, cameraScale);
    ctx.rotate(cameraRotation);
    ctx.translate(-boundsCenterX, -boundsCenterY);
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const player of players) {
        if (player.HP <= 0) {
            continue;
        }
        minX = Math.min(minX, player.x - player.size / 2);
        minY = Math.min(minY, player.y - player.size / 2);
        maxX = Math.max(maxX, player.x + player.size / 2);
        maxY = Math.max(maxY, player.y + player.size / 2);
        const hitT = currentTime - player.attackedTime;
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
        const spawnT = currentTime - player.spawnTime;
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
        ctx.globalAlpha = 1;
    }
    // ===== adjust camera (CORRECT) =====
    boundsCenterX = (minX + maxX) / 2;
    boundsCenterY = (minY + maxY) / 2;
    const ROTATION_SEARCH_STEPS = 100;
    const ROTATION_STEP = Math.PI / 2 / ROTATION_SEARCH_STEPS;
    let bestAngle = 0;
    let minAspectDelta = Infinity;
    let bestBoundsWidth = Infinity;
    let bestBoundsHeight = Infinity;
    const idealAspect = canvas.width / canvas.height;
    for (let i = 0; i < ROTATION_SEARCH_STEPS; i++) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const angle = i * ROTATION_STEP;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        for (const player of players) {
            if (player.HP <= 0) {
                continue;
            }
            let [px, py] = rotate(player.x - boundsCenterX, player.y - boundsCenterY, cos, sin);
            minX = Math.min(minX, px - player.size / 2);
            minY = Math.min(minY, py - player.size / 2);
            maxX = Math.max(maxX, px + player.size / 2);
            maxY = Math.max(maxY, py + player.size / 2);
        }
        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const aspect = boundsWidth / boundsHeight;
        const delta = Math.abs(idealAspect - aspect);
        if (delta < minAspectDelta) {
            bestAngle = angle;
            minAspectDelta = delta;
            bestBoundsWidth = boundsWidth;
            bestBoundsHeight = boundsHeight;
        }
    }
    // optimal rectangle-in-rectangle rotation
    cameraRotation = bestAngle;
    cameraScale = Math.min(ctx.canvas.width / bestBoundsWidth, ctx.canvas.height / bestBoundsHeight);
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
//# sourceMappingURL=main.js.map
