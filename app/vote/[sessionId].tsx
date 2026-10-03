/**
 * "Dinner Match" — the household votes want/der/negribu on the suggested recipes.
 * Live tally (realtime + light polling); on a match it celebrates and offers to
 * cook together. Anyone can end the vote now or let the app decide.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { castVote, closeVote, getVote } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { Recipe, VoteChoice, VoteSession } from '@src/api/types';
import { useUserId } from '@src/auth/store';
import { useAction } from '@src/ui/useAction';
import { Button, EmptyState, IconButton, Pill, Spinner } from '@src/ui/kit';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { L, voteLabel } from '@src/i18n/lv';

const CHOICES: VoteChoice[] = ['want', 'ok', 'no'];
const choiceColor = (c: VoteChoice): string => (c === 'want' ? colors.green : c === 'ok' ? colors.accent : colors.red);

export default function Vote() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const uid = useUserId();
  const { run: runVote } = useAction();
  const { run: runClose, busy: closeBusy } = useAction();

  const { data: session, isLoading } = useQuery({
    queryKey: qk.vote(sessionId),
    queryFn: () => getVote(sessionId),
    enabled: !!sessionId,
    refetchInterval: (q) => ((q.state.data as VoteSession | undefined)?.status === 'open' ? 3000 : false),
  });

  const invalidate = (hid?: string) => {
    void queryClient.invalidateQueries({ queryKey: qk.vote(sessionId) });
    if (hid) void queryClient.invalidateQueries({ queryKey: qk.activeVote(hid) });
  };

  if (isLoading) return <SafeAreaView style={styles.screen}><Spinner label={L.common.loading} /></SafeAreaView>;
  if (!session) return <SafeAreaView style={styles.screen}><EmptyState icon="sad-outline" title={L.common.error} action={L.common.close} onAction={() => router.back()} /></SafeAreaView>;

  const recipes = session.recipes ?? [];
  const open = session.status === 'open';
  const matched = session.status === 'matched' && session.matched_recipe_id
    ? recipes.find((r) => r.id === session.matched_recipe_id)
    : undefined;

  const myChoice = (rid: string): VoteChoice | undefined =>
    session.votes.find((v) => v.voter === uid && v.recipe_id === rid)?.choice;

  const cast = (rid: string, choice: VoteChoice) =>
    runVote(() => castVote(sessionId, rid, choice), { onDone: () => invalidate(session.household_id), silent: true });

  const score = (rid: string) =>
    session.votes.filter((v) => v.recipe_id === rid).reduce((a, v) => a + (v.choice === 'want' ? 2 : v.choice === 'ok' ? 1 : 0), 0);
  const leader = [...recipes].sort((a, b) => score(b.id) - score(a.id))[0];

  const closeNow = (rid: string | null) =>
    runClose(() => closeVote(sessionId, rid), { onDone: () => invalidate(session.household_id) });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <Text style={t.h2}>{L.vote.title}</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {matched ? (
          <View style={styles.matchCard}>
            <Ionicons name="sparkles" size={28} color={colors.accentText} />
            <Text style={[t.h1, { color: colors.accentText, marginTop: spacing.sm }]}>{L.vote.match}</Text>
            <Text style={[t.body, { color: colors.accentText, opacity: 0.85, marginTop: 2 }]}>{L.vote.matchBody(matched.title)}</Text>
            <Button label={L.vote.cookTogether} icon="flame" variant="secondary" style={{ marginTop: spacing.lg }} onPress={() => router.replace(`/cook/${matched.id}`)} />
          </View>
        ) : (
          <Text style={[t.small, { marginBottom: spacing.md }]}>{open ? L.vote.yourTurn : L.vote.noMatch}</Text>
        )}

        {recipes.map((r) => (
          <RecipeVoteRow
            key={r.id}
            recipe={r}
            votes={session.votes.filter((v) => v.recipe_id === r.id)}
            mine={myChoice(r.id)}
            open={open}
            isMatch={matched?.id === r.id}
            onVote={(c) => cast(r.id, c)}
            onPickThis={() => closeNow(r.id)}
          />
        ))}

        {open ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Button label={L.vote.closeVote} icon="checkmark-done" loading={closeBusy} onPress={() => closeNow(leader?.id ?? null)} />
            <Button label={L.vote.decideForUs} variant="ghost" loading={closeBusy} onPress={() => closeNow(null)} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function VoteDot({ name, choice }: { name: string; choice: VoteChoice }) {
  return (
    <View style={[styles.dot, { backgroundColor: choiceColor(choice) }]}>
      <Text style={styles.dotText}>{(name?.trim()?.[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

function RecipeVoteRow({
  recipe, votes, mine, open, isMatch, onVote, onPickThis,
}: {
  recipe: Recipe; votes: VoteSession['votes']; mine?: VoteChoice; open: boolean; isMatch: boolean;
  onVote: (c: VoteChoice) => void; onPickThis: () => void;
}) {
  return (
    <View style={[styles.card, isMatch && { borderColor: colors.accent }]}>
      <Pressable onPress={() => router.push(`/meals/${recipe.id}`)}>
        <Text style={t.h3} numberOfLines={2}>{recipe.title}</Text>
      </Pressable>
      <View style={styles.pills}>
        <Pill icon="time-outline" label={L.meals.timeTotal(recipe.time_total_min)} />
        <Pill icon="people-outline" label={L.meals.servings(recipe.servings)} />
      </View>

      {open ? (
        <View style={styles.voteRow}>
          {CHOICES.map((c) => {
            const on = mine === c;
            return (
              <Pressable
                key={c}
                onPress={() => onVote(c)}
                style={[styles.voteBtn, on ? { backgroundColor: choiceColor(c), borderColor: choiceColor(c) } : { borderColor: colors.border }]}
              >
                <Text style={[t.small, { color: on ? colors.accentText : colors.text }]}>{voteLabel[c]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {votes.length ? (
        <View style={styles.tally}>
          {votes.map((v, i) => <VoteDot key={`${v.voter}-${i}`} name={v.voter_name} choice={v.choice} />)}
        </View>
      ) : (
        <Text style={[t.tiny, { color: colors.textFaint, marginTop: spacing.sm }]}>{L.vote.waiting}</Text>
      )}

      {open ? (
        <Pressable onPress={onPickThis} hitSlop={6} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
          <Text style={[t.small, { color: colors.accent }]}>Izvēlēties šo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, gap: spacing.md },
  matchCard: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  voteRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  voteBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  tally: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.accentText, fontWeight: '800', fontSize: 11 },
});
