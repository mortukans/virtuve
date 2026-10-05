/**
 * Virtuve kitchen — ManualAddForm: add one product by hand. Collects a name plus
 * category / location / amount and emits an InventoryDraft (source 'manual').
 * The parent runs the mutation; a resolved `true` resets the form so the user
 * can keep adding without it closing.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Field } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';
import { amountLabel, categoryLabel, locationLabel, L } from '@src/i18n/lv';
import type { AmountLabel, FoodCategory, InventoryDraft, StorageLocation } from '@src/api/types';
import { EnumPicker } from './EnumPicker';
import { ExpiryField } from './ExpiryField';
import { AMOUNT_OPTIONS, CATEGORY_OPTIONS, LOCATION_OPTIONS } from './options';

export function ManualAddForm({
  onAdd,
  busy,
  onCancel,
}: {
  onAdd: (draft: InventoryDraft) => Promise<boolean>;
  busy?: boolean;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('produce');
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [amount, setAmount] = useState<AmountLabel>('some');
  const [expiresOn, setExpiresOn] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await onAdd({ name: trimmed, category, location, amount, expires_on: expiresOn, source: 'manual' });
    if (ok) {
      setName('');
      setAmount('some');
      setExpiresOn(null);
    }
  };

  return (
    <View>
      <Field
        label={L.kitchen.name}
        value={name}
        onChangeText={setName}
        placeholder={L.kitchen.namePlaceholder}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <EnumPicker label={L.kitchen.category} options={CATEGORY_OPTIONS} value={category} labels={categoryLabel} onChange={setCategory} />
      <EnumPicker label={L.kitchen.location} options={LOCATION_OPTIONS} value={location} labels={locationLabel} onChange={setLocation} />
      <EnumPicker label={L.kitchen.amount} options={AMOUNT_OPTIONS} value={amount} labels={amountLabel} onChange={setAmount} />
      <ExpiryField value={expiresOn} onChange={setExpiresOn} />
      <Button label={L.common.add} icon="add" onPress={submit} loading={busy} disabled={!name.trim()} />
      {onCancel ? <Button label={L.common.cancel} variant="ghost" onPress={onCancel} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}
