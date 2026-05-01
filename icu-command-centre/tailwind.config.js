/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a1628",
          900: "#0f1f3a",
          800: "#152a4d",
          700: "#1e3a66",
          600: "#2a4a80"
        },
        status: {
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};
