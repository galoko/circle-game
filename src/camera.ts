import { ctx } from "./canvas"
import { getPlayers } from "./game-state"

let cameraScale = 25 // 1 meter = 100 pixels
let cameraRotation = 0 // current rotation (radians)
let boundsCenterX = 0
let boundsCenterY = 0

export function getCamera() {
    return {
        cameraScale,
        cameraRotation,
        boundsCenterX,
        boundsCenterY,
    }
}

let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity

export function updateEncompassingViewport() {
    minX = Infinity
    minY = Infinity
    maxX = -Infinity
    maxY = -Infinity

    const players = getPlayers()
    for (const player of players) {
        minX = Math.min(minX, player.x - player.size / 2)
        minY = Math.min(minY, player.y - player.size / 2)
        maxX = Math.max(maxX, player.x + player.size / 2)
        maxY = Math.max(maxY, player.y + player.size / 2)
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        minX = 0
        minY = 0
        maxX = 0
        maxY = 0
    }

    // center of current world AABB (computed earlier in your render loop)
    boundsCenterX = (minX + maxX) / 2
    boundsCenterY = (minY + maxY) / 2

    const boundsWidth = Math.max(1e-6, maxX - minX)
    const boundsHeight = Math.max(1e-6, maxY - minY)
    cameraScale = Math.min(ctx.canvas.width / boundsWidth, ctx.canvas.height / boundsHeight)
}

export function getEncompassingViewport() {
    return { minX, minY, maxX, maxY }
}
