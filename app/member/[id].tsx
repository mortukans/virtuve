/**
 * Member profile editor. Self is always editable; editing others / children
 * requires admin. Allergies and "never" are hard blocks in recipe generation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Body, Button, Card, Chip, EmptyState, Field, H2, IconButton, Muted, Row, Screen, SectionHeader, Segmented, Spinner,
} from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
import { L, dietLabel, portionLabel, roleLabel } from '@src/i18n/lv';
import { removeMember, updateMember } from '@src/api/rpc';
import type { MemberPatch } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import type { MemberPrefs, MemberRole, Portion } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useUserId } from '@src/auth/store';
import { useAction } from '@src/ui/useAction';
import { ChipEditor } from '@src/household/ChipEditor';

const DEFAULT_PREFS: MemberPrefs = { likes: [], dislikes: [], never: [], allergies: [], cuisines: [], diet: [] };
const DIET_KEYS = Object.keys(dietLabel);

const PORTION_OPTIONS: { value: Portion; label: string }[] = (['small', 'normal', 'large'] as Portion[])
  .map((p) => ({ value: p, label: portionLabel[p] }));
const ROLE_OPTIONS: { value: MemberRole; label: string }[] = (['admin', 'member', 'child'] as MemberRole[])
  .map((r) => ({ value: r, label: roleLabel[r] }));

interface Form {
  display_name: string;
  portion: Portion;
  eats_by_default: boolean;
  role: MemberRole;
  prefs: MemberPrefs;
}

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, activeId, isLoading } = useHouseholdCtx();
  const uid = useUserId();
  const qc = useQueryClient();
  const { run, busy } = useAction();

  const member = household?.members?.find((m) => m.id === id);
  const myRole = household?.my_role;
  const isSelf = !!member?.user_id && member.user_id === uid;
  const isAdmin = myRole === 'admin';
  const canEdit = isSelf || isAdmin;

  const [form, setForm] = useState<Form | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (member && !initialized.current) {
      initialized.current = true;
      setForm({
        display_name: member.display_name,
        portion: member.portion,
        eats_by_default: member.eats_by_default,
        role: member.role,
        prefs: { ...DEFAULT_PREFS, ...member.prefs },
      });
    }
  }, [member]);

  if (isLoading || !household) return <Screen><Spinner label={L.common.loading} /></Screen>;
  if (!member) {
    return (
      <Screen>
        <EmptyState icon="person-outline" title={L.common.error} action={L.common.back} onAction={() => router.back()} />
      </Screen>
    );
  }
  if (!form) return <Screen><Spinner label={L.common.loading} /></Screen>;

  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const setPref = <K extends keyof MemberPrefs>(key: K, value: MemberPrefs[K]) =>
    setForm((f) => (f ? { ...f, prefs: { ...f.prefs, [key]: value } } : f));
  const toggleDiet = (k: string) =>
    setPref('diet', form.prefs.diet.includes(k) ? form.prefs.diet.filter((x) => x !== k) : [...form.prefs.diet, k]);

  const save = () => {
    const body: MemberPatch = {
      display_name: form.display_name.trim() || member.display_name,
      portion: form.portion,
      eats_by_default: form.eats_by_default,
      prefs: form.prefs,
    };
    if (isAdmin) body.role = form.role;
    void run(() => updateMember(member.id, body), {
      onDone: () => {
        void qc.invalidateQueries({ queryKey: qk.household(activeId as string) });
        router.back();
      },
    });
  };

  const remove = () => {
    Alert.alert('', `${L.common.remove}: ${member.display_name}?`, [
      { text: L.common.cancel, style: 'cancel' },
      {
        text: L.common.remove,
        style: 'destructive',
        onPress: () => {
          void run(() => removeMember(member.id), {
            onDone: () => {
              void qc.invalidateQueries({ queryKey: qk.household(activeId as string) });
              router.back();
            },
          });
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Row gap={spacing.sm} style={{ marginBottom: spacing.sm }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <H2>{isSelf ? L.member.title : member.display_name}</H2>
      </Row>

      {!canEdit ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Muted>{L.errors.not_admin}</Muted>
        </Card>
      ) : null}

      <View pointerEvents={canEdit ? 'auto' : 'none'} style={!canEdit ? { opacity: 0.6 } : undefined}>
        <Field label={L.member.displayName} value={form.display_name} onChangeText={(v) => patch({ display_name: v })} editable={canEdit} />

        <Text style={[t.small, { marginBottom: 6 }]}>{L.member.portion}</Text>
        <View style={{ marginBottom: spacing.md }}>
          <Segmented<Portion> options={PORTION_OPTIONS} value={form.portion} onChange={(v) => patch({ portion: v })} />
        </View>

        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Body>{L.member.eatsByDefault}</Body>
          <Switch
            value={form.eats_by_default}
            onValueChange={(v) => patch({ eats_by_default: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.text}
          />
        </Row>

        {isAdmin ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[t.small, { marginBottom: 6 }]}>{L.household.role}</Text>
            <Segmented<MemberRole> options={ROLE_OPTIONS} value={form.role} onChange={(v) => patch({ role: v })} />
          </View>
        ) : null}

        <SectionHeader title={L.member.likes} />
        <ChipEditor tags={form.prefs.likes} onChange={(v) => setPref('likes', v)} placeholder={L.member.tagPlaceholder} />

        <SectionHeader title={L.member.dislikes} />
        <ChipEditor tags={form.prefs.dislikes} onChange={(v) => setPref('dislikes', v)} placeholder={L.member.tagPlaceholder} />

        <SectionHeader title={L.member.never} />
        <ChipEditor tags={form.prefs.never} onChange={(v) => setPref('never', v)} placeholder={L.member.tagPlaceholder} />

        <SectionHeader title={L.member.allergies} />
        <ChipEditor
          tags={form.prefs.allergies}
          onChange={(v) => setPref('allergies', v)}
          placeholder={L.member.tagPlaceholder}
          color={colors.red}
          warning={L.member.allergyWarning}
        />

        <SectionHeader title={L.member.cuisines} />
        <ChipEditor tags={form.prefs.cuisines} onChange={(v) => setPref('cuisines', v)} placeholder={L.member.tagPlaceholder} />

        <SectionHeader title={L.member.diet} />
        <View style={styles.wrap}>
          {DIET_KEYS.map((k) => (
            <Chip key={k} label={dietLabel[k]} selected={form.prefs.diet.includes(k)} onPress={() => toggleDiet(k)} />
          ))}
        </View>
      </View>

      {canEdit ? (
        <Button label={L.common.save} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
      ) : null}

      {isAdmin && !isSelf ? (
        <Button variant="danger" icon="trash-outline" label={L.common.remove} onPress={remove} style={{ marginTop: spacing.md }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
