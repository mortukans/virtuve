/**
 * "Ko ēdam?" generator. Collects a MealQuery (mood / effort / max time / who eats
 * / cheap / use-expiring), asks the AI for 3 recipes, lazily fills in preview
 * images, and offers to start a household vote on the results.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { aiRecipeImage, aiRecipes, getInventory, startVote } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import type { Effort, MealQuery, Mood, Recipe } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { Button, Card, Chip, IconButton, Screen, Segmented, Spinner } from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
import { effortLabel, L, moodLabel } from '@src/i18n/lv';
import { RecipeCard } from '@src/meals/RecipeCard';

type TimeKey = '10' | '20' | '30' | 'any';

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={[t.small, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>{children}</Text>;
}

export default function Suggest() {
  const { household, activeId } = useHouseholdCtx();
  const members = household?.members ?? [];

  const [mood, setMood] = useState<Mood>('any');
  const [effort, setEffort] = useState<Effort>('normal');
  const [timeKey, setTimeKey] = useState<TimeKey>('any');
  const [eaters, setEaters] = useState<string[]>([]);
  const [initEaters, setInitEaters] = useState(false);
  const [cheap, setCheap] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);

  const { run, busy } = useAction();
  const voteAction = useAction();

  const inventory = useQuery({ queryKey: qk.inventory(activeId!), queryFn: () => getInventory(activeId!), enabled: !!activeId });
  const inventoryEmpty = inventory.data?.length === 0;

  useEffect(() => {
    if (!initEaters && members.length) {
      setEaters(members.filter((m) => m.eats_by_default).map((m) => m.id));
      setInitEaters(true);
    }
  }, [members, initEaters]);

  const toggleEater = (id: string) =>
    setEaters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const loadImages = (list: Recipe[]) => {
    list.forEach((r) => {
      if (r.image_url) return;
      aiRecipeImage(r.id)
        .then((res) => {
          if (res?.image_url) {
            setRecipes((cur) => (cur ? cur.map((x) => (x.id === r.id ? { ...x, image_url: res.image_url, image_is_ai: true } : x)) : cur));
          }
        })
        .catch(() => undefined);
    });
  };

  const generate = () => {
    if (!activeId) return;
    const query: MealQuery = {
      mood,
      effort,
      max_time_min: timeKey === 'any' ? null : Number(timeKey),
      eaters,
      cheap,
      prioritise_expiring: expiring,
    };
    void run(() => aiRecipes(activeId, query), {
      onDone: (res) => {
        setRecipes(res.recipes);
        loadImages(res.recipes);
      },
    });
  };

  const startVoteNow = () => {
    if (!activeId || !recipes?.length) return;
    void voteAction.run(() => startVote(activeId, recipes.map((r) => r.id)), {
      onDone: (session) => router.push(`/vote/${session.id}`),
    });
  };

  const moods = Object.keys(moodLabel) as Mood[];

  return (
    <Screen scroll>
      <View style={styles.head}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <Text style={t.h1}>Ko ēdam?</Text>
      </View>

      {inventoryEmpty ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[t.body, { marginBottom: spacing.md }]}>{L.meals.emptyInventory}</Text>
          <Button label={L.home.scanFridge} icon="camera-outline" onPress={() => router.push('/scan')} />
        </Card>
      ) : null}

      <Label>{L.meals.pickMood}</Label>
      <View style={styles.wrap}>
        {moods.map((m) => (
          <Chip key={m} label={moodLabel[m]} selected={mood === m} onPress={() => setMood(m)} />
        ))}
      </View>

      <Label>{L.meals.pickEffort}</Label>
      <Segmented<Effort>
        value={effort}
        onChange={setEffort}
        options={[
          { value: 'minimal', label: effortLabel.minimal },
          { value: 'normal', label: effortLabel.normal },
          { value: 'can_cook', label: effortLabel.can_cook },
        ]}
      />

      <Label>{L.meals.maxTime}</Label>
      <Segmented<TimeKey>
        value={timeKey}
        onChange={setTimeKey}
        options={[
          { value: '10', label: L.meals.min10 },
          { value: '20', label: L.meals.min20 },
          { value: '30', label: L.meals.min30 },
          { value: 'any', label: L.meals.anyTime },
        ]}
      />

      {members.length > 0 ? (
        <>
          <Label>{L.meals.whoEats}</Label>
          <View style={styles.wrap}>
            {members.map((m) => (
              <Chip key={m.id} label={m.display_name} selected={eaters.includes(m.id)} onPress={() => toggleEater(m.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Label>Papildu</Label>
      <View style={styles.wrap}>
        <Chip label="Taupīgi" selected={cheap} onPress={() => setCheap((v) => !v)} />
        <Chip label="Izlietot, kas drīz jāizlieto" selected={expiring} onPress={() => setExpiring((v) => !v)} />
      </View>

      <Button label="Izdomāt" icon="sparkles" loading={busy} onPress={generate} style={{ marginTop: spacing.xl }} />

      {busy ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Spinner label={L.meals.thinking} />
        </View>
      ) : recipes ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <Text style={t.h2}>{L.meals.results}</Text>
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} activeId={activeId!} />
          ))}
          {recipes.length > 1 ? (
            <Button label={L.meals.startVote} icon="people-outline" loading={voteAction.busy} onPress={startVoteNow} />
          ) : null}
          <Button label={L.meals.anotherOption} icon="refresh-outline" variant="secondary" onPress={generate} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginLeft: -spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
