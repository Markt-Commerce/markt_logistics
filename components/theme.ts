// Design tokens ported from markt_mobile's "Kinetic Minimalist" system --
// see ../UI_UX_DESIGN_GUIDE.md for the source values. Light theme only for
// this pass; dark mode is a deliberate follow-up, not done here.

export const colors = {
  primary: '#E94C2A',
  primaryMuted: '#FDF2EF',
  secondary: '#000000',
  background: '#FFFFFF',
  surface: '#F4F4F5',
  surfaceDim: '#D4D4D8',
  border: '#E4E4E7',
  borderLight: '#F4F4F5',
  textPrimary: '#000000',
  textSecondary: '#71717A',
  textMuted: '#A1A1AA',
  bgMuted: '#F4F4F5',
  error: '#ba1a1a',
  errorBg: '#ffdad6',
  success: '#178b1f',
} as const;

// Order/run/stop status tone table -- reused everywhere a status pill
// appears. Backend status strings are mapped to a tone by the caller.
export const tones = {
  positive: { bg: '#E7F6EC', text: '#0F7B3F' },
  attention: { bg: '#FEF3E2', text: '#A15C00' },
  negative: { bg: '#FDECEC', text: '#C42B2B' },
  neutral: { bg: '#F4F4F5', text: '#52525B' },
} as const;

export type Tone = keyof typeof tones;

export const spacing = {
  xs: 4,
  base: 8,
  sm: 12,
  md: 24,
  lg: 48,
  xl: 80,
  screenX: 16,
  card: 16,
  section: 24,
} as const;

// markt_mobile collapses nearly every radius token to 8px -- one
// consistent small radius rather than a scale.
export const radius = 8;

// The soft "Level 2" floating shadow, reserved for overlay/floating
// elements (bottom sheet, cards that need to lift off the page) -- the
// exact value from UI_UX_DESIGN_GUIDE.md. `boxShadow` (not the legacy
// shadow*/elevation props) is what RN 0.86's New Architecture wants.
export const shadow = {
  boxShadow: '0px 10px 30px rgba(0,0,0,0.04)',
} as const;

export const typography = {
  title: { fontSize: 20, fontWeight: '800' as const },
  subtitle: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  secondary: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.5 },
} as const;
