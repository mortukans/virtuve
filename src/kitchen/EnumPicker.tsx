/**
 * Virtuve kitchen — EnumPicker: pick one value from a small enum as a horizontal
 * row of Chips, driven by one of the i18n label maps (category / location /
 * amount / state). Self-contained and reused across the kitchen screens.
 */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Muted } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';

export function EnumPicker<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
}: {
  label?: string;
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Muted style={{ marginBottom: 6 }}>{label}</Muted> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}
      >
        {options.map((o) => (
          <Chip key={o} label={labels[o]} selected={o === value} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}
