import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { AppText } from "./AppText";
import { clearMark, getMark, markKnown, markUnknown, type WordMark } from "./marks";
import { colors } from "./theme";
import { semibold } from "./typography";

export function useWordMark(wordId: string | undefined) {
  const [mark, setMark] = useState<WordMark | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setMark(undefined);
    setError(null);
    setBusy(false);
  }, [wordId]);

  const reload = useCallback(() => {
    if (!wordId) return;
    const token = generation.current;
    getMark(wordId)
      .then((next) => {
        if (token !== generation.current) return;
        setMark(next);
      })
      .catch(() => {
        if (token !== generation.current) return;
        setError("学習印の読み込みに失敗しました");
        setMark(null);
      });
  }, [wordId]);

  useFocusEffect(
    useCallback(() => {
      if (!wordId) return;
      reload();
    }, [wordId, reload])
  );

  const run = async (task: () => Promise<WordMark | void>) => {
    if (!wordId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      if (result) setMark(result);
      else setMark(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return {
    mark,
    busy,
    error,
    setKnown: () => run(() => markKnown(wordId!)),
    setUnknown: () => run(() => markUnknown(wordId!)),
    clear: () => run(() => clearMark(wordId!)),
  };
}

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn, disabled && styles.chipOff]}
    >
      <AppText style={[styles.chipText, selected && styles.chipOnText]} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function WordMarkControls({
  mark,
  busy,
  error,
  setKnown,
  setUnknown,
  clear,
}: ReturnType<typeof useWordMark>) {
  if (mark === undefined) return null;

  const status = mark?.status ?? null;

  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>学習印</AppText>
      <View style={styles.row}>
        <Chip
          label="知っている"
          selected={status === "known"}
          disabled={busy}
          onPress={() => void setKnown()}
        />
        <Chip
          label="知らない"
          selected={status === "unknown"}
          disabled={busy}
          onPress={() => void setUnknown()}
        />
        {mark ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void clear()} style={styles.clearBtn}>
            <AppText style={[styles.clearLabel, busy && styles.clearOff]}>印を外す</AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, marginBottom: 4 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.chipOn },
  chipOff: { opacity: 0.5 },
  chipText: { color: colors.ink, fontSize: 13, ...semibold },
  chipOnText: { color: colors.chipOnText },
  clearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  clearLabel: { color: colors.accent, ...semibold, fontSize: 13 },
  clearOff: { opacity: 0.5 },
  error: { color: "#9B2C2C", marginTop: 8, lineHeight: 20 },
});