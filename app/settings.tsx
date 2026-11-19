import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { AppText } from "../src/AppText";
import { loadAttribution } from "../src/db";
import { clearAllMarks } from "../src/marks";
import { loadFilters, saveFilters } from "../src/storage";
import { colors } from "../src/theme";
import { bold, semibold } from "../src/typography";
import { bandSummary } from "../src/labels";
import { DEFAULT_BANDS, defaultFilters, type Filters } from "../src/types";

export default function SettingsScreen() {
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [attribution, setAttribution] = useState("読み込み中…");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadFilters().then((stored) => {
        if (alive) setFilters(stored);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  useEffect(() => {
    loadAttribution()
      .then(setAttribution)
      .catch(() => setAttribution("ATTRIBUTION.md を表示できませんでした。データセットのクレジットを確認してください。"));
  }, []);

  const applyPreset = async (bands: string[]) => {
    const next = { ...filters, bands };
    setFilters(next);
    await saveFilters(next);
  };

  const confirmClearMarks = () => {
    Alert.alert(
      "学習の印を消す",
      "クイズで付けた「知っている／知らない」の印と、次に出す日時をすべて消します。マイリストはそのままです。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "消す",
          style: "destructive",
          onPress: () => {
            void clearAllMarks();
          },
        },
      ]
    );
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

      <AppText style={styles.heading}>学習印</AppText>
      <AppText style={styles.lead}>
        クイズや単語詳細で付けた印は、端末内にだけ保存されます。マイリストとは別です。
      </AppText>
      <Pressable style={styles.dangerBtn} onPress={confirmClearMarks}>
        <AppText style={styles.dangerBtnText}>学習の印を消す</AppText>
      </Pressable>

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
  dangerBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dangerBtnText: { color: "#9B2C2C", ...semibold },
  body: { color: colors.ink, lineHeight: 22, fontSize: 13 },
});
