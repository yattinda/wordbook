import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText, AppTextInput } from "../../src/AppText";
import { getWordsByIds } from "../../src/db";
import { BottomSheet } from "../../src/BottomSheet";
import { ListNameDialog } from "../../src/ListNameDialog";
import { WordCard } from "../../src/WordCard";
import {
  deleteList,
  getList,
  membershipsInList,
  renameList,
  setMembership,
} from "../../src/lists";
import { colors } from "../../src/theme";
import { semibold } from "../../src/typography";
import type { WordListItem } from "../../src/types";

type Entry =
  | { kind: "word"; word: WordListItem }
  | { kind: "missing"; wordId: string };

function entryId(entry: Entry): string {
  return entry.kind === "word" ? entry.word.id : entry.wordId;
}

function matchesQuery(entry: Entry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (entry.kind !== "word") return false;
  return [entry.word.lemma, entry.word.gloss_ja, entry.word.gloss_en].some((value) =>
    (value ?? "").toLowerCase().includes(needle)
  );
}

export default function BookmarkListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadToken = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    const token = ++loadToken.current;
    try {
      const list = await getList(id);
      if (token !== loadToken.current) return;
      if (!list) {
        setMissing(true);
        setName(null);
        setEntries([]);
        setError(null);
        return;
      }
      const memberships = await membershipsInList(id);
      const words = await getWordsByIds(memberships.map((item) => item.wordId));
      if (token !== loadToken.current) return;
      setName(list.name);
      setMissing(false);
      setEntries(
        memberships.map((item) => {
          const word = words.get(item.wordId);
          return word ? { kind: "word", word } : { kind: "missing", wordId: item.wordId };
        })
      );
      setError(null);
    } catch (err) {
      if (token !== loadToken.current) return;
      setError(err instanceof Error ? err.message : "リストの読み込みに失敗しました");
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = useMemo(
    () => entries.filter((entry) => matchesQuery(entry, query)),
    [entries, query]
  );

  const removeWord = async (wordId: string) => {
    if (!id) return;
    loadToken.current += 1;
    setEntries((current) => current.filter((entry) => entryId(entry) !== wordId));
    try {
      await setMembership(id, wordId, false);
    } catch {
      setError("単語を外せませんでした");
      await load();
    }
  };

  const submitRename = async (nextName: string) => {
    if (!id) return;
    setRenameError(null);
    try {
      const result = await renameList(id, nextName);
      if (!result.ok) {
        setRenameError(result.error);
        return;
      }
      setName(result.name);
      setRenaming(false);
    } catch {
      setRenameError("名前を変更できませんでした");
    }
  };

  const removeList = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await deleteList(id);
      router.replace("/lists");
    } catch {
      setError("リストを削除できませんでした");
      setBusy(false);
    }
  };

  const openMenu = () => {
    setConfirming(false);
    setMenu(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: name ?? "リスト",
          headerRight: () =>
            name ? (
              <Pressable accessibilityRole="button" onPress={openMenu} hitSlop={8} style={styles.headerBtn}>
                <AppText style={styles.headerBtnText}>編集</AppText>
              </Pressable>
            ) : null,
        }}
      />
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : missing ? (
        <AppText style={styles.empty}>このリストは見つかりません</AppText>
      ) : entries.length === 0 ? (
        <AppText style={styles.empty}>このリストにはまだ単語がありません</AppText>
      ) : (
        <>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="綴り・訳で検索"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
          <FlatList
            data={visible}
            keyExtractor={entryId}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<AppText style={styles.empty}>該当する単語がありません</AppText>}
            renderItem={({ item }) => (
              <Swipeable
                friction={2}
                overshootRight={false}
                activeOffsetX={[-24, 24]}
                failOffsetY={[-16, 16]}
                useNativeAnimations={Platform.OS !== "web"}
                renderRightActions={() => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="外す"
                    onPress={() => void removeWord(entryId(item))}
                    style={styles.remove}
                  >
                    <AppText style={styles.removeText}>外す</AppText>
                  </Pressable>
                )}
              >
                {item.kind === "word" ? (
                  <WordCard
                    item={item.word}
                    onPress={() => router.push({ pathname: "/word/[id]", params: { id: item.word.id } })}
                  />
                ) : (
                  <View style={styles.missingCard}>
                    <AppText style={styles.missingText}>この単語は見つかりません</AppText>
                  </View>
                )}
              </Swipeable>
            )}
          />
        </>
      )}
      <BottomSheet
        visible={menu}
        onClose={() => {
          setMenu(false);
          setConfirming(false);
        }}
      >
        {confirming ? (
          <>
            <AppText style={styles.confirm}>
              このリストを削除します。単語そのものは辞書に残ります。
            </AppText>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void removeList()}
              style={styles.dangerBtn}
            >
              <AppText style={styles.dangerBtnText}>削除</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenu(false);
                setConfirming(false);
              }}
              style={styles.quietBtn}
            >
              <AppText style={styles.quietBtnText}>キャンセル</AppText>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenu(false);
                setRenameError(null);
                setRenaming(true);
              }}
              style={styles.menuBtn}
            >
              <AppText style={styles.menuBtnText}>名前を変更</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} style={styles.menuBtn}>
              <AppText style={styles.dangerLabel}>リストを削除</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setMenu(false)} style={styles.quietBtn}>
              <AppText style={styles.quietBtnText}>閉じる</AppText>
            </Pressable>
          </>
        )}
      </BottomSheet>
      <ListNameDialog
        visible={renaming}
        title="名前を変更"
        initialName={name ?? ""}
        confirmLabel="保存"
        error={renameError}
        onClose={() => setRenaming(false)}
        onSubmit={submitRename}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBtn: { paddingHorizontal: 8 },
  headerBtnText: { color: colors.accent, ...semibold, fontSize: 16 },
  search: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  remove: {
    width: 84,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: "#9B2C2C",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: "#fff", ...semibold },
  missingCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  missingText: { color: colors.muted, lineHeight: 22 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40, lineHeight: 22, paddingHorizontal: 24 },
  spinner: { marginTop: 40 },
  error: { color: "#9B2C2C", paddingHorizontal: 16, paddingTop: 12 },
  confirm: { color: colors.ink, lineHeight: 22, marginBottom: 16 },
  menuBtn: { paddingVertical: 14 },
  menuBtnText: { fontSize: 16, color: colors.ink, ...semibold },
  dangerLabel: { fontSize: 16, color: "#9B2C2C", ...semibold },
  dangerBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#9B2C2C",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dangerBtnText: { color: "#fff", ...semibold },
  quietBtn: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 8 },
  quietBtnText: { color: colors.muted, ...semibold },
});
