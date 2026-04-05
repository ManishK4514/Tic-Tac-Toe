/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "pulse-red": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
        "bounce-in": "bounceIn 0.5s ease-out",
        "fade-in": "fadeIn 0.3s ease-in",
      },
      keyframes: {
        bounceIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
