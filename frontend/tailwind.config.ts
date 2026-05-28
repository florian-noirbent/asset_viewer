import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d9e1e8",
        moss: "#3f6f5b",
        canopy: {
          ink: "#17211d",
          leaf: "#1f7a4d",
          mint: "#d9f2e4",
          sky: "#dcecf7",
          line: "#d8ded9",
        },
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 33, 29, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
