/**
 * Cook mode. A focused, full-screen flow: prep (ingredient checklist) → one big
 * step at a time (with optional in-app timers) → "would you cook it again?" rating
 * with feedback chips + notes → offer to mark the used products as consumed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getRecipe, markUsed, rateMeal } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { MealRating } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { Button, Chip, EmptyState, Field, IconButton, Spinner } from '@src/ui/kit';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { run: runRate, busy: rateBusy } = useAction();
  const { run: runUsed, busy: usedBusy } = useAction();

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

  const progress = phase === 'cook' ? (stepIdx + 1) / Math.max(1, total) : phase === 'prep' ? 0 : 1;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <Text style={t.small} numberOfLines={1}>
          {phase === 'cook' ? L.cook.step(stepIdx + 1, total) : phase === 'prep' ? L.cook.prep : L.cook.title}
        </Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>
      {phase === 'cook' || phase === 'prep' ? (
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {phase === 'prep' ? (
          <>
            <Text style={[t.h1, { marginBottom: spacing.xs }]}>{recipe.title}</Text>
            <Text style={[t.small, { marginBottom: spacing.lg }]}>{L.cook.prep}</Text>
            {recipe.ingredients.map((i, idx) => (
              <View key={idx} style={styles.ing}>
                <Ionicons name={i.have ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={i.have ? colors.green : colors.textFaint} />
                <Text style={[t.body, { flex: 1, marginLeft: spacing.sm }]}>{i.name}</Text>
                <Text style={t.small}>{i.qty}</Text>
              </View>
            ))}
          </>
        ) : null}

        {phase === 'cook' && step ? (
          <>
            <Text style={styles.stepText}>{step.text}</Text>
            {step.timer_min ? (
              <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
                {timerLeft !== null ? (
                  <>
                    <Text style={styles.timer}>{fmt(timerLeft)}</Text>
                    <Button label="Apturēt" variant="secondary" full={false} onPress={() => { stopTimer(); setTimerLeft(null); }} />
                  </>
                ) : (
                  <Button label={L.cook.startTimer(step.timer_min)} icon="timer-outline" full={false} onPress={() => startTimer(step.timer_min!)} />
                )}
              </View>
            ) : null}
          </>
        ) : null}

        {phase === 'rate' ? (
          <>
            <Text style={[t.h1, { marginBottom: spacing.xs }]}>{L.cook.finished}</Text>
            <Text style={[t.body, { marginBottom: spacing.lg }]}>{L.cook.rateQuestion}</Text>

            <Text style={[t.small, { marginBottom: spacing.sm }]}>{L.cook.feedbackTitle}</Text>
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
            <Text style={[t.body, { marginBottom: spacing.xl }]}>Vai atzīmēt izmantotos produktus kā izlietotus virtuvē?</Text>
            <View style={{ gap: spacing.sm }}>
              <Button label="Atzīmēt kā izlietotus" icon="checkmark-done" loading={usedBusy} onPress={markAllUsed} />
              <Button label={L.common.skip} variant="ghost" onPress={finish} />
            </View>
          </>
        ) : null}
      </ScrollView>

      {phase === 'prep' ? (
        <View style={styles.footer}>
          <Button label="Sākt gatavot" icon="flame" onPress={() => { setPhase('cook'); setStepIdx(0); }} />
        </View>
      ) : null}

      {phase === 'cook' ? (
        <View style={[styles.footer, styles.footerRow]}>
          <View style={{ flex: 1 }}>
            <Button label={L.common.back} variant="secondary" onPress={() => { if (stepIdx > 0) setStepIdx(stepIdx - 1); else setPhase('prep'); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={stepIdx < total - 1 ? L.common.next : L.cook.finish}
              icon={stepIdx < total - 1 ? 'arrow-forward' : 'checkmark'}
              onPress={() => { if (stepIdx < total - 1) setStepIdx(stepIdx + 1); else setPhase('rate'); }}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm } as object,
  track: { height: 3, backgroundColor: colors.surfaceAlt, marginHorizontal: spacing.lg, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.accent },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  ing: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stepText: { fontSize: 26, lineHeight: 36, fontWeight: '600', color: colors.text, marginTop: spacing.lg },
  timer: { fontSize: 56, fontWeight: '800', color: colors.accent, letterSpacing: -1, marginBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
