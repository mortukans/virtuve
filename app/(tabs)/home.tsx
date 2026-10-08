/**
 * Home dashboard — the daily "ko ēdam?" hub. Greeting + household name, who eats
 * tonight, the signature saffron "Ko ēdam šovakar?" hero, a fridge-scan strip,
 * glanceable metric cards (use-soon / shopping / plan), the active-vote banner and
 * the house favourite. "Virtuve dzīvo" redesign — presentation only; all data
 * wiring, queries and the attendance logic are preserved.
 */
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  getActiveVote, getAttendance, getInventory, getMealPlan, getRecipes, getRecommendedRecipes,
  getShoppingList, setAttendance,
} from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import type { AttendanceStatus, Member } from '@src/api/types';
import { useHouseholdCtx } from '@src/household/context';
import { useUserId } from '@src/auth/store';
import { useAction } from '@src/ui/useAction';
import {
  Avatar, Card, EmptyState, IngredientConstellation, MetricCard, SectionHeader, SectionLabel, Spinner, Title,
} from '@src/ui/kit';
import { colors, DOCK_CLEARANCE, radius, spacing, type as t, withAlpha } from '@src/ui/theme';
import { attendanceLabel, L } from '@src/i18n/lv';
import { greetingKey, plusDaysISO, todayISO } from '@src/meals/helpers';
import { RecipeCard } from '@src/meals/RecipeCard';
import { RecommendedCard } from '@src/meals/RecommendedCard';

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
  const recommended = useQuery({ queryKey: qk.recommended, queryFn: getRecommendedRecipes, staleTime: 5 * 60_000 });

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
        {/* Header: greeting + household name, constellation top-right */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[t.small, { marginBottom: spacing.xs }]}>{greeting}</Text>
            <Title>{household?.name ?? L.app.name}</Title>
          </View>
          <IngredientConstellation />
        </View>

        {/* Who eats tonight */}
        <AttendanceSection activeId={activeId} members={members} today={today} statusMap={attendance.data} />

        {/* Signature saffron dinner hero */}
        <Card raised onPress={() => router.push('/meals/suggest')} style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={[t.h1, { color: colors.accentText }]}>{L.home.whatToEat}</Text>
            <Text style={[t.body, { color: withAlpha(colors.accentText, 0.58), marginTop: spacing.xs }]}>
              {L.home.composerSub}
            </Text>
          </View>
          <View style={styles.heroMedallion}>
            <Ionicons name="restaurant" size={28} color={colors.accentSoft} />
          </View>
        </Card>

        {/* Fridge scan strip */}
        <Card onPress={() => router.push('/scan')} style={styles.camera}>
          <View style={styles.cameraTile}>
            <Ionicons name="camera-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={t.bodyStrong}>{L.home.scanFridge}</Text>
            <Text style={[t.small, { marginTop: 2 }]}>{L.home.scanHint}</Text>
          </View>
          <Ionicons name="arrow-up-right-box-outline" size={22} color={colors.accent} />
        </Card>

        {/* Tonight's glanceable metrics */}
        <SectionLabel style={styles.metricsLabel}>Šovakar</SectionLabel>
        <View style={styles.metrics}>
          <MetricCard
            icon="leaf"
            tint={colors.herb}
            title={L.home.useSoon}
            detail={urgent.length ? L.kitchen.freshSummary(urgent.length) : L.home.nothingUrgent}
            onPress={() => router.push('/kitchen')}
          />
          <MetricCard
            icon="cart"
            tint={colors.accent}
            title={L.home.shoppingList}
            detail={shoppingOpen > 0 ? L.shopping.itemsCount(shoppingOpen) : L.home.shoppingEmptyShort}
            onPress={() => router.push('/shopping')}
          />
          <MetricCard
            icon="calendar"
            tint={colors.accentSoft}
            title={L.home.weekPlan}
            detail={L.home.planCount(planned, 7)}
            onPress={() => router.push('/plan')}
          />
        </View>

        {/* Recommended recipes (free, with photos) */}
        {recommended.data && recommended.data.length > 0 ? (
          <>
            <SectionHeader title={L.home.recommended} action={L.home.recommendedAll} onAction={() => router.push('/recipes')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.rail}
              contentContainerStyle={styles.railContent}
            >
              {recommended.data.slice(0, 8).map((r) => (
                <RecommendedCard key={r.id} recipe={r} width={230} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Active vote in progress */}
        {activeVote ? (
          <Card onPress={() => router.push(`/vote/${activeVote.id}`)} style={styles.voteCard}>
            <View style={styles.voteIcon}>
              <Ionicons name="restaurant" size={20} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.tiny, { color: colors.blue }]}>{L.vote.title.toUpperCase()}</Text>
              <Text style={[t.bodyStrong, { marginTop: 2 }]} numberOfLines={1}>{voteText}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>
        ) : null}

        {/* House favourite */}
        {favourite ? (
          <>
            <SectionLabel style={styles.favLabel}>{L.home.favourite}</SectionLabel>
            <RecipeCard recipe={favourite} activeId={activeId} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    <Card style={styles.tonightCard}>
      <View style={styles.attHead}>
        <SectionLabel>{L.home.eatsTonight}</SectionLabel>
        <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
          <Text style={[t.small, { color: colors.accent, fontWeight: '600' }]}>{editing ? L.common.done : L.home.change}</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
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
              <Avatar name={m.display_name} size={24} />
              <Text style={[t.small, { color: colors.text, marginLeft: 6 }]}>{m.display_name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[t.small, { marginTop: spacing.sm }]}>{L.home.tonightEmpty}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: DOCK_CLEARANCE },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl },

  hero: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderColor: colors.accent,
    borderRadius: radius.xl, padding: 22, marginBottom: spacing.lg,
  },
  heroMedallion: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentText,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md,
  },

  camera: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  cameraTile: {
    width: 46, height: 46, borderRadius: radius.md, backgroundColor: withAlpha(colors.accent, 0.14),
    alignItems: 'center', justifyContent: 'center',
  },

  metricsLabel: { marginBottom: spacing.md },
  metrics: { gap: spacing.sm },

  rail: { marginHorizontal: -spacing.lg },
  railContent: { gap: spacing.md, paddingHorizontal: spacing.lg },

  voteCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.xl, borderColor: withAlpha(colors.blue, 0.45),
  },
  voteIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: withAlpha(colors.blue, 0.14),
    alignItems: 'center', justifyContent: 'center',
  },

  favLabel: { marginTop: spacing.xl, marginBottom: spacing.md },

  tonightCard: { marginBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  attHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  attPick: { borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: spacing.md, paddingVertical: 7 },
  homeChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingVertical: 5, paddingHorizontal: 8, paddingRight: spacing.md,
  },
});
