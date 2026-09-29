import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText, AppTextInput } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import type { BookmarkChoice } from "./lists";
import { colors } from "./theme";
import { bold, semibold } from "./typography";

export function BookmarkSheet({
  lists,
  onClose,
  onToggle,
  onCreate,
}: {
  lists: BookmarkChoice[];
  onClose: () => void;
  onToggle: (listId: string, on: boolean) => void;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(lists.length === 0 ? "あとで見る" : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = draft.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      const nextError = await onCreate(draft);
      if (nextError) setError(nextError);
      else {
        setDraft("");
        setError(null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.header}>
        <AppText style={styles.title}>リスト</AppText>
        <Pressable onPress={onClose} hitSlop={8}>
          <AppText style={styles.close}>閉じる</AppText>
        </Pressable>
      </View>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {lists.map((list) => (
          <Pressable
            key={list.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: list.checked }}
            accessibilityLabel={list.name}
            onPress={() => onToggle(list.id, !list.checked)}
            style={styles.row}
          >
            <View style={[styles.box, list.checked && styles.boxOn]}>
              {list.checked ? <AppText style={styles.tick}>✓</AppText> : null}
            </View>
            <AppText style={styles.name}>{list.name}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.create}>
        <AppTextInput
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setError(null);
          }}
          placeholder="リストの名前"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={() => {
            void submit();
          }}
          style={styles.input}
        />
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canCreate}
          onPress={() => {
            void submit();
          }}
          style={[styles.createBtn, !canCreate && styles.createBtnOff]}
        >
          <AppText style={styles.createBtnText}>新しいリストを作る</AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 18, ...bold, color: colors.ink },
  close: { color: colors.accent, ...semibold },
  list: { maxHeight: 280 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: "#fff", fontSize: 14, lineHeight: 18, ...bold },
  name: { flex: 1, fontSize: 16, color: colors.ink },
  create: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: "#9B2C2C", marginTop: 8 },
  createBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createBtnOff: { opacity: 0.4 },
  createBtnText: { color: "#fff", ...semibold },
});
