import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#18181b',       // Workspace dark background
          canvas: '#27272a',   // Canvas container
          panel: '#1f1f23',    // Toolbar and panel background
          border: '#3f3f46',   // Subtle borders
          accent: '#3b82f6',   // Blue selection/focus
          text: '#f4f4f5',     // Light text
          muted: '#a1a1aa',    // Dimmed secondary text
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

