export const fonts = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  bold: "DMSans_700Bold",
} as const;

export const serifFonts = {
  regular: "SourceSerif4_400Regular",
  italic: "SourceSerif4_400Regular_Italic",
  bold: "SourceSerif4_700Bold",
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 33, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 27, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, letterSpacing: 0.3 },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0.1 },
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;
