import { randRange } from "./lcg"
import { applyImpulseToCenter } from "./physics"
import { Player } from "./player"
import { getPlayers } from "./game-state"
import { getCurrentTime } from "./time"
import { playOnceFromGroup } from "./audio"

function findBestEnemy(player: Player): Player | undefined {
    const players = getPlayers()

    let best: Player | undefined
    let bestScore = Infinity

    // tunables
    const DIST_WEIGHT = 10.0
    const TARGET_WEIGHT = 2.0 // ↑ increase to reduce focus fire

    // precompute max distance (cheap & stable)
    let maxDist = 0
    for (const other of players) {
        if (other.team === player.team || other.HP <= 0) continue
        const dx = other.x - player.x
        const dy = other.y - player.y
        maxDist = Math.max(maxDist, Math.hypot(dx, dy))
    }
    maxDist ||= 1

    for (const other of players) {
        if (other.team === player.team || other.HP <= 0) continue

        const dx = other.x - player.x
        const dy = other.y - player.y
        const dist = Math.hypot(dx, dy)

        const normDist = dist / maxDist
        const normTargeted = other.targetedBy

        const score = DIST_WEIGHT * normDist + TARGET_WEIGHT * normTargeted

        if (score < bestScore) {
            bestScore = score
            best = other
        }
    }

    return best
}

const MAX_SPEED = 1
const KP = 10 // attraction strength
const KD = 4 // damping (important!)

const ATTACK_DISTANCE = 0.1

function applyMovementAI(player: Player, dt: number) {
    // arrival slowing
    const speedFactor = 1

    let desiredVx: number
    let desiredVy: number

    if (player.target) {
        const dx = player.target.x - player.x
        const dy = player.target.y - player.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        const targetDistance = player.size / 2 + player.target.size / 2 + ATTACK_DISTANCE / 2

        if (dist < targetDistance) return

        const nx = dx / dist
        const ny = dy / dist

        desiredVx = nx * MAX_SPEED * speedFactor
        desiredVy = ny * MAX_SPEED * speedFactor
    } else {
        desiredVx = 0 * speedFactor
        desiredVy = 0 * speedFactor
    }

    const errVx = desiredVx - player.vx
    const errVy = desiredVy - player.vy

    applyImpulseToCenter(player, KP * errVx - KD * player.vx, KP * errVy - KD * player.vy, dt)
}

export function stepAI(dt: number) {
    const players = getPlayers()

    for (const p of players) {
        p.retargetTimer -= dt
        if (!p.target || p.target.HP <= 0 || p.retargetTimer <= 0) {
            if (p.target) {
                p.target.targetedBy--
            }
            p.target = findBestEnemy(p)
            if (p.target) {
                p.target.targetedBy++
            }
            p.retargetTimer = randRange(0.5, 1)
        }

        if (p.target) {
            const dx = p.target.x - p.x
            const dy = p.target.y - p.y
            const distanceSq = dx * dx + dy * dy

            const targetDistance = p.size / 2 + p.target.size / 2 + ATTACK_DISTANCE / 2

            if (distanceSq < targetDistance * targetDistance) {
                if (p.attackCooldown < getCurrentTime()) {
                    p.target.HP -= p.attack * randRange(0.9, 1.1)
                    p.attackCooldown = getCurrentTime() + p.attackSpeed * randRange(0.9, 1.1)

                    applyImpulseToCenter(
                        p.target,
                        (dx / Math.sqrt(distanceSq)) * 5,
                        (dy / Math.sqrt(distanceSq)) * 5,
                        1
                    )

                    applyImpulseToCenter(
                        p,
                        (-dx / Math.sqrt(distanceSq)) * 5,
                        (-dy / Math.sqrt(distanceSq)) * 5,
                        1
                    )

                    // hit animation

                    {
                        const dx = p.target.x - p.x
                        const dy = p.target.y - p.y
                        const len = Math.hypot(dx, dy) || 1

                        p.target.hitDirX = dx / len
                        p.target.hitDirY = dy / len
                        p.target.attackedTime = getCurrentTime()

                        playOnceFromGroup("HIT", { volume: randRange(0.1, 0.3) })
                    }
                }
            }
        }

        applyMovementAI(p, dt)
    }
}
