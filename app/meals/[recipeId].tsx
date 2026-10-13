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
import { hasNutrition, parseNutrition, scaleQty, visibleTags } from '@src/meals/library';
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
  const [servingsOverride, setServingsOverride] = useState<number | null>(null);

  const { data: recipe, isLoading } = useQuery({
    queryKey: qk.recipe(recipeId),
    queryFn: () => getRecipe(recipeId),
    enabled: !!recipeId,
  });

  if (isLoading) return <Screen><Spinner label={L.common.loading} /></Screen>;
  if (!recipe) return <Screen><EmptyState icon="sad-outline" title={L.common.error} action={L.common.back} onAction={() => router.back()} /></Screen>;

  const have = recipe.ingredients.filter((i) => i.have);
  const missing: RecipeIngredient[] = recipe.missing?.length ? recipe.missing : recipe.ingredients.filter((i) => !i.have);
  const tags = visibleTags(recipe).filter((tag) => TAG_LV[tag]);
  const transformKeys = Object.keys(transformLabel) as TransformKey[];

  // Serving scaler — display-only. addMissingFromRecipe stays recipe-based (below).
  const MIN_SERVINGS = 1;
  const MAX_SERVINGS = 12;
  const servings = servingsOverride ?? recipe.servings;
  const scaleFactor = recipe.servings > 0 ? servings / recipe.servings : 1;
  const stepServings = (delta: number) =>
    setServingsOverride(Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, servings + delta)));

  // Per-serving nutrition from kcal + the encoded macro tags.
  const nutrition = parseNutrition(recipe);
  const macros: { label: string; g: number; color: string }[] = [];
  if (nutrition.protein != null) macros.push({ label: L.meals.protein, g: nutrition.protein, color: colors.herb });
  if (nutrition.carbs != null) macros.push({ label: L.meals.carbs, g: nutrition.carbs, color: colors.orange });
  if (nutrition.fat != null) macros.push({ label: L.meals.fat, g: nutrition.fat, color: colors.paprika });

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
              {/* serving scaler — rescales the quantities shown below (display-only) */}
              <View style={styles.scaler}>
                <IconButton
                  icon="remove"
                  bg
                  color={servings <= MIN_SERVINGS ? colors.textFaint : colors.text}
                  onPress={() => stepServings(-1)}
                />
                <Text style={styles.scalerLabel}>{L.meals.servings(servings)}</Text>
                <IconButton
                  icon="add"
                  bg
                  color={servings >= MAX_SERVINGS ? colors.textFaint : colors.text}
                  onPress={() => stepServings(1)}
                />
              </View>
              {have.length ? (
                <>
                  <SectionLabel>Jau ir mājās</SectionLabel>
                  {have.map((i, idx) => (
                    <View key={`h${idx}`} style={styles.ing}>
                      <View style={styles.ingDot}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.herb} />
                      </View>
                      <Text style={[t.body, { flex: 1 }]}>{i.name}</Text>
                      <Text style={t.small}>{scaleQty(i.qty, scaleFactor)}</Text>
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
                      <Text style={t.small}>{scaleQty(i.qty, scaleFactor)}</Text>
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
              {hasNutrition(nutrition) ? (
                <View style={styles.nutritionPanel}>
                  <SectionLabel style={{ marginBottom: spacing.md }}>{L.meals.perServing}</SectionLabel>
                  {nutrition.kcal != null ? (
                    <View style={styles.ringWrap}>
                      <View style={styles.ring}>
                        <Text style={styles.ringNum}>{nutrition.kcal}</Text>
                        <Text style={styles.ringUnit}>{L.meals.kcalShort}</Text>
                      </View>
                      <Text style={styles.ringCaption}>{L.meals.calories}</Text>
                    </View>
                  ) : null}
                  {macros.length ? (
                    <View style={styles.macroRow}>
                      {macros.map((m) => (
                        <View key={m.label} style={styles.macroCard}>
                          <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                          <Text style={[styles.macroVal, { color: m.color }]}>{`${m.g} g`}</Text>
                          <Text style={styles.macroLabel} numberOfLines={1}>{m.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.nutritionNote}>{L.meals.nutritionNote}</Text>
                </View>
              ) : null}
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
  scaler: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.lg,
  },
  scalerLabel: { ...t.bodyStrong },
  nutritionPanel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  ringWrap: { alignItems: 'center', marginBottom: spacing.lg },
  ring: {
    width: 136, height: 136, borderRadius: 68, borderWidth: 6, borderColor: colors.accent,
    backgroundColor: withAlpha(colors.accent, 0.08), alignItems: 'center', justifyContent: 'center',
  },
  ringNum: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  ringUnit: { ...t.small, color: colors.textMuted, marginTop: -2 },
  ringCaption: { ...t.small, marginTop: spacing.sm },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroCard: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', gap: 5,
  },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroVal: { ...t.h3 },
  macroLabel: { ...t.tiny, color: colors.textMuted, letterSpacing: 0.3 },
  nutritionNote: { ...t.small, color: colors.textFaint, marginTop: spacing.md },
});
