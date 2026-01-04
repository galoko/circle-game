import { getCamera } from "./camera"
import { ctx } from "./canvas"
import { drawConfetti } from "./confetti"
import { getPlayers, getTeamWon } from "./game-state"
import { getVotingInfo } from "./messages"
import { TEAM_A } from "./teams"
import { getCurrentTime } from "./time"
import { clamp, easeOutCubic, easeOutQuad } from "./utils"

// animations

const VOTE_PUMP_DURATION = 0.25
export const DEATH_DURATION = 2
const SPAWN_DURATION = 0.35
const SPAWN_FADE_IN = 0.2
const HIT_ANIMATION = 0.25 // seconds

let voteAnimA = 0
let voteAnimB = 0

export function startVoteA_Anim() {
    voteAnimA = getCurrentTime() + VOTE_PUMP_DURATION
}

export function startVoteB_Anim() {
    voteAnimB = getCurrentTime() + VOTE_PUMP_DURATION
}

// render functions

function drawVoteBar(
    x: number,
    y: number,
    width: number,
    height: number,
    votes: number,
    votesNeeded: number,
    color: string,
    label: string,
    pumpT: number
) {
    const t = Math.max(0, Math.min(1, pumpT / VOTE_PUMP_DURATION))
    const scale = 1 + Math.sin(t * Math.PI) * 0.15

    ctx.save()
    ctx.translate(x + width / 2, y + height / 2)
    ctx.scale(scale, scale)
    ctx.translate(-width / 2, -height / 2)

    // outline
    ctx.lineWidth = 3
    ctx.strokeStyle = color
    ctx.strokeRect(0, 0, width, height)

    // fill
    const fillW = (votes / votesNeeded) * width
    ctx.fillStyle = color
    ctx.globalAlpha = 0.6
    ctx.fillRect(0, 0, fillW, height)

    ctx.globalAlpha = 1

    // text
    ctx.fillStyle = "white"
    ctx.font = 'bold 40px "VT323"'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${label} (${votes}/${votesNeeded})`, width / 2, height / 2)

    ctx.restore()
}

// win screen

let winStartTime = 0

export function setupWinScreen() {
    winStartTime = getCurrentTime()
}

function winnerLabel() {
    return getTeamWon() === TEAM_A ? "6" : "7"
}

function drawWinScreen() {
    // overlay fade timing
    const t = clamp((getCurrentTime() - winStartTime) / 1.8, 0, 1)
    const a = easeOutQuad(t)

    // screen-space overlay
    ctx.resetTransform()
    ctx.save()

    // darken + tint
    ctx.globalAlpha = 0.55 * a
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.restore()

    // centered text
    ctx.save()
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "white"

    const msg = `Game over! ${winnerLabel()} wins!`
    ctx.globalAlpha = clamp((t - 0.15) / 0.85, 0, 1)

    ctx.font = 'bold 100px "VT323"'
    ctx.fillText(msg, ctx.canvas.width / 2, ctx.canvas.height / 2)
    ctx.strokeStyle = "black"

    ctx.restore()

    // confetti on top
    drawConfetti()
}

export function renderScene() {
    // rendering
    ctx.resetTransform()
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.fillStyle = "#151515"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // draw vote labels

    const { cameraScale, cameraRotation, boundsCenterX, boundsCenterY } = getCamera()

    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2)
    ctx.scale(cameraScale, cameraScale)
    ctx.rotate(cameraRotation)
    ctx.translate(-boundsCenterX, -boundsCenterY)

    const players = getPlayers()

    for (const player of players) {
        const hitT = getCurrentTime() - player.attackedTime
        if (hitT > 0 && hitT < HIT_ANIMATION) {
            const t = hitT / HIT_ANIMATION
            const alpha = (1 - t) * 0.7

            const nx = player.hitDirX
            const ny = player.hitDirY

            // perpendicular vector
            const px = -ny
            const py = nx

            const length = player.size * (1.2 + t * 0.6)
            const width = player.size * 0.4

            const cx = player.x
            const cy = player.y

            const x0 = cx - nx * length
            const y0 = cy - ny * length
            const x1 = cx
            const y1 = cy

            const grad = ctx.createLinearGradient(x0, y0, x1, y1)
            grad.addColorStop(0, `rgba(255, 0, 0, 0)`)
            grad.addColorStop(0.5, `rgba(255, 0, 0, ${alpha})`)
            grad.addColorStop(1, `rgba(255, 0, 0, 0)`)

            ctx.fillStyle = grad
            ctx.beginPath()

            ctx.moveTo(cx + px * width, cy + py * width)
            ctx.lineTo(cx - px * width, cy - py * width)
            ctx.lineTo(cx - nx * length - px * width, cy - ny * length - py * width)
            ctx.lineTo(cx - nx * length + px * width, cy - ny * length + py * width)

            ctx.closePath()
            ctx.fill()
        }

        const spawnT = getCurrentTime() - player.spawnTime

        if (spawnT >= 0 && spawnT < SPAWN_DURATION) {
            const t = spawnT / SPAWN_DURATION

            // --- unit alpha ---
            const alpha = clamp(t / SPAWN_FADE_IN, 0, 1)

            // --- glow ---
            const glowT = clamp(spawnT / 0.25, 0, 1)
            const glowAlpha = Math.sin(glowT * Math.PI) * 0.6

            const baseRadius = player.size * 0.6
            const glowRadius = baseRadius * (1.0 + 1.5 * (1 - t))

            ctx.save()
            ctx.globalAlpha = glowAlpha
            ctx.fillStyle = "purple"

            ctx.beginPath()
            ctx.arc(player.x, player.y, glowRadius, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()

            ctx.globalAlpha = alpha
        }

        if (player.HP <= 0) {
            if (player.deathTime !== undefined && player.dust) {
                const t = clamp((getCurrentTime() - player.deathTime) / DEATH_DURATION, 0, 1)

                const fade = 1 - easeOutCubic(t)
                ctx.globalAlpha = fade

                for (const d of player.dust) {
                    // movement continues outward from edge
                    const drift = t * d.speed

                    const dx = d.offsetX + Math.cos(d.angle) * drift
                    const dy = d.offsetY + Math.sin(d.angle) * drift - t * 0.4

                    ctx.fillStyle = player.team === TEAM_A ? "red" : "blue"

                    ctx.beginPath()
                    ctx.arc(player.x + dx, player.y + dy, d.size * (1 - t), 0, Math.PI * 2)
                    ctx.fill()
                }

                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.fillStyle = "white"
                ctx.font = 'bold 0.8px "VT323"'
                ctx.translate(player.x, player.y)
                ctx.rotate(-cameraRotation)
                ctx.globalAlpha = fade * fade
                ctx.fillText(player.team === TEAM_A ? "6" : "7", 0, 0)
                ctx.rotate(cameraRotation)
                ctx.translate(-player.x, -player.y)

                ctx.globalAlpha = 1
            }
        } else {
            ctx.lineWidth = 0.02 + player.HP / 10000
            ctx.beginPath()
            ctx.arc(player.x, player.y, player.size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2)
            ctx.strokeStyle = player.team === TEAM_A ? "red" : "blue"
            ctx.stroke()

            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillStyle = "white"
            ctx.font = 'bold 0.8px "VT323"'
            ctx.translate(player.x, player.y)
            ctx.rotate(-cameraRotation)
            ctx.fillText(player.team === TEAM_A ? "6" : "7", 0, 0)
            ctx.rotate(cameraRotation)
            ctx.translate(-player.x, -player.y)
        }

        ctx.globalAlpha = 1
    }

    // ===== adjust camera =====

    const teamWon = getTeamWon()
    if (!teamWon) {
        ctx.resetTransform()

        const { spawnVoteA, spawnVoteA_Needed, spawnVoteB, spawnVoteB_Needed } = getVotingInfo()

        const BAR_WIDTH = ctx.canvas.width * 0.8
        const BAR_HEIGHT = 50
        const BAR_X = (ctx.canvas.width - BAR_WIDTH) / 2

        voteAnimA = Math.max(0, voteAnimA - getCurrentTime())
        voteAnimB = Math.max(0, voteAnimB - getCurrentTime())

        drawVoteBar(
            BAR_X,
            40,
            BAR_WIDTH,
            BAR_HEIGHT,
            spawnVoteA,
            spawnVoteA_Needed,
            "red",
            "Send 6 to Spawn 6",
            voteAnimA
        )

        drawVoteBar(
            BAR_X,
            110,
            BAR_WIDTH,
            BAR_HEIGHT,
            spawnVoteB,
            spawnVoteB_Needed,
            "blue",
            "Send 7 to Spawn 7",
            voteAnimB
        )
    } else {
        drawWinScreen()
    }
}
