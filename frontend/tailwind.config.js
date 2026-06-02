/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#070912',
          900: '#0b0f1c',
          800: '#111729',
          700: '#1a2236',
          600: '#243049',
        },
        brand: {
          400: '#7c9cff',
          500: '#5d7cff',
          600: '#4361ee',
          700: '#3046c9',
        },
        accent: {
          violet: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
        },
      },
      backgroundImage: {
        'grad-brand': 'linear-gradient(135deg, #4361ee 0%, #a855f7 50%, #ec4899 100%)',
        'grad-emerald': 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
        'grad-amber': 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        'grad-mesh': 'radial-gradient(at 20% 10%, rgba(67,97,238,0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(168,85,247,0.30) 0px, transparent 50%), radial-gradient(at 40% 90%, rgba(236,72,153,0.25) 0px, transparent 50%), radial-gradient(at 90% 80%, rgba(6,182,212,0.25) 0px, transparent 50%)',
      },
      boxShadow: {
        'glow-brand': '0 0 0 1px rgba(124,156,255,0.25), 0 8px 32px -8px rgba(67,97,238,0.45)',
        'glow-violet': '0 0 40px -8px rgba(168,85,247,0.6)',
        'inset-ring': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2.5s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'gradient-x': 'gradientX 8s ease infinite',
        'blob': 'blob 18s ease-in-out infinite',
        'typing': 'typing 1.4s infinite ease-in-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: 0, transform: 'translateY(-6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%,100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.05)' },
        },
        gradientX: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,30px) scale(0.95)' },
        },
        typing: {
          '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.5 },
          '40%': { transform: 'scale(1)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
