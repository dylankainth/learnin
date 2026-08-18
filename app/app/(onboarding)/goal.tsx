import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { api } from "@/lib/api";

const GOALS = [
  "Ace my exams",
  "Build a daily study habit",
  "Understand lectures faster",
  "Remember what I learn long-term",
  "Cut down on last-minute cramming",
];

export default function GoalScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onContinue() {
    setSaving(true);
    try {
      // Best-effort — goal is stored at signup already if chosen there; this
      // screen lets the user set/change it right after onboarding.
      router.replace("/(tabs)");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.wrap}>
        <Text style={typography.h1}>What's your goal?</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>
          We'll tune reminders and pacing around it.
        </Text>

        <FlatList
          data={GOALS}
          keyExtractor={(g) => g}
          contentContainerStyle={{ gap: 12, marginTop: 28 }}
          renderItem={({ item }) => {
            const active = item === selected;
            return (
              <Pressable
                onPress={() => setSelected(item)}
                style={[styles.option, active && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              >
                <Text style={[typography.bodyMedium, active && { color: colors.primaryDark }]}>{item}</Text>
              </Pressable>
            );
          }}
        />

        <Button label="Continue" onPress={onContinue} disabled={!selected} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, justifyContent: "flex-start", gap: 0 },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
  },
});
