import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

/**
 * Tailwind v4 reads its design tokens from the `@theme` block in
 * `src/styles/parwest-theme.css`. This config exists only to declare
 * darkMode + content + plugins. Do NOT add a `theme.extend.colors` block
 * here — it would shadow / contradict the @theme tokens and the previous
 * `hsl(var(--…))` wrappings produced invalid CSS.
 */
const config: Config = {
    darkMode: "class",
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: "",
    plugins: [tailwindcssAnimate],
}

export default config
