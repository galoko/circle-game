import { Player } from "./player"
import { getPlayers } from "./game-state"
import { getCamera } from "./camera"

const COLLISION_STIFFNESS = 100 // how hard circles push apart
const COLLISION_DAMPING = 40 // velocity damping on collision
const GLOBAL_DAMPING = 0.98 // air resistance

export function applyImpulseToCenter(player: Player, fx: number, fy: number, dt: number) {
    player.vx += fx * dt
    player.vy += fy * dt
}

const ARENA_RADIUS = 12 // N (your max distance)
const ARENA_SOFTNESS = 3 // how early the pull starts
const ARENA_FORCE = 15

function applyArenaConstraint(p: Player, dt: number) {
    const { boundsCenterX, boundsCenterY } = getCamera()

    const dx = p.x - boundsCenterX
    const dy = p.y - boundsCenterY
    const dist = Math.hypot(dx, dy)

    const softRadius = ARENA_RADIUS - ARENA_SOFTNESS

    if (dist <= softRadius) return

    // smooth 0..1 when entering forbidden zone
    const t = (dist - softRadius) / ARENA_SOFTNESS
    const strength = t * t // quadratic = very smooth

    const nx = dx / dist
    const ny = dy / dist

    p.vx -= nx * ARENA_FORCE * strength * dt
    p.vy -= ny * ARENA_FORCE * strength * dt
}

export function stepPhysics(dt: number) {
    const players = getPlayers()

    // --- Integrate velocity ---
    for (const p of players) {
        applyArenaConstraint(p, dt)

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
