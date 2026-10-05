/**
 * Virtuve kitchen — ExpiryField: set a product's "derīgs līdz" date. Quick preset
 * chips (3 dienas / nedēļa / …) cover the common cases; "Cits datums" opens the
 * native date picker for an exact date. The freshness ring is derived server-side
 * from this date (see private.eff_freshness), so we preview the same buckets here.
 * Value is an ISO 'YYYY-MM-DD' string, or null for no expiry.
 */
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, Chip, Muted, Row } from '@src/ui/kit';
import { colors, freshnessColor, radius, spacing, type as t } from '@src/ui/theme';
import { freshnessLabel, L } from '@src/i18n/lv';
import { plusDaysISO } from '@src/meals/helpers';
import type { Freshness } from '@src/api/types';

/** Local calendar date → 'YYYY-MM-DD' (local parts, not UTC, so the picked day is exact). */
const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const fmt = (s: string): string => {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
};

/** Client preview of private.eff_freshness: <today expired, ≤+1 today, ≤+3 soon, else fresh. */
const effFreshness = (iso: string): Freshness => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = fromISO(iso);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 1) return 'use_today';
  if (diff <= 3) return 'use_soon';
  return 'fresh';
};

const PRESETS: { label: string; days: number }[] = [
  { label: L.kitchen.expiry3d, days: 3 },
  { label: L.kitchen.expiryWeek, days: 7 },
  { label: L.kitchen.expiry2w, days: 14 },
  { label: L.kitchen.expiryMonth, days: 30 },
];

export function ExpiryField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [show, setShow] = useState(false);
  const fresh = value ? effFreshness(value) : null;

  const onPick = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'dismissed') return;
    if (date) onChange(toISO(date));
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Muted style={{ marginBottom: 6 }}>{L.kitchen.expiresOn}</Muted>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={L.kitchen.expiryNone} selected={!value} onPress={() => { onChange(null); setShow(false); }} />
        {PRESETS.map((p) => {
          const iso = plusDaysISO(p.days);
          return <Chip key={p.days} label={p.label} selected={value === iso} onPress={() => { onChange(iso); setShow(false); }} />;
        })}
        <Chip label={L.kitchen.expiryOther} icon="calendar-outline" selected={show} onPress={() => setShow((s) => !s)} />
      </Row>

      {value ? (
        <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
          <Text style={t.bodyStrong}>{fmt(value)}</Text>
          {fresh && fresh !== 'fresh' ? (
            <Text style={[t.small, { color: freshnessColor(fresh) }]}>{`· ${freshnessLabel[fresh]}`}</Text>
          ) : null}
        </Row>
      ) : null}

      {show ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={value ? fromISO(value) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            textColor={colors.text}
            onChange={onPick}
          />
          {Platform.OS === 'ios' ? (
            <Button label={L.common.done} variant="secondary" full={false} onPress={() => setShow(false)} style={{ marginTop: spacing.xs }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  picker: {
    marginTop: spacing.sm,
    alignItems: 'center' as const,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
};
