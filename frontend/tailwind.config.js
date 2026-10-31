/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ublock: {
          bg: '#0B1120',
          card: '#151F32',
          border: '#24334C',
          muted: '#8194B2',
          primary: '#3B82F6',
          primaryHover: '#2563EB',
          success: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B'
        }
      }
    },
  },
  plugins: [],
}
