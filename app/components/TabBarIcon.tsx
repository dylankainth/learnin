import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

type IconProps = { color: string; size?: number };

export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11.5 12 4l8 7.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ReviewIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21c-4.5-2.7-8-6-8-10a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 4-3.5 7.3-8 10Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LibraryIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5.5Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M4 17a2 2 0 0 1 2-2h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={2.2} />
      <Path d="M4.5 20c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
