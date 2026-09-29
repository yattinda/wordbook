import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../../src/AppText";
import { ListNameDialog } from "../../src/ListNameDialog";
import { createList, getLists, type BookmarkList } from "../../src/lists";
import { colors } from "../../src/theme";
import { bold, semibold } from "../../src/typography";

export default function BookmarkListsScreen() {
  const [lists, setLists] = useState<BookmarkList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const loadToken = useRef(0);

  const load = useCallback(async () => {
    const token = ++loadToken.current;
    try {
      const next = await getLists();
      if (token !== loadToken.current) return;
      setLists(next);
      setError(null);
    } catch (err) {
      if (token !== loadToken.current) return;
      setError(err instanceof Error ? err.message : "リストの読み込みに失敗しました");
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openCreate = () => {
    setCreateError(null);
    setCreating(true);
  };

  const submitCreate = async (name: string) => {
    setCreateError(null);
    try {
      const result = await createList(name);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      setCreating(false);
      await load();
    } catch {
      setCreateError("リストを保存できませんでした");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "マイリスト",
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={openCreate} hitSlop={8} style={styles.headerBtn}>
              <AppText style={styles.headerBtnText}>追加</AppText>
            </Pressable>
          ),
        }}
      />
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppText style={styles.empty}>
                まだリストがありません。単語の画面から、覚えたい語をリストに入れられます。
              </AppText>
              <Pressable accessibilityRole="button" onPress={openCreate} style={styles.emptyBtn}>
                <AppText style={styles.emptyBtnText}>新しいリスト</AppText>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} ${item.count}語`}
              style={styles.row}
              onPress={() => router.push({ pathname: "/lists/[id]", params: { id: item.id } })}
            >
              <AppText style={styles.name} numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText style={styles.count}>{item.count.toLocaleString()}語</AppText>
            </Pressable>
          )}
        />
      )}
      <ListNameDialog
        visible={creating}
        title="新しいリスト"
        initialName=""
        confirmLabel="作る"
        error={createError}
        onClose={() => setCreating(false)}
        onSubmit={submitCreate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBtn: { paddingHorizontal: 8 },
  headerBtnText: { color: colors.accent, ...semibold, fontSize: 16 },
  list: { padding: 16, paddingBottom: 40, gap: 10, flexGrow: 1 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  name: { flex: 1, fontSize: 18, ...bold, color: colors.ink },
  count: { color: colors.muted, ...semibold },
  emptyWrap: { alignItems: "center", marginTop: 48, paddingHorizontal: 12 },
  empty: { textAlign: "center", color: colors.muted, lineHeight: 22 },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyBtnText: { color: "#fff", ...semibold },
  spinner: { marginTop: 40 },
  error: { color: "#9B2C2C", paddingHorizontal: 16, paddingTop: 12 },
});
