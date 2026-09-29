import { Platform, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "./AppText";
import { posLabel } from "./labels";
import { colors } from "./theme";
import { bold, jaBody, semibold } from "./typography";
import type { WordListItem } from "./types";

function firstGloss(text: string | null): string {
  if (!text) return "";
  return text.split(/[；;]/)[0]?.trim() ?? "";
}

function formatIpa(ipa: string | null): string | null {
  if (!ipa) return null;
  const trimmed = ipa.trim();
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}/`;
}

function SavedMark() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.mark}
    >
      <AppText style={styles.markText}>✓</AppText>
    </View>
  );
}

export function WordCard({
  item,
  saved = false,
  onPress,
}: {
  item: WordListItem;
  saved?: boolean;
  onPress: () => void;
}) {
  const pronunciation = formatIpa(item.ipa);
  const pos = posLabel(item.pos);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.lemma} ${pos}${saved ? " 保存済み" : ""}`}
      style={styles.card}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <AppText style={styles.lemma}>{item.lemma}</AppText>
        <View style={styles.aside}>
          {saved ? <SavedMark /> : null}
          <AppText style={styles.pos}>{pos}</AppText>
        </View>
      </View>
      {pronunciation ? <AppText style={styles.meta}>{pronunciation}</AppText> : null}
      <AppText style={styles.gloss} numberOfLines={2}>
        {firstGloss(item.gloss_ja) || firstGloss(item.gloss_en) || "（訳なし）"}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lemma: { fontSize: 22, ...bold, color: colors.ink, flex: 1, paddingRight: 8 },
  aside: { flexDirection: "row", alignItems: "center", gap: 8 },
  pos: { color: colors.accent, ...semibold },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    color: colors.accent,
    fontSize: 12,
    lineHeight: Platform.OS === "android" ? 16 : 14,
    ...bold,
  },
  meta: { color: colors.muted, marginTop: 4 },
  gloss: { color: colors.ink, marginTop: 8, fontSize: 15, lineHeight: 22, ...jaBody },
});
