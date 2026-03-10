/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0d1117',
          card: '#161b22',
          hover: '#21262d',
          border: '#30363d',
          text: '#e6edf3',
          muted: '#b1bac4',
          faded: '#8b949e',
        },
        energy: {
          solar: '#f59e0b',
          grid: '#6366f1',
          battery: '#8b5cf6',
          heat: '#ef4444',
          cold: '#3b82f6',
          green: '#22c55e',
          chp: '#f97316',
        },
      },
    },
  },
  plugins: [],
}
