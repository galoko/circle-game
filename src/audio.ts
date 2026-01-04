import { randRange } from "./lcg"

const MAX_HIT_SOUNDS = 1
let activeHitSounds = 0

const SOUNDS = {
    SPAWN: [
        "545201__theplax__pop-1.wav",
        "545200__theplax__pop-2.wav",
        "545199__theplax__pop-3.wav",
        "545198__theplax__pop-4.wav",
    ],
    HIT: [
        "impactTin_medium_000.ogg",
        "impactTin_medium_001.ogg",
        "impactTin_medium_002.ogg",
        "impactTin_medium_003.ogg",
        "impactTin_medium_004.ogg",
    ],
    DEATH: [
        "545201__theplax__pop-1.wav",
        "545200__theplax__pop-2.wav",
        "545199__theplax__pop-3.wav",
        "545198__theplax__pop-4.wav",
    ],
    WIN: ["zapsplat_multimedia_game_sound_coin_collect_bonus_win_113262.mp3"],
    VOTE: ["634690__adhdreaming__lil-pip.wav"],
    BACKGROUND: ["Sketchbook 2024-12-21.ogg"],
    WINS_6: ["6_wins.wav"],
    WINS_7: ["7_wins.wav"],
}

type SoundOptions = {
    loop?: boolean
    volume?: number
    noRandom?: boolean
}

type SoundMap = Record<string, AudioBuffer[]>

/* =======================
   Internal module state
   ======================= */

let context: AudioContext | null = null
let destination: MediaStreamAudioDestinationNode | null = null
let audioElement: HTMLAudioElement | null = null
let buffers: SoundMap = {}

/* =======================
   Helpers
   ======================= */

export function waitForUserGesture(): Promise<void> {
    return new Promise(resolve => {
        const handler = () => {
            window.removeEventListener("pointerdown", handler)
            window.removeEventListener("keydown", handler)
            resolve()
        }

        window.addEventListener("pointerdown", handler, { once: true })
        window.addEventListener("keydown", handler, { once: true })
    })
}

/* =======================
   Public API
   ======================= */

/** Call ONCE at startup */
export async function initAudio() {
    await waitForUserGesture()

    context = new AudioContext()
    destination = context.createMediaStreamDestination()

    audioElement = new Audio()
    audioElement.srcObject = destination.stream
    audioElement.autoplay = true

    await context.resume()
    await preloadSounds(SOUNDS)
}

export async function setOutputDevice(deviceId: string) {
    if (!audioElement) {
        throw new Error("Audio not initialized")
    }

    if (!("setSinkId" in audioElement)) {
        throw new Error("setSinkId not supported")
    }

    // @ts-ignore
    await audioElement.setSinkId(deviceId)
}

/** Play random one-shot from group */
export function playOnceFromGroup(group: keyof typeof SOUNDS, options: SoundOptions = {}) {
    const list = buffers[group]
    if (!list?.length || !context || !destination) return

    // 🚫 limit HIT spam
    if (group === "HIT" && activeHitSounds >= MAX_HIT_SOUNDS) return

    const buffer = list[randRange(0, list.length - 1) | 0]
    const source = playBuffer(buffer, false, options)

    if (group === "HIT" && source) {
        activeHitSounds++

        source.onended = () => {
            activeHitSounds--
        }
    }
}

/** Play looping sound (music) */
export function playLoop(group: keyof typeof SOUNDS, options: SoundOptions = {}) {
    const buffer = buffers[group]?.[0]
    if (!buffer || !context || !destination) return

    playBuffer(buffer, true, options)
}

/* =======================
   Internal functions
   ======================= */

async function preloadSounds(sounds: Record<string, string[]>) {
    if (!context) throw new Error("AudioContext not initialized")

    const entries = Object.entries(sounds)

    await Promise.all(
        entries.map(async ([key, urls]) => {
            buffers[key] = await Promise.all(
                urls.map(async url => {
                    const res = await fetch(`build/sounds/${url}`)
                    const data = await res.arrayBuffer()
                    return context!.decodeAudioData(data)
                })
            )
        })
    )
}

function playBuffer(buffer: AudioBuffer, loop: boolean, options: SoundOptions) {
    if (!context || !destination) return

    const source = context.createBufferSource()
    const gain = context.createGain()

    source.buffer = buffer
    source.loop = loop

    // 🔀 RANDOM PITCH (±5%)
    source.playbackRate.value = options.noRandom ? 1 : randRange(0.85, 1.15)

    // 🔊 Slight volume randomization (optional)
    gain.gain.value = (options.volume ?? 1.0) * (options.noRandom ? 1 : randRange(0.9, 1.05))

    source.connect(gain)
    gain.connect(destination)
    source.start()

    return source
}

export async function getAudioOutputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices()

    return devices
        .filter(d => d.kind === "audiooutput")
        .map(d => ({
            deviceId: d.deviceId,
            label: d.label || "Unknown output device",
        }))
}

export async function setLineOutputDevice() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const devices = await getAudioOutputDevices()
    const device = devices.find(d => d.label === "Line 1 (Virtual Audio Cable)")
    if (device) {
        setOutputDevice(device.deviceId)
    }

    stream.getTracks().forEach(t => t.stop())
}
