import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  NotoSansJP_400Regular,
  NotoSansJP_600SemiBold,
  NotoSansJP_700Bold,
  NotoSansJP_800ExtraBold,
} from "@expo-google-fonts/noto-sans-jp";

import { fontFamily } from "../src/typography";

const androidFonts = {
  NotoSansJP_400Regular,
  NotoSansJP_600SemiBold,
  NotoSansJP_700Bold,
  NotoSansJP_800ExtraBold,
};

export default function RootLayout() {
  const [androidFontsLoaded] = useFonts(
    Platform.OS === "android" ? androidFonts : {}
  );
  const fontsReady = Platform.OS !== "android" || androidFontsLoaded;

  if (!fontsReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#F4F1EA" },
          headerTintColor: "#1F2A2E",
          headerTitleStyle: fontFamily ? { fontFamily } : undefined,
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
