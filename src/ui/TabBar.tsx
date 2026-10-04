/**
 * Floating tab dock — a rounded, raised bar with four labelled tabs and a central
 * saffron "+" FAB that lifts above it. Replaces the default full-width tab bar.
 * The FAB opens the fridge scan (the signature "add food" action).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion, radius, shadow, spacing, withAlpha } from './theme';
import { L } from '@src/i18n/lv';
import { tap } from './haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { on: IconName; off: IconName; label: string }> = {
  home: { on: 'restaurant', off: 'restaurant-outline', label: L.nav.home },
  kitchen: { on: 'snow', off: 'snow-outline', label: L.nav.kitchen },
  shopping: { on: 'cart', off: 'cart-outline', label: L.nav.shopping },
  us: { on: 'people', off: 'people-outline', label: L.nav.us },
};

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => ICONS[r.name]);
  const mid = Math.ceil(routes.length / 2);
  const left = routes.slice(0, mid);
  const right = routes.slice(mid);

  const renderTab = (route: (typeof routes)[number]) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === index;
    const cfg = ICONS[route.name];
    const color = focused ? colors.accent : colors.textFaint;
    const onPress = () => {
      tap();
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Pressable key={route.key} onPress={onPress} style={styles.tab} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: focused }} accessibilityLabel={cfg.label}>
        <View style={[styles.iconWrap, focused && { backgroundColor: withAlpha(colors.accent, 0.14) }]}>
          <Ionicons name={focused ? cfg.on : cfg.off} size={22} color={color} />
        </View>
        <Text style={[styles.label, { color }]} numberOfLines={1}>{cfg.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow.dock]}>
        <View style={styles.side}>{left.map(renderTab)}</View>
        <View style={{ width: 72 }} />
        <View style={styles.side}>{right.map(renderTab)}</View>
      </View>
      <Fab />
    </View>
  );
}

function Fab() {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.fabWrap, anim]} pointerEvents="box-none">
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.9, motion.spring); }}
        onPressOut={() => { scale.value = withSpring(1, motion.spring); }}
        onPress={() => { tap(); router.push('/scan'); }}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel={L.kitchen.scanPhoto}
      >
        <Ionicons name="add" size={32} color={colors.accentText} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 14 },
  bar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    backgroundColor: withAlpha('#1D241E', 0.96), borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    height: 66, paddingHorizontal: spacing.xs,
  },
  side: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, minWidth: 56 },
  iconWrap: { width: 40, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  fabWrap: { position: 'absolute', top: -20, alignSelf: 'center' },
  fab: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg, ...shadow.fab,
  },
});
