import initBox2D from "box2d-wasm"

const Box2D = await initBox2D()
await document.fonts.load('16px "VT323"')

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

const world = new Box2D.b2World(new Box2D.b2Vec2(0, 0))

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

function createCircleBody(x: number, y: number, size: number) {
    const bodyDef = new Box2D.b2BodyDef()
    bodyDef.set_type(Box2D.b2_dynamicBody)

    bodyDef.set_position(new Box2D.b2Vec2(x, y))

    const body = world.CreateBody(bodyDef)

    const shape = new Box2D.b2CircleShape()
    shape.set_m_radius(size / 2)

    const fixtureDef = new Box2D.b2FixtureDef()
    fixtureDef.set_shape(shape)
    fixtureDef.set_density(1.0)
    fixtureDef.set_friction(1)
    fixtureDef.set_restitution(0)

    body.CreateFixture(fixtureDef)

    return body
}

const TEAM_A = 1
const TEAM_B = 2

const players: Player[] = []

let NextPlayerID = 1

class Player {
    id = NextPlayerID++

    HP: number = 1000
    body: Box2D.b2Body

    constructor(readonly team: number, x: number, y: number, public size = 1) {
        players.push(this)
        this.body = createCircleBody(x, y, size)
        this.body.GetUserData().set_pointer(this.id)
    }

    target?: Player
    retargetTimer = 0
}

for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
        new Player(TEAM_A, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1))
        new Player(TEAM_B, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1) + 30)
    }
}

const DT = 1 / 60

let lastTimestamp: number | undefined
let timeElapsed = 0

let cameraX = 0
let cameraY = 0
let cameraScale = 25 // 1 meter = 100 pixels

// ai stuff

function findNearestEnemy(player: Player): Player | undefined {
    let best: Player | undefined
    let bestDist = Infinity

    const pos = player.body.GetPosition()

    for (const other of players) {
        if (other.team === player.team || other.HP <= 0) continue

        const p = other.body.GetPosition()
        const dx = p.get_x() - pos.get_x()
        const dy = p.get_y() - pos.get_y()
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
const ARRIVAL_RADIUS = 0.5

let force = new Box2D.b2Vec2(0, 0)

function applyMovementAI(player: Player, dt: number) {
    if (!player.target) return

    const body = player.body

    const pos = body.GetPosition()
    const vel = body.GetLinearVelocity()
    const tpos = player.target.body.GetPosition()

    const dx = tpos.get_x() - pos.get_x()
    const dy = tpos.get_y() - pos.get_y()
    const dist = Math.hypot(dx, dy)

    if (dist < 0.001) return

    const nx = dx / dist
    const ny = dy / dist

    // arrival slowing
    const speedFactor = dist < ARRIVAL_RADIUS ? dist / ARRIVAL_RADIUS : 1

    const desiredVx = nx * MAX_SPEED * speedFactor
    const desiredVy = ny * MAX_SPEED * speedFactor

    const errVx = desiredVx - vel.get_x()
    const errVy = desiredVy - vel.get_y()

    force.set_x(KP * errVx - KD * vel.get_x())
    force.set_y(KP * errVy - KD * vel.get_y())

    body.ApplyForceToCenter(force, true)
}

function stepAI(dt: number) {
    for (const p of players) {
        if (p.HP <= 0) {
            // СДОХ СУКА
            debugger
            continue
        }

        p.retargetTimer -= DT
        if (!p.target || p.target.HP <= 0) {
            p.target = findNearestEnemy(p)
            // p.retargetTimer = randRange(0.5, 1)
        }

        applyMovementAI(p, DT)
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

        world.Step(DT, 1, 1)
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
        const pos = player.body.GetPosition()
        const x = pos.get_x()
        const y = pos.get_y()

        minX = Math.min(minX, x - player.size / 2)
        minY = Math.min(minY, y - player.size / 2)
        maxX = Math.max(maxX, x + player.size / 2)
        maxY = Math.max(maxY, y + player.size / 2)

        ctx.lineWidth = 0.1
        ctx.beginPath()
        ctx.arc(x, y, player.size / 2 - 0.1 / 2, 0, Math.PI * 2)
        ctx.strokeStyle = player.team === TEAM_A ? "red" : "blue"
        ctx.stroke()

        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillStyle = "black"
        ctx.font = 'bold 0.8px "VT323"'
        ctx.fillText(Math.round(player.HP / 100).toString(), x, y)
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
