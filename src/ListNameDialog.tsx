import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, AppTextInput } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { colors } from "./theme";
import { bold, semibold } from "./typography";

export function ListNameDialog({
  visible,
  title,
  initialName,
  confirmLabel,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initialName: string;
  confirmLabel: string;
  error: string | null;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [hideError, setHideError] = useState(false);
  const canSubmit = name.trim().length > 0 && !busy;

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setBusy(false);
  }, [visible, initialName]);

  useEffect(() => {
    setHideError(false);
  }, [error]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText style={styles.title}>{title}</AppText>
      <AppTextInput
        value={name}
        onChangeText={(value) => {
          setName(value);
          setHideError(true);
        }}
        placeholder="リストの名前"
        placeholderTextColor={colors.muted}
        autoFocus={visible}
        selectTextOnFocus
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => {
          void submit();
        }}
        style={styles.input}
      />
      {!hideError && error ? <AppText style={styles.error}>{error}</AppText> : null}
      <View style={styles.actions}>
        <Pressable onPress={onClose} style={styles.quiet}>
          <AppText style={styles.quietText}>キャンセル</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => {
            void submit();
          }}
          style={[styles.confirm, !canSubmit && styles.confirmOff]}
        >
          <AppText style={styles.confirmText}>{confirmLabel}</AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, ...bold, color: colors.ink, marginBottom: 12 },
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
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  quiet: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  quietText: { color: colors.muted, ...semibold },
  confirm: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  confirmOff: { opacity: 0.4 },
  confirmText: { color: "#fff", ...semibold },
});
