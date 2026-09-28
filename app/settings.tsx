import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "../src/AppText";
import { loadAttribution } from "../src/db";
import { loadFilters, saveFilters } from "../src/storage";
import { colors } from "../src/theme";
import { bold, semibold } from "../src/typography";
import { bandSummary } from "../src/labels";
import { DEFAULT_BANDS, defaultFilters, type Filters } from "../src/types";

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
      <AppText style={styles.heading}>学習レベル</AppText>
      <AppText style={styles.lead}>
        既定では初級を外し、中級・中上級・上級を表示します。
      </AppText>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => applyPreset([...DEFAULT_BANDS])}>
          <AppText style={styles.btnText}>TOEIC ~760</AppText>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => applyPreset([])}>
          <AppText style={styles.btnText}>すべて</AppText>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => applyPreset(["upper", "advanced"])}>
          <AppText style={styles.btnText}>上級寄り</AppText>
        </Pressable>
      </View>
      <AppText style={styles.current}>現在: {bandSummary(filters.bands)}</AppText>

      <AppText style={styles.heading}>ライセンス / クレジット</AppText>
      <AppText style={styles.body}>{attribution}</AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 18, ...bold, color: colors.ink, marginBottom: 8 },
  lead: { color: colors.muted, lineHeight: 22, marginBottom: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: "#fff", ...semibold },
  current: { color: colors.ink, marginBottom: 24 },
  body: { color: colors.ink, lineHeight: 22, fontSize: 13 },
});
