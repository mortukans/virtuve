/**
 * Cook mode — focused full-screen flow ("Virtuve dzīvo" redesign).
 *
 * Top: round back + a saffron step-progress indicator. Body: a warm step block
 * with the big step number and the instruction as a large heading, optional timer,
 * and a help affordance. Bottom: one big primary to advance ("Tālāk" → "Pabeigt").
 * Flow: prep (ingredient checklist) → step-by-step → rating + feedback → mark used.
 * Visual only — stepping, timers, the help modal and the rateMeal flow are preserved.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { aiCookHelp, getRecipe, markUsed, rateMeal } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { MealRating } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { Button, Chip, EmptyState, Field, IconButton, SectionLabel, Spinner } from '@src/ui/kit';
import { colors, radius, spacing, type as t, withAlpha } from '@src/ui/theme';
import { feedbackLabel, L, ratingLabel } from '@src/i18n/lv';
import { impact, success } from '@src/ui/haptics';

type Phase = 'prep' | 'cook' | 'rate' | 'used';

const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function Cook() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { activeId } = useHouseholdCtx();

  const [phase, setPhase] = useState<Phase>('prep');
  const [stepIdx, setStepIdx] = useState(0);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQ, setHelpQ] = useState('');
  const [helpA, setHelpA] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { run: runRate, busy: rateBusy } = useAction();
  const { run: runUsed, busy: usedBusy } = useAction();
  const { run: runHelp, busy: helpBusy } = useAction();

  const { data: recipe, isLoading } = useQuery({ queryKey: qk.recipe(recipeId), queryFn: () => getRecipe(recipeId), enabled: !!recipeId });

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => stopTimer(), []);
  useEffect(() => { stopTimer(); setTimerLeft(null); }, [stepIdx, phase]);

  const startTimer = (min: number) => {
    stopTimer();
    impact();
    setTimerLeft(min * 60);
    timerRef.current = setInterval(() => {
      setTimerLeft((s) => {
        if (s === null) return null;
        if (s <= 1) { stopTimer(); success(); Alert.alert('', 'Taimeris pabeigts!'); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  if (isLoading) return <SafeAreaView style={styles.screen}><Spinner label={L.common.loading} /></SafeAreaView>;
  if (!recipe) return <SafeAreaView style={styles.screen}><EmptyState icon="sad-outline" title={L.common.error} action={L.common.back} onAction={() => router.back()} /></SafeAreaView>;

  const steps = recipe.steps;
  const total = steps.length;
  const step = steps[stepIdx];
  const feedbackKeys = Object.keys(feedbackLabel);

  const toggleFeedback = (k: string) =>
    setSelectedFeedback((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const finish = () => {
    if (activeId) {
      void queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) });
      void queryClient.invalidateQueries({ queryKey: qk.history(activeId) });
    }
    router.replace('/home');
  };

  const submitRate = (rating: MealRating) =>
    runRate(() => rateMeal(recipe.id, rating, selectedFeedback, notes.trim() || null), {
      onDone: () => { success(); if (recipe.uses_item_ids.length) setPhase('used'); else finish(); },
    });

  const markAllUsed = () =>
    runUsed(async () => { await Promise.all(recipe.uses_item_ids.map((id) => markUsed(id, 'some'))); }, { onDone: finish });

  const askHelp = () =>
    runHelp(() => aiCookHelp(helpQ.trim(), recipeId), {
      onDone: (res) => { success(); setHelpA(res.answer); },
    });

  // Back unwinds the flow: cook steps → prep → exit; rate/used → exit (as before).
  const onBack = () => {
    if (phase === 'cook') { if (stepIdx > 0) setStepIdx(stepIdx - 1); else setPhase('prep'); return; }
    router.back();
  };

  const topLabel = phase === 'cook' ? L.cook.step(stepIdx + 1, total) : phase === 'prep' ? L.cook.prep : L.cook.title;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" bg onPress={onBack} />
        <View style={styles.topCenter}>
          {phase === 'cook' ? (
            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < stepIdx ? styles.dotDone : i === stepIdx ? styles.dotActive : styles.dotOff,
                  ]}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.topLabel} numberOfLines={1}>{topLabel}</Text>
        </View>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {phase === 'prep' ? (
          <>
            <Text style={[t.h1, { marginBottom: spacing.xs }]}>{recipe.title}</Text>
            <Text style={[t.small, { marginBottom: spacing.lg }]}>{L.cook.prep}</Text>
            {recipe.ingredients.map((i, idx) => (
              <View key={idx} style={styles.ing}>
                <View style={styles.ingDot}>
                  <Ionicons name={i.have ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={i.have ? colors.herb : colors.textFaint} />
                </View>
                <Text style={[t.body, { flex: 1 }]}>{i.name}</Text>
                <Text style={t.small}>{i.qty}</Text>
              </View>
            ))}
          </>
        ) : null}

        {phase === 'cook' && step ? (
          <>
            <View style={styles.stepCard}>
              <View style={styles.stepGlow} />
              <Text style={styles.stepCardNum}>{step.n}</Text>
              <SectionLabel style={{ marginTop: spacing.xs }}>Solis</SectionLabel>
            </View>
            <Text style={styles.stepText}>{step.text}</Text>
            {step.timer_min ? (
              <View style={styles.timerWrap}>
                {timerLeft !== null ? (
                  <>
                    <Text style={styles.timer}>{fmt(timerLeft)}</Text>
                    <Button label="Apturēt" variant="secondary" full={false} onPress={() => { stopTimer(); setTimerLeft(null); }} />
                  </>
                ) : (
                  <Button label={L.cook.startTimer(step.timer_min)} icon="timer-outline" variant="secondary" full={false} onPress={() => startTimer(step.timer_min!)} />
                )}
              </View>
            ) : null}
          </>
        ) : null}

        {phase === 'rate' ? (
          <>
            <Text style={[t.h1, { marginBottom: spacing.xs }]}>{L.cook.finished}</Text>
            <Text style={[t.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>{L.cook.rateQuestion}</Text>

            <SectionLabel style={{ marginBottom: spacing.sm }}>{L.cook.feedbackTitle}</SectionLabel>
            <View style={styles.wrap}>
              {feedbackKeys.map((k) => (
                <Chip key={k} label={feedbackLabel[k]} selected={selectedFeedback.includes(k)} onPress={() => toggleFeedback(k)} />
              ))}
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Field label={L.cook.notes} value={notes} onChangeText={setNotes} placeholder="…" multiline />
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button label={ratingLabel.love} icon="heart" loading={rateBusy} onPress={() => submitRate('love')} />
              <Button label={ratingLabel.ok} icon="thumbs-up-outline" variant="secondary" loading={rateBusy} onPress={() => submitRate('ok')} />
              <Button label={ratingLabel.never} icon="close-circle-outline" variant="danger" loading={rateBusy} onPress={() => submitRate('never')} />
            </View>
          </>
        ) : null}

        {phase === 'used' ? (
          <>
            <Text style={[t.h1, { marginBottom: spacing.xs }]}>{L.kitchen.markUsed}</Text>
            <Text style={[t.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>Vai atzīmēt izmantotos produktus kā izlietotus virtuvē?</Text>
            <View style={{ gap: spacing.sm }}>
              <Button label="Atzīmēt kā izlietotus" icon="checkmark-done" loading={usedBusy} onPress={markAllUsed} />
              <Button label={L.common.skip} variant="ghost" onPress={finish} />
            </View>
          </>
        ) : null}

        {phase === 'prep' || phase === 'cook' ? (
          <View style={styles.helpWrap}>
            <Button label={L.cook.help} icon="help-circle-outline" variant="ghost" full={false} onPress={() => setHelpOpen(true)} />
          </View>
        ) : null}
      </ScrollView>

      {phase === 'prep' ? (
        <View style={styles.footer}>
          <Button label="Sākt gatavot" icon="flame" onPress={() => { setPhase('cook'); setStepIdx(0); }} />
        </View>
      ) : null}

      {phase === 'cook' ? (
        <View style={styles.footer}>
          <Button
            label={stepIdx < total - 1 ? L.common.next : L.cook.finish}
            icon={stepIdx < total - 1 ? 'arrow-forward' : 'checkmark'}
            onPress={() => { if (stepIdx < total - 1) setStepIdx(stepIdx + 1); else setPhase('rate'); }}
          />
        </View>
      ) : null}

      <Modal visible={helpOpen} transparent animationType="slide" onRequestClose={() => setHelpOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setHelpOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={t.h2}>{L.cook.helpTitle}</Text>
                <IconButton icon="close" onPress={() => setHelpOpen(false)} />
              </View>
              <Field
                value={helpQ}
                onChangeText={setHelpQ}
                placeholder={L.cook.helpPlaceholder}
                multiline
                style={styles.helpInput}
              />
              <Button
                label={L.cook.helpAsk}
                icon="sparkles-outline"
                disabled={helpBusy || helpQ.trim().length === 0}
                onPress={askHelp}
              />
              {helpBusy ? (
                <Spinner label={L.cook.helpThinking} />
              ) : helpA ? (
                <View style={styles.answerBox}>
                  <Text style={[t.body, { lineHeight: 22 }]}>{helpA}</Text>
                </View>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  topCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  topSpacer: { width: 44 },
  topLabel: { ...t.small, textAlign: 'center' },
  dots: { flexDirection: 'row', alignSelf: 'stretch', marginBottom: 7 },
  dot: { flex: 1, height: 5, borderRadius: 3, marginHorizontal: 2 },
  dotDone: { backgroundColor: withAlpha(colors.accent, 0.5) },
  dotActive: { backgroundColor: colors.accent },
  dotOff: { backgroundColor: colors.surfaceHigh },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  ing: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ingDot: { width: 28, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  stepCard: { height: 132, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: spacing.sm },
  stepGlow: { position: 'absolute', top: -46, right: -34, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.accent, opacity: 0.14 },
  stepCardNum: { fontSize: 66, fontWeight: '800', color: colors.accent, letterSpacing: -2 },
  stepText: { fontSize: 27, lineHeight: 36, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: spacing.xl },
  timerWrap: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.md },
  timer: { fontSize: 56, fontWeight: '800', color: colors.accent, letterSpacing: -1, marginBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  helpWrap: { alignItems: 'center', marginTop: spacing.xl },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  helpInput: { minHeight: 96, textAlignVertical: 'top' },
  answerBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
});
