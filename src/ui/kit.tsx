/**
 * Virtuve UI kit — shared building blocks so every screen reads as one system.
 * Import from '@src/ui/kit'. Colours/spacing/type come from theme.ts.
 *
 * Redesign ("Virtuve dzīvo"): rounder surfaces, saffron reserved for the current
 * action, larger type, press-scale feedback, floating metric cards, expressive
 * select cards and a decorative ingredient constellation.
 */
import React from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, DOCK_CLEARANCE, radius, shadow, spacing, type as t, withAlpha } from './theme';
import { tap } from './haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── layout ───────────────────────────────────────────────────────────────────

export function Screen({
  children, scroll = false, pad = true, dock = false, style, contentStyle,
}: {
  children: React.ReactNode; scroll?: boolean; pad?: boolean; dock?: boolean;
  style?: ViewStyle; contentStyle?: ViewStyle;
}) {
  const inner = <View style={[pad && { paddingHorizontal: spacing.lg }, { flex: scroll ? undefined : 1 }, scroll && { paddingTop: spacing.lg }, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingBottom: dock ? DOCK_CLEARANCE : spacing.huge }, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = spacing.sm }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export const Divider = () => <View style={styles.divider} />;

export const Spinner = ({ label }: { label?: string }) => (
  <View style={styles.center}>
    <ActivityIndicator color={colors.accent} />
    {label ? <Text style={[t.small, { marginTop: spacing.sm }]}>{label}</Text> : null}
  </View>
);

// ─── text ─────────────────────────────────────────────────────────────────────

export const Title = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[t.h1, style]}>{children}</Text>
);
export const Hero = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[t.hero, style]}>{children}</Text>
);
export const H2 = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[t.h2, style]}>{children}</Text>
);
export const Body = ({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) => (
  <Text style={[t.body, muted && { color: colors.textMuted }, style]}>{children}</Text>
);
export const Muted = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[t.small, style]}>{children}</Text>
);

/** Uppercase, tracked, muted section label (matches the spec's KOSectionLabel). */
export const SectionLabel = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[styles.sectionLabel, style]}>{String(children).toUpperCase()}</Text>
);

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      {action && onAction ? (
        <Pressable onPress={() => { tap(); onAction(); }} hitSlop={8}>
          <Text style={[t.small, { color: colors.accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  label, onPress, variant = 'primary', icon, disabled, loading, style, full = true,
}: {
  label: string; onPress: () => void; variant?: ButtonVariant; icon?: IconName;
  disabled?: boolean; loading?: boolean; style?: ViewStyle; full?: boolean;
}) {
  const v = BTN[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={() => { if (!off) { tap(); onPress(); } }}
      disabled={off}
      style={({ pressed }) => [
        styles.btn, { backgroundColor: v.bg, borderColor: v.border },
        full && { alignSelf: 'stretch' },
        pressed && !off && { transform: [{ scale: 0.985 }], opacity: 0.92 },
        off && { opacity: 0.45 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Row gap={spacing.sm} style={{ justifyContent: 'center' }}>
          {icon ? <Ionicons name={icon} size={19} color={v.fg} /> : null}
          <Text style={[t.bodyStrong, { color: v.fg, fontWeight: '700' }]}>{label}</Text>
        </Row>
      )}
    </Pressable>
  );
}

const BTN: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
  danger: { bg: 'transparent', fg: colors.paprika, border: colors.paprika },
};

export function IconButton({ icon, onPress, color = colors.text, size = 22, bg }: { icon: IconName; onPress: () => void; color?: string; size?: number; bg?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={10} style={({ pressed }) => [styles.iconBtn, bg && styles.iconBtnBg, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// ─── surfaces ─────────────────────────────────────────────────────────────────

export function Card({ children, onPress, style, raised }: { children: React.ReactNode; onPress?: () => void; style?: ViewStyle; raised?: boolean }) {
  const content = <View style={[styles.card, raised && shadow.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] }}>
      {content}
    </Pressable>
  );
}

export function ListRow({ title, subtitle, left, right, onPress }: {
  title: string; subtitle?: string; left?: React.ReactNode; right?: React.ReactNode; onPress?: () => void;
}) {
  const body = (
    <View style={styles.listRow}>
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={t.body}>{title}</Text>
        {subtitle ? <Text style={[t.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { opacity: 0.8 }}>{body}</Pressable>;
}

/** Floating metric row: tinted icon medallion + title + one line of context. */
export function MetricCard({ icon, title, detail, tint = colors.accent, onPress }: {
  icon: IconName; title: string; detail: string; tint?: string; onPress?: () => void;
}) {
  const body = (
    <View style={[styles.metricCard]}>
      <View style={[styles.metricIcon, { backgroundColor: withAlpha(tint, 0.14) }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[t.bodyStrong]} numberOfLines={1}>{title}</Text>
        <Text style={[t.small, { marginTop: 2 }]} numberOfLines={1}>{detail}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={withAlpha(colors.textMuted, 0.7)} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] }}>
      {body}
    </Pressable>
  );
}

/** Expressive selectable card. `tile` = icon over title (grids); `row` = icon + title + check. */
export function SelectCard({
  title, desc, icon, selected, onPress, variant = 'tile', minHeight, style,
}: {
  title: string; desc?: string; icon?: IconName; selected?: boolean; onPress: () => void;
  variant?: 'tile' | 'row'; minHeight?: number; style?: ViewStyle;
}) {
  const fg = selected ? colors.accentText : colors.text;
  const base: ViewStyle = {
    backgroundColor: selected ? colors.accent : colors.surface,
    borderColor: selected ? colors.accent : colors.border,
  };
  if (variant === 'row') {
    return (
      <Pressable
        onPress={() => { tap(); onPress(); }}
        style={({ pressed }) => [styles.selectRow, base, pressed && { transform: [{ scale: 0.99 }] }, style]}
      >
        {icon ? <Ionicons name={icon} size={20} color={fg} style={{ width: 28 }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[t.bodyStrong, { color: fg }]}>{title}</Text>
          {desc ? <Text style={[t.small, { color: selected ? withAlpha(colors.accentText, 0.66) : colors.textMuted, marginTop: 1 }]}>{desc}</Text> : null}
        </View>
        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={selected ? colors.accentText : colors.textFaint} />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [styles.selectTile, base, { minHeight: minHeight ?? 94 }, pressed && { transform: [{ scale: 0.98 }] }, style]}
    >
      {icon ? <Ionicons name={icon} size={21} color={fg} /> : null}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text style={[t.bodyStrong, { color: fg }]}>{title}</Text>
        {desc ? <Text style={[t.small, { color: selected ? withAlpha(colors.accentText, 0.66) : colors.textMuted, marginTop: 2 }]} numberOfLines={2}>{desc}</Text> : null}
      </View>
    </Pressable>
  );
}

// ─── small bits ───────────────────────────────────────────────────────────────

export function Pill({ label, color = colors.textMuted, bg, icon }: { label: string; color?: string; bg?: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg ?? colors.surfaceAlt }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} /> : null}
      <Text style={[t.tiny, { color, letterSpacing: 0.3 }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, onRemove, color = colors.accent, icon }: {
  label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void; color?: string; icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && onPress && { opacity: 0.9 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.accentText : colors.textMuted} style={{ marginRight: 6 }} /> : null}
      <Text style={[t.small, { color: selected ? colors.accentText : colors.text, fontWeight: '600' }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={() => { tap(); onRemove(); }} hitSlop={8} style={{ marginLeft: 6 }}>
          <Ionicons name="close" size={14} color={selected ? colors.accentText : colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} style={[styles.segmentItem, on && styles.segmentOn]}>
            <Text style={[t.small, { color: on ? colors.accentText : colors.textMuted, fontWeight: '600' }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, style, ...props }: { label?: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={[t.small, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

export function Avatar({ name, size = 36, color = colors.accent }: { name: string; size?: number; color?: string }) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: {
  icon: IconName; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.accent} />
      </View>
      <Text style={[t.h3, { marginTop: spacing.lg, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[t.small, { marginTop: 6, textAlign: 'center', maxWidth: 300, lineHeight: 20 }]}>{body}</Text> : null}
      {action && onAction ? <Button label={action} onPress={onAction} full={false} style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

// ─── signature motif: ingredient constellation ─────────────────────────────────

/** Decorative drifting "ingredients". Purely visual; hidden from accessibility and
 *  frozen under Reduce Motion. */
export function IngredientConstellation({ size = 1 }: { size?: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    p.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, p]);

  const herb = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * p.value - 1 }] }));
  const cap = useAnimatedStyle(() => ({ transform: [{ rotate: `${9 * p.value}deg` }] }));
  const ring = useAnimatedStyle(() => ({ transform: [{ translateY: 6 * p.value + 1 }] }));

  return (
    <View
      style={{ width: 92 * size, height: 60 * size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View style={[cons.herb, herb, { transform: [{ scale: size }] }]} />
      <Animated.View style={[cons.cap, cap]} />
      <Animated.View style={[cons.ring, ring]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  sectionLabel: { ...t.tiny, color: withAlpha(colors.textMuted, 0.72) },
  btn: { minHeight: 56, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  iconBtnBg: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  metricCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  metricIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  selectTile: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 14, justifyContent: 'space-between' },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 42, borderRadius: radius.pill, borderWidth: 1 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.accent },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.lg, height: 54, fontSize: 17 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(colors.accent, 0.12), alignItems: 'center', justifyContent: 'center' },
});

const cons = StyleSheet.create({
  herb: { position: 'absolute', left: 8, top: 26, width: 11, height: 11, borderRadius: 6, backgroundColor: withAlpha(colors.herb, 0.9) },
  cap: { position: 'absolute', left: 40, top: 12, width: 34, height: 10, borderRadius: 5, backgroundColor: withAlpha(colors.accentSoft, 0.9) },
  ring: { position: 'absolute', left: 64, top: 30, width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: withAlpha(colors.paprika, 0.9) },
});

/** Reduce-motion helper for screens that animate. */
export function useReduceMotionFlag(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let m = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (m) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { m = false; sub.remove(); };
  }, []);
  return reduce;
}
