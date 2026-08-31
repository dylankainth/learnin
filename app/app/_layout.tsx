import React, { useCallback, useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { CalSans_400Regular } from "@expo-google-fonts/cal-sans";
import {
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_700Bold,
} from "@expo-google-fonts/source-serif-4";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ConnectivityProvider } from "@/lib/connectivity";
import { ToastHost } from "@/lib/toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { colors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === "(tabs)";
    if (!user && inTabs) {
      router.replace("/(onboarding)");
    }
  }, [user, loading, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    CalSans_400Regular,
    SourceSerif4_400Regular,
    SourceSerif4_400Regular_Italic,
    SourceSerif4_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ConnectivityProvider>
      <AuthProvider>
        <AuthGuard />
        <StatusBar style="dark" backgroundColor={colors.bg} />
        <ErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
              animation: "slide_from_right",
              gestureEnabled: true,
              animationMatchesGesture: true,
            }}
          >
            <Stack.Screen name="(auth)" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          </Stack>
        </ErrorBoundary>
        <ToastHost />
      </AuthProvider>
    </ConnectivityProvider>
  );
}
