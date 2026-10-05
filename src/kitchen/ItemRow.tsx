/**
 * Virtuve kitchen — ItemRow: one inventory item as a pantry grid tile. The tile
 * shows a big food emoji (by category / common name), a freshness ring, the name
 * and the amount + freshness label. Tapping opens a bottom sheet with the item
 * actions — use tonight, mark used (all / some), edit the fields, or delete.
 * Self-contained: it runs its own mutations and invalidates the inventory query
 * after each one. Rendered two-up inside the Kitchen screen's padded grid.
 */
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Button, Field, IconButton, Muted, Row } from '@src/ui/kit';
import { colors, freshnessColor, radius, spacing, type as t } from '@src/ui/theme';
import { amountLabel, categoryLabel, freshnessLabel, locationLabel, stateLabel, L } from '@src/i18n/lv';
import { markUsed, removeInventoryItem, updateInventoryItem } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useAction } from '@src/ui/useAction';
import type { AmountLabel, FoodCategory, InventoryItem, ItemState, StorageLocation } from '@src/api/types';
import { EnumPicker } from './EnumPicker';
import { ExpiryField } from './ExpiryField';
import { AMOUNT_OPTIONS, CATEGORY_OPTIONS, LOCATION_OPTIONS, STATE_OPTIONS } from './options';

type Mode = 'closed' | 'actions' | 'edit';

/** One emoji per food category — the tile's visual anchor. */
const CATEGORY_EMOJI: Record<FoodCategory, string> = {
  produce: '🥬', meat: '🍗', fish: '🐟', dairy: '🥛', bakery: '🍞', pantry_dry: '🌾',
  frozen: '🧊', drinks: '🧃', condiments: '🫙', snacks: '🍪', leftovers: '🍲', other: '🛒',
};

/** A few distinctive items earn their own emoji; otherwise we fall back to the category. */
const NAME_EMOJI: ReadonlyArray<readonly [string, string]> = [
  ['kartupe', '🥔'], ['burkān', '🥕'], ['tomāt', '🍅'], ['gurķ', '🥒'], ['sīpol', '🧅'],
  ['ķiplok', '🧄'], ['ābol', '🍎'], ['banān', '🍌'], ['apelsīn', '🍊'], ['citron', '🍋'],
  ['vīnog', '🍇'], ['zemen', '🍓'], ['sier', '🧀'], ['kafij', '☕'], ['tēj', '🍵'],
  ['olīv', '🫒'], ['makaron', '🍝'], ['šokolād', '🍫'],
];

function foodEmoji(item: InventoryItem): string {
  const name = item.name.toLowerCase();
  for (const [key, emoji] of NAME_EMOJI) if (name.includes(key)) return emoji;
  return CATEGORY_EMOJI[item.category];
}

export function ItemRow({ item, activeId }: { item: InventoryItem; activeId: string }) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('closed');
  const { run, busy } = useAction();

  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty_text ?? '');
  const [category, setCategory] = useState<FoodCategory>(item.category);
  const [location, setLocation] = useState<StorageLocation>(item.location);
  const [amount, setAmount] = useState<AmountLabel>(item.amount);
  const [state, setState] = useState<ItemState>(item.state);
  const [expiresOn, setExpiresOn] = useState<string | null>(item.expires_on);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) });
  const dot = freshnessColor(item.freshness);
  const emoji = foodEmoji(item);
  const amountText = item.qty_text?.trim() ? item.qty_text : amountLabel[item.amount];
  // Two columns within the Screen's horizontal padding (spacing.lg each side) + a spacing.md gutter.
  const tileWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  const doMarkUsed = (how: 'all' | 'some') =>
    run(() => markUsed(item.id, how), { onDone: () => { invalidate(); setMode('closed'); } });

  const doDelete = () =>
    Alert.alert(item.name, undefined, [
      { text: L.common.cancel, style: 'cancel' },
      {
        text: L.common.delete,
        style: 'destructive',
        onPress: () => { void run(() => removeInventoryItem(item.id), { onDone: invalidate }); },
      },
    ]);

  const startEdit = () => {
    setName(item.name);
    setQty(item.qty_text ?? '');
    setCategory(item.category);
    setLocation(item.location);
    setAmount(item.amount);
    setState(item.state);
    setExpiresOn(item.expires_on);
    setMode('edit');
  };

  const saveEdit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const patch: Partial<InventoryItem> = {
      name: trimmed,
      qty_text: qty.trim() ? qty.trim() : null,
      category,
      location,
      amount,
      state,
      expires_on: expiresOn,
    };
    void run(() => updateInventoryItem(item.id, patch), { onDone: () => { invalidate(); setMode('closed'); } });
  };

  return (
    <>
      <Pressable
        onPress={() => setMode('actions')}
        style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      >
        <View style={styles.tileTop}>
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={[styles.ring, { borderColor: dot }]} />
        </View>
        <View>
          <Text style={t.bodyStrong} numberOfLines={2}>{item.name}</Text>
          <Row gap={6} style={{ marginTop: 2, flexWrap: 'wrap' }}>
            <Muted>{amountText}</Muted>
            {item.freshness !== 'unknown' ? (
              <>
                <Muted>·</Muted>
                <Muted style={{ color: dot }}>{freshnessLabel[item.freshness]}</Muted>
              </>
            ) : null}
          </Row>
        </View>
      </Pressable>

      <Modal
        visible={mode !== 'closed'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMode('closed')}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalWrap}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMode('closed')} />
            <View style={styles.sheet}>
              <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }} gap={spacing.sm}>
                <Row gap={spacing.md} style={{ flex: 1 }}>
                  <Text style={styles.sheetEmoji}>{emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={t.bodyStrong} numberOfLines={1}>{item.name}</Text>
                    <Text style={t.small} numberOfLines={1}>{`${categoryLabel[item.category]} · ${amountText}`}</Text>
                  </View>
                </Row>
                <IconButton icon="close" onPress={() => setMode('closed')} />
              </Row>

              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {mode === 'edit' ? (
                  <>
                    <Field label={L.kitchen.name} value={name} onChangeText={setName} placeholder={L.kitchen.namePlaceholder} />
                    <Field
                      label={`${L.kitchen.amount} (${L.common.optional})`}
                      value={qty}
                      onChangeText={setQty}
                      placeholder="piem., ~300 g vai ½ paka"
                    />
                    <EnumPicker label={L.kitchen.category} options={CATEGORY_OPTIONS} value={category} labels={categoryLabel} onChange={setCategory} />
                    <EnumPicker label={L.kitchen.location} options={LOCATION_OPTIONS} value={location} labels={locationLabel} onChange={setLocation} />
                    <EnumPicker label={L.kitchen.amount} options={AMOUNT_OPTIONS} value={amount} labels={amountLabel} onChange={setAmount} />
                    <EnumPicker label={L.kitchen.state} options={STATE_OPTIONS} value={state} labels={stateLabel} onChange={setState} />
                    <ExpiryField value={expiresOn} onChange={setExpiresOn} />
                    <Row gap={spacing.sm} style={{ marginTop: spacing.xs }}>
                      <Button label={L.common.cancel} variant="ghost" onPress={() => setMode('actions')} style={{ flex: 1 }} />
                      <Button label={L.common.save} onPress={saveEdit} loading={busy} disabled={!name.trim()} style={{ flex: 1 }} />
                    </Row>
                  </>
                ) : (
                  <>
                    <Button
                      label={L.kitchen.useThis}
                      icon="restaurant-outline"
                      onPress={() => { setMode('closed'); router.push(`/meals/suggest?focus=${encodeURIComponent(item.name)}`); }}
                    />
                    <Muted style={{ marginTop: spacing.xs }}>{L.kitchen.markUsed}</Muted>
                    <Row gap={spacing.sm}>
                      <Button label={L.kitchen.usedAll} variant="secondary" onPress={() => doMarkUsed('all')} loading={busy} style={{ flex: 1 }} />
                      <Button label={L.kitchen.usedSome} variant="secondary" onPress={() => doMarkUsed('some')} loading={busy} style={{ flex: 1 }} />
                    </Row>
                    <Row gap={spacing.sm} style={{ marginTop: spacing.xs }}>
                      <Button label={L.common.edit} variant="ghost" icon="create-outline" onPress={startEdit} style={{ flex: 1 }} />
                      <Button label={L.common.delete} variant="danger" icon="trash-outline" onPress={doDelete} loading={busy} style={{ flex: 1 }} />
                    </Row>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  emoji: { fontSize: 34, lineHeight: 40 },
  ring: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, marginTop: 4 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetEmoji: { fontSize: 30, lineHeight: 36 },
});
