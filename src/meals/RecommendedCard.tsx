/**
 * Compact recommended-recipe card: photo on top, title + quick meta below.
 * Tap opens the full recipe detail (global recipes open for everyone). Used in
 * the Home "Iesakām" rail and the full recommended-recipes screen.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@src/api/types';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { tap } from '@src/ui/haptics';
import { RecipeImage } from './RecipeImage';

export function RecommendedCard({ recipe, width }: { recipe: Recipe; width?: number }) {
  return (
    <Pressable
      onPress={() => { tap(); router.push(`/meals/${recipe.id}`); }}
      style={({ pressed }) => [
        styles.card,
        width ? { width } : { alignSelf: 'stretch' },
        pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
      ]}
    >
      <RecipeImage recipe={recipe} height={150} rounded={false} />
      <View style={styles.body}>
        <Text style={t.bodyStrong} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={t.small}>{`${recipe.time_total_min} min`}</Text>
          <Text style={t.small}>·</Text>
          <Text style={t.small}>{L.meals.servings(recipe.servings)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  body: { padding: spacing.md, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
