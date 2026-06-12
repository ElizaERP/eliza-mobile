/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Identidad ELIZA — cadena de frío
        frost: {
          950: '#062536',
          900: '#0B3A53', // azul profundo de cámara fría (principal)
          700: '#155E81',
          500: '#1E88B5',
        },
        ice: {
          400: '#38BDF8', // acento hielo
          100: '#DDF1FB',
          50: '#F1F9FD',
        },
        snow: '#F7F9FB', // fondo
        graphite: {
          900: '#1A222A',
          600: '#4B5A66',
          400: '#8295A3',
        },
        ok: '#1F9D6B',
        warn: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
