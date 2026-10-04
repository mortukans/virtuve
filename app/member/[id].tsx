/**
 * Member profile editor. Self is always editable; editing others / children
 * requires admin. Allergies and "never" are hard blocks in recipe generation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Avatar, Body, Button, Card, Chip, EmptyState, Field, H2, IconButton, Muted, Row, Screen, SectionLabel, Segmented, Spinner,
} from '@src/ui/kit';
import { colors, spacing } from '@src/ui/theme';
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
      <Row style={{ marginBottom: spacing.lg }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
      </Row>

      {/* Identity */}
      <Row gap={spacing.md} style={{ marginBottom: spacing.xl }}>
        <Avatar name={form.display_name || member.display_name} size={72} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <H2>{isSelf ? L.member.title : (form.display_name || member.display_name)}</H2>
          <Muted style={{ marginTop: 4 }}>{roleLabel[form.role]} · {portionLabel[form.portion]}</Muted>
        </View>
      </Row>

      {!canEdit ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Muted>{L.errors.not_admin}</Muted>
        </Card>
      ) : null}

      <View pointerEvents={canEdit ? 'auto' : 'none'} style={!canEdit ? { opacity: 0.6 } : undefined}>
        {/* Basics */}
        <SectionLabel style={styles.sec}>Pamatinformācija</SectionLabel>
        <Card>
          <Field label={L.member.displayName} value={form.display_name} onChangeText={(v) => patch({ display_name: v })} editable={canEdit} />

          <Muted style={{ marginBottom: 6 }}>{L.member.portion}</Muted>
          <Segmented<Portion> options={PORTION_OPTIONS} value={form.portion} onChange={(v) => patch({ portion: v })} />

          <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
            <Body>{L.member.eatsByDefault}</Body>
            <Switch
              value={form.eats_by_default}
              onValueChange={(v) => patch({ eats_by_default: v })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
            />
          </Row>

          {isAdmin ? (
            <View style={{ marginTop: spacing.md }}>
              <Muted style={{ marginBottom: 6 }}>{L.household.role}</Muted>
              <Segmented<MemberRole> options={ROLE_OPTIONS} value={form.role} onChange={(v) => patch({ role: v })} />
            </View>
          ) : null}
        </Card>

        {/* Tastes */}
        <SectionLabel style={styles.sec}>{L.member.likes}</SectionLabel>
        <ChipEditor tags={form.prefs.likes} onChange={(v) => setPref('likes', v)} placeholder={L.member.tagPlaceholder} />

        <SectionLabel style={styles.sec}>{L.member.dislikes}</SectionLabel>
        <ChipEditor tags={form.prefs.dislikes} onChange={(v) => setPref('dislikes', v)} placeholder={L.member.tagPlaceholder} />

        <SectionLabel style={styles.sec}>{L.member.cuisines}</SectionLabel>
        <ChipEditor tags={form.prefs.cuisines} onChange={(v) => setPref('cuisines', v)} placeholder={L.member.tagPlaceholder} />

        {/* Hard blocks */}
        <SectionLabel style={styles.sec}>{L.member.never}</SectionLabel>
        <ChipEditor tags={form.prefs.never} onChange={(v) => setPref('never', v)} placeholder={L.member.tagPlaceholder} color={colors.paprika} />

        <SectionLabel style={[styles.sec, { color: colors.paprika }]}>{L.member.allergies}</SectionLabel>
        <ChipEditor
          tags={form.prefs.allergies}
          onChange={(v) => setPref('allergies', v)}
          placeholder={L.member.tagPlaceholder}
          color={colors.red}
          warning={L.member.allergyWarning}
        />

        {/* Diet */}
        <SectionLabel style={styles.sec}>{L.member.diet}</SectionLabel>
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
  sec: { marginTop: spacing.xl, marginBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
