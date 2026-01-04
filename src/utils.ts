export function easeOutQuad(t: number) {
    return 1 - (1 - t) * (1 - t)
}

export function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3)
}

export function clamp(v: number, min: number, max: number) {
    return v < min ? min : v > max ? max : v
}

export function getQueryParam(name: string): string | null {
    const params = new URLSearchParams(window.location.search)
    return params.get(name)
}
