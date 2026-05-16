/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "-apple-system", "sans-serif"],
        display: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        /** Brand palette — premium healthcare dark blue */
        clinical: {
          50: "#eef4fb",
          100: "#d9e6f5",
          200: "#b3cce8",
          300: "#7aa8d6",
          400: "#4d85c4",
          500: "#2f6cb0",
          600: "#245894",
          700: "#1a4578",
          800: "#153a61",
          900: "#0f2847",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 40, 97, 0.06), 0 8px 24px rgba(26, 69, 120, 0.1)",
        "card-lg": "0 4px 6px rgba(15, 40, 97, 0.05), 0 16px 40px rgba(26, 69, 120, 0.14)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out forwards",
        "fade-in": "fade-in 0.25s ease-out forwards",
      },
    },
  },
  plugins: [],
};
