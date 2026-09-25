import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getNeighbors, getWord } from "../../src/db";
import { colors } from "../../src/theme";
import type { Neighbor, WordDetail } from "../../src/types";

export default function WordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [word, setWord] = useState<WordDetail | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }
  if (!word) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
  }

  const ipaBits = Object.entries(word.ipaMap)
    .filter(([, value]) => value)
    .map(([key, value]) => {
      const trimmed = String(value).trim();
      const shown = trimmed.startsWith("/") ? trimmed : `/${trimmed}/`;
      return `${key} ${shown}`;
    });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.lemma}>{word.lemma}</Text>
      <Text style={styles.sub}>
        {word.pos}
        {word.cefr ? ` · ${word.cefr}` : ""}
        {word.app_band ? ` · ${word.app_band}` : ""}
      </Text>
      {ipaBits.length ? <Text style={styles.ipa}>{ipaBits.join("   ")}</Text> : null}
      {word.domains.length ? <Text style={styles.meta}>{word.domains.join(" · ")}</Text> : null}

      <Text style={styles.heading}>意味</Text>
      {word.senses.length ? (
        word.senses.map((sense, index) => (
          <View key={`${sense.gloss_en}-${index}`} style={styles.block}>
            {sense.gloss_ja ? <Text style={styles.ja}>{sense.gloss_ja}</Text> : null}
            {sense.gloss_en ? <Text style={styles.en}>{sense.gloss_en}</Text> : null}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>意味データがありません</Text>
      )}

      {word.collocations.length ? (
        <>
          <Text style={styles.heading}>コロケーション</Text>
          <Text style={styles.body}>{word.collocations.join(" · ")}</Text>
        </>
      ) : null}

      {word.synonyms.length ? (
        <>
          <Text style={styles.heading}>辞書の類義語</Text>
          <Text style={styles.body}>{word.synonyms.join(" · ")}</Text>
        </>
      ) : null}

      <Text style={styles.heading}>類似語</Text>
      {neighbors.length ? (
        neighbors.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.lemma} ${item.pos}`}
            style={styles.neighbor}
            onPress={() => router.push({ pathname: "/word/[id]", params: { id: item.id } })}
          >
            <View style={styles.neighborTop}>
              <Text style={styles.neighborLemma}>{item.lemma}</Text>
              <Text style={styles.score}>{item.score.toFixed(2)}</Text>
            </View>
            <Text style={styles.muted}>
              {item.pos}
              {item.gloss_ja ? ` · ${item.gloss_ja.split(/[；;]/)[0]}` : ""}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={styles.muted}>類似語はまだ計算されていません</Text>
      )}

      {word.examples.length ? (
        <>
          <Text style={styles.heading}>例文</Text>
          {word.examples.map((example) => (
            <View key={`${example.sentence_id}-${example.en}`} style={styles.block}>
              <Text style={styles.en}>{example.en}</Text>
              <Text style={styles.ja}>{example.ja}</Text>
              <Text style={styles.cite}>
                Tatoeba
                {example.author ? ` · ${example.author}` : ""}
                {example.translation_author ? ` / ${example.translation_author}` : ""}
                {example.sentence_id ? ` · #${example.sentence_id}` : ""}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  lemma: { fontSize: 32, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 6, color: colors.accent, fontWeight: "600", fontSize: 16 },
  ipa: { marginTop: 8, color: colors.ink },
  meta: { marginTop: 6, color: colors.muted },
  heading: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
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
  ja: { fontSize: 16, color: colors.ink, lineHeight: 24 },
  en: { fontSize: 15, color: colors.muted, lineHeight: 22, marginTop: 4 },
  body: { color: colors.ink, lineHeight: 22 },
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
  neighborLemma: { fontSize: 18, fontWeight: "700", color: colors.ink },
  score: { color: colors.accent, fontWeight: "600" },
  cite: { marginTop: 8, fontSize: 12, color: colors.muted },
  error: { padding: 20, color: "#9B2C2C" },
});
