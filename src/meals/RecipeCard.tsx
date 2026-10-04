/**
 * Editorial recipe card for the "Ko ēdam?" results. A large flush food image (or
 * the typographic fallback panel) with a heart save toggle overlaid top-right,
 * then title, summary, a row of small meta pills, "what you already have", a
 * missing-ingredients line, and Gatavot / Pievienot trūkstošo actions.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@src/api/types';
import { addMissingFromRecipe, saveRecipe } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useAction } from '@src/ui/useAction';
import { success, tap } from '@src/ui/haptics';
import { Button, Pill } from '@src/ui/kit';
import { colors, radius, shadow, spacing, type as t } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { RecipeImage } from './RecipeImage';

export function RecipeCard({ recipe, activeId }: { recipe: Recipe; activeId: string }) {
  const { run, busy } = useAction();
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasImage = !!recipe.image_url;
  const missing = recipe.missing ?? [];
  const open = () => router.push(`/meals/${recipe.id}`);
  const cook = () => router.push(`/cook/${recipe.id}`);

  // Heart save toggle — optimistic, reverts if the save RPC fails.
  const toggleSave = () => {
    tap();
    const next = !saved;
    setSaved(next);
    void saveRecipe(recipe.id, next)
      .then(() => { if (next) success(); })
      .catch(() => setSaved(!next));
  };

  const addMissing = () =>
    run(() => addMissingFromRecipe(activeId, recipe.id), {
      onDone: () => {
        setAdded(true);
        success();
        void queryClient.invalidateQueries({ queryKey: qk.shopping(activeId) });
      },
    });

  return (
    <Pressable
      onPress={() => { tap(); open(); }}
      style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.95, transform: [{ scale: 0.995 }] }]}
    >
      <RecipeImage recipe={recipe} height={200} rounded={false} />

      <Pressable
        onPress={toggleSave}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => [styles.heart, pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }]}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.heart : colors.cream} />
      </Pressable>

      <View style={styles.body}>
        {hasImage ? <Text style={t.h3} numberOfLines={2}>{recipe.title}</Text> : null}
        {recipe.summary ? <Text style={[t.small, { lineHeight: 19 }]} numberOfLines={2}>{recipe.summary}</Text> : null}

        <View style={styles.pills}>
          <Pill icon="time-outline" label={L.meals.timeTotal(recipe.time_total_min)} />
          <Pill icon="people-outline" label={L.meals.servings(recipe.servings)} />
          {recipe.kcal != null ? <Pill icon="flame-outline" label={L.meals.kcal(recipe.kcal)} /> : null}
          {recipe.est_cost_eur != null ? <Pill icon="pricetag-outline" label={L.meals.perPerson(recipe.est_cost_eur / Math.max(1, recipe.servings))} /> : null}
        </View>

        <View style={styles.have}>
          <Ionicons name="checkmark-circle" size={15} color={colors.green} />
          <Text style={[t.small, { color: colors.text, marginLeft: 6 }]}>
            {L.meals.usesHave(recipe.uses_item_ids.length, recipe.ingredients.length)}
          </Text>
        </View>

        {missing.length > 0 ? (
          <Text style={[t.small, { lineHeight: 19 }]} numberOfLines={2}>
            <Text style={{ color: colors.accent }}>{L.meals.needToBuy}: </Text>
            {missing.map((m) => m.name).join(', ')}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button label={L.meals.cook} icon="flame" onPress={cook} />
          </View>
          {missing.length > 0 ? (
            <View style={{ flex: 1 }}>
              <Button
                label={added ? 'Pievienots' : 'Pievienot trūkstošo'}
                icon={added ? 'checkmark' : 'cart-outline'}
                variant="secondary"
                loading={busy}
                disabled={added}
                onPress={addMissing}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  heart: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: spacing.lg, gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  have: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
