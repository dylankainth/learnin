import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

interface PomodoroTimerProps {
  onComplete?: () => void;
  initialSeconds?: number;
}

export function PomodoroTimer({ onComplete, initialSeconds = 25 * 60 }: PomodoroTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    if (!isRunning || seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, seconds, onComplete]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = 1 - seconds / initialSeconds;

  if (!showTimer) {
    return (
      <Pressable style={styles.toggleBtn} onPress={() => setShowTimer(true)}>
        <Text style={[typography.caption, { color: colors.primary }]}>⏱ Start Focus Timer</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerDisplay}>
        <View style={[styles.progressRing, { opacity: progress * 0.5 }]} />
        <Text style={[typography.h1, { color: isRunning ? colors.danger : colors.primary }]}>
          {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
          {isRunning ? "Focus time" : "Paused"}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => setIsRunning(!isRunning)}>
          <Text style={[typography.caption, { color: "#fff" }]}>{isRunning ? "Pause" : "Start"}</Text>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: colors.border }]} onPress={() => setShowTimer(false)}>
          <Text style={[typography.caption, { color: colors.text }]}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    marginBottom: 12,
  },
  timerDisplay: {
    alignItems: "center",
    marginBottom: 16,
  },
  progressRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
  },
  controls: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    alignItems: "center",
  },
});
