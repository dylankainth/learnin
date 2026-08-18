export const colors = {
  // Backgrounds
  bg: "#F5F2FC",
  bgGradientTop: "#C7B9F2",
  bgGradientBottom: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F0ECFA",

  // Brand
  primary: "#6C4FE0",
  primaryDark: "#5539C7",
  primarySoft: "#EAE3FB",

  // Text
  text: "#241E38",
  textMuted: "#8D86A6",
  textOnPrimary: "#FFFFFF",

  // Accents (mirrors the habit-card palette: pink / orange / teal / blue)
  pink: "#FF6FA0",
  pinkLight: "#FFE1EC",
  orange: "#FFA53D",
  orangeLight: "#FFEBD3",
  teal: "#2FC7B4",
  tealLight: "#D8F7F1",
  blue: "#6C8EF5",
  blueLight: "#E4EAFD",
  yellow: "#FFC94A",
  yellowLight: "#FFF3D6",

  border: "#ECE7F9",
  danger: "#F0546B",
  success: "#2FC7B4",
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
