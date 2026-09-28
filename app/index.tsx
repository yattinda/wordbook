import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { listPosValues, listSpreadPage, listWords } from "../src/db";
import { freshSpreadCursor, type SpreadCursor } from "../src/spread";
import {
  bandLabel,
  bandSummary,
  comparePos,
  domainLabel,
  domainSummary,
  isAllSelected,
  posLabel,
  toggleChoice,
} from "../src/labels";
import { loadFilters, saveFilters } from "../src/storage";
import { AppText, AppTextInput } from "../src/AppText";
import { colors } from "../src/theme";
import { bold, jaBody, semibold } from "../src/typography";
import {
  APP_BANDS,
  DOMAINS,
  defaultFilters,
  type Filters,
  type WordListItem,
} from "../src/types";

const PAGE = 80;

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
      <AppText style={[styles.chipText, selected && styles.chipOnText]}>{label}</AppText>
    </Pressable>
  );
}

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

export default function ListScreen() {
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [items, setItems] = useState<WordListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [posOptions, setPosOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spreadRef = useRef<SpreadCursor>(freshSpreadCursor());
  const spreadSeedRef = useRef(1);
  const requestRef = useRef(0);
  const pagingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadFilters().then((stored) => {
        if (!alive) return;
        const next = stored.cefr.length ? { ...stored, cefr: [] } : stored;
        if (stored.cefr.length) void saveFilters(next);
        setFilters((current) => ({ ...next, query: current.query }));
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  useEffect(() => {
    listPosValues()
      .then(setPosOptions)
      .catch(() => setPosOptions([]));
  }, []);

  const load = useCallback(async (next: Filters, offset = 0, append = false) => {
    if (append && pagingRef.current) return;
    pagingRef.current = true;
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    const browsing = next.query.trim().length === 0;
    if (browsing && !append) {
      spreadSeedRef.current = (Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0;
      spreadRef.current = freshSpreadCursor();
    }
    try {
      if (browsing) {
        const result = await listSpreadPage(next, spreadRef.current, spreadSeedRef.current);
        if (requestId !== requestRef.current) return;
        spreadRef.current = result.cursor;
        setTotal(result.total);
        setHasMore(result.hasMore);
        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      } else {
        const result = await listWords(next, PAGE, offset);
        if (requestId !== requestRef.current) return;
        const loaded = (append ? offset : 0) + result.items.length;
        setTotal(result.total);
        setHasMore(loaded < result.total);
        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      }
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      if (requestId === requestRef.current) {
        pagingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      load(filters, 0, false);
    }, filters.query ? 200 : 0);
    return () => clearTimeout(handle);
  }, [filters, load]);

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      void saveFilters(next);
      return next;
    });
  };

  const orderedPos = useMemo(() => [...posOptions].sort(comparePos), [posOptions]);

  const filterSummary = useMemo(() => {
    const parts = [
      bandSummary(filters.bands),
      domainSummary(filters.domains),
      filters.pos.length && !isAllSelected(filters.pos, orderedPos)
        ? [...filters.pos].sort(comparePos).map(posLabel).join("・")
        : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }, [filters, orderedPos]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.searchRow}>
        <AppTextInput
          value={filters.query}
          onChangeText={(query) => updateFilters({ query })}
          placeholder="単語・日本語・定義で検索"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        <Link href="/settings" asChild>
          <Pressable style={styles.iconBtn}>
            <AppText style={styles.iconBtnText}>設定</AppText>
          </Pressable>
        </Link>
      </View>
      <Pressable onPress={() => setShowFilters((value) => !value)} style={styles.summary}>
        <AppText style={styles.summaryText}>
          {total.toLocaleString()} 語 · {filterSummary}
        </AppText>
        <AppText style={styles.summaryToggle}>{showFilters ? "閉じる" : "絞り込み"}</AppText>
      </Pressable>
      {showFilters ? (
        <View style={styles.filters}>
          <AppText style={styles.filterLabel}>レベル</AppText>
          <View style={styles.chipRow}>
            <Chip
              label="すべて"
              selected={isAllSelected(filters.bands, APP_BANDS)}
              onPress={() => updateFilters({ bands: [] })}
            />
            {APP_BANDS.map((band) => (
              <Chip
                key={band}
                label={bandLabel(band)}
                selected={filters.bands.includes(band)}
                onPress={() => updateFilters({ bands: toggleChoice(filters.bands, band, APP_BANDS) })}
              />
            ))}
          </View>
          <AppText style={styles.filterLabel}>分野</AppText>
          <View style={styles.chipRow}>
            <Chip
              label="すべて"
              selected={isAllSelected(filters.domains, DOMAINS)}
              onPress={() => updateFilters({ domains: [] })}
            />
            {DOMAINS.map((domain) => (
              <Chip
                key={domain}
                label={domainLabel(domain)}
                selected={filters.domains.includes(domain)}
                onPress={() => updateFilters({ domains: toggleChoice(filters.domains, domain, DOMAINS) })}
              />
            ))}
          </View>
          <AppText style={styles.filterLabel}>品詞</AppText>
          <View style={styles.chipRow}>
            <Chip
              label="すべて"
              selected={isAllSelected(filters.pos, orderedPos)}
              onPress={() => updateFilters({ pos: [] })}
            />
            {orderedPos.map((pos) => (
              <Chip
                key={pos}
                label={posLabel(pos)}
                selected={filters.pos.includes(pos)}
                onPress={() => updateFilters({ pos: toggleChoice(filters.pos, pos, orderedPos) })}
              />
            ))}
          </View>
        </View>
      ) : null}
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!loadingMore && hasMore && items.length < total) {
              void load(filters, items.length, true);
            }
          }}
          ListEmptyComponent={<AppText style={styles.empty}>該当する単語がありません</AppText>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} /> : null}
          renderItem={({ item }) => {
            const pronunciation = formatIpa(item.ipa);
            const pos = posLabel(item.pos);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.lemma} ${pos}`}
                style={styles.card}
                onPress={() => router.push({ pathname: "/word/[id]", params: { id: item.id } })}
              >
                <View style={styles.cardTop}>
                  <AppText style={styles.lemma}>{item.lemma}</AppText>
                  <AppText style={styles.pos}>{pos}</AppText>
                </View>
                {pronunciation ? <AppText style={styles.meta}>{pronunciation}</AppText> : null}
                <AppText style={styles.gloss} numberOfLines={2}>
                  {firstGloss(item.gloss_ja) || firstGloss(item.gloss_en) || "（訳なし）"}
                </AppText>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  search: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  iconBtn: {
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  iconBtnText: { color: colors.accent, ...semibold },
  summary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryText: { color: colors.muted, flex: 1, paddingRight: 8 },
  summaryToggle: { color: colors.accent, ...semibold },
  filters: { paddingHorizontal: 16, paddingBottom: 8 },
  filterLabel: { color: colors.muted, marginTop: 8, marginBottom: 6, fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.chipOn },
  chipText: { color: colors.ink, fontSize: 13 },
  chipOnText: { color: colors.chipOnText },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  lemma: { fontSize: 22, ...bold, color: colors.ink, flex: 1, paddingRight: 8 },
  pos: { color: colors.accent, ...semibold },
  meta: { color: colors.muted, marginTop: 4 },
  gloss: { color: colors.ink, marginTop: 8, fontSize: 15, lineHeight: 22, ...jaBody },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  spinner: { marginTop: 40 },
  error: { color: "#9B2C2C", paddingHorizontal: 16 },
});
