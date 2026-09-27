import { Platform, type TextStyle } from "react-native";

/** Japanese-first UI font (avoids CJK SC glyph defaults on web / some locales). */
export const fontFamily = Platform.select({
  ios: "Hiragino Sans",
  android: "NotoSansJP_400Regular",
  default:
    'Hiragino Sans, "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", sans-serif',
});

export const defaultTextStyle: TextStyle = fontFamily ? { fontFamily } : {};

/** On Android, synthetic bold falls back to non-JP CJK fonts — use explicit Noto weights. */
export const semibold: TextStyle =
  Platform.select({
    android: { fontFamily: "NotoSansJP_600SemiBold" },
    default: { fontWeight: "600" },
  }) ?? { fontWeight: "600" };

export const bold: TextStyle =
  Platform.select({
    android: { fontFamily: "NotoSansJP_700Bold" },
    default: { fontWeight: "700" },
  }) ?? { fontWeight: "700" };

export const extraBold: TextStyle =
  Platform.select({
    android: { fontFamily: "NotoSansJP_800ExtraBold" },
    default: { fontWeight: "800" },
  }) ?? { fontWeight: "800" };

/** Japanese body lines on Android (tighter vertical metrics than default). */
export const jaBody: TextStyle = Platform.select({
  android: { includeFontPadding: false },
  default: {},
}) ?? {};
