// rollup.config.js
import serve from "rollup-plugin-serve"
import livereload from "rollup-plugin-livereload"
import typescript from "@rollup/plugin-typescript"
import commonjs from "@rollup/plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"
import { string } from "rollup-plugin-string"

export default {
    input: "src/main.ts",
    output: {
        dir: "build",
        useStrict: false,
        format: "es",
        sourcemap: "true",
        entryFileNames: "main.js",
        chunkFileNames: "box2d/[name].js",
        assetFileNames: "box2d/[name][extname]"
    },
    plugins: [
        typescript({
            sourceMap: true,
            inlineSources: true,
        }),
        string({
            include: ["**/*.wgsl"],
        }),
        nodeResolve({
            jsnext: true,
            main: true,
        }),
        commonjs({
            include: ["node_modules/**"],
        }),
        serve({
            contentBase: ".",
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
            },
        }),
        livereload({ watch: "build", delay: 250 }),
    ],
}
