/**
 * First-run onboarding. A short, friendly flow that ends by creating the first
 * household and seeding its settings + the creator's preferences.
 *
 * "Virtuve dzīvo" redesign: a floating capsule progress indicator (completed and
 * active steps are saffron, the active one stretches wider), expressive SelectCards
 * for the single choices and tokenised Chips for the multi-selects — it should feel
 * like assembling the household, not filling in a form. Visual only: the step
 * machine, every selection and the final create-household action are unchanged.
 */
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Body, Button, Chip, Field, H2, Hero, Muted, Row, Screen, SelectCard } from '@src/ui/kit';
import { colors, spacing, withAlpha } from '@src/ui/theme';
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

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type PriorityKey = keyof HouseholdSettings['priorities'];
type ForWhom = 'justMe' | 'twoPeople' | 'family';

const PRIORITY_KEYS = Object.keys(priorityLabel) as PriorityKey[];
const DIET_KEYS = Object.keys(dietLabel);
const COOKING_LOVE_KEYS = Object.keys(cookingLoveLabel) as CookingLove[];

const MAX_PRIORITIES = 3;

const FOR_WHOM_ICON: Record<ForWhom, IconName> = {
  justMe: 'person-outline',
  twoPeople: 'people-outline',
  family: 'people-circle-outline',
};

const COOKING_LOVE_ICON: Record<CookingLove, IconName> = {
  love: 'heart-outline',
  fine: 'thumbs-up-outline',
  duty: 'time-outline',
  minimal: 'flash-outline',
};

const DEFAULT_SETTINGS: HouseholdSettings = {
  priorities: { fast: 2, cheap: 2, healthy: 1, high_protein: 1, tasty: 2, low_effort: 1, use_leftovers: 2, reduce_waste: 2 },
  cooking_love: 'fine',
  equipment: ['stove', 'oven', 'microwave'],
  weekly_budget: null,
  tone: 'friendly',
};
const DEFAULT_PREFS: MemberPrefs = { likes: [], dislikes: [], never: [], allergies: [], cuisines: [], diet: [] };

const STEPS = 6;

/** Floating capsule progress: completed + active are saffron, active stretches. */
function ProgressDots({ step }: { step: number }) {
  return (
    <Row gap={6} style={styles.progress}>
      {Array.from({ length: STEPS }).map((_, i) => (
        <ProgressDot key={i} active={i === step} done={i < step} />
      ))}
    </Row>
  );
}

function ProgressDot({ active, done }: { active: boolean; done: boolean }) {
  const w = useSharedValue(active ? 26 : 8);
  useEffect(() => {
    w.value = withTiming(active ? 26 : 8, { duration: 260 });
  }, [active, w]);
  const anim = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View style={[styles.dot, { backgroundColor: active || done ? colors.accent : colors.border }, anim]} />
  );
}

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

  // Priorities are a max-3 multi-select: an extra pick beyond the cap is ignored.
  const togglePriority = (k: PriorityKey) =>
    setPriorities((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= MAX_PRIORITIES ? p : [...p, k]));

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

  const cta = step === 0
    ? 'Sākt'
    : last
      ? (isLinked ? L.onboarding.start : L.onboarding.startNoAccount)
      : L.common.next;

  return (
    <Screen pad={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ProgressDots step={step} />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
              <View style={styles.welcome}>
                <View style={styles.medallion}>
                  <Ionicons name="restaurant" size={46} color={colors.accent} />
                </View>
                <Hero style={{ textAlign: 'center' }}>{L.app.name}</Hero>
                <H2 style={{ textAlign: 'center' }}>No tā, kas jau ir mājās.</H2>
                <Body muted style={{ textAlign: 'center', lineHeight: 24 }}>{L.app.tagline}</Body>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.step}>
                <H2>{L.onboarding.forWhom}</H2>
                <View style={{ gap: spacing.sm }}>
                  {(['justMe', 'twoPeople', 'family'] as const).map((v) => (
                    <SelectCard
                      key={v}
                      variant="row"
                      title={L.onboarding[v]}
                      icon={FOR_WHOM_ICON[v]}
                      selected={forWhom === v}
                      onPress={() => setForWhom(v)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.step}>
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
              <View style={styles.step}>
                <H2>{L.onboarding.prioritiesTitle}</H2>
                <Body muted>{L.onboarding.prioritiesBody}</Body>
                <View style={styles.wrap}>
                  {PRIORITY_KEYS.map((k) => (
                    <Chip key={k} label={priorityLabel[k]} selected={priorities.includes(k)} onPress={() => togglePriority(k)} />
                  ))}
                </View>
                <Muted>{`${priorities.length}/${MAX_PRIORITIES}`}</Muted>
              </View>
            ) : null}

            {step === 4 ? (
              <View style={styles.step}>
                <H2>{L.onboarding.cookingLoveTitle}</H2>
                <View style={{ gap: spacing.sm }}>
                  {COOKING_LOVE_KEYS.map((k) => (
                    <SelectCard
                      key={k}
                      variant="row"
                      title={cookingLoveLabel[k]}
                      icon={COOKING_LOVE_ICON[k]}
                      selected={cookingLove === k}
                      onPress={() => setCookingLove(k)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {step === 5 ? (
              <View style={styles.step}>
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

          <Row gap={spacing.sm} style={styles.nav}>
            {step > 0 ? (
              <Button variant="ghost" full={false} style={{ flex: 1 }} label={L.common.back} onPress={back} />
            ) : null}
            <Button
              full={false}
              style={{ flex: step > 0 ? 2 : 1 }}
              label={cta}
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
  progress: { justifyContent: 'center', marginTop: spacing.sm },
  dot: { height: 8, borderRadius: 4 },
  scroll: { paddingVertical: spacing.xl, gap: spacing.md, flexGrow: 1 },
  welcome: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  medallion: {
    width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent, 0.12), marginBottom: spacing.sm,
  },
  step: { gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nav: { paddingBottom: spacing.md },
});
