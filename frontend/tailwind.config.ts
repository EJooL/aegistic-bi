import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        subtle: '#F7F8FA',
        gridbg: '#F9FAFB',
        ink: {
          DEFAULT: '#09090B',
          secondary: '#4B5563',
        },
        obsidian: {
          DEFAULT: '#09090B',
          surface: '#141417',
          border: '#27272A',
        },
        cta: {
          DEFAULT: '#FF0F5B',
          hover: '#DC0A4D',
          active: '#BE0842',
        },
        brand: {
          DEFAULT: '#67689E',
          hover: '#545588',
        },
        skyviz: '#5BC2F4',
        crimson: '#FF0F5B',
        line: {
          strong: '#BDC4D0',
          subtle: '#E5E7EB',
        },
      },
      fontFamily: {
        display: [
          'Space Grotesk',
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      transitionTimingFunction: {
        swiss: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
