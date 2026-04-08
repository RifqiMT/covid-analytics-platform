import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff", // white
          card: "#fff7ed", // warm white (subtle gold tint)
          muted: "#f1f5f9", // slate-100 (neutral border/background)
          input: "#ffffff",
        },
        accent: {
          DEFAULT: "#dc2626", // red-600 (Indonesia red)
          dim: "#b91c1c", // red-700
          strong: "#991b1b", // red-800
          alert: "#dc2626",
          danger: "#991b1b",
          gold: "#d4af37", // classic gold
          goldDim: "#b88a1e",
        },
        /** Indonesia palette tokens */
        indonesia: {
          red: "#dc2626",
          white: "#ffffff",
          gold: "#d4af37",
          goldDim: "#b88a1e",
          ink: "#111827",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
