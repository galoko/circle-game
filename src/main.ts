import { initAudio, playLoop, setLineOutputDevice } from "./audio"
import { startGameLoop } from "./game-loop"
import { generatePlayerGrid } from "./game-state"
import { updateSpawnVoteA_Needed, updateSpawnVoteB_Needed } from "./messages"
import { getQueryParam } from "./utils"

await initAudio()

const playAudio = getQueryParam("audio") !== null
if (!playAudio) {
    await setLineOutputDevice()
}
playLoop("BACKGROUND", { volume: 0.3 })

generatePlayerGrid()

updateSpawnVoteA_Needed()
updateSpawnVoteB_Needed()

startGameLoop()
