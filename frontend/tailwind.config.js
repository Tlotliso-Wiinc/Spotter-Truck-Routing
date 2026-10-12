/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        spotter: {
          teal: '#1c3a45',
          blue: {
            50: '#e6f2ff',
            100: '#b3d9ff',
            200: '#80bfff',
            300: '#4da6ff',
            400: '#1a8dff',
            500: '#0066cc',
            600: '#0052a3',
            700: '#003d7a',
            800: '#002952',
            900: '#00142b',
          },
          dark: {
            50: '#f5f5f5',
            100: '#e0e0e0',
            200: '#bdbdbd',
            300: '#9e9e9e',
            400: '#757575',
            500: '#616161',
            600: '#424242',
            700: '#303030',
            800: '#212121',
            900: '#1c3a45',
          },
          green: {
            400: '#81c784',
            500: '#66bb6a',
            600: '#43a047',
          },
          yellow: {
            400: '#ffd54f',
            500: '#ffca28',
            600: '#ffb300',
          },
          red: {
            500: '#ef4444',
          },
          purple: {
            600: '#9333ea',
          },
        },
      },
    },
  },
  plugins: [],
}
