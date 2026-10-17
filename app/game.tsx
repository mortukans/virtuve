/**
 * Pusdienu spēle — the Tinder-style dinner discovery game.
 *
 * Flow (local `phase` state): 'swipe' → 'review' → 'preview'.
 *  • swipe   — card stack (src/game/SwipeDeck); swipe / tap to like or skip.
 *  • review  — the liked recipes; tap one to preview it.
 *  • preview — ingredient checklist + add-to-shopping + open full recipe.
 *
 * HOOKS RULE (a past build crashed on this): EVERY hook is called at the very top
 * of the component, before any early `return`. Do not move a hook below a guard.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  addMissingFromRecipe, addShoppingItems, getGameDeck, getInventory, getShoppingList,
} from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { FoodCategory, Member, Recipe, ShoppingDraft } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { prepareDeck } from '@src/game/filter';
import { useReminder } from '@src/game/reminder';
import { SwipeDeck, type SwipeCardHandle } from '@src/game/SwipeDeck';
import { useAction } from '@src/ui/useAction';
import {
  Button, Card, EmptyState, IconButton, Muted, Pill, Row, Screen, SectionLabel, Spinner, Title,
} from '@src/ui/kit';
import { colors, radius, spacing, type as t, withAlpha } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { RecipeImage } from '@src/meals/RecipeImage';
import { success, tap } from '@src/ui/haptics';

type Phase = 'swipe' | 'review' | 'preview';
interface Check { name: string; qty: string; have: boolean; checked: boolean }

const EMPTY_MEMBERS: Member[] = [];
const norm = (s: string): string => s.toLowerCase().trim();
/** Case-insensitive "contains" that ignores empty needles. */
const contains = (haystack: string, needle: string): boolean => {
  const n = norm(needle);
  return n.length > 0 && norm(haystack).includes(n);
};

// ─── header (shared by every phase) ─────────────────────────────────────────────

function GameHeader({ enabled, showBell = true, onBack, onBell }: {
  enabled: boolean; showBell?: boolean; onBack: () => void; onBell: () => void;
}) {
  return (
    <View style={styles.header}>
      <IconButton icon="chevron-back" bg onPress={onBack} />
      <Text style={styles.headerTitle} numberOfLines={1}>{L.game.title}</Text>
      {showBell ? (
        <IconButton
          icon={enabled ? 'notifications' : 'notifications-outline'}
          bg
          color={enabled ? colors.accent : colors.text}
          onPress={onBell}
        />
      ) : <View style={{ width: 44 }} />}
    </View>
  );
}

function LikedCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.likedCard}>
      <Row gap={spacing.md}>
        <View style={styles.thumb}>
          <RecipeImage recipe={recipe} height={72} rounded={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={t.bodyStrong} numberOfLines={2}>{recipe.title}</Text>
          <Row gap={spacing.xs} style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <Pill icon="time-outline" label={`${recipe.time_total_min} min`} />
            <Pill icon="people-outline" label={L.meals.servings(recipe.servings)} />
          </Row>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Row>
    </Card>
  );
}

function RoundButton({ icon, tint, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: withAlpha(tint, 0.16), borderColor: tint },
        pressed && { transform: [{ scale: 0.92 }], opacity: 0.9 },
      ]}
    >
      <Ionicons name={icon} size={30} color={tint} />
    </Pressable>
  );
}

// ─── screen ─────────────────────────────────────────────────────────────────────

export default function GameScreen() {
  // ---- ALL hooks first, unconditionally (see HOOKS RULE above) ----
  const { household, activeId, isLoading: hhLoading } = useHouseholdCtx();
  const reminder = useReminder();

  const [phase, setPhase] = useState<Phase>('swipe');
  const [deck, setDeck] = useState<Recipe[]>([]);
  const [prepared, setPrepared] = useState(false);
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [checklist, setChecklist] = useState<Check[]>([]);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [reminderNote, setReminderNote] = useState<string | null>(null);

  const cardRef = useRef<SwipeCardHandle | null>(null);
  const { run: runAdd, busy: addBusy } = useAction();
  const { run: runAll, busy: allBusy } = useAction();

  const deckQuery = useQuery({ queryKey: qk.gameDeck, queryFn: getGameDeck });
  const invQuery = useQuery({
    queryKey: activeId ? qk.inventory(activeId) : ['inventory', 'none'],
    queryFn: () => getInventory(activeId as string),
    enabled: !!activeId,
  });
  const shopQuery = useQuery({
    queryKey: activeId ? qk.shopping(activeId) : ['shopping', 'none'],
    queryFn: () => getShoppingList(activeId as string),
    enabled: !!activeId,
  });

  const members = household?.members ?? EMPTY_MEMBERS;

  // Build the deck ONCE, after both the recipes and the household have resolved,
  // so the dietary filter sees the real members. Reshuffle only on restart.
  useEffect(() => {
    if (!prepared && deckQuery.data && !hhLoading && activeId) {
      setDeck(prepareDeck(deckQuery.data, members));
      setPrepared(true);
    }
  }, [prepared, deckQuery.data, hhLoading, activeId, members]);

  // (Re)build the preview checklist whenever the selected recipe or inventory
  // changes: an ingredient defaults to CHECKED (to buy) unless it's in the kitchen.
  useEffect(() => {
    if (!selected) { setChecklist([]); return; }
    const inv = invQuery.data ?? [];
    setChecklist(
      (selected.ingredients ?? []).map((ing) => {
        const have = inv.some((it) => contains(it.name, ing.name) || contains(ing.name, it.name));
        return { name: ing.name, qty: ing.qty, have, checked: !have };
      }),
    );
  }, [selected, invQuery.data]);

  // ---- derived values (not hooks) ----
  const checkedCount = checklist.filter((c) => c.checked).length;
  const hasIngredients = checklist.length > 0;

  // ---- handlers (not hooks) ----
  const onDecide = (isLike: boolean) => {
    const card = deck[index];
    if (isLike && card) setLiked((prev) => [...prev, card]);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= deck.length) setPhase('review');
  };

  const handleBell = () => {
    const next = !reminder.enabled;
    void reminder.toggle(next).then((ok) => {
      if (next && !ok) setReminderNote(reminder.supported ? L.game.reminderDenied : L.game.reminderUnsupported);
      else setReminderNote(null);
    });
  };

  const restart = () => {
    setDeck(prepareDeck(deckQuery.data ?? [], members));
    setIndex(0);
    setLiked([]);
    setSelected(null);
    setChecklist([]);
    setAddedMsg(null);
    setPhase('swipe');
  };

  const keepBrowsing = () => {
    if (index < deck.length) setPhase('swipe');
    else restart();
  };

  const openPreview = (r: Recipe) => {
    setSelected(r);
    setAddedMsg(null);
    setPhase('preview');
  };

  const toggleCheck = (i: number) =>
    setChecklist((prev) => prev.map((c, idx) => (idx === i ? { ...c, checked: !c.checked } : c)));

  const confirmAdded = () => {
    success();
    setAddedMsg(L.game.addedToList);
    if (activeId) void queryClient.invalidateQueries({ queryKey: qk.shopping(activeId) });
  };

  const addSelected = () => {
    if (!activeId || !selected) return;
    const existing = new Set((shopQuery.data ?? []).map((s) => norm(s.name)));
    const drafts: ShoppingDraft[] = checklist
      .filter((c) => c.checked && !existing.has(norm(c.name)))
      .map((c) => ({ name: c.name, category: 'other' as FoodCategory }));
    if (drafts.length === 0) { confirmAdded(); return; } // everything selected is already on the list
    void runAdd(() => addShoppingItems(activeId, drafts), { onDone: confirmAdded });
  };

  const addAll = () => {
    if (!activeId || !selected) return;
    void runAll(() => addMissingFromRecipe(activeId, selected.id), { onDone: confirmAdded });
  };

  const head = (
    <GameHeader enabled={reminder.enabled} onBack={() => router.back()} onBell={handleBell} />
  );

  // ---- guarded returns (AFTER every hook) ----
  if (hhLoading) {
    return <Screen><Spinner label={L.common.loading} /></Screen>;
  }
  if (!activeId) {
    return (
      <Screen pad={false}>
        <View style={styles.body}>
          <GameHeader enabled={false} showBell={false} onBack={() => router.back()} onBell={() => {}} />
          <EmptyState
            icon="home-outline"
            title={L.home.noHousehold}
            action={L.home.createHousehold}
            onAction={() => router.push('/household/create')}
          />
        </View>
      </Screen>
    );
  }
  if (deckQuery.isLoading || !prepared) {
    return (
      <Screen pad={false}>
        <View style={styles.body}>{head}<Spinner label={L.game.loading} /></View>
      </Screen>
    );
  }
  if (deckQuery.isError) {
    return (
      <Screen pad={false}>
        <View style={styles.body}>{head}<EmptyState icon="sad-outline" title={L.game.noRecipes} /></View>
      </Screen>
    );
  }

  // ---- phase content ----
  return (
    <Screen pad={false}>
      <View style={styles.body}>
        {head}
        {reminder.enabled ? <Muted style={styles.note}>{L.game.reminderBody}</Muted> : null}
        {reminderNote ? <Muted style={[styles.note, { color: colors.paprika }]}>{reminderNote}</Muted> : null}

        {phase === 'swipe' ? (
          <View style={{ flex: 1 }}>
            <Muted style={styles.intro}>{L.game.intro}</Muted>
            {deck.length === 0 ? (
              <EmptyState icon="fast-food-outline" title={L.game.noRecipes} />
            ) : index >= deck.length ? null : (
              <>
                <SwipeDeck deck={deck} index={index} onDecide={onDecide} cardRef={cardRef} />
                <View style={styles.controls}>
                  <RoundButton icon="close" tint={colors.paprika} onPress={() => cardRef.current?.swipe('skip')} />
                  <RoundButton icon="heart" tint={colors.herb} onPress={() => cardRef.current?.swipe('like')} />
                </View>
                <View style={styles.finishWrap}>
                  <Button label={L.game.finish} variant="ghost" full={false} onPress={() => setPhase('review')} />
                </View>
              </>
            )}
          </View>
        ) : null}

        {phase === 'review' ? (
          liked.length === 0 ? (
            <View style={styles.emptyReview}>
              <View style={styles.emptyCircle}>
                <Ionicons name="restaurant-outline" size={32} color={colors.accent} />
              </View>
              <Title style={{ textAlign: 'center', marginTop: spacing.md }}>{L.game.noLikesTitle}</Title>
              <Muted style={{ textAlign: 'center', marginTop: 6, maxWidth: 300 }}>{L.game.noLikesBody}</Muted>
              <View style={styles.emptyActions}>
                <Button label={L.game.keepBrowsing} variant="secondary" onPress={keepBrowsing} />
                <Button label={L.game.restart} onPress={restart} />
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
              <Title style={{ marginTop: spacing.sm }}>{L.game.reviewTitle}</Title>
              <Muted style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{L.game.reviewBody(liked.length)}</Muted>
              {liked.map((r) => <LikedCard key={r.id} recipe={r} onPress={() => openPreview(r)} />)}
              <Button label={L.game.restart} variant="ghost" onPress={restart} style={{ marginTop: spacing.md }} />
            </ScrollView>
          )
        ) : null}

        {phase === 'preview' && selected ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
            <View style={styles.previewBack}>
              <Button label={L.common.back} icon="chevron-back" variant="ghost" full={false} onPress={() => setPhase('review')} />
            </View>
            <View style={styles.previewImage}>
              <RecipeImage recipe={selected} height={220} rounded={false} />
            </View>
            <Title style={{ marginTop: spacing.md }}>{selected.title}</Title>
            <Row gap={spacing.xs} style={{ marginTop: spacing.sm, flexWrap: 'wrap' }}>
              <Pill icon="time-outline" label={`${selected.time_total_min} min`} />
              <Pill icon="people-outline" label={L.meals.servings(selected.servings)} />
            </Row>

            <SectionLabel style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>{L.game.ingredientsTitle}</SectionLabel>
            {!hasIngredients ? (
              <Muted>{L.game.nothingToAdd}</Muted>
            ) : (
              checklist.map((c, i) => (
                <Pressable
                  key={`${c.name}-${i}`}
                  onPress={() => { tap(); toggleCheck(i); }}
                  style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons
                    name={c.checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={c.checked ? colors.accent : colors.textFaint}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={t.body}>{c.name}</Text>
                    {c.qty ? <Text style={[t.small, { marginTop: 1 }]}>{c.qty}</Text> : null}
                  </View>
                  {c.have ? (
                    <Pill label={L.game.haveIt} color={colors.herb} bg={withAlpha(colors.herb, 0.14)} />
                  ) : (
                    <Pill label={L.game.toBuy} color={colors.accent} bg={withAlpha(colors.accent, 0.14)} />
                  )}
                </Pressable>
              ))
            )}

            {addedMsg ? (
              <Row gap={spacing.xs} style={{ marginTop: spacing.md }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.herb} />
                <Text style={[t.small, { color: colors.herb }]}>{addedMsg}</Text>
              </Row>
            ) : null}
            {hasIngredients && checkedCount === 0 ? (
              <Muted style={{ marginTop: spacing.sm }}>{L.game.nothingToAdd}</Muted>
            ) : null}

            <View style={styles.previewActions}>
              <Button
                label={L.game.addSelected(checkedCount)}
                icon="cart-outline"
                onPress={addSelected}
                disabled={checkedCount === 0}
                loading={addBusy}
              />
              <Button label={L.game.addAllMissing} icon="add-circle-outline" variant="secondary" loading={allBusy} onPress={addAll} />
              <Button label={L.game.openRecipe} icon="book-outline" onPress={() => router.push(`/meals/${selected.id}`)} />
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  headerTitle: { ...t.h2, flex: 1, textAlign: 'center' },
  note: { marginTop: spacing.xs },
  intro: { marginTop: spacing.sm, marginBottom: spacing.md },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xxl, marginTop: spacing.md },
  finishWrap: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  round: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scrollPad: { paddingBottom: spacing.huge },
  likedCard: { marginBottom: spacing.sm, padding: spacing.sm },
  thumb: { width: 92, borderRadius: radius.md, overflow: 'hidden' },
  emptyReview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(colors.accent, 0.12), alignItems: 'center', justifyContent: 'center' },
  emptyActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl },
  previewBack: { alignSelf: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.sm },
  previewImage: { borderRadius: radius.lg, overflow: 'hidden' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  previewActions: { marginTop: spacing.lg, gap: spacing.sm },
});
