import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
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
          <Text style={typography.h1}>Welcome back</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>Pick up right where you left off.</Text>

          <View style={{ gap: 14, marginTop: 32 }}>
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextField label="Password" placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Log in" onPress={onSubmit} loading={loading} disabled={!email || !password} style={{ marginTop: 28 }} />

          <Link href="/(auth)/forgot-password" style={{ alignSelf: "center", marginTop: 16 }}>
            <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Forgot password?</Text>
          </Link>

          <View style={styles.footerRow}>
            <Text style={[typography.body, { color: colors.textMuted }]}>New here? </Text>
            <Link href="/(auth)/signup" replace>
              <Text style={[typography.bodyMedium, { color: colors.primary }]}>Create an account</Text>
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
