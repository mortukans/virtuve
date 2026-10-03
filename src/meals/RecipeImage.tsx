/**
 * Recipe hero image. Shows the AI/preview photo when present; otherwise a
 * premium typographic panel (big title over a warm tint + faint food glyph) so
 * an image-less recipe still looks intentional. Reused by the card + detail/cook.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@src/api/types';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { L } from '@src/i18n/lv';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const glyphFor = (tags: string[]): IconName => {
  if (tags.includes('air_fryer')) return 'flame-outline';
  if (tags.includes('healthy') || tags.includes('light')) return 'leaf-outline';
  if (tags.includes('comfort')) return 'cafe-outline';
  if (tags.includes('high_protein')) return 'nutrition-outline';
  if (tags.includes('one_pan')) return 'egg-outline';
  return 'restaurant-outline';
};

/** Deterministic warm tint from a seed so different recipes read differently. */
const tintFor = (seed: string): string => {
  const palette = [colors.accent, colors.accentDeep, colors.orange, colors.red, colors.green];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

export function RecipeImage({
  recipe, height = 190, rounded = true, overlayTitle = false,
}: {
  recipe: Recipe; height?: number; rounded?: boolean; overlayTitle?: boolean;
}) {
  const r = rounded ? radius.lg : 0;

  if (recipe.image_url) {
    return (
      <View style={{ height, borderRadius: r, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
        <Image source={{ uri: recipe.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        {recipe.image_is_ai ? (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={11} color={colors.text} />
            <Text style={[t.tiny, { color: colors.text, marginLeft: 4 }]}>{L.meals.aiImage}</Text>
          </View>
        ) : null}
        {overlayTitle ? (
          <>
            <View style={styles.scrim} />
            <Text style={[t.h1, styles.overlayTitle]} numberOfLines={3}>{recipe.title}</Text>
          </>
        ) : null}
      </View>
    );
  }

  const tint = tintFor(recipe.id || recipe.title);
  return (
    <View style={[styles.typo, { height, borderRadius: r }]}>
      <View style={[styles.glow, { backgroundColor: tint }]} />
      <Ionicons name={glyphFor(recipe.tags)} size={Math.round(height * 0.6)} color={tint} style={styles.watermark} />
      <Text style={[t.h1, { color: colors.text }]} numberOfLines={3}>{recipe.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  typo: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  glow: {
    position: 'absolute', top: -60, right: -50, width: 180, height: 180, borderRadius: 90, opacity: 0.22,
  },
  watermark: { position: 'absolute', top: 6, right: 10, opacity: 0.16 },
  aiBadge: {
    position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.overlay, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  overlayTitle: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
});
