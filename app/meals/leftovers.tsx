/**
 * "No atlikumiem" — turn whatever is left over into new meal ideas. The user
 * builds a free-text list of leftovers shown as removable chips, then the
 * ai-leftovers edge function returns recipes rendered with the shared RecipeCard.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { aiLeftovers } from '@src/api/rpc';
import type { Recipe } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useAction } from '@src/ui/useAction';
import { Body, Button, Chip, Field, IconButton, Row, Screen, Spinner } from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { RecipeCard } from '@src/meals/RecipeCard';

export default function Leftovers() {
  const { activeId } = useHouseholdCtx();
  const { run, busy } = useAction();

  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);

  const addItem = () => {
    const v = draft.trim();
    if (!v) { setDraft(''); return; }
    setItems((cur) => (cur.some((x) => x.toLowerCase() === v.toLowerCase()) ? cur : [...cur, v]));
    setDraft('');
  };
  const removeItem = (v: string) => setItems((cur) => cur.filter((x) => x !== v));

  const generate = () => {
    if (!activeId || items.length === 0) return;
    void run(() => aiLeftovers(activeId, items), {
      onDone: (res) => setRecipes(res.recipes),
    });
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <Text style={t.h1}>{L.meals.leftoversTitle}</Text>
      </View>

      <Body muted style={{ marginBottom: spacing.lg }}>{L.meals.leftoversBody}</Body>

      {items.length > 0 ? (
        <View style={styles.chips}>
          {items.map((it) => (
            <Chip key={it} label={it} selected onRemove={() => removeItem(it)} />
          ))}
        </View>
      ) : null}

      <Row gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder={L.meals.leftoversPlaceholder}
            onSubmitEditing={addItem}
            returnKeyType="done"
            blurOnSubmit={false}
            autoCapitalize="sentences"
          />
        </View>
        <View style={{ marginBottom: spacing.md }}>
          <IconButton icon="add-circle" onPress={addItem} color={colors.accent} size={30} />
        </View>
      </Row>

      <Button
        label={L.meals.leftoversGenerate}
        icon="sparkles"
        loading={busy}
        disabled={items.length === 0}
        onPress={generate}
        style={{ marginTop: spacing.md }}
      />

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
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginLeft: -spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
});
