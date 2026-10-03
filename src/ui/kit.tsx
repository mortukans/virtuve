/**
 * Virtuve UI kit — shared building blocks so every screen reads as one system.
 * Import from '@src/ui/kit'. Colours/spacing/type come from theme.ts.
 */
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, type as t } from './theme';
import { tap } from './haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── layout ───────────────────────────────────────────────────────────────────

export function Screen({
  children, scroll = false, pad = true, style,
}: { children: React.ReactNode; scroll?: boolean; pad?: boolean; style?: ViewStyle }) {
  const inner = <View style={[pad && { padding: spacing.lg }, { flex: scroll ? undefined : 1 }, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.huge }} showsVerticalScrollIndicator={false}>
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
export const H2 = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[t.h2, style]}>{children}</Text>
);
export const Body = ({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) => (
  <Text style={[t.body, muted && { color: colors.textMuted }, style]}>{children}</Text>
);
export const Muted = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[t.small, style]}>{children}</Text>
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
        full && { alignSelf: 'stretch' }, pressed && !off && { opacity: 0.85 }, off && { opacity: 0.45 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Row gap={spacing.sm} style={{ justifyContent: 'center' }}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
          <Text style={[t.bodyStrong, { color: v.fg }]}>{label}</Text>
        </Row>
      )}
    </Pressable>
  );
}

const BTN: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
  danger: { bg: 'transparent', fg: colors.red, border: colors.red },
};

export function IconButton({ icon, onPress, color = colors.text, size = 22 }: { icon: IconName; onPress: () => void; color?: string; size?: number }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={10} style={styles.iconBtn}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// ─── surfaces ─────────────────────────────────────────────────────────────────

export function Card({ children, onPress, style, raised }: { children: React.ReactNode; onPress?: () => void; style?: ViewStyle; raised?: boolean }) {
  const content = <View style={[styles.card, raised && shadow.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }}>
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

// ─── small bits ───────────────────────────────────────────────────────────────

export function Pill({ label, color = colors.textMuted, bg, icon }: { label: string; color?: string; bg?: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg ?? colors.surfaceAlt }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} /> : null}
      <Text style={[t.tiny, { color }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, onRemove, color = colors.accent }: {
  label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      style={[styles.chip, selected ? { backgroundColor: color, borderColor: color } : { borderColor: colors.border }]}
    >
      <Text style={[t.small, { color: selected ? colors.accentText : colors.text }]}>{label}</Text>
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
            <Text style={[t.small, { color: on ? colors.accentText : colors.textMuted }]} numberOfLines={1}>{o.label}</Text>
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
      <Ionicons name={icon} size={44} color={colors.textFaint} />
      <Text style={[t.h3, { marginTop: spacing.md, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[t.small, { marginTop: 6, textAlign: 'center', maxWidth: 280 }]}>{body}</Text> : null}
      {action && onAction ? <Button label={action} onPress={onAction} full={false} style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionLabel: { ...t.tiny, color: colors.textFaint },
  btn: { height: 52, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.accent },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
