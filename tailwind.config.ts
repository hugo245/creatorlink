import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#FAF8F4', 2: '#F3F0E9', 3: '#EAE6DC' },
        ink: { DEFAULT: '#16130F', 2: '#3A352E', 3: '#6B6459', 4: '#9A9387' },
        line: { DEFAULT: '#E6E1D6', strong: '#D3CCBD' },
        signal: { DEFAULT: '#E8381C', dark: '#C42B13', soft: '#FDEBE6' },
        moss: { DEFAULT: '#1F7A4D', soft: '#E4F2EA' },
        amber: { DEFAULT: '#B7791F', soft: '#FBF1DC' },
        sky: { DEFAULT: '#2457C5', soft: '#E6EDFB' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Inter Variable"', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(22,19,15,.04), 0 1px 2px rgba(22,19,15,.05)',
        lift: '0 1px 0 rgba(22,19,15,.04), 0 12px 32px -12px rgba(22,19,15,.18)',
        pop: '0 24px 60px -20px rgba(22,19,15,.35)',
      },
      letterSpacing: { tightest: '-0.045em' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade .25s ease both',
        marquee: 'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
