import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Image, Animated } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GRADIENT_H = SCREEN_HEIGHT * 0.75;

const BUBBLES = [
  { id: 0,  x: 0.08, size: 12, opacity: 0.18, duration: 7000,  delay: 0    },
  { id: 1,  x: 0.22, size: 22, opacity: 0.12, duration: 9500,  delay: 1200 },
  { id: 2,  x: 0.41, size: 8,  opacity: 0.22, duration: 6000,  delay: 2800 },
  { id: 3,  x: 0.60, size: 18, opacity: 0.14, duration: 11000, delay: 400  },
  { id: 4,  x: 0.78, size: 10, opacity: 0.20, duration: 7500,  delay: 3500 },
  { id: 5,  x: 0.88, size: 28, opacity: 0.10, duration: 13000, delay: 1800 },
  { id: 6,  x: 0.15, size: 16, opacity: 0.16, duration: 8500,  delay: 5000 },
  { id: 7,  x: 0.50, size: 6,  opacity: 0.24, duration: 5500,  delay: 700  },
  { id: 8,  x: 0.70, size: 20, opacity: 0.13, duration: 10000, delay: 4200 },
  { id: 9,  x: 0.33, size: 14, opacity: 0.17, duration: 8000,  delay: 2200 },
  { id: 10, x: 0.92, size: 9,  opacity: 0.21, duration: 6500,  delay: 6000 },
  { id: 11, x: 0.55, size: 24, opacity: 0.09, duration: 12000, delay: 3000 },
];

function Bubble({ x, size, opacity, duration, delay }: typeof BUBBLES[0]) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }).start(({ finished }) => {
        if (finished) run();
      });
    };
    const t = setTimeout(run, delay);
    return () => clearTimeout(t);
  }, []);

  // Bubble starts just below the container (top: GRADIENT_H) and rises off the top
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(GRADIENT_H + size)] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x * SCREEN_WIDTH - size / 2,
        top: GRADIENT_H,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: `rgba(255,255,255,${opacity})`,
        backgroundColor: `rgba(255,255,255,${opacity * 0.3})`,
        transform: [{ translateY }],
      }}
    />
  );
}

export default function OnboardingScreen() {
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync("#FFFFFF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Gradient bg */}
      <LinearGradient
        colors={["#9EC2CE", "#07536C"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientSection}
      />

      {/* Bubbles — absolute over gradient, behind noise */}
      <View style={styles.bubblesLayer} pointerEvents="none">
        {BUBBLES.map((b) => <Bubble key={b.id} {...b} />)}
      </View>

      {/* Noise — absolute over bubbles */}
      <Image source={require("../../assets/noise.png")} style={styles.noise} resizeMode="cover" pointerEvents="none" />

      {/* Brand text — absolute over noise */}
      <View style={styles.brandWrap} pointerEvents="none">
        <Text style={styles.brandName}>seasponge</Text>
      </View>

      {/* Bottom 3/5 — white */}
      <View style={styles.whiteSection}>
        <Pressable
          style={({ pressed }) => [styles.buttonPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text style={styles.buttonPrimaryText}>Create an account</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.buttonSecondary, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.buttonSecondaryText}>Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  gradientSection: {
    height: GRADIENT_H,
  },
  bubblesLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: GRADIENT_H,
    overflow: "hidden",
  },
  noise: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: GRADIENT_H,
    opacity: 0.05,
  },
  brandWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: GRADIENT_H,
    justifyContent: "center",
    alignItems: "center",
  },
  brandName: {
    fontFamily: "CalSans_400Regular",
    fontSize: 72,
    color: "#FFFFFF",
    letterSpacing: -1.5,
  },
  whiteSection: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: "#002B3A",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  buttonPrimaryText: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  buttonSecondary: {
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#002B3A",
  },
  buttonSecondaryText: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 18,
    color: "#002B3A",
    letterSpacing: 0.2,
  },
});
