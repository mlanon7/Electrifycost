/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Brand: trustworthy editorial / cost-tool palette.
        // Palette A ("Daylight", May-2026 refinement audit) — same shape as
        // before, slightly cooler / more confident green. Closes the gap
        // with the emerald drift in 22 components so the brand-vs-emerald
        // mismatch disappears without a full reskin.
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: {
          blue: '#2563eb',
          amber: '#d97706',
          rose: '#b91c1c',
        },
      },
      fontFamily: {
        // Inter for body; Source Serif 4 as an editorial accent for h1/h2.
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Source Serif Pro"', 'Charter', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        prose: '68ch',
      },
      letterSpacing: {
        'tightest': '-0.035em',
        'tight-display': '-0.025em',
      },
      boxShadow: {
        // Layered shadows for the premium-card look.
        'card':       '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05)',
        'card-hover': '0 2px 4px 0 rgb(15 23 42 / 0.06), 0 8px 24px -8px rgb(15 23 42 / 0.12)',
        'elev':       '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 12px 32px -12px rgb(15 23 42 / 0.16)',
        'inner-soft': 'inset 0 1px 2px 0 rgb(15 23 42 / 0.04)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        'brand-grad-soft': 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      },
    },
  },
  plugins: [],
};
