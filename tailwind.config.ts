
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { primary: { DEFAULT: "#2ca4df" } },
      borderRadius: { xl: "14px", "2xl": "18px" }
    },
  },
  plugins: [],
};
export default config;

