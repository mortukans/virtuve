/**
 * Horizontal chip picker for a small enum (e.g. food category). Reusable across
 * the shopping + plan features — pass options, the selected value and onChange.
 */
import React from 'react';
import { ScrollView } from 'react-native';
import { Chip } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';

export function EnumPicker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg }}
    >
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}
