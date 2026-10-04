/**
 * Recipe detail — editorial redesign ("Virtuve dzīvo").
 *
 * A full-bleed hero (AI photo or a warm constellation block) with round overlay
 * controls, then a rounded content sheet that overlaps the image: title, meta,
 * a herb-green "jau ir X no Y" line, segmented tabs (Sastāvdaļas / Pagatavošana /
 * Uzturvērtība), "Pielāgot recepti" transform chips, and the cook / add-missing
 * actions. Visual only — all data wiring and behaviour is preserved.
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
import {
  Button, Chip, EmptyState, IconButton, IngredientConstellation, MetricCard, Pill, Screen,
  SectionLabel, Segmented, Spinner,
} from '@src/ui/kit';
import { colors, radius, spacing, type as t, withAlpha } from '@src/ui/theme';
import { L, transformLabel } from '@src/i18n/lv';
import { RecipeImage } from '@src/meals/RecipeImage';
import { success } from '@src/ui/haptics';

const TAG_LV: Record<string, string> = {
  fast: 'Ātri', healthy: 'Veselīgi', cheap: 'Taupīgi', high_protein: 'Daudz olbaltumvielu',
  comfort: 'Sātīgi', light: 'Viegli', air_fryer: 'Air fryer', one_pan: 'Viena panna',
  one_pot: 'Viens katls', vegetarian: 'Veģetāri', vegan: 'Vegāni', spicy: 'Ass', kids: 'Bērniem',
};

const HERO_H = 300;
type Tab = 'ingredients' | 'steps' | 'nutrition';

export default function RecipeDetail() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { activeId } = useHouseholdCtx();
  const { run: runAdd, busy: addBusy } = useAction();
  const { run: runSave } = useAction();
  const { run: runTransform, busy: transformBusy } = useAction();
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('ingredients');

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
      <Screen scroll pad={false}>
        {/* ── editorial hero ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {recipe.image_url ? (
            <RecipeImage recipe={recipe} height={HERO_H} rounded={false} />
          ) : (
            <View style={styles.heroFallback}>
              <View style={[styles.heroGlow, { backgroundColor: colors.accent, top: -50, left: -40 }]} />
              <View style={[styles.heroGlow, { backgroundColor: colors.paprika, bottom: -60, right: -30, opacity: 0.5 }]} />
              <IngredientConstellation size={1.7} />
            </View>
          )}
          <View style={styles.heroScrim} pointerEvents="none" />
          <View style={styles.heroBar}>
            <IconButton icon="chevron-back" bg onPress={() => router.back()} />
            <IconButton icon={saved ? 'heart' : 'heart-outline'} bg color={saved ? colors.heart : colors.text} onPress={toggleSave} />
          </View>
        </View>

        {/* ── content sheet (overlaps the hero) ──────────────────────────── */}
        <View style={styles.sheet}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.summary ? <Text style={styles.summary}>{recipe.summary}</Text> : null}

          <View style={styles.meta}>
            <Pill icon="time-outline" label={L.meals.timeTotal(recipe.time_total_min)} />
            <Pill icon="hourglass-outline" label={L.meals.timeActive(recipe.time_active_min)} />
            <Pill icon="people-outline" label={L.meals.servings(recipe.servings)} />
          </View>

          <View style={styles.usesHave}>
            <Ionicons name="checkmark-circle" size={16} color={colors.herb} />
            <Text style={[t.small, { color: colors.herb, marginLeft: 6 }]}>
              {L.meals.usesHave(have.length, recipe.ingredients.length)}
            </Text>
          </View>

          {tags.length ? (
            <View style={styles.tags}>
              {tags.map((tag) => <Pill key={tag} label={TAG_LV[tag]} />)}
            </View>
          ) : null}

          {/* ── tabs ─────────────────────────────────────────────────────── */}
          <View style={{ marginTop: spacing.xl }}>
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'ingredients', label: 'Sastāvdaļas' },
                { value: 'steps', label: 'Pagatavošana' },
                { value: 'nutrition', label: 'Uzturvērtība' },
              ]}
            />
          </View>

          {tab === 'ingredients' ? (
            <View style={{ marginTop: spacing.lg }}>
              {have.length ? (
                <>
                  <SectionLabel>Jau ir mājās</SectionLabel>
                  {have.map((i, idx) => (
                    <View key={`h${idx}`} style={styles.ing}>
                      <View style={styles.ingDot}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.herb} />
                      </View>
                      <Text style={[t.body, { flex: 1 }]}>{i.name}</Text>
                      <Text style={t.small}>{i.qty}</Text>
                    </View>
                  ))}
                </>
              ) : null}
              {missing.length ? (
                <>
                  <SectionLabel style={have.length ? { marginTop: spacing.lg } : undefined}>{L.meals.needToBuy}</SectionLabel>
                  {missing.map((i, idx) => (
                    <View key={`m${idx}`} style={styles.ing}>
                      <View style={styles.ingDot}>
                        <View style={styles.missDot} />
                      </View>
                      <Text style={[t.body, { flex: 1, color: colors.text }]}>{i.name}</Text>
                      <Text style={t.small}>{i.qty}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          {tab === 'steps' ? (
            <View style={{ marginTop: spacing.lg }}>
              {recipe.steps.map((s) => (
                <View key={s.n} style={styles.step}>
                  <View style={styles.stepNum}><Text style={[t.bodyStrong, { color: colors.accentText }]}>{s.n}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.body, { lineHeight: 24 }]}>{s.text}</Text>
                    {s.timer_min ? <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}><Pill icon="timer-outline" label={`${s.timer_min} min`} color={colors.accent} bg={withAlpha(colors.accent, 0.14)} /></View> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'nutrition' ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {recipe.kcal != null ? <MetricCard icon="flame-outline" title={L.meals.kcal(recipe.kcal)} detail="Enerģija" tint={colors.paprika} /> : null}
              <MetricCard icon="people-outline" title={L.meals.servings(recipe.servings)} detail="Porcijas" />
              <MetricCard icon="time-outline" title={L.meals.timeTotal(recipe.time_total_min)} detail="Pagatavošanas laiks" />
              <MetricCard icon="hourglass-outline" title={L.meals.timeActive(recipe.time_active_min)} detail="Aktīvais laiks" tint={colors.herb} />
              {recipe.est_cost_eur != null ? <MetricCard icon="pricetag-outline" title={L.meals.perPerson(recipe.est_cost_eur / Math.max(1, recipe.servings))} detail="Izmaksas uz personu" tint={colors.accentSoft} /> : null}
            </View>
          ) : null}

          {/* ── transform chips ──────────────────────────────────────────── */}
          <SectionLabel style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>{L.meals.transformTitle}</SectionLabel>
          <View style={styles.transformRow}>
            {transformKeys.map((key) => (
              <Chip key={key} label={transformLabel[key]} onPress={() => transform(key)} />
            ))}
          </View>

          {/* ── primary actions ──────────────────────────────────────────── */}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Button label={L.meals.cook} icon="flame" onPress={() => router.push(`/cook/${recipe.id}`)} />
            {missing.length ? (
              <Button
                label={added ? 'Pievienots sarakstam' : L.meals.addMissing}
                icon={added ? 'checkmark' : 'cart-outline'}
                variant="secondary"
                loading={addBusy}
                disabled={added}
                onPress={addMissing}
              />
            ) : null}
          </View>
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
  hero: { height: HERO_H, marginTop: -spacing.lg },
  heroFallback: { height: HERO_H, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, opacity: 0.6 },
  heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 96, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroBar: { position: 'absolute', top: spacing.sm, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheet: {
    marginTop: -spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.huge,
  },
  title: { ...t.h1 },
  summary: { ...t.body, color: colors.textMuted, marginTop: spacing.md, lineHeight: 24 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.lg },
  usesHave: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  ing: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ingDot: { width: 28, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  missDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.paprika },
  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  transformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
});
