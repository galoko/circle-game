import { randRange } from "./lcg"
import { Player } from "./player"
import { getPlayers } from "./game-state"
import { startVoteA_Anim, startVoteB_Anim } from "./renderer"
import { TEAM_A, TEAM_B } from "./teams"
import { getCurrentTime } from "./time"
import { getEncompassingViewport } from "./camera"
import { playOnceFromGroup } from "./audio"
import { getQueryParam } from "./utils"

export const SPAWN_TEAM_A = 1
export const SPAWN_TEAM_B = 2

const messages: number[] = []

let lastMessageTime = 0
let spawnVoteA = 0
let spawnVoteA_Needed = 1
let spawnVoteB = 0
let spawnVoteB_Needed = 1

export function updateSpawnVoteA_Needed() {
    const players = getPlayers()

    const aliveCountA = players.filter(p => p.HP > 0 && p.team === TEAM_A).length
    spawnVoteA_Needed = Math.max(1, Math.ceil(aliveCountA / 20))
}

export function updateSpawnVoteB_Needed() {
    const players = getPlayers()

    const aliveCountB = players.filter(p => p.HP > 0 && p.team === TEAM_B).length
    spawnVoteB_Needed = Math.max(1, Math.ceil(aliveCountB / 20))
}

export function getVotingInfo() {
    return {
        spawnVoteA,
        spawnVoteA_Needed,
        spawnVoteB,
        spawnVoteB_Needed,
    }
}

export function addMessage(msg: number) {
    messages.push(msg)
}

const userActivity = 1

function simulateUserActivity() {
    if (getCurrentTime() - lastMessageTime > userActivity) {
        lastMessageTime = getCurrentTime()

        // spawn new players
        if (randRange(0, 1) < 0.5) {
            messages.push(SPAWN_TEAM_A)
        } else {
            messages.push(SPAWN_TEAM_B)
        }
    }
}

const shouldSimulate = getQueryParam("sim") !== null

export function stepMessages() {
    if (shouldSimulate) {
        simulateUserActivity()
    }

    updateSpawnVoteA_Needed()
    updateSpawnVoteB_Needed()

    const players = getPlayers()
    let { minX, minY, maxX, maxY } = getEncompassingViewport()

    let parsed = false
    while (messages.length > 0) {
        const msg = messages.shift()
        switch (msg) {
            case SPAWN_TEAM_A: {
                spawnVoteA++
                startVoteA_Anim()

                if (spawnVoteA >= spawnVoteA_Needed) {
                    spawnVoteA = 0

                    players.push(new Player(TEAM_A, randRange(minX, maxX), randRange(minY, maxY)))

                    playOnceFromGroup("SPAWN")
                }

                parsed = true
                break
            }
            case SPAWN_TEAM_B: {
                spawnVoteB++
                startVoteB_Anim()

                if (spawnVoteB >= spawnVoteB_Needed) {
                    spawnVoteB = 0

                    updateSpawnVoteB_Needed()

                    players.push(new Player(TEAM_B, randRange(minX, maxX), randRange(minY, maxY)))
                    playOnceFromGroup("SPAWN")
                }

                parsed = true
                break
            }
        }
    }

    if (parsed) {
        // playOnceFromGroup("VOTE", { volume: 0.1 })
    }
}

const WS_URL = "ws://localhost:8585/sink"

let ws: WebSocket | null = null
let reconnectTimer: number | null = null

const RECONNECT_DELAY_MS = 1000

function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return

    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
        console.log("WS connected")

        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer)
            reconnectTimer = null
        }
    }

    ws.onmessage = event => {
        console.log("WS message:", event.data)
        const data = JSON.parse(event.data)
        if (data.message) {
            let count6 = 0
            let count7 = 0

            for (const c of data.message) {
                if (c === "6") count6++
                else if (c === "7") count7++
            }

            const total = count6 + count7
            if (total === 0) {
                return
            }

            const r = randRange(0, 1) * total

            if (r < count6) {
                messages.push(SPAWN_TEAM_A)
            } else {
                messages.push(SPAWN_TEAM_B)
            }
        }
    }

    ws.onerror = err => {
        console.error("WS error", err)
        ws?.close()
    }

    ws.onclose = () => {
        console.log("WS closed, reconnecting...")
        scheduleReconnect()
    }
}

/**
 * Schedule reconnect
 */
function scheduleReconnect() {
    if (reconnectTimer !== null) return

    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connect()
    }, RECONNECT_DELAY_MS)
}

connect()
