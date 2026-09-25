import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadAttribution } from "../src/db";
import { loadFilters, saveFilters } from "../src/storage";
import { colors } from "../src/theme";
import { APP_BANDS, DEFAULT_BANDS, defaultFilters, type Filters } from "../src/types";

export default function SettingsScreen() {
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [attribution, setAttribution] = useState("読み込み中…");

  useEffect(() => {
    loadFilters().then(setFilters);
    loadAttribution()
      .then(setAttribution)
      .catch(() => setAttribution("ATTRIBUTION.md を表示できませんでした。データセットのクレジットを確認してください。"));
  }, []);

  const applyPreset = async (bands: string[]) => {
    const next = { ...filters, bands };
    setFilters(next);
    await saveFilters(next);
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>学習レベル</Text>
      <Text style={styles.lead}>
        TOEIC 760 前後向けの既定は core / upper / advanced です。A1・A2（review）は含めません。
      </Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => applyPreset([...DEFAULT_BANDS])}>
          <Text style={styles.btnText}>TOEIC ~760</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => applyPreset([...APP_BANDS])}>
          <Text style={styles.btnText}>すべて</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => applyPreset(["upper", "advanced"])}>
          <Text style={styles.btnText}>上級寄り</Text>
        </Pressable>
      </View>
      <Text style={styles.current}>現在: {filters.bands.join(", ") || "指定なし"}</Text>

      <Text style={styles.heading}>ライセンス / クレジット</Text>
      <Text style={styles.body}>{attribution}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  lead: { color: colors.muted, lineHeight: 22, marginBottom: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  current: { color: colors.ink, marginBottom: 24 },
  body: { color: colors.ink, lineHeight: 22, fontSize: 13 },
});
