/**
 * ChoiceList — a clean single-select vertical list. Each option is a tappable
 * row with an optional hint and a radio/check indicator. Used for "how much do
 * you like cooking?", "who do you cook for?" etc.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { tap } from '@src/ui/haptics';

export function ChoiceList<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { tap(); onChange(o.value); }}
            style={[styles.row, on ? styles.on : null]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[t.body, on && { color: colors.accentText, fontWeight: '700' }]}>{o.label}</Text>
              {o.hint ? (
                <Text style={[t.small, { marginTop: 2 }, on && { color: colors.accentText }]}>{o.hint}</Text>
              ) : null}
            </View>
            <Ionicons
              name={on ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={on ? colors.accentText : colors.textFaint}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
});
