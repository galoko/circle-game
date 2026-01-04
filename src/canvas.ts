export const canvas = document.createElement("canvas")

const WIDTH = 1080
const HEIGHT = 1920

canvas.width = WIDTH
canvas.height = HEIGHT
canvas.style.width = WIDTH / devicePixelRatio + "px"
canvas.style.height = HEIGHT / devicePixelRatio + "px"
canvas.style.position = "fixed"
canvas.style.left = "0"
canvas.style.bottom = "0"
document.body.appendChild(canvas)

export const ctx = canvas.getContext("2d")!
