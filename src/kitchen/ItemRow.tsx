/**
 * Virtuve kitchen — ItemRow: one inventory item. Collapsed it shows a freshness
 * dot, the name, the amount (free-text qty if set) + freshness label, and a
 * category tag. Tapping expands inline to actions — use tonight, mark used
 * (all / some), edit the fields, or delete. Self-contained: it runs its own
 * mutations and invalidates the inventory query after each one.
 */
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Field, Muted, Pill, Row } from '@src/ui/kit';
import { colors, freshnessColor, spacing } from '@src/ui/theme';
import { amountLabel, categoryLabel, freshnessLabel, locationLabel, stateLabel, L } from '@src/i18n/lv';
import { markUsed, removeInventoryItem, updateInventoryItem } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useAction } from '@src/ui/useAction';
import type { AmountLabel, FoodCategory, InventoryItem, ItemState, StorageLocation } from '@src/api/types';
import { EnumPicker } from './EnumPicker';
import { AMOUNT_OPTIONS, CATEGORY_OPTIONS, LOCATION_OPTIONS, STATE_OPTIONS } from './options';

type Mode = 'closed' | 'actions' | 'edit';

export function ItemRow({ item, activeId }: { item: InventoryItem; activeId: string }) {
  const [mode, setMode] = useState<Mode>('closed');
  const { run, busy } = useAction();

  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty_text ?? '');
  const [category, setCategory] = useState<FoodCategory>(item.category);
  const [location, setLocation] = useState<StorageLocation>(item.location);
  const [amount, setAmount] = useState<AmountLabel>(item.amount);
  const [state, setState] = useState<ItemState>(item.state);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) });
  const dot = freshnessColor(item.freshness);
  const amountText = item.qty_text?.trim() ? item.qty_text : amountLabel[item.amount];

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
    };
    void run(() => updateInventoryItem(item.id, patch), { onDone: () => { invalidate(); setMode('closed'); } });
  };

  return (
    <View>
      <Pressable
        onPress={() => setMode((m) => (m === 'closed' ? 'actions' : 'closed'))}
        style={({ pressed }) => [{ paddingVertical: spacing.md }, pressed && { opacity: 0.7 }]}
      >
        <Row gap={spacing.md}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
          <View style={{ flex: 1 }}>
            <Body>{item.name}</Body>
            <Row gap={6} style={{ marginTop: 2 }}>
              <Muted>{amountText}</Muted>
              {item.freshness !== 'unknown' ? (
                <>
                  <Muted>·</Muted>
                  <Muted style={{ color: dot }}>{freshnessLabel[item.freshness]}</Muted>
                </>
              ) : null}
            </Row>
          </View>
          <Pill label={categoryLabel[item.category]} />
          <Ionicons name={mode === 'closed' ? 'chevron-down' : 'chevron-up'} size={16} color={colors.textFaint} />
        </Row>
      </Pressable>

      {mode === 'actions' ? (
        <View style={{ paddingBottom: spacing.md, gap: spacing.sm }}>
          <Button label={L.kitchen.useThis} icon="restaurant-outline" onPress={() => router.push('/meals/suggest')} />
          <Muted style={{ marginTop: spacing.xs }}>{L.kitchen.markUsed}</Muted>
          <Row gap={spacing.sm}>
            <Button label={L.kitchen.usedAll} variant="secondary" onPress={() => doMarkUsed('all')} loading={busy} style={{ flex: 1 }} />
            <Button label={L.kitchen.usedSome} variant="secondary" onPress={() => doMarkUsed('some')} loading={busy} style={{ flex: 1 }} />
          </Row>
          <Row gap={spacing.sm} style={{ marginTop: spacing.xs }}>
            <Button label={L.common.edit} variant="ghost" icon="create-outline" onPress={startEdit} style={{ flex: 1 }} />
            <Button label={L.common.delete} variant="danger" icon="trash-outline" onPress={doDelete} loading={busy} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : null}

      {mode === 'edit' ? (
        <View style={{ paddingBottom: spacing.md }}>
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
          <Row gap={spacing.sm}>
            <Button label={L.common.cancel} variant="ghost" onPress={() => setMode('actions')} style={{ flex: 1 }} />
            <Button label={L.common.save} onPress={saveEdit} loading={busy} disabled={!name.trim()} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : null}
    </View>
  );
}
