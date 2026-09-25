import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#F4F1EA" },
          headerTintColor: "#1F2A2E",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#F4F1EA" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "単語一覧" }} />
        <Stack.Screen name="word/[id]" options={{ title: "単語" }} />
        <Stack.Screen name="settings" options={{ title: "設定" }} />
      </Stack>
    </>
  );
}
