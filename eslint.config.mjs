import coreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const config = [
    ...coreWebVitals,
    ...nextTypeScript,
    {
        rules: {
            // Allow intentionally-unused parameters/variables when prefixed with an underscore.
            // This matches the widely-used convention (e.g. `_baseUrl`) for required-but-unused args.
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
]

export default config
