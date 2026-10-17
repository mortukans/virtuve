/**
 * SwipeDeck — the signature Tinder-style card stack for the dinner game
 * ("Pusdienu spēle"). Renders the top ~2 cards: the top one follows the finger
 * (translate + rotate) with a GARŠO / NĒ overlay, flies off past a threshold and
 * reports the decision; a slightly scaled card sits behind it for depth.
 *
 * The top card is remounted per recipe (`key={recipe.id}`), so its shared values
 * reset to 0 for each new card automatically. An imperative handle lets the
 * Like / Skip buttons trigger the same fly-off programmatically.
 *
 * HOOKS RULE: every hook in SwipeCard is called at the top, before any return.
 */
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@src/api/types';
import { colors, radius, shadow, spacing, type as t, withAlpha } from '@src/ui/theme';
import { RecipeImage } from '@src/meals/RecipeImage';
import { L } from '@src/i18n/lv';
import { impact } from '@src/ui/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Fraction of the screen width a card must cross to count as a decision. */
const THRESHOLD = 0.28;
/** Spring used to snap an undecided card back to centre. */
const SNAP = { damping: 17, stiffness: 190, mass: 1 };
const LIKE_LABEL = L.game.like.toUpperCase();
const SKIP_LABEL = L.game.skip.toUpperCase();

export interface SwipeCardHandle {
  /** Fly the card off and decide, as if the user swiped it. */
  swipe: (dir: 'like' | 'skip') => void;
}

// ─── card visual (shared by the top card and the depth card) ────────────────────

function Meta({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={colors.cream} />
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function CardFace({ recipe, height }: { recipe: Recipe; height: number }) {
  return (
    <View style={[styles.cardFace, { height }]}>
      <RecipeImage recipe={recipe} height={height} rounded={false} />
      <View style={styles.scrimMid} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />
      <View style={styles.cardText} pointerEvents="none">
        <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.metaRow}>
          <Meta icon="time-outline" label={`${recipe.time_total_min} min`} />
          <Meta icon="people-outline" label={L.meals.servings(recipe.servings)} />
        </View>
        {recipe.summary ? <Text style={styles.cardSummary} numberOfLines={2}>{recipe.summary}</Text> : null}
      </View>
    </View>
  );
}

// ─── top (draggable) card ───────────────────────────────────────────────────────

interface SwipeCardProps {
  recipe: Recipe;
  height: number;
  onDecide: (liked: boolean) => void;
}

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { recipe, height, onDecide }, ref,
) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const decided = useSharedValue(false);
  const enter = useSharedValue(0.96);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 220 });
  }, [enter]);

  // Fly off the screen then report the decision. Safe to call from the JS thread
  // (buttons / imperative handle): assigning a shared value schedules the
  // animation on the UI thread, and the completion worklet hops back via runOnJS.
  const flyOff = (liked: boolean) => {
    if (decided.value) return;
    decided.value = true;
    impact();
    x.value = withTiming(
      (liked ? 1 : -1) * width * 1.6,
      { duration: 280 },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onDecide)(liked);
      },
    );
  };

  useImperativeHandle(ref, () => ({
    swipe: (dir) => flyOff(dir === 'like'),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { rotate: `${x.value / 20}deg` },
      { scale: enter.value },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, width * 0.25], [0, 1], Extrapolation.CLAMP),
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-width * 0.25, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (decided.value) return;
      x.value = e.translationX;
    })
    .onEnd((e) => {
      'worklet';
      if (decided.value) return;
      const th = width * THRESHOLD;
      if (e.translationX > th) {
        decided.value = true;
        runOnJS(impact)();
        x.value = withTiming(width * 1.6, { duration: 240 }, (finished) => {
          'worklet';
          if (finished) runOnJS(onDecide)(true);
        });
      } else if (e.translationX < -th) {
        decided.value = true;
        runOnJS(impact)();
        x.value = withTiming(-width * 1.6, { duration: 240 }, (finished) => {
          'worklet';
          if (finished) runOnJS(onDecide)(false);
        });
      } else {
        x.value = withSpring(0, SNAP);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.cardShadow, { height }, cardStyle]}>
        <CardFace recipe={recipe} height={height} />
        <Animated.View style={[styles.badge, styles.badgeLike, likeStyle]} pointerEvents="none">
          <Text style={[styles.badgeText, { color: colors.herb }]}>{LIKE_LABEL}</Text>
        </Animated.View>
        <Animated.View style={[styles.badge, styles.badgeSkip, skipStyle]} pointerEvents="none">
          <Text style={[styles.badgeText, { color: colors.paprika }]}>{SKIP_LABEL}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

// ─── the stack ──────────────────────────────────────────────────────────────────

interface SwipeDeckProps {
  deck: Recipe[];
  index: number;
  onDecide: (liked: boolean) => void;
  cardRef: React.RefObject<SwipeCardHandle | null>;
}

export function SwipeDeck({ deck, index, onDecide, cardRef }: SwipeDeckProps) {
  const { height: winH } = useWindowDimensions();
  const cardH = Math.max(360, Math.min(winH * 0.52, 460));
  const top = deck[index];
  const next = deck[index + 1];
  if (!top) return null;

  return (
    <View style={styles.deckArea}>
      {next ? (
        <View style={styles.behindWrap} pointerEvents="none">
          <View style={[styles.cardShadow, styles.behind, { height: cardH }]}>
            <CardFace recipe={next} height={cardH} />
          </View>
        </View>
      ) : null}
      <SwipeCard key={top.id} ref={cardRef} recipe={top} height={cardH} onDecide={onDecide} />
    </View>
  );
}

const styles = StyleSheet.create({
  deckArea: { flex: 1, justifyContent: 'center' },
  behindWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  behind: { transform: [{ scale: 0.94 }, { translateY: 18 }], opacity: 0.6 },
  cardShadow: { width: '100%', borderRadius: radius.lg, ...shadow.card },
  cardFace: {
    width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt,
  },
  scrimMid: { position: 'absolute', left: 0, right: 0, bottom: '40%', height: '22%', backgroundColor: 'rgba(0,0,0,0.26)' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', backgroundColor: 'rgba(0,0,0,0.58)' },
  cardText: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  cardTitle: { ...t.h2, color: colors.cream, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  cardSummary: { ...t.small, color: withAlpha(colors.cream, 0.9), marginTop: spacing.sm, lineHeight: 19 },
  meta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: withAlpha(colors.bg, 0.5), paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  metaLabel: { ...t.small, color: colors.cream, fontWeight: '600' },
  badge: {
    position: 'absolute', top: 18, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.md, borderWidth: 3, backgroundColor: 'rgba(12,16,13,0.35)',
  },
  badgeLike: { left: 18, borderColor: colors.herb, transform: [{ rotate: '-12deg' }] },
  badgeSkip: { right: 18, borderColor: colors.paprika, transform: [{ rotate: '12deg' }] },
  badgeText: { fontSize: 26, fontWeight: '800', letterSpacing: 1 },
});
