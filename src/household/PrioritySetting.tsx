/**
 * PrioritySetting — a labelled 0..3 importance selector (none / low / med / high)
 * built on the kit Segmented. Used in household settings for each priority.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Segmented } from '@src/ui/kit';
import { spacing, type as t } from '@src/ui/theme';

const LEVELS: { value: string; label: string }[] = [
  { value: '0', label: 'Nav' },
  { value: '1', label: 'Zems' },
  { value: '2', label: 'Vidējs' },
  { value: '3', label: 'Augsts' },
];

export function PrioritySetting({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[t.bodyStrong, { marginBottom: 8 }]}>{label}</Text>
      <Segmented options={LEVELS} value={String(value)} onChange={(v) => onChange(Number(v))} />
    </View>
  );
}
