import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { Card } from "@/components/Card";
import { BlobMascot } from "@/components/BlobMascot";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { NotificationPrefs } from "@/lib/types";
import { registerForPushNotifications } from "@/lib/notifications";

function formatHour(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.notifications.getPrefs().then((r) => setPrefs(r.prefs)).catch(() => {});
    }, []),
  );

  async function onToggleReminders(enabled: boolean) {
    setPrefs((p) => (p ? { ...p, enabled } : p));
    if (enabled) {
      const granted = await registerForPushNotifications().catch(() => false);
      if (!granted) {
        Alert.alert("Notifications disabled", "Enable notifications for Sea Sponge in your device settings to get review reminders.");
      }
    }
    await api.notifications.updatePrefs({ enabled }).catch(() => {});
  }

  async function onChangeHour(delta: number) {
    if (!prefs) return;
    const next = (prefs.reminder_hour_local + delta + 24) % 24;
    setPrefs({ ...prefs, reminder_hour_local: next });
    await api.notifications.updatePrefs({ reminderHourLocal: next }).catch(() => {});
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.wrap}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <BlobMascot color={colors.primary} size={56} mood="happy" />
          </View>
          <View>
            <Text style={typography.h2}>{user?.name}</Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>{user?.email}</Text>
          </View>
        </View>

        <Card style={{ marginTop: 24, gap: 4, padding: 6 }}>
          <Row label="Daily reminders" right={<Switch value={prefs?.enabled ?? true} onValueChange={onToggleReminders} trackColor={{ true: colors.primary }} />} />
          {prefs?.enabled && (
            <Row
              label="Reminder time"
              right={
                <View style={styles.stepper}>
                  <Pressable onPress={() => onChangeHour(-1)} style={styles.stepBtn}>
                    <Text style={styles.stepText}>–</Text>
                  </Pressable>
                  <Text style={[typography.bodyMedium, { minWidth: 78, textAlign: "center" }]}>
                    {prefs ? formatHour(prefs.reminder_hour_local) : "--"}
                  </Text>
                  <Pressable onPress={() => onChangeHour(1)} style={styles.stepBtn}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </Card>

        <Card style={{ marginTop: 16, padding: 6 }}>
          <NavRow label="Change goal" onPress={() => router.push("/(onboarding)/goal")} />
          <NavRow label="Upload a lecture" onPress={() => router.push("/upload")} />
        </Card>

        <Pressable style={styles.logout} onPress={() => logout()}>
          <Text style={[typography.bodyMedium, { color: colors.danger }]}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={typography.body}>{label}</Text>
      {right}
    </View>
  );
}

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={typography.body}>{label}</Text>
      <Text style={{ color: colors.textMuted }}>{">"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { ...typography.h2, color: colors.primary, lineHeight: 22 },
  logout: { alignItems: "center", marginTop: 28, paddingVertical: 12 },
});
