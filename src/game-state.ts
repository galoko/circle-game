import { playOnceFromGroup } from "./audio"
import { spawnConfettiFirework } from "./confetti"
import { randRange } from "./lcg"
import { Player } from "./player"
import { DEATH_DURATION, setupWinScreen } from "./renderer"
import { TEAM_A, TEAM_B } from "./teams"
import { getCurrentTime } from "./time"

const players: Player[] = []
let teamWon = 0
let winStartTime = 0

export function getPlayers() {
    return players
}

export function addPlayer(player: Player) {
    players.push(player)
}

export function getTeamWon() {
    return teamWon
}

export function generatePlayerGrid() {
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            addPlayer(
                new Player(TEAM_A, 10 + x + randRange(-0.1, 0.1), 10 + y + randRange(-0.1, 0.1))
            )
            addPlayer(
                new Player(
                    TEAM_B,
                    10 + x + randRange(-0.1, 0.1),
                    10 + y + randRange(-0.1, 0.1) + 30
                )
            )
        }
    }
}

export function stepGameLogic() {
    const players = getPlayers()

    let teamAplayers = 0
    let teamBplayers = 0

    for (let i = 0; i < players.length; i++) {
        const p = players[i]
        if (p.HP <= 0) {
            if (p.target) {
                p.target.targetedBy--
                p.target = undefined
            }

            // died
            if (p.deathTime === undefined) {
                p.deathTime = getCurrentTime()
                playOnceFromGroup("DEATH")

                // spawn dust

                const COUNT = 32
                p.dust = []

                for (let i = 0; i < COUNT; i++) {
                    const angle = (i / COUNT) * Math.PI * 2 + randRange(-0.15, 0.15)

                    p.dust.push({
                        angle,
                        speed: randRange(0.6, 1.4),
                        size: randRange(0.06, 0.14),

                        // initial position ON THE EDGE
                        offsetX: (Math.cos(angle) * p.size) / 2,
                        offsetY: (Math.sin(angle) * p.size) / 2,
                    })
                }
            } else if (p.deathTime + DEATH_DURATION < getCurrentTime()) {
                players.splice(i, 1)
                i--
                continue
            }
        } else {
            if (p.team === TEAM_A) {
                teamAplayers++
            } else {
                teamBplayers++
            }
        }
    }

    if (teamWon == 0 && (teamAplayers == 0 || teamBplayers == 0)) {
        if (teamAplayers === 0) {
            teamWon = TEAM_B
            playOnceFromGroup("WINS_7", { noRandom: true })
        } else if (teamBplayers == 0) {
            teamWon = TEAM_A
            playOnceFromGroup("WINS_6", { noRandom: true })
        }
        winStartTime = getCurrentTime()
        playOnceFromGroup("WIN", { noRandom: true })
        setupWinScreen()
        spawnConfettiFirework() // initial burst
    }

    if (teamWon !== 0 && winStartTime + 30 < getCurrentTime()) {
        teamWon = 0
        players.length = 0
        generatePlayerGrid()
    }
}
