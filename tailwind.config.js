/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        },
        colors: {
          // Bee Huggie brand palette. The 500/400 honey, 900 ink, 400 sage,
          // 500 stone and 100 cream values are sampled from the brand sheet;
          // the neighbouring stops are derived for hover and border states.
          honey: {
            50: '#FEF7E6',
            100: '#FDEFC8',
            300: '#FEDC8A',
            400: '#FDCA50',
            500: '#F8B51E',
            600: '#E09D12',
            700: '#B87D0C',
          },
          ink: {
            500: '#3D515C',
            600: '#2E404A',
            700: '#243239',
            800: '#1E2A31',
            900: '#18232A',
          },
          sage: {
            100: '#E4F0EA',
            200: '#C6E1D6',
            300: '#A9CFC1',
            400: '#87B9A6',
            500: '#6BA592',
            600: '#548C7A',
          },
          stone: {
            200: '#E5E1DC',
            300: '#CFC9C2',
            400: '#B5B0A9',
            500: '#9B968F',
            600: '#7D7873',
          },
          cream: {
            50: '#FDFAF5',
            100: '#F9EEE3',
            200: '#F2E3D2',
            300: '#E8D4BE',
          },
        },
      },
    },
    plugins: [],
  }