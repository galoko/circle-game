import { getCurrentTime } from "./time"

let NextPlayerID = 1

export class Player {
    id = NextPlayerID++

    HP: number = 1000

    constructor(readonly team: number, public x: number, public y: number, public size = 1) {
        //
    }

    vx = 0
    vy = 0

    targetedBy = 0

    target?: Player
    retargetTimer = 0

    attackCooldown = 0

    attackSpeed = 1
    attack = 25

    // for animation
    attackedTime = 0
    hitDirX = 0
    hitDirY = 0

    spawnTime = getCurrentTime()
    deathTime?: number

    dust?: {
        angle: number
        speed: number
        size: number
        offsetX: number
        offsetY: number
    }[]
}
