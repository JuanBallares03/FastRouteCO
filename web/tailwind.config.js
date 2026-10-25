/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        surface: '#faf8ff',
        'surface-dim': '#d2d9f4',
        'surface-bright': '#faf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'surface-container-highest': '#dae2fd',
        'on-surface': '#131b2e',
        'on-surface-variant': '#444653',
        'inverse-surface': '#283044',
        'inverse-on-surface': '#eef0ff',
        outline: '#757684',
        'outline-variant': '#c4c5d5',
        'surface-tint': '#3755c3',

        // Primary
        primary: '#00288e',
        'on-primary': '#ffffff',
        'primary-container': '#1e40af',
        'on-primary-container': '#a8b8ff',
        'inverse-primary': '#b8c4ff',
        'primary-fixed': '#dde1ff',
        'primary-fixed-dim': '#b8c4ff',
        'on-primary-fixed': '#001453',
        'on-primary-fixed-variant': '#173bab',

        // Secondary
        secondary: '#006398',
        'on-secondary': '#ffffff',
        'secondary-container': '#5bb8fe',
        'on-secondary-container': '#00476e',
        'secondary-fixed': '#cce5ff',
        'secondary-fixed-dim': '#93ccff',
        'on-secondary-fixed': '#001d31',
        'on-secondary-fixed-variant': '#004b73',

        // Tertiary
        tertiary: '#003e17',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#005823',
        'on-tertiary-container': '#56d474',
        'tertiary-fixed': '#7ffc97',
        'tertiary-fixed-dim': '#62df7d',
        'on-tertiary-fixed': '#002109',
        'on-tertiary-fixed-variant': '#005320',

        // Error
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // Background
        background: '#faf8ff',
        'on-background': '#131b2e',
        'surface-variant': '#dae2fd',

        // Shadcn/ui compatible aliases
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.25rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-lg': ['36px', { lineHeight: '44px', fontWeight: '700', letterSpacing: '-0.02em' }],
        'display-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '700', letterSpacing: '-0.02em' }],
        'headline-lg': ['28px', { lineHeight: '36px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'headline-md': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '14px', fontWeight: '500' }],
        'code-tracking': ['13px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      spacing: {
        gutter: '1rem',
        'gutter-md': '1.5rem',
        'gutter-lg': '2rem',
        margin: '1rem',
        'margin-md': '1.5rem',
        'margin-lg': '2rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
      },
      boxShadow: {
        'level-1': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        'level-2': '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        'level-3': '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}