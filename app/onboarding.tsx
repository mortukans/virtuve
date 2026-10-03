/**
 * First-run onboarding. A short, friendly flow that ends by creating the first
 * household and seeding its settings + the creator's preferences.
 */
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Body, Button, Chip, Field, H2, Muted, Row, Screen, Title } from '@src/ui/kit';
import { colors, spacing } from '@src/ui/theme';
import { L, cookingLoveLabel, dietLabel, priorityLabel } from '@src/i18n/lv';
import { createHousehold, getHousehold, updateHousehold, updateMember } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import type { CookingLove, HouseholdSettings, MemberPrefs } from '@src/api/types';
import { useAuth } from '@src/auth/store';
import { appleAvailable, ProviderCancelled } from '@src/auth/apple';
import { useActiveHousehold } from '@src/household/active';
import { useAction } from '@src/ui/useAction';
import { errorMessage } from '@src/ui/errors';
import { ChipEditor } from '@src/household/ChipEditor';
import { ChoiceList } from '@src/household/ChoiceList';

type PriorityKey = keyof HouseholdSettings['priorities'];
type ForWhom = 'justMe' | 'twoPeople' | 'family';

const PRIORITY_KEYS = Object.keys(priorityLabel) as PriorityKey[];
const DIET_KEYS = Object.keys(dietLabel);
const COOKING_LOVE_KEYS = Object.keys(cookingLoveLabel) as CookingLove[];

const DEFAULT_SETTINGS: HouseholdSettings = {
  priorities: { fast: 2, cheap: 2, healthy: 1, high_protein: 1, tasty: 2, low_effort: 1, use_leftovers: 2, reduce_waste: 2 },
  cooking_love: 'fine',
  equipment: ['stove', 'oven', 'microwave'],
  weekly_budget: null,
  tone: 'friendly',
};
const DEFAULT_PREFS: MemberPrefs = { likes: [], dislikes: [], never: [], allergies: [], cuisines: [], diet: [] };

const STEPS = 6;

export default function Onboarding() {
  const [step, setStep] = useState(0);

  // collected answers
  const [forWhom, setForWhom] = useState<ForWhom | null>(null);
  const [diet, setDiet] = useState<string[]>([]);
  const [never, setNever] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<PriorityKey[]>([]);
  const [cookingLove, setCookingLove] = useState<CookingLove | null>(null);
  const [name, setName] = useState('Mūsu mājas');

  const uid = useAuth((s) => s.session?.user.id ?? null);
  const isLinked = useAuth((s) => s.isLinked);
  const signInWithApple = useAuth((s) => s.signInWithApple);
  const setActive = useActiveHousehold((s) => s.setActive);
  const qc = useQueryClient();
  const { run, busy } = useAction();

  const [canApple, setCanApple] = useState(false);
  const [linkingApple, setLinkingApple] = useState(false);
  useEffect(() => {
    let mounted = true;
    void appleAvailable().then((v) => { if (mounted) setCanApple(v); });
    return () => { mounted = false; };
  }, []);

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const linkApple = async () => {
    setLinkingApple(true);
    try {
      await signInWithApple();
    } catch (e) {
      if (!(e instanceof ProviderCancelled)) Alert.alert('', errorMessage(e));
    } finally {
      setLinkingApple(false);
    }
  };

  const finish = () => {
    void run(async () => {
      const seeded = { ...DEFAULT_SETTINGS.priorities };
      for (const k of priorities) seeded[k] = 3;
      const settings: HouseholdSettings = {
        ...DEFAULT_SETTINGS,
        priorities: seeded,
        cooking_love: cookingLove ?? DEFAULT_SETTINGS.cooking_love,
      };

      const created = await createHousehold(name.trim() || 'Mūsu mājas');
      setActive(created.id);
      const updated = await updateHousehold(created.id, { settings });

      let members = updated.members ?? created.members;
      if (!members) members = (await getHousehold(created.id)).members;
      const me = members?.find((m) => m.user_id === uid);
      if (me) {
        const prefs: MemberPrefs = { ...DEFAULT_PREFS, never, diet };
        await updateMember(me.id, { prefs });
      }
      return created.id;
    }, {
      onDone: (id) => {
        void qc.invalidateQueries({ queryKey: qk.households });
        void qc.invalidateQueries({ queryKey: qk.household(id) });
        router.replace('/home');
      },
    });
  };

  const last = step === STEPS - 1;
  const next = () => (last ? finish() : setStep((s) => Math.min(STEPS - 1, s + 1)));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Screen pad={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Row gap={6} style={{ justifyContent: 'center', marginTop: spacing.sm }}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />
            ))}
          </Row>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: spacing.xl, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
              <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
                <Ionicons name="restaurant" size={56} color={colors.accent} />
                <Title>{L.onboarding.welcomeTitle}</Title>
                <Body muted>{L.onboarding.welcomeBody}</Body>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={{ gap: spacing.lg }}>
                <H2>{L.onboarding.forWhom}</H2>
                <ChoiceList<ForWhom>
                  options={[
                    { value: 'justMe', label: L.onboarding.justMe },
                    { value: 'twoPeople', label: L.onboarding.twoPeople },
                    { value: 'family', label: L.onboarding.family },
                  ]}
                  value={forWhom}
                  onChange={setForWhom}
                />
              </View>
            ) : null}

            {step === 2 ? (
              <View style={{ gap: spacing.md }}>
                <H2>{L.onboarding.avoidTitle}</H2>
                <Body muted>{L.onboarding.avoidBody}</Body>
                <View style={styles.wrap}>
                  {DIET_KEYS.map((k) => (
                    <Chip key={k} label={dietLabel[k]} selected={diet.includes(k)} onPress={() => setDiet((d) => toggle(d, k))} />
                  ))}
                </View>
                <ChipEditor label={L.member.never} tags={never} onChange={setNever} placeholder={L.member.tagPlaceholder} />
              </View>
            ) : null}

            {step === 3 ? (
              <View style={{ gap: spacing.md }}>
                <H2>{L.onboarding.prioritiesTitle}</H2>
                <Body muted>{L.onboarding.prioritiesBody}</Body>
                <View style={styles.wrap}>
                  {PRIORITY_KEYS.map((k) => (
                    <Chip key={k} label={priorityLabel[k]} selected={priorities.includes(k)} onPress={() => setPriorities((p) => toggle(p, k))} />
                  ))}
                </View>
              </View>
            ) : null}

            {step === 4 ? (
              <View style={{ gap: spacing.lg }}>
                <H2>{L.onboarding.cookingLoveTitle}</H2>
                <ChoiceList<CookingLove>
                  options={COOKING_LOVE_KEYS.map((k) => ({ value: k, label: cookingLoveLabel[k] }))}
                  value={cookingLove}
                  onChange={setCookingLove}
                />
              </View>
            ) : null}

            {step === 5 ? (
              <View style={{ gap: spacing.md }}>
                <H2>{L.household.createTitle}</H2>
                <Body muted>{L.household.createBody}</Body>
                <Field label={L.member.displayName} value={name} onChangeText={setName} placeholder={L.household.namePlaceholder} />
                {canApple && !isLinked ? (
                  <View style={{ gap: spacing.sm }}>
                    <Button variant="secondary" icon="logo-apple" label={L.auth.continueApple} onPress={() => { void linkApple(); }} loading={linkingApple} />
                    <Muted>{L.auth.whyAccount}</Muted>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <Row gap={spacing.sm} style={{ paddingBottom: spacing.md }}>
            {step > 0 ? (
              <Button variant="ghost" full={false} style={{ flex: 1 }} label={L.common.back} onPress={back} />
            ) : null}
            <Button
              full={false}
              style={{ flex: step > 0 ? 2 : 1 }}
              label={last ? (isLinked ? L.onboarding.start : L.onboarding.startNoAccount) : L.common.next}
              onPress={next}
              loading={busy}
            />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent, width: 22 },
  dotDone: { backgroundColor: colors.accentDeep },
});
