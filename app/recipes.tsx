/**
 * "Receptes iedvesmai" — the discovery surface for the global recipe library
 * (200+ recipes with photos). Browse by category, search by title/tag, or let
 * "Pārsteidz mani" pick for you. A virtualised 2-column FlatList keeps it smooth
 * at hundreds of cards. Every card opens the normal recipe detail.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getRecommendedRecipes } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import {
  Button, Chip, EmptyState, Field, IconButton, IngredientConstellation,
  Muted, Row, Screen, Spinner, Title,
} from '@src/ui/kit';
import { spacing } from '@src/ui/theme';
import { L, count, recipeCategoryLabel } from '@src/i18n/lv';
import {
  RECIPE_CATEGORY_KEYS, recipeCategory, visibleTags, type RecipeCategoryKey,
} from '@src/meals/library';
import { RecommendedCard } from '@src/meals/RecommendedCard';

export default function RecipesScreen() {
  const { data, isLoading } = useQuery({ queryKey: qk.recommended, queryFn: getRecommendedRecipes, staleTime: 5 * 60_000 });
  const recipes = data ?? [];

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RecipeCategoryKey | null>(null);

  const { width: screenW } = useWindowDimensions();
  const tileWidth = (screenW - 2 * spacing.lg - spacing.md) / 2;

  // Only offer a category chip if at least one loaded recipe is in it (keeps order).
  const presentCategories = useMemo(() => {
    const seen = new Set<RecipeCategoryKey>();
    for (const r of recipes) {
      const c = recipeCategory(r);
      if (c) seen.add(c);
    }
    return RECIPE_CATEGORY_KEYS.filter((k) => seen.has(k));
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (category && recipeCategory(r) !== category) return false;
      if (!q) return true;
      if (r.title.toLowerCase().includes(q)) return true;
      return visibleTags(r).some((tag) => tag.toLowerCase().includes(q));
    });
  }, [recipes, query, category]);

  const resetFilters = () => { setQuery(''); setCategory(null); };

  const onSurprise = () => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/meals/${pick.id}`);
  };

  const header = (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Title>{L.home.recommendedTitle}</Title>
        <IconButton icon="chevron-back" onPress={() => router.back()} bg />
      </Row>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <Muted style={{ flex: 1, marginRight: spacing.md }}>{L.home.recommendedSub}</Muted>
        <IngredientConstellation />
      </Row>

      <Field
        placeholder={L.meals.searchRecipes}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {presentCategories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -spacing.lg, marginBottom: spacing.lg }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
        >
          <Chip label={L.meals.allCategories} selected={category === null} onPress={() => setCategory(null)} />
          {presentCategories.map((key) => (
            <Chip key={key} label={recipeCategoryLabel[key]} selected={category === key} onPress={() => setCategory(key)} />
          ))}
        </ScrollView>
      ) : null}

      <Button
        label={L.meals.surpriseMe}
        icon="sparkles"
        variant="secondary"
        onPress={onSurprise}
        disabled={filtered.length === 0}
        style={{ marginBottom: spacing.lg }}
      />

      <Muted style={{ marginBottom: spacing.md }}>{count(filtered.length, 'recepte', 'receptes')}</Muted>
    </View>
  );

  return (
    <Screen pad={false}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={2}
        renderItem={({ item }) => <RecommendedCard recipe={item} width={tileWidth} />}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.huge, rowGap: spacing.lg }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading ? (
            <Spinner label={L.common.loading} />
          ) : (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <EmptyState
                icon="search-outline"
                title={L.meals.nothingFound}
                body="Pamēģini citu meklējumu vai kategoriju."
                action="Notīrīt"
                onAction={resetFilters}
              />
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
    </Screen>
  );
}
