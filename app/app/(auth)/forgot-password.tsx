import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/lib/auth";

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
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
          <Text style={typography.h1}>Reset your password</Text>
          {sent ? (
            <Text style={[typography.body, { color: colors.textMuted, marginTop: 10 }]}>
              If an account exists for {email.trim()}, we've sent a reset link to it.
            </Text>
          ) : (
            <>
              <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>
                We'll email you a link to set a new one.
              </Text>
              <View style={{ marginTop: 28 }}>
                <TextField
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Button label="Send reset link" onPress={onSubmit} loading={loading} disabled={!email} style={{ marginTop: 24 }} />
            </>
          )}
          <Button label="Back to log in" variant="ghost" onPress={() => router.replace("/(auth)/login")} style={{ marginTop: 12 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  error: { ...typography.caption, color: colors.danger, marginTop: 14 },
});
