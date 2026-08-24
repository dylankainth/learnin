import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as NavigationBar from "expo-navigation-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { TextField } from "@/components/TextField";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/lib/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_H = 200;

export default function SignupScreen() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    NavigationBar.setBackgroundColorAsync("#FFFFFF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

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
    <View style={styles.root}>
      {/* Gradient header */}
      <LinearGradient
        colors={["#9EC2CE", "#07536C"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.header}
      />
      <Image
        source={require("../../assets/noise.png")}
        style={styles.noise}
        resizeMode="cover"
        pointerEvents="none"
      />
      <SafeAreaView style={styles.headerContent} pointerEvents="none">
        <Text style={styles.brand}>soak it all in.</Text>
      </SafeAreaView>

      {/* Form */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Start this new journey</Text>
          <Text style={styles.subtitle}>Create your account to begin.</Text>

          <View style={{ gap: 14, marginTop: 28 }}>
            <TextField
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextField
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, (!name || !email || password.length < 8 || loading) && { opacity: 0.5 }]}
            onPress={onSubmit}
            disabled={!name || !email || password.length < 8 || loading}
          >
            <Text style={styles.btnText}>{loading ? "Creating account…" : "Create account"}</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Already have an account? </Text>
            <Link href="/(auth)/login" replace>
              <Text style={[typography.bodyMedium, { color: "#07536C" }]}>Log in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_H,
  },
  noise: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: HEADER_H,
    opacity: 0.05,
  },
  headerContent: {
    height: HEADER_H,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontFamily: "CalSans_400Regular",
    fontSize: 42,
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  form: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  title: {
    fontFamily: "Figtree_700Bold",
    fontSize: 26,
    color: "#002B3A",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Figtree_400Regular",
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 6,
  },
  btn: {
    backgroundColor: "#002B3A",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    marginTop: 28,
  },
  btnText: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 14,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
});
