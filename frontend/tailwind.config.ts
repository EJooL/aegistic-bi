import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        subtle: '#F7F8FA',
        ink: {
          DEFAULT: '#09090B',
          secondary: '#4B5563',
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
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          'Inter',
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
    },
  },
  plugins: [],
};

export default config;
