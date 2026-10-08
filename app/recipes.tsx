/**
 * "Receptes iedvesmai" — the full list of free, recommended recipes (global,
 * with photos). Openable by anyone; each card opens the normal recipe detail.
 */
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getRecommendedRecipes } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import { EmptyState, IconButton, Muted, Row, Screen, Spinner, Title } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { RecommendedCard } from '@src/meals/RecommendedCard';

export default function RecipesScreen() {
  const { data, isLoading } = useQuery({ queryKey: qk.recommended, queryFn: getRecommendedRecipes, staleTime: 5 * 60_000 });
  const recipes = data ?? [];

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Title>{L.home.recommendedTitle}</Title>
        <IconButton icon="chevron-back" onPress={() => router.back()} bg />
      </Row>
      <Muted style={{ marginBottom: spacing.lg }}>{L.home.recommendedSub}</Muted>

      {isLoading && recipes.length === 0 ? (
        <Spinner label={L.common.loading} />
      ) : recipes.length === 0 ? (
        <EmptyState icon="restaurant-outline" title={L.home.recommendedTitle} body={L.home.recommendedSub} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {recipes.map((r) => (
            <RecommendedCard key={r.id} recipe={r} />
          ))}
        </View>
      )}
    </Screen>
  );
}
