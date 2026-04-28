import coreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const config = [
    {
        // Design-system v1.1 spec dump (folder name has a trailing space).
        // Not project source — exclude from lint so it doesn't add noise.
        ignores: ["Parwest /**"],
    },
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
    {
        // Design System v1.1: ban hex color literals in components/app code.
        // Token files in src/styles/** are exempt. Warning-level for now so we
        // can baseline pre-existing violations and prevent NEW hex literals.
        files: [
            "src/components/**/*.tsx",
            "src/components/**/*.ts",
            "src/app/**/*.tsx",
            "src/app/**/*.ts",
        ],
        rules: {
            "no-restricted-syntax": [
                "warn",
                {
                    selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
                    message:
                        "Hex color literals are not allowed outside src/styles/. Use Tailwind utilities (bg-primary, text-muted-foreground) or a v1.0 token (var(--brand-600)).",
                },
            ],
        },
    },
]

export default config
