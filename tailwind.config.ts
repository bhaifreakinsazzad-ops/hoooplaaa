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
        brand: {
          forest: '#021B16',    // Midnight Forest — Hero, Header, Footer, Dark Luxury Base
          teal: '#003D3A',      // Deep Teal — Layered dark panels & gradient anchor
          emerald: '#0A7F5A',   // Emerald Teal — Growth accent & active highlights
          gold: '#D4AF37',      // Champagne Gold — Primary CTA, hairline rules, precision accents
          softgold: '#E6BE73',  // Soft Gold — Hover & curved accent highlights
          platinum: '#E8E8E8',  // Platinum Silver — Readable neutral on dark surfaces
          ivory: '#F7F3E8',     // Ivory — Accessible long-form light canvas
          ink: '#163A31',       // Evergreen Ink — Primary text on pale/Ivory surfaces
          muted: '#48635A',     // Muted Evergreen — Secondary copy on Ivory
          hairline: '#DDD5C3',  // Warm Ivory Hairline — Crisp card & section dividers
        },
        // Backward-compatible semantic aliases harmonized to Brand Book v3.0
        hoooplaaa: {
          navy: {
            950: '#021B16',
            900: '#05241E',
            800: '#003D3A',
            700: '#104F48',
            600: '#0A7F5A',
          },
          gold: {
            600: '#B59028',
            500: '#D4AF37',
            400: '#E6BE73',
            300: '#F0D599',
            100: '#F7F3E8',
          },
          canvas: {
            light: '#F7F3E8',
            cream: '#FBF9F3',
            dark: '#021B16',
          },
          ink: {
            primary: '#163A31',
            secondary: '#48635A',
            tertiary: '#70877F',
          },
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-montserrat)', 'var(--font-bengali)', 'system-ui', 'sans-serif'],
        bengali: ['var(--font-bengali)', 'var(--font-montserrat)', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 10px 30px -10px rgba(212, 175, 55, 0.35)',
        'forest-card': '0 18px 42px -18px rgba(2, 27, 22, 0.35)',
        'ivory-card': '0 1px 2px rgba(22, 58, 49, 0.05), 0 10px 26px -18px rgba(22, 58, 49, 0.16)',
      },
    },
  },
  plugins: [],
};

export default config;
