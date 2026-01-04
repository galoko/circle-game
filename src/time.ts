let currentTime = 0
let timescale = 40

export function getCurrentTime() {
    return currentTime
}

export function advanceTime(dt: number) {
    currentTime += dt
}

export function getTimescale() {
    return timescale
}
