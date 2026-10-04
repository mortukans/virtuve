/**
 * Household settings — priorities, cooking love, equipment, budget and tone.
 * Admins edit; everyone else sees a read-only view with a note. Any member can
 * leave the household from the bottom of the screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Body, Button, Card, Chip, Divider, Field, H2, IconButton, Muted, Row, Screen, SectionLabel, Segmented, Spinner,
} from '@src/ui/kit';
import { colors, spacing } from '@src/ui/theme';
import { L, cookingLoveLabel, equipmentLabel, priorityLabel } from '@src/i18n/lv';
import { leaveHousehold, updateHousehold } from '@src/api/rpc';
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

  const confirmLeave = () => {
    Alert.alert('', `${L.household.leave}?`, [
      { text: L.common.cancel, style: 'cancel' },
      {
        text: L.household.leave,
        style: 'destructive',
        onPress: () => {
          void run(() => leaveHousehold(activeId), {
            onDone: () => {
              void qc.invalidateQueries({ queryKey: qk.households });
              router.back();
            },
          });
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Row style={{ marginBottom: spacing.lg }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <H2>{L.household.settings}</H2>
      </Row>

      {!canEdit ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Muted>{L.errors.not_admin}</Muted>
        </Card>
      ) : null}

      <View pointerEvents={canEdit ? 'auto' : 'none'} style={!canEdit ? { opacity: 0.6 } : undefined}>
        <SectionLabel style={styles.sec}>{L.household.title}</SectionLabel>
        <Field value={form.name} onChangeText={(v) => patch({ name: v })} editable={canEdit} placeholder={L.household.namePlaceholder} />

        <SectionLabel style={styles.sec}>{L.household.priorities}</SectionLabel>
        <Card>
          {PRIORITY_KEYS.map((k) => (
            <PrioritySetting
              key={k}
              label={priorityLabel[k]}
              value={form.priorities[k]}
              onChange={(v) => patch({ priorities: { ...form.priorities, [k]: v } })}
            />
          ))}
        </Card>

        <SectionLabel style={styles.sec}>{L.onboarding.cookingLoveTitle}</SectionLabel>
        <ChoiceList<CookingLove>
          options={COOKING_LOVE_KEYS.map((k) => ({ value: k, label: cookingLoveLabel[k] }))}
          value={form.cooking_love}
          onChange={(v) => patch({ cooking_love: v })}
        />

        <SectionLabel style={styles.sec}>{L.household.equipment}</SectionLabel>
        <View style={styles.wrap}>
          {EQUIPMENT_KEYS.map((k) => (
            <Chip key={k} label={equipmentLabel[k]} selected={form.equipment.includes(k)} onPress={() => toggleEquipment(k)} />
          ))}
        </View>

        <SectionLabel style={styles.sec}>{L.household.budget}</SectionLabel>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
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
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </Card>

        <SectionLabel style={styles.sec}>{L.household.tone}</SectionLabel>
        <Segmented<Tone> options={TONE_OPTIONS} value={form.tone} onChange={(v) => patch({ tone: v })} />
      </View>

      {canEdit ? (
        <Button label={L.common.save} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
      ) : null}

      <Divider />
      <Button variant="danger" icon="exit-outline" label={L.household.leave} onPress={confirmLeave} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sec: { marginTop: spacing.xl, marginBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
