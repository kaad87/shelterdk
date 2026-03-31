import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="shelter/[slug]" options={{ headerShown: true, title: "" }} />
          <Stack.Screen name="route/[slug]" options={{ headerShown: true, title: "" }} />
          <Stack.Screen name="tracking" options={{ presentation: "fullScreenModal" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
