import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3B498B',
          hover: '#2D3870',
          tint: '#EEF0FA',
        },
        viz: {
          primary: '#4DA8E5',
          tint: '#EBF6FD',
          text: '#1B6CA8',
          series1: '#3B498B',
          series2: '#4DA8E5',
          series3: '#7685C4',
          series4: '#2A7EB5',
          series5: '#9BCBF0',
        },
        guardrail: {
          DEFAULT: '#E11D48',
          bg: '#FFF1F2',
          border: '#FECDD3',
          text: '#9F1239',
        },
        surface: {
          canvas: '#F8FAFC',
          card: '#FFFFFF',
          code: '#F1F5F9',
          border: '#E2E8F0',
          'border-strong': '#CBD5E1',
        },
        ink: {
          heading: '#111827',
          body: '#1F2937',
          muted: '#526075',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(17, 24, 39, 0.04), 0 1px 3px 0 rgba(17, 24, 39, 0.03)',
        panel: '0 4px 12px -2px rgba(17, 24, 39, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
