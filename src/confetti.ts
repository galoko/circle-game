import { ctx } from "./canvas"
import { randRange } from "./lcg"
import { clamp } from "./utils"

type Confetti = {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    rot: number
    vr: number
    color: string
    life: number
    ttl: number
    exploded: boolean
}

const confetti: Confetti[] = []

export function spawnConfettiFirework() {
    const COLORS = ["#ff3b3b", "#ffcc00", "#2aff4e", "#2a7fff", "#b266ff", "#ff66cc", "#ffffff"]

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
    })
}

export function stepConfetti(dt: number) {
    // optional: drip-confetti while the win screen is up
    if (randRange(0, 1) < dt * 0.6) spawnConfettiFirework()

    const GRAVITY = 1600
    const DRAG = 0.985

    for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i]
        p.life += dt

        // 🚀 rocket phase
        if (!p.exploded) {
            p.vy += GRAVITY * dt * 0.15
            p.x += p.vx * dt
            p.y += p.vy * dt

            if (p.life >= p.ttl) {
                // 💥 EXPLODE
                const COUNT = Math.round(randRange(240, 400)) | 0

                for (let k = 0; k < COUNT; k++) {
                    const angle = (k / COUNT) * Math.PI * 2 + randRange(-0.2, 0.2)
                    const speed = randRange(300, 900)

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
                    })
                }

                confetti.splice(i, 1)
                continue
            }
        } else {
            // 🎉 falling confetti
            p.vy += GRAVITY * dt
            p.vx *= DRAG
            p.vy *= DRAG

            p.x += p.vx * dt
            p.y += p.vy * dt
            p.rot += p.vr * dt

            if (p.life > p.ttl || p.y > ctx.canvas.height + 200) {
                confetti.splice(i, 1)
            }
        }
    }
}

export function drawConfetti() {
    for (const p of confetti) {
        const fade = 1 - clamp((p.life - (p.ttl - 0.7)) / 0.7, 0, 1)

        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color

        // rectangles + strips look more festive
        ctx.fillRect(-p.size * 0.5, -p.size * 0.15, p.size, p.size * 0.3)

        ctx.restore()
    }
}
