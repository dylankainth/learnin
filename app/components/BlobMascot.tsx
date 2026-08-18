import React from "react";
import Svg, { Path, Circle, G } from "react-native-svg";

// Hand-drawn organic blob outlines (own artwork, not sourced from any asset
// pack) — a few silhouettes to vary the mascots across screens the way the
// reference style uses a family of soft rounded shapes.
const BLOB_PATHS = [
  "M100,18 C132,14 168,34 178,72 C188,110 172,152 136,172 C100,192 54,188 28,158 C2,128 6,80 34,50 C52,30 76,22 100,18 Z",
  "M100,14 C142,14 186,46 186,100 C186,150 146,186 100,186 C54,186 14,150 14,100 C14,50 58,14 100,14 Z",
  "M96,10 C122,26 152,16 168,44 C190,60 192,94 174,118 C186,148 158,176 126,168 C104,190 68,188 56,162 C26,160 12,128 26,100 C10,74 28,44 58,42 C68,18 90,4 96,10 Z",
  "M58,22 C90,8 142,10 166,38 C192,62 190,124 162,156 C136,190 76,190 42,162 C12,136 8,78 30,48 C40,34 46,28 58,22 Z",
];

export type BlobMood = "happy" | "wink" | "excited" | "sleepy";

interface FaceProps {
  mood: BlobMood;
}

function Face({ mood }: FaceProps) {
  const eyeY = 95;
  if (mood === "wink") {
    return (
      <G>
        <Circle cx={78} cy={eyeY} r={6} fill="#241E38" />
        <Path d="M112,94 q10,-8 20,0" stroke="#241E38" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Path d="M85,116 q15,14 30,0" stroke="#241E38" strokeWidth={5} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  if (mood === "excited") {
    return (
      <G>
        <Circle cx={78} cy={eyeY} r={7} fill="#241E38" />
        <Circle cx={122} cy={eyeY} r={7} fill="#241E38" />
        <Path d="M78,120 q22,22 44,0" stroke="#241E38" strokeWidth={6} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  if (mood === "sleepy") {
    return (
      <G>
        <Path d="M70,95 q8,-6 16,0" stroke="#241E38" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Path d="M114,95 q8,-6 16,0" stroke="#241E38" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Path d="M90,120 q10,6 20,0" stroke="#241E38" strokeWidth={5} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  return (
    <G>
      <Circle cx={78} cy={eyeY} r={6.5} fill="#241E38" />
      <Circle cx={122} cy={eyeY} r={6.5} fill="#241E38" />
      <Path d="M82,116 q18,16 36,0" stroke="#241E38" strokeWidth={5.5} strokeLinecap="round" fill="none" />
    </G>
  );
}

interface BlobMascotProps {
  color: string;
  size?: number;
  variant?: 0 | 1 | 2 | 3;
  mood?: BlobMood;
  withFace?: boolean;
}

export function BlobMascot({ color, size = 96, variant = 0, mood = "happy", withFace = true }: BlobMascotProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Path d={BLOB_PATHS[variant]} fill={color} />
      {withFace && <Face mood={mood} />}
    </Svg>
  );
}

export function Sparkle({ color = "#241E38", size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2 L14.2 9.6 L22 12 L14.2 14.4 L12 22 L9.8 14.4 L2 12 L9.8 9.6 Z"
        fill={color}
      />
    </Svg>
  );
}
