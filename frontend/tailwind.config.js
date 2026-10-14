/** @type {import('tailwindcss').Config} */
import defaultColors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/**
 * Theme system
 * ------------
 * The UI uses plain `slate-*`, `white` and accent classes everywhere. Instead of adding
 * `dark:` variants to every element, those palettes read CSS variables that are swapped by
 * the `theme-dark` / `theme-light` class on <html>. Opacity modifiers keep working
 * (e.g. `bg-slate-900/60`) thanks to the `rgb(var(--x) / <alpha-value>)` format.
 */

const SLATE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// 🌌 Midnight Aurora — indigo-tinted night blue (default)
const DARK = {
  'app-bg': '#070B17',
  white: '#FFFFFF',
  slate: {
    50: '#F1F5FB', 100: '#E6ECF5', 200: '#CBD5E6', 300: '#A9B6CC', 400: '#8292AD',
    500: '#5E6E8A', 600: '#435270', 700: '#313E5A', 800: '#222D45', 900: '#141C30', 950: '#0B1121',
  },
};

// 🌊 Seafoam — soft mint surfaces, deep teal ink (inverted slate scale)
const LIGHT = {
  'app-bg': '#DDEFE8',
  white: '#0B2220',
  slate: {
    50: '#0C2422', 100: '#15312F', 200: '#234644', 300: '#335A58', 400: '#4C7470',
    500: '#66918A', 600: '#8FB8AB', 700: '#B7D8CC', 800: '#D3E9E1', 900: '#EDF7F3', 950: '#F6FBF9',
  },
};

// Accent shades used as text/badges. In the light theme they map to darker tones for contrast.
const ACCENTS = ['emerald', 'teal', 'red', 'amber', 'indigo', 'blue', 'purple', 'rose', 'sky'];
const ACCENT_STEPS = [200, 300, 400];
const LIGHT_ACCENT_MAP = { 200: 800, 300: 700, 400: 600 };

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const cssVar = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const buildVars = (palette, light) => {
  const vars = {
    '--app-bg': toRgb(palette['app-bg']),
    '--white': toRgb(palette.white),
  };
  SLATE_STEPS.forEach((s) => {
    vars[`--slate-${s}`] = toRgb(palette.slate[s]);
  });
  ACCENTS.forEach((name) => {
    ACCENT_STEPS.forEach((s) => {
      const source = light ? LIGHT_ACCENT_MAP[s] : s;
      vars[`--${name}-${s}`] = toRgb(defaultColors[name][source]);
    });
  });
  return vars;
};

const accentColors = Object.fromEntries(
  ACCENTS.map((name) => [
    name,
    {
      ...defaultColors[name],
      ...Object.fromEntries(ACCENT_STEPS.map((s) => [s, cssVar(`${name}-${s}`)])),
    },
  ])
);

export default {
  darkMode: ['class', '.theme-dark'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        white: cssVar('white'),
        slate: Object.fromEntries(SLATE_STEPS.map((s) => [s, cssVar(`slate-${s}`)])),
        ...accentColors,
        'app-bg': cssVar('app-bg'),
        // Text placed on top of solid emerald/teal buttons — identical in both themes
        'on-accent': '#022C22',
        background: cssVar('app-bg'),
        card: cssVar('slate-900'),
        border: cssVar('slate-800'),
        muted: cssVar('slate-700'),
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root, .theme-dark': { ...buildVars(DARK, false), colorScheme: 'dark' },
        '.theme-light': { ...buildVars(LIGHT, true), colorScheme: 'light' },
      });
    }),
  ],
}
