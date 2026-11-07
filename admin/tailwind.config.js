/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf8',
          100: '#d3f5ee',
          200: '#a9e9de',
          300: '#74d6c8',
          400: '#43bcad',
          500: '#27a093',
          600: '#1d8179',
          700: '#1c6762',
          800: '#1b5350',
          900: '#1b4543',
        },
      },
    },
  },
  plugins: [],
}
