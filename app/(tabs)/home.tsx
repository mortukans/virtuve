/**
 * Home dashboard — the daily "ko ēdam?" hub. Greeting, who eats tonight, the big
 * "Ko ēdam šovakar?" CTA, an active-vote banner, and glanceable sections for
 * expiring food, the shopping list, this week's plan and the house favourite.
 */
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  getActiveVote, getAttendance, getInventory, getMealPlan, getRecipes, getShoppingList, setAttendance,
} from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { AttendanceStatus, Member } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useUserId } from '@src/auth/store';
import { useAction } from '@src/ui/useAction';
import { Avatar, Button, EmptyState, SectionHeader, Spinner } from '@src/ui/kit';
import { colors, freshnessColor, radius, shadow, spacing, type as t } from '@src/ui/theme';
import { attendanceLabel, L } from '@src/i18n/lv';
import { greetingKey, plusDaysISO, todayISO } from '@src/meals/helpers';
import { RecipeCard } from '@src/meals/RecipeCard';

const URGENT: ReadonlyArray<string> = ['use_today', 'use_soon', 'expired'];

export default function Home() {
  const { household, activeId, isLoading } = useHouseholdCtx();
  const uid = useUserId();
  const today = todayISO();
  const weekTo = plusDaysISO(6);
  const [refreshing, setRefreshing] = useState(false);

  const attendance = useQuery({ queryKey: qk.attendance(activeId!, today), queryFn: () => getAttendance(activeId!, today), enabled: !!activeId });
  const vote = useQuery({ queryKey: qk.activeVote(activeId!), queryFn: () => getActiveVote(activeId!), enabled: !!activeId });
  const inventory = useQuery({ queryKey: qk.inventory(activeId!), queryFn: () => getInventory(activeId!), enabled: !!activeId });
  const shopping = useQuery({ queryKey: qk.shopping(activeId!), queryFn: () => getShoppingList(activeId!), enabled: !!activeId });
  const plan = useQuery({ queryKey: qk.plan(activeId!, today, weekTo), queryFn: () => getMealPlan(activeId!, today, weekTo), enabled: !!activeId });
  const favourites = useQuery({ queryKey: qk.recipes(activeId!, 'favourites'), queryFn: () => getRecipes(activeId!, 'favourites'), enabled: !!activeId });

  if (isLoading && !household) {
    return <SafeAreaView style={styles.screen}><Spinner label={L.common.loading} /></SafeAreaView>;
  }
  if (!activeId) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState icon="home-outline" title={L.home.noHousehold} action={L.home.createHousehold} onAction={() => router.push('/household/create')} />
      </SafeAreaView>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.attendance(activeId, today) }),
      queryClient.invalidateQueries({ queryKey: qk.activeVote(activeId) }),
      queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) }),
      queryClient.invalidateQueries({ queryKey: qk.shopping(activeId) }),
      queryClient.invalidateQueries({ queryKey: qk.plan(activeId, today, weekTo) }),
      queryClient.invalidateQueries({ queryKey: qk.recipes(activeId, 'favourites') }),
    ]).catch(() => undefined);
    setRefreshing(false);
  };

  const greeting = L.home[greetingKey()];
  const members = household?.members ?? [];

  const activeVote = vote.data;
  const creatorName = activeVote ? members.find((m) => m.user_id === activeVote.created_by)?.display_name : undefined;
  const voteText = activeVote
    ? (creatorName && activeVote.created_by !== uid ? L.vote.started(creatorName) : L.vote.yourTurn)
    : '';

  const urgent = (inventory.data ?? []).filter((i) => URGENT.includes(i.freshness));
  const shoppingOpen = (shopping.data ?? []).filter((s) => s.status !== 'bought').length;
  const planned = (plan.data ?? []).filter((p) => p.status === 'planned').length;
  const favourite = favourites.data?.[0];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={t.small}>{greeting}</Text>
        <Text style={[t.h1, { marginBottom: spacing.lg }]}>{household?.name ?? L.app.name}</Text>

        {activeVote ? (
          <Pressable onPress={() => router.push(`/vote/${activeVote.id}`)} style={({ pressed }) => [styles.voteBanner, pressed && { opacity: 0.9 }]}>
            <Ionicons name="restaurant" size={22} color={colors.blue} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[t.tiny, { color: colors.blue }]}>{L.vote.title.toUpperCase()}</Text>
              <Text style={t.bodyStrong} numberOfLines={1}>{voteText}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}

        <AttendanceSection activeId={activeId} members={members} today={today} statusMap={attendance.data} />

        {/* BIG CTA */}
        <Pressable onPress={() => router.push('/meals/suggest')} style={({ pressed }) => [styles.cta, shadow.card, pressed && { opacity: 0.94 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[t.h1, { color: colors.accentText }]}>{L.home.whatToEat}</Text>
            <Text style={[t.small, { color: colors.accentText, opacity: 0.8, marginTop: 4 }]}>
              Izdomāsim no tā, kas tev jau ir mājās.
            </Text>
          </View>
          <View style={styles.ctaIcon}>
            <Ionicons name="restaurant" size={30} color={colors.accentText} />
          </View>
        </Pressable>
        <Button label={L.home.scanFridge} icon="camera-outline" variant="secondary" onPress={() => router.push('/scan')} style={{ marginTop: spacing.md }} />

        {/* Expiring soon */}
        <SectionHeader title={L.home.useSoon} action={urgent.length ? L.common.all : undefined} onAction={urgent.length ? () => router.push('/kitchen') : undefined} />
        {urgent.length ? (
          <View style={styles.chipWrap}>
            {urgent.map((i) => (
              <View key={i.id} style={styles.urgentChip}>
                <View style={[styles.dot, { backgroundColor: freshnessColor(i.freshness) }]} />
                <Text style={[t.small, { color: colors.text }]}>{i.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={t.small}>{L.home.nothingUrgent}</Text>
        )}

        {/* Shopping list */}
        <SectionHeader title={L.home.shoppingList} />
        <TappableRow
          icon="cart-outline"
          text={shoppingOpen > 0 ? L.shopping.itemsCount(shoppingOpen) : L.shopping.empty}
          onPress={() => router.push('/shopping')}
        />

        {/* Week plan */}
        <SectionHeader title={L.home.weekPlan} />
        <TappableRow
          icon="calendar-outline"
          text={L.home.planCount(planned, 7)}
          onPress={() => router.push('/plan')}
        />

        {/* House favourite */}
        {favourite ? (
          <>
            <SectionHeader title={L.home.favourite} />
            <RecipeCard recipe={favourite} activeId={activeId} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TappableRow({ icon, text, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={[t.body, { flex: 1, marginLeft: spacing.md }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function AttendanceSection({
  activeId, members, today, statusMap,
}: {
  activeId: string; members: Member[]; today: string; statusMap: { member_id: string; status: AttendanceStatus }[] | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const { run } = useAction();
  const map = new Map((statusMap ?? []).map((a) => [a.member_id, a.status]));
  const statusOf = (m: Member): AttendanceStatus => map.get(m.id) ?? (m.eats_by_default ? 'home' : 'away');
  const homeMembers = members.filter((m) => statusOf(m) === 'home');

  const set = (m: Member, status: AttendanceStatus) =>
    run(() => setAttendance(activeId, today, status, m.id), {
      onDone: () => void queryClient.invalidateQueries({ queryKey: qk.attendance(activeId, today) }),
    });

  return (
    <View style={styles.attCard}>
      <View style={styles.attHead}>
        <Text style={[t.tiny, { color: colors.textFaint }]}>{L.home.eatsTonight.toUpperCase()}</Text>
        <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
          <Text style={[t.small, { color: colors.accent }]}>{editing ? L.common.done : L.home.change}</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {members.map((m) => {
            const home = statusOf(m) === 'home';
            return (
              <View key={m.id} style={styles.attRow}>
                <Avatar name={m.display_name} size={30} />
                <Text style={[t.body, { flex: 1, marginLeft: spacing.sm }]} numberOfLines={1}>{m.display_name}</Text>
                <Pressable onPress={() => set(m, 'home')} style={[styles.attPick, home && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  <Text style={[t.small, { color: home ? colors.accentText : colors.textMuted }]}>{attendanceLabel.home}</Text>
                </Pressable>
                <Pressable onPress={() => set(m, 'away')} style={[styles.attPick, !home && { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                  <Text style={[t.small, { color: !home ? colors.text : colors.textMuted }]}>{attendanceLabel.away}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : homeMembers.length ? (
        <View style={[styles.chipWrap, { marginTop: spacing.md }]}>
          {homeMembers.map((m) => (
            <View key={m.id} style={styles.homeChip}>
              <Avatar name={m.display_name} size={26} />
              <Text style={[t.small, { color: colors.text, marginLeft: 6 }]}>{m.display_name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[t.small, { marginTop: spacing.sm }]}>Nosaki, kas šovakar ēd mājās.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.huge },
  voteBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.blue, padding: spacing.md, marginBottom: spacing.lg,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.xl,
    padding: spacing.xl,
  },
  ctaIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(42,26,0,0.15)', alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  urgentChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
  attCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  attHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  attPick: { borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: spacing.md, paddingVertical: 7 },
  homeChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingVertical: 5, paddingHorizontal: 8, paddingRight: spacing.md,
  },
});
