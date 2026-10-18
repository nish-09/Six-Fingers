/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#FFD900",
          purple: "#6500C8",
          pink: "#F000A8",
          green: "#9BE52E",
          black: "#111111",
          cream: "#FFF9E8",
          purpleDark: "#470094",
          purpleLight: "#8424EB",
        },
      },
      boxShadow: {
        'brutal-sm': '3px 3px 0 #111111',
        'brutal': '6px 6px 0 #111111',
        'brutal-lg': '8px 8px 0 #111111',
        'brutal-xl': '12px 12px 0 #111111',
        'brutal-pressed': '1px 1px 0 #111111',
        'brutal-pink': '6px 6px 0 #F000A8',
        'brutal-green': '6px 6px 0 #9BE52E',
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
        '5': '5px',
        '6': '6px',
      },
      fontFamily: {
        display: ['var(--font-bricolage)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-space)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)' },
          '70%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
        pop: 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        wiggle: 'wiggle 1s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
