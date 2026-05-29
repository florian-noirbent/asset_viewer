import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#11241c",
        line: "#dfe6dc",
        moss: "#2f6b4f",
        canopy: {
          ink: "#11241c",
          leaf: "#2f6b4f",
          fern: "#6f8c73",
          mint: "#e8f3e8",
          mist: "#f5f7f1",
          cream: "#fbfaf4",
          copper: "#b68157",
          line: "#dfe6dc",
        },
      },
      boxShadow: {
        panel: "0 1px 2px rgba(17, 36, 28, 0.08), 0 10px 28px rgba(17, 36, 28, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
