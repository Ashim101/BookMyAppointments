/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf8',
          100: '#d3f5ee',
          200: '#a9ebdd',
          300: '#73dac6',
          400: '#3fc2ab',
          500: '#22a692',
          600: '#188677',
          700: '#176b60',
          800: '#16554e',
          900: '#15473f',
        },
        ink: { 900: '#14212b', 700: '#33444f', 500: '#5c6b76', 300: '#a5b0b8' },
      },
      boxShadow: { card: '0 1px 2px rgba(20,33,43,.06), 0 4px 16px rgba(20,33,43,.06)' },
    },
  },
  plugins: [],
}
