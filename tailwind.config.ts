import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="concept-a"]'],
  theme: {
    extend: {
      colors: {
        hoooplaaa: {
          navy: {
            950: '#071525', // Midnight Abyss
            900: '#0B1A2A', // Foundational Navy
            800: '#10283E', // Surface / Card Panel
            700: '#1B3654', // Border / Muted Stroke
            600: '#2A4D73', // Secondary accent
          },
          gold: {
            600: '#B8923E', // Deep gold
            500: '#D9B45E', // Primary Muted Gold
            400: '#E6C678', // Hover gold
            300: '#F4D58D', // Pale Gold
            100: '#FDF8EC', // Tinted gold highlight
          },
          canvas: {
            light: '#F7F8FA', // Light canvas
            cream: '#FFFCF5', // Warm luxury cream
            dark: '#071525',  // Master dark canvas
          },
          ink: {
            primary: '#102033', // Deep slate body
            secondary: '#4A5B70', // Muted subtitle
            tertiary: '#7C8BA0', // Placeholder
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'sans-serif'],
        bengali: ['Hind Siliguri', 'Noto Sans Bengali', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 20px -3px rgba(217, 180, 94, 0.25)',
        'navy-card': '0 10px 30px -5px rgba(7, 21, 37, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
