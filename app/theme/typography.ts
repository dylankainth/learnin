export const fonts = {
  regular: "Quicksand_500Medium",
  medium: "Quicksand_600SemiBold",
  bold: "Quicksand_700Bold",
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 31 },
  h2: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;
