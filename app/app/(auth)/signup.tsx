import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/lib/auth";

export default function SignupScreen() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
      router.replace("/(onboarding)/goal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={typography.h1}>Start this new journey</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>
            Create your account to begin.
          </Text>

          <View style={{ gap: 14, marginTop: 32 }}>
            <TextField label="Name" placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextField label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Create account" onPress={onSubmit} loading={loading} disabled={!name || !email || password.length < 8} style={{ marginTop: 28 }} />

          <View style={styles.footerRow}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Already have an account? </Text>
            <Link href="/(auth)/login" replace>
              <Text style={[typography.bodyMedium, { color: colors.primary }]}>Log in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  error: { ...typography.caption, color: colors.danger, marginTop: 14 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
});
