/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          metal: '#e74c3c',
          kimya: '#27ae60',
          gida: '#f1c40f',
          tekstil: '#2980b9',
        }
      }
    },
  },
  plugins: [],
}