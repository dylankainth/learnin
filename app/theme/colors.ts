export const colors = {
  // Backgrounds — warm ivory, easier on eyes during long sessions
  bg: "#F9F8F5",
  bgGradientTop: "#E6E1F8",
  bgGradientBottom: "#F9F8F5",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F1EC",

  // Brand — deep indigo: confident, focused, academic
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  primaryLight: "#EEF2FF",
  primarySoft: "#EEF2FF",

  // Text — warm stone tones, not cold gray
  text: "#1C1917",
  textMuted: "#78716C",
  textOnPrimary: "#FFFFFF",

  // Accents — desaturated, considered
  pink: "#DB2777",
  pinkLight: "#FCE7F3",
  orange: "#D97706",
  orangeLight: "#FEF3C7",
  teal: "#0D9488",
  tealLight: "#CCFBF1",
  blue: "#2563EB",
  blueLight: "#DBEAFE",
  yellow: "#CA8A04",
  yellowLight: "#FEF9C3",

  border: "#E5E1D8",
  danger: "#DC2626",
  success: "#059669",
} as const;

export const accentPairs = [
  { fg: colors.pink, bg: colors.pinkLight },
  { fg: colors.orange, bg: colors.orangeLight },
  { fg: colors.teal, bg: colors.tealLight },
  { fg: colors.blue, bg: colors.blueLight },
  { fg: colors.yellow, bg: colors.yellowLight },
] as const;

export function accentFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return accentPairs[hash % accentPairs.length];
}
