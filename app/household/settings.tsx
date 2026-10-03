/**
 * Household settings — priorities, cooking love, equipment, budget and tone.
 * Admins edit; everyone else sees a read-only view with a note.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Body, Button, Card, Chip, Field, H2, IconButton, Muted, Row, Screen, SectionHeader, Segmented, Spinner,
} from '@src/ui/kit';
import { colors, spacing } from '@src/ui/theme';
import { L, cookingLoveLabel, equipmentLabel, priorityLabel } from '@src/i18n/lv';
import { updateHousehold } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import type { CookingLove, HouseholdSettings } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { ChoiceList } from '@src/household/ChoiceList';
import { PrioritySetting } from '@src/household/PrioritySetting';

type PriorityKey = keyof HouseholdSettings['priorities'];
type Tone = HouseholdSettings['tone'];

const PRIORITY_KEYS = Object.keys(priorityLabel) as PriorityKey[];
const EQUIPMENT_KEYS = Object.keys(equipmentLabel);
const COOKING_LOVE_KEYS = Object.keys(cookingLoveLabel) as CookingLove[];

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'neutral', label: L.household.toneNeutral },
  { value: 'friendly', label: L.household.toneFriendly },
  { value: 'humor', label: L.household.toneHumor },
];

interface Form {
  name: string;
  priorities: HouseholdSettings['priorities'];
  cooking_love: CookingLove;
  equipment: string[];
  budgetOn: boolean;
  budgetText: string;
  tone: Tone;
}

export default function HouseholdSettingsScreen() {
  const { household, activeId, isLoading } = useHouseholdCtx();
  const qc = useQueryClient();
  const { run, busy } = useAction();

  const canEdit = household?.my_role === 'admin';

  const [form, setForm] = useState<Form | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (household && !initialized.current) {
      initialized.current = true;
      const s = household.settings;
      setForm({
        name: household.name,
        priorities: { ...s.priorities },
        cooking_love: s.cooking_love,
        equipment: [...s.equipment],
        budgetOn: s.weekly_budget != null,
        budgetText: s.weekly_budget != null ? String(s.weekly_budget) : '',
        tone: s.tone,
      });
    }
  }, [household]);

  if (isLoading || !form || !household || !activeId) {
    return <Screen><Spinner label={L.common.loading} /></Screen>;
  }

  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const toggleEquipment = (k: string) =>
    patch({ equipment: form.equipment.includes(k) ? form.equipment.filter((x) => x !== k) : [...form.equipment, k] });

  const save = () => {
    const budget = form.budgetOn ? Number.parseFloat(form.budgetText.replace(',', '.')) : NaN;
    const settings: HouseholdSettings = {
      priorities: form.priorities,
      cooking_love: form.cooking_love,
      equipment: form.equipment,
      weekly_budget: form.budgetOn && Number.isFinite(budget) ? budget : null,
      tone: form.tone,
    };
    void run(() => updateHousehold(activeId, { name: form.name.trim() || household.name, settings }), {
      onDone: () => {
        void qc.invalidateQueries({ queryKey: qk.household(activeId) });
        void qc.invalidateQueries({ queryKey: qk.households });
        router.back();
      },
    });
  };

  return (
    <Screen scroll>
      <Row gap={spacing.sm} style={{ marginBottom: spacing.sm }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <H2>{L.household.settings}</H2>
      </Row>

      {!canEdit ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Muted>{L.errors.not_admin}</Muted>
        </Card>
      ) : null}

      <View pointerEvents={canEdit ? 'auto' : 'none'} style={!canEdit ? { opacity: 0.6 } : undefined}>
        <Field label={L.household.title} value={form.name} onChangeText={(v) => patch({ name: v })} editable={canEdit} />

        <SectionHeader title={L.household.priorities} />
        {PRIORITY_KEYS.map((k) => (
          <PrioritySetting
            key={k}
            label={priorityLabel[k]}
            value={form.priorities[k]}
            onChange={(v) => patch({ priorities: { ...form.priorities, [k]: v } })}
          />
        ))}

        <SectionHeader title={L.onboarding.cookingLoveTitle} />
        <ChoiceList<CookingLove>
          options={COOKING_LOVE_KEYS.map((k) => ({ value: k, label: cookingLoveLabel[k] }))}
          value={form.cooking_love}
          onChange={(v) => patch({ cooking_love: v })}
        />

        <SectionHeader title={L.household.equipment} />
        <View style={styles.wrap}>
          {EQUIPMENT_KEYS.map((k) => (
            <Chip key={k} label={equipmentLabel[k]} selected={form.equipment.includes(k)} onPress={() => toggleEquipment(k)} />
          ))}
        </View>

        <SectionHeader title={L.household.budget} />
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Body>{form.budgetOn ? L.household.budget : L.household.budgetOff}</Body>
          <Switch
            value={form.budgetOn}
            onValueChange={(v) => patch({ budgetOn: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.text}
          />
        </Row>
        {form.budgetOn ? (
          <Field
            value={form.budgetText}
            onChangeText={(v) => patch({ budgetText: v })}
            placeholder="€ / nedēļā"
            keyboardType="numeric"
            editable={canEdit}
          />
        ) : null}

        <SectionHeader title={L.household.tone} />
        <Segmented<Tone> options={TONE_OPTIONS} value={form.tone} onChange={(v) => patch({ tone: v })} />
      </View>

      {canEdit ? (
        <Button label={L.common.save} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
