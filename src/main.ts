// ---- Seeded RNG (LCG) ----
// 32-bit LCG: x = (a*x + c) mod 2^32
// Returns float in [0, 1)
function makeLCG(seed: number) {
    let state = seed >>> 0
    return function random() {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0
        return state / 4294967296
    }
}

// Pick a seed (fixed for deterministic runs; or change it per run)
const rand = makeLCG(123456789) // <= change seed here if you want

// Optional helpers
const randRange = (min: number, max: number) => min + (max - min) * rand()

const canvas = document.createElement("canvas")

const WIDTH = 1080
const HEIGHT = 1920

const height = document.body.clientHeight
canvas.width = WIDTH
canvas.height = HEIGHT
canvas.style.width = WIDTH / devicePixelRatio + "px"
canvas.style.height = HEIGHT / devicePixelRatio + "px"
const ctx = canvas.getContext("2d")!
document.body.appendChild(canvas)

const TEAM_A = 1
const TEAM_B = 2

const players: Player[] = []

let NextPlayerID = 1

class Player {
    id = NextPlayerID++

    HP: number = 1000

    constructor(readonly team: number, public x: number, public y: number, public size = 1) {
        players.push(this)
    }

    vx = 0
    vy = 0

    target?: Player
    retargetTimer = 0
}

for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
        new Player(TEAM_A, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1))
        new Player(TEAM_B, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1) + 30)
    }
}

const DT = 1 / 20

let lastTimestamp: number | undefined
let timeElapsed = 0

let cameraX = 0
let cameraY = 0
let cameraScale = 25 // 1 meter = 100 pixels

const COLLISION_STIFFNESS = 5 // how hard circles push apart
const COLLISION_DAMPING = 1 // velocity damping on collision
const GLOBAL_DAMPING = 0.98 // air resistance

function stepPhysics(dt: number) {
    // --- Integrate velocity ---
    for (const p of players) {
        if (p.HP <= 0) continue

        p.x += p.vx * dt
        p.y += p.vy * dt

        // global damping
        p.vx *= GLOBAL_DAMPING
        p.vy *= GLOBAL_DAMPING
    }

    // --- Circle-circle collisions ---
    for (let i = 0; i < players.length; i++) {
        const a = players[i]

        for (let j = i + 1; j < players.length; j++) {
            const b = players[j]

            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist2 = dx * dx + dy * dy

            const ra = a.size * 0.5
            const rb = b.size * 0.5
            const minDist = ra + rb

            if (dist2 === 0 || dist2 >= minDist * minDist) continue

            const dist = Math.sqrt(dist2)
            const nx = dx / dist
            const ny = dy / dist

            const penetration = minDist - dist

            // --- Relative velocity ---
            const rvx = b.vx - a.vx
            const rvy = b.vy - a.vy
            const relVel = rvx * nx + rvy * ny

            // --- Spring impulse ---
            const force = COLLISION_STIFFNESS * penetration - COLLISION_DAMPING * relVel

            const impulseX = force * nx * dt
            const impulseY = force * ny * dt

            a.vx -= impulseX
            a.vy -= impulseY
            b.vx += impulseX
            b.vy += impulseY
        }
    }
}

// ai stuff

function findNearestEnemy(player: Player): Player | undefined {
    let best: Player | undefined
    let bestDist = Infinity

    for (const other of players) {
        if (other.team === player.team || other.HP <= 0) continue

        const dx = other.x - player.x
        const dy = other.y - player.y
        const d2 = dx * dx + dy * dy

        if (d2 < bestDist) {
            bestDist = d2
            best = other
        }
    }

    return best
}

const MAX_SPEED = 0.1
const KP = 10 // attraction strength
const KD = 4 // damping (important!)
const ARRIVAL_RADIUS = 1.2

function applyImpulseToCenter(player: Player, fx: number, fy: number, dt: number) {
    player.vx += fx * DT
    player.vy += fy * DT
}

function applyMovementAI(player: Player, dt: number) {
    if (!player.target) return

    const dx = player.target.x - player.x
    const dy = player.target.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 1.1) return

    const nx = dx / dist
    const ny = dy / dist

    // arrival slowing
    const speedFactor = dist < ARRIVAL_RADIUS ? ARRIVAL_RADIUS - dist : 1

    const desiredVx = nx * MAX_SPEED * speedFactor
    const desiredVy = ny * MAX_SPEED * speedFactor

    const errVx = desiredVx - player.vx
    const errVy = desiredVy - player.vy

    applyImpulseToCenter(player, KP * errVx - KD * player.vx, KP * errVy - KD * player.vy, dt)
}

function stepAI(dt: number) {
    for (const p of players) {
        if (p.HP <= 0) {
            // СДОХ СУКА
            debugger
            continue
        }

        p.retargetTimer -= dt
        if (!p.target || p.target.HP <= 0) {
            p.target = findNearestEnemy(p)
            // p.retargetTimer = randRange(0.5, 1)
        }

        applyMovementAI(p, dt)
    }
}

// damage

function tick(time: number) {
    // physics

    lastTimestamp ??= time

    const delta = (time - lastTimestamp) / 1000
    timeElapsed += delta

    while (timeElapsed >= DT) {
        stepAI(DT)

        stepPhysics(DT)

        timeElapsed -= DT
    }

    // rendering
    ctx.resetTransform()
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.scale(cameraScale, cameraScale)
    ctx.translate(-cameraX, -cameraY)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const player of players) {
        minX = Math.min(minX, player.x - player.size / 2)
        minY = Math.min(minY, player.y - player.size / 2)
        maxX = Math.max(maxX, player.x + player.size / 2)
        maxY = Math.max(maxY, player.y + player.size / 2)

        ctx.lineWidth = 0.1
        ctx.beginPath()
        ctx.arc(player.x, player.y, player.size / 2 - 0.1 / 2, 0, Math.PI * 2)
        ctx.strokeStyle = player.team === TEAM_A ? "red" : "blue"
        ctx.stroke()

        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillStyle = "black"
        ctx.font = 'bold 0.8px "VT323"'
        ctx.fillText(Math.round(player.HP / 100).toString(), player.x, player.y)
    }

    // adjust camera

    const boundsWidth = maxX - minX
    const boundsHeight = maxY - minY

    const boundsCenterX = (minX + maxX) / 2
    const boundsCenterY = (minY + maxY) / 2

    const margin = 1.2 // 20% padding around the scene

    const scaleX = ctx.canvas.width / (boundsWidth * margin)
    const scaleY = ctx.canvas.height / (boundsHeight * margin)

    cameraScale = Math.min(scaleX, scaleY)
    cameraX = boundsCenterX - ctx.canvas.width / cameraScale / 2
    cameraY = boundsCenterY - ctx.canvas.height / cameraScale / 2

    requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
