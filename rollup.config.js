// rollup.config.js
import serve from "rollup-plugin-serve"
import livereload from "rollup-plugin-livereload"
import typescript from "@rollup/plugin-typescript"
import commonjs from "@rollup/plugin-commonjs"
import nodeResolve from "rollup-plugin-node-resolve"
import { string } from "rollup-plugin-string"
import url from "@rollup/plugin-url"
import copy from 'rollup-plugin-copy'

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
        copy({
            targets: [
                {
                    src: "node_modules/box2d-wasm/dist/es/*.wasm",
                    dest: "build/box2d"
                }
            ]
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
