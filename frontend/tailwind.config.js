/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noc: {
          bg:        '#080d1a',
          surface:   '#0d1425',
          card:      '#111827',
          border:    '#1a2744',
          borderHi:  '#243560',
          cyan:      '#00d4ff',
          cyanDim:   '#0099bb',
          blue:      '#1a6bff',
          blueDim:   '#1250c4',
          purple:    '#6c63ff',
          red:       '#ff3b3b',
          orange:    '#ff8c00',
          yellow:    '#ffd700',
          green:     '#00e676',
          greenDim:  '#00b359',
          textPri:   '#dce8ff',
          textSec:   '#7a99cc',
          textDim:   '#3d567a',
        },
      },
      fontFamily: {
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow:       '0 0 20px rgba(0,212,255,0.15)',
        glowBlue:   '0 0 20px rgba(26,107,255,0.2)',
        glowRed:    '0 0 20px rgba(255,59,59,0.2)',
        glowGreen:  '0 0 20px rgba(0,230,118,0.15)',
        card:       '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'blink':      'blink 1.2s step-end infinite',
        'scan':       'scan 4s linear infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        blink: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
        scan:  { '0%': { backgroundPosition: '0% 0%' }, '100%': { backgroundPosition: '0% 100%' } },
        float: { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      backgroundImage: {
        'grid-noc': "linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)",
      },
      backgroundSize: { 'grid-noc': '40px 40px' },
    },
  },
  plugins: [],
}
