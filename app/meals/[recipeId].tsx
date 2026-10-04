/**
 * Recipe detail. Hero image/typographic header, summary, quick facts, ingredients
 * split into "ir mājās" vs "jāpiepērk", numbered steps, cost + tags, and actions
 * to cook, add missing items to the shopping list, or save the recipe.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { addMissingFromRecipe, aiTransform, getRecipe, saveRecipe } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { RecipeIngredient, TransformKey } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { Button, Chip, EmptyState, IconButton, Pill, Screen, Spinner } from '@src/ui/kit';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { L, transformLabel } from '@src/i18n/lv';
import { RecipeImage } from '@src/meals/RecipeImage';
import { success } from '@src/ui/haptics';

const TAG_LV: Record<string, string> = {
  fast: 'Ātri', healthy: 'Veselīgi', cheap: 'Taupīgi', high_protein: 'Daudz olbaltumvielu',
  comfort: 'Sātīgi', light: 'Viegli', air_fryer: 'Air fryer', one_pan: 'Viena panna',
  one_pot: 'Viens katls', vegetarian: 'Veģetāri', vegan: 'Vegāni', spicy: 'Ass', kids: 'Bērniem',
};

export default function RecipeDetail() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { activeId } = useHouseholdCtx();
  const { run: runAdd, busy: addBusy } = useAction();
  const { run: runSave } = useAction();
  const { run: runTransform, busy: transformBusy } = useAction();
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: recipe, isLoading } = useQuery({
    queryKey: qk.recipe(recipeId),
    queryFn: () => getRecipe(recipeId),
    enabled: !!recipeId,
  });

  if (isLoading) return <Screen><Spinner label={L.common.loading} /></Screen>;
  if (!recipe) return <Screen><EmptyState icon="sad-outline" title={L.common.error} action={L.common.back} onAction={() => router.back()} /></Screen>;

  const have = recipe.ingredients.filter((i) => i.have);
  const missing: RecipeIngredient[] = recipe.missing?.length ? recipe.missing : recipe.ingredients.filter((i) => !i.have);
  const tags = recipe.tags.filter((tag) => TAG_LV[tag]);
  const transformKeys = Object.keys(transformLabel) as TransformKey[];

  const addMissing = () =>
    runAdd(() => addMissingFromRecipe(activeId!, recipe.id), {
      onDone: () => {
        setAdded(true);
        success();
        if (activeId) void queryClient.invalidateQueries({ queryKey: qk.shopping(activeId) });
      },
    });

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    void runSave(() => saveRecipe(recipe.id, next), { silent: true });
  };

  const transform = (key: TransformKey) =>
    runTransform(() => aiTransform(recipe.id, key), {
      onDone: (res) => { success(); router.push(`/meals/${res.recipe.id}`); },
    });

  return (
    <>
    <Screen scroll>
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} color={saved ? colors.accent : colors.text} onPress={toggleSave} />
      </View>

      <RecipeImage recipe={recipe} height={240} overlayTitle />

      {recipe.summary ? <Text style={[t.body, { marginTop: spacing.lg, lineHeight: 22 }]}>{recipe.summary}</Text> : null}

      <View style={styles.facts}>
        <Pill icon="time-outline" label={L.meals.timeTotal(recipe.time_total_min)} />
        <Pill icon="hourglass-outline" label={L.meals.timeActive(recipe.time_active_min)} />
        <Pill icon="people-outline" label={L.meals.servings(recipe.servings)} />
        {recipe.kcal != null ? <Pill icon="flame-outline" label={L.meals.kcal(recipe.kcal)} /> : null}
        {recipe.est_cost_eur != null ? <Pill icon="pricetag-outline" label={L.meals.perPerson(recipe.est_cost_eur / Math.max(1, recipe.servings))} /> : null}
      </View>

      {tags.length ? (
        <View style={styles.facts}>
          {tags.map((tag) => <Pill key={tag} label={TAG_LV[tag]} color={colors.accent} />)}
        </View>
      ) : null}

      {have.length ? (
        <>
          <Text style={styles.groupLabel}>IR MĀJĀS</Text>
          {have.map((i, idx) => (
            <View key={`h${idx}`} style={styles.ing}>
              <Ionicons name="checkmark-circle" size={18} color={colors.green} />
              <Text style={[t.body, { flex: 1, marginLeft: spacing.sm }]}>{i.name}</Text>
              <Text style={t.small}>{i.qty}</Text>
            </View>
          ))}
        </>
      ) : null}

      {missing.length ? (
        <>
          <Text style={styles.groupLabel}>JĀPIEPĒRK</Text>
          {missing.map((i, idx) => (
            <View key={`m${idx}`} style={styles.ing}>
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={[t.body, { flex: 1, marginLeft: spacing.sm }]}>{i.name}</Text>
              <Text style={t.small}>{i.qty}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.groupLabel}>PAGATAVOŠANA</Text>
      {recipe.steps.map((s) => (
        <View key={s.n} style={styles.step}>
          <View style={styles.stepNum}><Text style={[t.bodyStrong, { color: colors.accentText }]}>{s.n}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[t.body, { lineHeight: 22 }]}>{s.text}</Text>
            {s.timer_min ? <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><Pill icon="timer-outline" label={`${s.timer_min} min`} color={colors.accent} /></View> : null}
          </View>
        </View>
      ))}

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Button label={L.meals.cook} icon="flame" onPress={() => router.push(`/cook/${recipe.id}`)} />
        {missing.length ? (
          <Button
            label={added ? 'Pievienots sarakstam' : 'Pievienot trūkstošo sarakstam'}
            icon={added ? 'checkmark' : 'cart-outline'}
            variant="secondary"
            loading={addBusy}
            disabled={added}
            onPress={addMissing}
          />
        ) : null}
        <Button label={saved ? 'Saglabāts' : L.common.save} icon={saved ? 'bookmark' : 'bookmark-outline'} variant="ghost" onPress={toggleSave} />
      </View>

      <Text style={styles.groupLabel}>{L.meals.transformTitle.toUpperCase()}</Text>
      <View style={styles.transformRow}>
        {transformKeys.map((key) => (
          <Chip key={key} label={transformLabel[key]} onPress={() => transform(key)} />
        ))}
      </View>
    </Screen>
    {transformBusy ? (
      <View style={styles.overlay}>
        <Spinner label={L.meals.transforming} />
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, marginHorizontal: -spacing.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  groupLabel: { ...t.tiny, color: colors.textFaint, marginTop: spacing.xl, marginBottom: spacing.sm },
  ing: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  transformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
});
