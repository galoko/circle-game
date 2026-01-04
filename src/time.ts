import { getQueryParam } from "./utils"

let currentTime = 0
let timescale = parseInt(getQueryParam("t") ?? "1")

export function getCurrentTime() {
    return currentTime
}

export function advanceTime(dt: number) {
    currentTime += dt
}

export function getTimescale() {
    return timescale
}
