import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OfflineBanner } from "../components/OfflineBanner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { startSyncProcessor } from "../lib/sync-manager";

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    startSyncProcessor();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="shelter/[slug]" options={{ headerShown: true, title: "" }} />
            <Stack.Screen name="route/[slug]" options={{ headerShown: true, title: "" }} />
            <Stack.Screen name="tracking" options={{ presentation: "fullScreenModal" }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
