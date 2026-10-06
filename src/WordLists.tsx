import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { AppText } from "./AppText";
import { BookmarkSheet } from "./BookmarkSheet";
import { choicesForWord, createList, setMembership, type BookmarkChoice } from "./lists";
import { colors } from "./theme";
import { semibold } from "./typography";

export function useWordLists(wordId: string | undefined) {
  const [lists, setLists] = useState<BookmarkChoice[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const chain = useRef(Promise.resolve());
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setLists([]);
    setReady(false);
    setError(null);
    setSheetOpen(false);
  }, [wordId]);

  useFocusEffect(
    useCallback(() => {
      if (!wordId) return;
      const token = generation.current;
      let alive = true;
      choicesForWord(wordId)
        .then((next) => {
          if (!alive || token !== generation.current) return;
          setLists(next);
          setReady(true);
        })
        .catch((err) => {
          console.error(err);
          if (alive) setError("リストの読み込みに失敗しました");
        });
      return () => {
        alive = false;
      };
    }, [wordId])
  );

  const toggleList = (listId: string, on: boolean) => {
    if (!wordId) return;
    const currentId = wordId;
    generation.current += 1;
    setLists((current) => current.map((list) => (list.id === listId ? { ...list, checked: on } : list)));
    chain.current = chain.current.then(async () => {
      try {
        await setMembership(listId, currentId, on);
      } catch {
        try {
          const token = ++generation.current;
          const next = await choicesForWord(currentId);
          if (token === generation.current) setLists(next);
        } catch {
          setError("リストの更新に失敗しました");
        }
      }
    });
  };

  const createAndSave = async (name: string): Promise<string | null> => {
    if (!wordId) return "リストを保存できませんでした";
    const currentId = wordId;
    try {
      const result = await createList(name, currentId);
      if (!result.ok) return result.error;
      generation.current += 1;
      setLists((current) => [
        { id: result.id, name: result.name, checked: true },
        ...current.filter((list) => list.id !== result.id),
      ]);
      setReady(true);
      return null;
    } catch {
      return "リストを保存できませんでした";
    }
  };

  return { lists, ready, error, sheetOpen, setSheetOpen, toggleList, createAndSave };
}

export function WordListControls({
  lists,
  ready,
  error,
  sheetOpen,
  setSheetOpen,
  toggleList,
  createAndSave,
}: ReturnType<typeof useWordLists>) {
  const savedLists = lists.filter((list) => list.checked);
  return (
    <>
      {error ? <AppText style={styles.listsError}>{error}</AppText> : null}
      {ready ? (
        savedLists.length ? (
          <View style={styles.memberships}>
            {savedLists.map((list) => (
              <View key={list.id} style={styles.memberChip}>
                <AppText style={styles.memberName} numberOfLines={1}>
                  {list.name}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${list.name} から外す`}
                  hitSlop={6}
                  onPress={() => toggleList(list.id, false)}
                >
                  <AppText style={styles.memberRemove}>×</AppText>
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetOpen(true)}
              style={styles.editChip}
            >
              <AppText style={styles.editChipText}>追加・編集</AppText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSheetOpen(true)}
            style={styles.addBtn}
          >
            <AppText style={styles.addBtnText}>リストに追加</AppText>
          </Pressable>
        )
      ) : null}
      {sheetOpen ? (
        <BookmarkSheet
          lists={lists}
          onClose={() => setSheetOpen(false)}
          onToggle={toggleList}
          onCreate={createAndSave}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  listsError: { color: "#9B2C2C", marginTop: 12 },
  memberships: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
  },
  memberName: { flexShrink: 1, color: colors.ink, fontSize: 14 },
  memberRemove: { color: colors.muted, fontSize: 16, lineHeight: 18, ...semibold },
  editChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editChipText: { color: colors.accent, ...semibold, fontSize: 14 },
  addBtn: {
    alignSelf: "flex-start",
    marginTop: 14,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: { color: colors.accent, ...semibold },
});
