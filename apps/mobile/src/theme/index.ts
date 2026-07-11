// Locked design tokens. Do not hardcode colors, spacing, radii, or font families anywhere
// outside this file - screens and components should only ever reference `theme.*`.

export const colors = {
  primary: '#0C00A9',
  accent: '#F30304',
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#14142B',
  inkMuted: '#6E6E80',
  // Answer-feedback tints (correct/incorrect) - accent doubles as the incorrect color.
  success: '#12A150',
  successBg: '#E3F6EA',
  errorBg: '#FCE7E7',
} as const;

// 8-10px standard, no larger - keep every radius in this range.
export const radii = {
  sm: 8,
  md: 9,
  lg: 10,
} as const;

// No card borders, no shadows anywhere in the app - flat surfaces only, distinguished by
// the surface/bg color pairing above.
export const elevation = {
  none: 0,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Sora for headers/scores/big numbers, Plus Jakarta Sans for body. Font family names must
// match exactly what @expo-google-fonts loads them as (see useFonts in App.tsx).
export const fonts = {
  heading: 'Sora_700Bold',
  headingSemiBold: 'Sora_600SemiBold',
  score: 'Sora_800ExtraBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.score, fontSize: 40, lineHeight: 48 },
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.headingSemiBold, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
} as const;

export const theme = {
  colors,
  radii,
  elevation,
  spacing,
  fonts,
  type,
} as const;

export type Theme = typeof theme;
export default theme;
