/**
 * Virtuve kitchen — ScanRow: one AI scan result, as an editable card. An include
 * checkbox (on by default), an editable name, category / location / amount
 * pickers and a colour-coded confidence pill. Low-confidence rows show a hint to
 * check the guess. Purely controlled — the parent owns the draft array.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Card, Field, Muted, Pill, Row } from '@src/ui/kit';
import { colors, spacing } from '@src/ui/theme';
import { amountLabel, categoryLabel, locationLabel, L } from '@src/i18n/lv';
import type { AmountLabel, FoodCategory, StorageLocation } from '@src/api/types';
import { EnumPicker } from './EnumPicker';
import { AMOUNT_OPTIONS, CATEGORY_OPTIONS, LOCATION_OPTIONS } from './options';

export interface ScanDraft {
  id: string;
  include: boolean;
  name: string;
  category: FoodCategory;
  location: StorageLocation;
  amount: AmountLabel;
  confidence: number;
}

export function ScanRow({ draft, onChange }: { draft: ScanDraft; onChange: (patch: Partial<ScanDraft>) => void }) {
  const conf = draft.confidence;
  const confColor = conf >= 0.85 ? colors.green : conf >= 0.6 ? colors.yellow : colors.red;
  const low = conf < 0.6;

  return (
    <Card style={{ marginBottom: spacing.sm, opacity: draft.include ? 1 : 0.5 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Pressable onPress={() => onChange({ include: !draft.include })} hitSlop={8}>
          <Row gap={spacing.sm}>
            <Ionicons
              name={draft.include ? 'checkbox' : 'square-outline'}
              size={24}
              color={draft.include ? colors.accent : colors.textFaint}
            />
            <Body>{L.common.add}</Body>
          </Row>
        </Pressable>
        <Pill label={L.scan.confidence(conf)} color={confColor} />
      </Row>

      <Field value={draft.name} onChangeText={(t) => onChange({ name: t })} placeholder={L.kitchen.namePlaceholder} />
      <EnumPicker label={L.kitchen.category} options={CATEGORY_OPTIONS} value={draft.category} labels={categoryLabel} onChange={(v) => onChange({ category: v })} />
      <EnumPicker label={L.kitchen.location} options={LOCATION_OPTIONS} value={draft.location} labels={locationLabel} onChange={(v) => onChange({ location: v })} />
      <EnumPicker label={L.kitchen.amount} options={AMOUNT_OPTIONS} value={draft.amount} labels={amountLabel} onChange={(v) => onChange({ amount: v })} />

      {low ? (
        <Row gap={6}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.red} />
          <Muted style={{ color: colors.red }}>{L.scan.notRight}</Muted>
        </Row>
      ) : null}
    </Card>
  );
}
