// eslint-disable-next-line no-undef
module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    rules: {
        indent: ["error", 4, { SwitchCase: 1 }],
        "linebreak-style": ["error", "windows"],
        quotes: ["error", "double"],
        semi: ["error", "never"],
        "max-len": [
            "error",
            {
                code: 100,
            },
        ],
        "no-debugger": "off",
        "no-multi-spaces": [
            "error",
            { exceptions: { ImportDeclaration: false, VariableDeclarator: true } },
        ],
        "@typescript-eslint/ban-ts-ignore": "off",
    },
}
