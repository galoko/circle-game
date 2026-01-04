import { stepAI } from "./ai"
import { updateEncompassingViewport } from "./camera"
import { stepConfetti } from "./confetti"
import { getTeamWon, stepGameLogic } from "./game-state"
import { stepMessages } from "./messages"
import { stepPhysics } from "./physics"
import { renderScene } from "./renderer"
import { advanceTime, getTimescale } from "./time"

let lastTimestamp: number | undefined
let timeElapsed = 0
function tick(time: number) {
    const DT = 1 / 60

    // physics

    lastTimestamp ??= time

    const delta = ((time - lastTimestamp) / 1000) * getTimescale()
    timeElapsed += delta

    timeElapsed %= 2

    while (timeElapsed >= DT) {
        if (!getTeamWon()) {
            stepMessages()
        }
        stepGameLogic()
        stepAI(DT)
        stepPhysics(DT)
        stepConfetti(DT)

        advanceTime(DT)
        timeElapsed -= DT
    }

    lastTimestamp = time - timeElapsed * 1000

    renderScene()

    updateEncompassingViewport()

    requestAnimationFrame(tick)
}

export function startGameLoop() {
    requestAnimationFrame(tick)
}
