import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BlobCluster } from "@/components/BlobCluster";
import { ProgressDots } from "@/components/ProgressDots";
import { Button } from "@/components/Button";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    title: "Learnin",
    subtitle: "Turn any lecture into something you'll actually remember.",
  },
  {
    title: "Upload a PDF or a recording",
    subtitle: "We turn it into a long, readable explainer with quick quizzes woven right in as you scroll.",
  },
  {
    title: "Never forget it again",
    subtitle: "Spaced-repetition reviews and reminders bring the right cards back exactly when you're about to forget them.",
  },
];

export default function OnboardingSlides() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  }

  function goNext() {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
    } else {
      router.push("/(auth)/signup");
    }
  }

  return (
    <LinearGradient colors={[colors.bgGradientTop, colors.bgGradientBottom]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {SLIDES.map((slide, i) => (
            <View key={i} style={[styles.slide, { width }]}>
              <View style={styles.illustration}>
                <BlobCluster />
              </View>
              <Text style={[typography.display, styles.title]}>{slide.title}</Text>
              <Text style={[typography.body, styles.subtitle]}>{slide.subtitle}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <ProgressDots count={SLIDES.length} activeIndex={index} />
          <Button label={index === SLIDES.length - 1 ? "Get started" : "Next"} onPress={goNext} style={{ marginTop: 20 }} />
          {index < SLIDES.length - 1 && (
            <Text style={styles.skip} onPress={() => router.push("/(auth)/signup")}>
              Skip
            </Text>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  slide: { alignItems: "center", paddingHorizontal: 32, paddingTop: 40 },
  illustration: { height: 240, alignItems: "center", justifyContent: "center" },
  title: { textAlign: "center", color: colors.text, marginTop: 12 },
  subtitle: { textAlign: "center", color: colors.textMuted, marginTop: 14 },
  footer: { paddingHorizontal: 32, paddingBottom: 24 },
  skip: { ...typography.bodyMedium, textAlign: "center", color: colors.textMuted, marginTop: 16 },
});
