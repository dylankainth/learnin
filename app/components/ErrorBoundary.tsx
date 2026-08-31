import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { Button } from "@/components/Button";
import { BlobMascot } from "@/components/BlobMascot";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches render/lifecycle errors below it so one broken screen shows a recoverable fallback instead of force-closing the whole app. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.wrap}>
            <BlobMascot color={colors.primary} size={72} mood="sleepy" />
            <Text style={[typography.h2, { marginTop: 20, textAlign: "center" }]}>Something went wrong</Text>
            <Text style={[typography.body, { color: colors.textMuted, marginTop: 8, textAlign: "center" }]}>
              This screen hit an unexpected error. You can try again.
            </Text>
            <Button label="Try again" onPress={() => this.setState({ hasError: false })} style={{ marginTop: 24 }} />
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
});
