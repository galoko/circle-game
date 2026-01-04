// ---- Seeded RNG (LCG) ----
// 32-bit LCG: x = (a*x + c) mod 2^32
// Returns float in [0, 1)
function makeLCG(seed: number) {
    let state = seed >>> 0
    return function random() {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0
        return state / 4294967296
    }
}

// Pick a seed (fixed for deterministic runs; or change it per run)
const rand = makeLCG(0xdeadbea) // <= change seed here if you want

// Optional helpers
export const randRange = (min: number, max: number) => min + (max - min) * rand()
