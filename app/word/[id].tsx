import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { BookmarkSheet } from "../../src/BookmarkSheet";
import { getNeighbors, getWord } from "../../src/db";
import { AppText } from "../../src/AppText";
import { formatPronunciations, posLabel } from "../../src/labels";
import { choicesForWord, createList, setMembership, type BookmarkChoice } from "../../src/lists";
import { colors } from "../../src/theme";
import { bold, extraBold, jaBody, semibold } from "../../src/typography";
import type { Neighbor, WordDetail } from "../../src/types";

export default function WordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [word, setWord] = useState<WordDetail | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<BookmarkChoice[]>([]);
  const [listsReady, setListsReady] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const chain = useRef(Promise.resolve());
  const listsGeneration = useRef(0);

  useEffect(() => {
    listsGeneration.current += 1;
    setLists([]);
    setListsReady(false);
    setListsError(null);
    setSheetOpen(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    Promise.all([getWord(id), getNeighbors(id)])
      .then(([nextWord, nextNeighbors]) => {
        if (!alive) return;
        setWord(nextWord);
        setNeighbors(nextNeighbors);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const token = listsGeneration.current;
      let alive = true;
      choicesForWord(id)
        .then((next) => {
          if (!alive || token !== listsGeneration.current) return;
          setLists(next);
          setListsReady(true);
        })
        .catch((err) => {
          console.error(err);
          if (alive) setListsError("リストの読み込みに失敗しました");
        });
      return () => {
        alive = false;
      };
    }, [id])
  );

  const toggleList = (listId: string, on: boolean) => {
    if (!id) return;
    const wordId = id;
    listsGeneration.current += 1;
    setLists((current) => current.map((list) => (list.id === listId ? { ...list, checked: on } : list)));
    chain.current = chain.current.then(async () => {
      try {
        await setMembership(listId, wordId, on);
      } catch {
        try {
          const token = ++listsGeneration.current;
          const next = await choicesForWord(wordId);
          if (token === listsGeneration.current) setLists(next);
        } catch {
          setListsError("リストの更新に失敗しました");
        }
      }
    });
  };

  const createAndSave = async (name: string): Promise<string | null> => {
    if (!id) return "リストを保存できませんでした";
    const wordId = id;
    try {
      const result = await createList(name, wordId);
      if (!result.ok) return result.error;
      listsGeneration.current += 1;
      setLists((current) => [
        { id: result.id, name: result.name, checked: true },
        ...current.filter((list) => list.id !== result.id),
      ]);
      setListsReady(true);
      return null;
    } catch {
      return "リストを保存できませんでした";
    }
  };

  if (error) {
    return <AppText style={styles.error}>{error}</AppText>;
  }
  if (!word) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
  }

  const pronunciation = formatPronunciations(word.ipaMap);
  const pos = posLabel(word.pos);
  const savedLists = lists.filter((list) => list.checked);

  return (
    <>
    <ScrollView contentContainerStyle={styles.page}>
      <AppText style={styles.lemma}>{word.lemma}</AppText>
      <AppText style={styles.sub}>{pos}</AppText>
      {pronunciation ? <AppText style={styles.ipa}>{pronunciation}</AppText> : null}

      {listsError ? <AppText style={styles.listsError}>{listsError}</AppText> : null}
      {listsReady ? (
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

      <View style={styles.senses}>
        {word.senses.length ? (
          word.senses.map((sense, index) => (
            <View key={`${sense.gloss_en}-${index}`} style={styles.block}>
              {sense.gloss_ja ? <AppText style={styles.ja}>{sense.gloss_ja}</AppText> : null}
              {sense.gloss_en ? <AppText style={styles.en}>{sense.gloss_en}</AppText> : null}
            </View>
          ))
        ) : (
          <AppText style={styles.muted}>意味データがありません</AppText>
        )}
      </View>

      {word.collocations.length ? (
        <>
          <AppText style={styles.heading}>コロケーション</AppText>
          {word.collocations.map((phrase, index) => (
            <AppText key={`${phrase}-${index}`} style={styles.collocationLine}>
              {phrase}
            </AppText>
          ))}
        </>
      ) : null}

      {word.synonyms.length ? (
        <>
          <AppText style={styles.heading}>辞書の類義語</AppText>
          <AppText style={styles.body}>{word.synonyms.join(" · ")}</AppText>
        </>
      ) : null}

      {word.examples.length ? (
        <>
          <AppText style={styles.heading}>例文</AppText>
          {word.examples.map((example) => (
            <View key={`${example.sentence_id}-${example.en}`} style={styles.block}>
              <AppText style={styles.en}>{example.en}</AppText>
              <AppText style={styles.ja}>{example.ja}</AppText>
              <AppText style={styles.cite}>
                Tatoeba
                {example.author ? ` · ${example.author}` : ""}
                {example.translation_author ? ` / ${example.translation_author}` : ""}
                {example.sentence_id ? ` · #${example.sentence_id}` : ""}
              </AppText>
            </View>
          ))}
        </>
      ) : null}

      <AppText style={styles.heading}>類似語</AppText>
      {neighbors.length ? (
        neighbors.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.lemma} ${posLabel(item.pos)}`}
            style={styles.neighbor}
            onPress={() => router.push({ pathname: "/word/[id]", params: { id: item.id } })}
          >
            <View style={styles.neighborTop}>
              <AppText style={styles.neighborLemma}>{item.lemma}</AppText>
              <AppText style={styles.score}>{item.score.toFixed(2)}</AppText>
            </View>
            <AppText style={styles.muted}>
              {posLabel(item.pos)}
              {item.gloss_ja ? ` · ${item.gloss_ja.split(/[；;]/)[0]}` : ""}
            </AppText>
          </Pressable>
        ))
      ) : (
        <AppText style={styles.muted}>類似語はまだ計算されていません</AppText>
      )}
    </ScrollView>
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
  page: { padding: 20, paddingBottom: 48 },
  lemma: { fontSize: 32, ...extraBold, color: colors.ink },
  sub: { marginTop: 4, color: colors.accent, ...semibold, fontSize: 16 },
  ipa: { marginTop: 6, color: colors.muted },
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
  senses: { marginTop: 16 },
  heading: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 13,
    ...bold,
    color: colors.muted,
    letterSpacing: 0.6,
  },
  block: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ja: { fontSize: 16, color: colors.ink, lineHeight: 24, ...jaBody },
  en: { fontSize: 15, color: colors.muted, lineHeight: 22, marginTop: 4 },
  body: { color: colors.ink, lineHeight: 22 },
  collocationLine: { color: colors.ink, lineHeight: 24, marginBottom: 4 },
  muted: { color: colors.muted, lineHeight: 20 },
  neighbor: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  neighborTop: { flexDirection: "row", justifyContent: "space-between" },
  neighborLemma: { fontSize: 18, ...bold, color: colors.ink },
  score: { color: colors.accent, ...semibold },
  cite: { marginTop: 8, fontSize: 12, color: colors.muted },
  error: { padding: 20, color: "#9B2C2C" },
});
