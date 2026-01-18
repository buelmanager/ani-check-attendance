/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a1f2e',
          light: '#252b3d',
          dark: '#151925',
        },
        accent: {
          DEFAULT: '#c9a962',
          light: '#d4b873',
          dark: '#b89a53',
        },
        surface: {
          DEFAULT: '#252b3d',
          dark: '#1a1f2e',
        },
        background: '#1a1f2e',
        success: '#2ECC71',
        warning: '#F8A035',
        danger: '#E74C3C',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
