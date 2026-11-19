import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../src/AppText";
import { countQuizWords, getWord, getWordsByIds, listPosValues, sampleQuizWords } from "../src/db";
import {
  bandSummary,
  comparePos,
  domainSummary,
  formatPronunciations,
  isAllSelected,
  posLabel,
} from "../src/labels";
import { getList, getLists, getTroubleListId, membershipsInList, type BookmarkList } from "../src/lists";
import {
  markKnown,
  markUnknown,
  QUIZ_SOURCE_REVIEW,
  restingIds,
  reviewMarks,
} from "../src/marks";
import { loadFilters } from "../src/storage";
import { colors } from "../src/theme";
import { bold, extraBold, jaBody, semibold } from "../src/typography";
import { defaultFilters, type Filters, type WordDetail, type WordListItem } from "../src/types";
import { useWordLists, WordListControls } from "../src/WordLists";

const SIZES = [10, 20, 50] as const;

type Phase = "setup" | "prompt" | "answer" | "done";

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatIpa(ipa: string | null): string {
  if (!ipa?.trim()) return "";
  const trimmed = ipa.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}/`;
}

function describeFilters(filters: Filters, posOptions: string[]): string {
  const pos =
    filters.pos.length && posOptions.length && !isAllSelected(filters.pos, posOptions)
      ? [...filters.pos].sort(comparePos).map(posLabel).join("・")
      : null;
  const parts = [
    filters.query.trim() ? `「${filters.query.trim()}」` : null,
    bandSummary(filters.bands),
    domainSummary(filters.domains),
    pos,
  ].filter(Boolean);
  return parts.join(" · ");
}

function shuffle<T>(items: readonly T[]): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swap];
    next[swap] = current;
  }
  return next;
}

async function eligibleListWords(listId: string): Promise<WordListItem[] | null> {
  const list = await getList(listId);
  if (!list) return null;
  const memberships = await membershipsInList(listId);
  const words = await getWordsByIds(memberships.map((item) => item.wordId));
  const eligible: WordListItem[] = [];
  for (const item of memberships) {
    const word = words.get(item.wordId);
    if (word?.gloss_ja?.trim()) eligible.push(word);
  }
  return eligible;
}

async function restingForQuiz(sourceId: string | null): Promise<string[]> {
  if (sourceId === QUIZ_SOURCE_REVIEW) return [];
  const troubleListId = await getTroubleListId();
  if (troubleListId && sourceId === troubleListId) return [];
  return restingIds();
}

async function reviewDeckWords(limit: number): Promise<WordListItem[]> {
  const marks = await reviewMarks();
  if (!marks.length || limit <= 0) return [];
  const words = await getWordsByIds(marks.map((mark) => mark.wordId));
  const items: WordListItem[] = [];
  for (const mark of marks) {
    const word = words.get(mark.wordId);
    if (word?.gloss_ja?.trim()) items.push(word);
    if (items.length >= limit) break;
  }
  return items;
}

async function countReviewDeckWords(): Promise<number> {
  const marks = await reviewMarks();
  if (!marks.length) return 0;
  const words = await getWordsByIds(marks.map((mark) => mark.wordId));
  let count = 0;
  for (const mark of marks) {
    const word = words.get(mark.wordId);
    if (word?.gloss_ja?.trim()) count += 1;
  }
  return count;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <AppText style={[styles.chipText, selected && styles.chipOnText]} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ listId?: string; query?: string }>();
  const paramListId = firstString(params.listId);
  const paramQuery = firstString(params.query) ?? "";

  const [phase, setPhase] = useState<Phase>("setup");
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [filtersReady, setFiltersReady] = useState(false);
  const [posOptions, setPosOptions] = useState<string[]>([]);
  const [bookmarkLists, setBookmarkLists] = useState<BookmarkList[]>([]);
  const [listsNote, setListsNote] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(paramListId ?? null);
  const [size, setSize] = useState<(typeof SIZES)[number]>(20);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [poolTotal, setPoolTotal] = useState<number | null>(null);
  const [counting, setCounting] = useState(true);
  const [marking, setMarking] = useState(false);
  const [listMissing, setListMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<WordListItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<WordDetail | null | undefined>(undefined);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const countToken = useRef(0);

  const item = deck[index];
  const wordLists = useWordLists(phase === "prompt" || phase === "answer" ? item?.id : undefined);

  useFocusEffect(
    useCallback(() => {
      if (phaseRef.current !== "setup") return;
      let alive = true;
      loadFilters().then((stored) => {
        if (!alive || phaseRef.current !== "setup") return;
        setFilters({ ...stored, query: paramQuery });
        setFiltersReady(true);
      });
      listPosValues()
        .then((next) => {
          if (alive) setPosOptions(next);
        })
        .catch(() => {
          if (alive) setPosOptions([]);
        });
      getLists()
        .then((next) => {
          if (!alive) return;
          setBookmarkLists(next);
          setListsNote(null);
        })
        .catch(() => {
          if (alive) setListsNote("リストの読み込みに失敗しました");
        });
      return () => {
        alive = false;
      };
    }, [paramQuery])
  );

  useEffect(() => {
    if (phase !== "setup") return;
    if (sourceId === null && !filtersReady) {
      setCounting(true);
      setPoolCount(null);
      setPoolTotal(null);
      setListMissing(false);
      return;
    }
    const token = ++countToken.current;
    setCounting(true);
    setPoolCount(null);
    setPoolTotal(null);
    setListMissing(false);
    setError(null);
    const run = async () => {
      if (sourceId === QUIZ_SOURCE_REVIEW) {
        const total = await countReviewDeckWords();
        if (token !== countToken.current) return;
        setPoolTotal(total);
        setPoolCount(total);
        return;
      }
      const resting = await restingForQuiz(sourceId);
      const restingSet = new Set(resting);
      if (sourceId === null) {
        const total = await countQuizWords(filters);
        const available = await countQuizWords(filters, resting);
        if (token !== countToken.current) return;
        setPoolTotal(total);
        setPoolCount(available);
        return;
      }
      const words = await eligibleListWords(sourceId);
      if (token !== countToken.current) return;
      if (!words) {
        setListMissing(true);
        setPoolTotal(0);
        setPoolCount(0);
        return;
      }
      const available = words.filter((word) => !restingSet.has(word.id)).length;
      setPoolTotal(words.length);
      setPoolCount(available);
    };
    run()
      .catch((err) => {
        if (token !== countToken.current) return;
        setPoolCount(null);
        setError(err instanceof Error ? err.message : "出題の準備に失敗しました");
      })
      .finally(() => {
        if (token === countToken.current) setCounting(false);
      });
  }, [phase, sourceId, filters, filtersReady]);

  useEffect(() => {
    if (phase !== "answer" || !item) return;
    let alive = true;
    setAnswer(undefined);
    setAnswerError(null);
    getWord(item.id)
      .then((word) => {
        if (alive) setAnswer(word);
      })
      .catch((err) => {
        if (!alive) return;
        setAnswer(null);
        setAnswerError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      alive = false;
    };
  }, [phase, item]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const chooseSource = (next: string | null) => {
    if (next === sourceId) return;
    setSourceId(next);
    setPoolCount(null);
    setCounting(true);
    setListMissing(false);
    setError(null);
  };

  const begin = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let items: WordListItem[] = [];
      if (sourceId === QUIZ_SOURCE_REVIEW) {
        const total = await countReviewDeckWords();
        setPoolTotal(total);
        setPoolCount(total);
        items = await reviewDeckWords(Math.min(size, total));
      } else {
        const resting = await restingForQuiz(sourceId);
        const restingSet = new Set(resting);
        if (sourceId === null) {
          const total = await countQuizWords(filters);
          const available = await countQuizWords(filters, resting);
          setPoolTotal(total);
          setPoolCount(available);
          items = await sampleQuizWords(filters, Math.min(size, available), resting);
        } else {
          const words = await eligibleListWords(sourceId);
          if (!words) {
            setListMissing(true);
            setPoolTotal(0);
            setPoolCount(0);
            setPhase("setup");
            return;
          }
          const eligible = words.filter((word) => !restingSet.has(word.id));
          setPoolTotal(words.length);
          setPoolCount(eligible.length);
          items = shuffle(eligible).slice(0, Math.min(size, eligible.length));
        }
      }
      if (!items.length) {
        setPoolCount(0);
        setPhase("setup");
        return;
      }
      setDeck(items);
      setIndex(0);
      setPhase("prompt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "出題の準備に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (index + 1 >= deck.length) setPhase("done");
    else {
      setIndex((current) => current + 1);
      setPhase("prompt");
    }
  };

  const finishMark = async (known: boolean) => {
    if (!item || marking) return;
    setMarking(true);
    setAnswerError(null);
    try {
      if (known) {
        await markKnown(item.id);
      } else {
        await markUnknown(item.id);
        const remaining = deck.slice(index + 1);
        const alreadyQueued = remaining.some((word) => word.id === item.id);
        if (!alreadyQueued) setDeck((current) => [...current, item]);
      }
      advance();
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setMarking(false);
    }
  };

  const title = phase === "answer" ? "答え" : "クイズ";
  const leaveLabel = paramListId ? "リストへ戻る" : "一覧へ戻る";
  const selectedList = bookmarkLists.find((list) => list.id === sourceId);
  const take = poolCount == null ? size : Math.min(size, poolCount);
  const isReview = sourceId === QUIZ_SOURCE_REVIEW;
  const emptyLabel =
    isReview
      ? "復習する語はありません"
      : poolTotal != null && poolTotal > 0 && poolCount === 0
        ? "出題できる語は、いま休みの学習印だけです。「復習」から出題できます。"
        : "日本語訳のある単語がありません";
  const poolLabel = isReview
    ? `復習対象の ${poolCount == null ? "…" : poolCount.toLocaleString()} 語から`
    : `日本語訳のある ${poolCount == null ? "…" : poolCount.toLocaleString()} 語から`;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title }} />
      {phase === "setup" ? (
        <ScrollView contentContainerStyle={styles.setup}>
          <AppText style={styles.label}>出題元</AppText>
          <View style={styles.chipRow}>
            <Chip label="今の絞り込み" selected={sourceId === null} onPress={() => chooseSource(null)} />
            <Chip
              label="復習"
              selected={sourceId === QUIZ_SOURCE_REVIEW}
              onPress={() => chooseSource(QUIZ_SOURCE_REVIEW)}
            />
            {bookmarkLists.map((list) => (
              <Chip
                key={list.id}
                label={list.name}
                selected={sourceId === list.id}
                onPress={() => chooseSource(list.id)}
              />
            ))}
          </View>
          {sourceId === null ? (
            <AppText style={styles.summary}>{describeFilters(filters, posOptions)}</AppText>
          ) : isReview ? (
            <AppText style={styles.summary}>学習印の復習</AppText>
          ) : (
            <AppText style={styles.summary}>{selectedList?.name ?? "リスト"}</AppText>
          )}
          {listsNote ? <AppText style={styles.error}>{listsNote}</AppText> : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {counting && poolCount === null ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : listMissing ? (
            <View style={styles.emptyBlock}>
              <AppText style={styles.empty}>このリストは見つかりません</AppText>
              <Pressable accessibilityRole="button" onPress={leave} style={styles.textBtn}>
                <AppText style={styles.textBtnLabel}>{leaveLabel}</AppText>
              </Pressable>
            </View>
          ) : poolCount === 0 ? (
            <View style={styles.emptyBlock}>
              <AppText style={styles.empty}>{emptyLabel}</AppText>
              <Pressable accessibilityRole="button" onPress={leave} style={styles.textBtn}>
                <AppText style={styles.textBtnLabel}>{leaveLabel}</AppText>
              </Pressable>
            </View>
          ) : (
            <>
              <AppText style={styles.count}>{poolLabel}</AppText>
              <AppText style={styles.label}>語数</AppText>
              <View style={styles.chipRow}>
                {SIZES.map((option) => (
                  <Chip
                    key={option}
                    label={String(option)}
                    selected={size === option}
                    onPress={() => setSize(option)}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={counting || busy || !poolCount}
                onPress={() => void begin()}
                style={[styles.primary, (counting || busy || !poolCount) && styles.primaryOff]}
              >
                <AppText style={styles.primaryText}>{busy ? "準備しています" : `${take}語ではじめる`}</AppText>
              </Pressable>
            </>
          )}
        </ScrollView>
      ) : null}

      {phase === "prompt" && item ? (
        <View style={styles.stage}>
          <ScrollView contentContainerStyle={styles.prompt}>
            <AppText style={styles.progress}>
              {index + 1} / {deck.length}
            </AppText>
            <AppText style={styles.lemma}>{item.lemma}</AppText>
            <AppText style={styles.pos}>{posLabel(item.pos)}</AppText>
            {formatIpa(item.ipa) ? <AppText style={styles.ipa}>{formatIpa(item.ipa)}</AppText> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={advance} style={styles.textBtn}>
              <AppText style={styles.textBtnLabel}>飛ばす</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPhase("answer")}
              style={[styles.primary, styles.footerPrimary]}
            >
              <AppText style={styles.primaryText}>答えを見る</AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === "answer" && item ? (
        <View style={styles.stage}>
          <ScrollView contentContainerStyle={styles.answer}>
            <AppText style={styles.progress}>
              {index + 1} / {deck.length}
            </AppText>
            <AppText style={styles.lemma}>{item.lemma}</AppText>
            <AppText style={styles.pos}>{posLabel(item.pos)}</AppText>
            <Pronunciation detail={answer} fallback={item.ipa} />
            <WordListControls {...wordLists} />
            {answerError ? <AppText style={styles.error}>{answerError}</AppText> : null}
            <AnswerBody item={item} detail={answer} />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/word/[id]", params: { id: item.id } })}
              style={styles.detailLink}
            >
              <AppText style={styles.detailLinkText}>詳細</AppText>
            </Pressable>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={() => setPhase("prompt")} style={styles.textBtn}>
              <AppText style={styles.textBtnLabel}>問題に戻る</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={marking}
              onPress={() => void finishMark(false)}
              style={[styles.secondary, styles.footerSecondary, marking && styles.primaryOff]}
            >
              <AppText style={styles.secondaryText}>知らない</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={marking}
              onPress={() => void finishMark(true)}
              style={[styles.primary, styles.footerPrimary, marking && styles.primaryOff]}
            >
              <AppText style={styles.primaryText}>{marking ? "保存中…" : "知っている"}</AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === "done" ? (
        <View style={styles.done}>
          <AppText style={styles.doneTitle}>{deck.length}語見終わりました</AppText>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void begin()}
            style={[styles.primary, styles.donePrimary, busy && styles.primaryOff]}
          >
            <AppText style={styles.primaryText}>{busy ? "準備しています" : "もう一度"}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={leave} style={styles.textBtn}>
            <AppText style={styles.textBtnLabel}>{leaveLabel}</AppText>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Pronunciation({ detail, fallback }: { detail: WordDetail | null | undefined; fallback: string | null }) {
  const fromDetail = detail ? formatPronunciations(detail.ipaMap) : "";
  const text = fromDetail || formatIpa(fallback);
  if (!text) return null;
  return <AppText style={styles.ipa}>{text}</AppText>;
}

function AnswerBody({ item, detail }: { item: WordListItem; detail: WordDetail | null | undefined }) {
  if (detail === undefined) {
    return <ActivityIndicator color={colors.accent} style={styles.spinner} />;
  }
  const senses = detail?.senses.length
    ? detail.senses
    : [{ gloss_ja: (detail ?? item).gloss_ja, gloss_en: (detail ?? item).gloss_en }];
  const visible = senses.filter((sense) => sense.gloss_ja || sense.gloss_en);
  const examples = (detail?.examples ?? []).slice(0, 2);
  return (
    <>
      <View style={styles.senses}>
        {visible.length ? (
          visible.map((sense, senseIndex) => (
            <View key={`${sense.gloss_en}-${senseIndex}`} style={styles.block}>
              {sense.gloss_ja ? <AppText style={styles.ja}>{sense.gloss_ja}</AppText> : null}
              {sense.gloss_en ? <AppText style={styles.en}>{sense.gloss_en}</AppText> : null}
            </View>
          ))
        ) : (
          <AppText style={styles.empty}>意味データがありません</AppText>
        )}
      </View>
      {examples.length ? (
        <>
          <AppText style={styles.heading}>例文</AppText>
          {examples.map((example) => (
            <View key={`${example.sentence_id}-${example.en}`} style={styles.block}>
              <AppText style={styles.en}>{example.en}</AppText>
              {example.ja ? <AppText style={styles.ja}>{example.ja}</AppText> : null}
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
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  setup: { padding: 16, paddingBottom: 40 },
  label: { color: colors.muted, marginTop: 8, marginBottom: 6, fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    maxWidth: "100%",
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.chipOn },
  chipText: { color: colors.ink, fontSize: 13 },
  chipOnText: { color: colors.chipOnText },
  summary: { color: colors.muted, marginTop: 12, lineHeight: 20 },
  count: { color: colors.ink, marginTop: 8, ...semibold },
  stage: { flex: 1 },
  prompt: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  answer: { padding: 20, paddingBottom: 32 },
  progress: { color: colors.muted, ...semibold },
  lemma: { fontSize: 40, ...extraBold, color: colors.ink, marginTop: 12 },
  pos: { marginTop: 4, color: colors.accent, ...semibold, fontSize: 16 },
  ipa: { marginTop: 6, color: colors.muted },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerPrimary: { flex: 1, marginTop: 0 },
  footerSecondary: { flex: 1, marginTop: 0 },
  secondary: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryText: { color: colors.ink, ...semibold, fontSize: 16 },
  primary: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryOff: { opacity: 0.5 },
  primaryText: { color: "#fff", ...semibold, fontSize: 16 },
  textBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  textBtnLabel: { color: colors.accent, ...semibold },
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
  cite: { marginTop: 8, fontSize: 12, color: colors.muted },
  detailLink: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 8 },
  detailLinkText: { color: colors.accent, ...semibold },
  done: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  doneTitle: { fontSize: 28, ...extraBold, color: colors.ink },
  donePrimary: { alignSelf: "stretch" },
  emptyBlock: { marginTop: 24 },
  empty: { color: colors.muted, lineHeight: 22 },
  spinner: { marginTop: 28 },
  error: { color: "#9B2C2C", marginTop: 12, lineHeight: 20 },
});
