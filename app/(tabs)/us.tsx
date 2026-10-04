/**
 * "Mēs" — the household hub: members, invites, settings, recent meals, favourites
 * and the personal profile (name, Apple link, sign out, delete account).
 */
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Body, Button, Card, Chip, Field, IconButton, IngredientConstellation, ListRow, MetricCard,
  Muted, Row, Screen, SectionHeader, Spinner, Title,
} from '@src/ui/kit';
import { colors, spacing, type as t, withAlpha } from '@src/ui/theme';
import { count, L, ratingLabel } from '@src/i18n/lv';
import { addMember, deleteMe, getHistory, getRecipes, rotateInvite, setDisplayName } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import { useHouseholdCtx } from '@src/household/context';
import { useActiveHousehold } from '@src/household/active';
import { useAuth, useUserId } from '@src/auth/store';
import { appleAvailable, ProviderCancelled } from '@src/auth/apple';
import { useAction } from '@src/ui/useAction';
import { errorMessage } from '@src/ui/errors';
import { MemberCard } from '@src/household/MemberCard';
import { InviteCard } from '@src/household/InviteCard';

const fmtDate = (s: string): string => {
  const p = s.slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : s;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Big two-up action tile that toggles an inline form (invite / add child).
 *  Lights up in its tint while its form is open (saffron = active state). */
function ActionTile({ icon, title, tint, active, onPress }: {
  icon: IconName; title: string; tint: string; active: boolean; onPress: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Card
        onPress={onPress}
        style={active ? { ...styles.tile, borderColor: tint, backgroundColor: withAlpha(tint, 0.12) } : styles.tile}
      >
        <View style={[styles.tileIcon, { backgroundColor: withAlpha(tint, active ? 0.24 : 0.14) }]}>
          <Ionicons name={icon} size={22} color={tint} />
        </View>
        <Body style={[t.bodyStrong, { color: active ? tint : colors.text }]}>{title}</Body>
      </Card>
    </View>
  );
}

export default function UsScreen() {
  const { household, activeId, households, isLoading } = useHouseholdCtx();

  const profile = useAuth((s) => s.profile);
  const isLinked = useAuth((s) => s.isLinked);
  const signInWithApple = useAuth((s) => s.signInWithApple);
  const signOut = useAuth((s) => s.signOut);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const uid = useUserId();
  const setActive = useActiveHousehold((s) => s.setActive);
  const qc = useQueryClient();
  const { run, busy } = useAction();

  const [canApple, setCanApple] = useState(false);
  useEffect(() => {
    let mounted = true;
    void appleAvailable().then((v) => { if (mounted) setCanApple(v); });
    return () => { mounted = false; };
  }, []);

  const [showInvite, setShowInvite] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [name, setName] = useState(profile?.display_name ?? '');
  useEffect(() => { setName(profile?.display_name ?? ''); }, [profile?.display_name]);

  const historyQ = useQuery({
    queryKey: activeId ? qk.history(activeId) : ['history', 'none'],
    queryFn: () => getHistory(activeId as string),
    enabled: !!activeId,
  });
  const favsQ = useQuery({
    queryKey: activeId ? qk.recipes(activeId, 'favourites') : ['recipes', 'none'],
    queryFn: () => getRecipes(activeId as string, 'favourites'),
    enabled: !!activeId,
  });
  const savedQ = useQuery({
    queryKey: activeId ? qk.recipes(activeId, 'saved') : ['recipes', 'none-saved'],
    queryFn: () => getRecipes(activeId as string, 'saved'),
    enabled: !!activeId,
  });

  if (isLoading) return <Screen><Spinner label={L.common.loading} /></Screen>;

  if (!household || !activeId) {
    return (
      <Screen scroll dock>
        <Title>{L.nav.us}</Title>
        <Body muted style={{ marginVertical: spacing.lg }}>{L.home.noHousehold}</Body>
        <Button label={L.home.createHousehold} icon="add" onPress={() => router.push('/household/create')} />
        <Button variant="secondary" label={L.household.join} icon="enter-outline" onPress={() => router.push('/household/join')} style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  const members = household.members ?? [];
  const recent = (historyQ.data ?? []).slice(0, 5);
  const favourites = favsQ.data ?? [];
  const saved = savedQ.data ?? [];
  const eatsTonight = members.filter((m) => m.eats_by_default).length;

  const saveName = () => {
    void run(() => setDisplayName(name.trim()), {
      onDone: () => {
        void refreshProfile();
        void qc.invalidateQueries({ queryKey: qk.household(activeId) });
      },
    });
  };
  const rotate = () => {
    void run(() => rotateInvite(activeId), {
      onDone: () => { void qc.invalidateQueries({ queryKey: qk.household(activeId) }); },
    });
  };
  const addChild = () => {
    const n = childName.trim();
    if (!n) return;
    void run(() => addMember(activeId, n, 'child'), {
      onDone: () => {
        setChildName('');
        setShowAddChild(false);
        void qc.invalidateQueries({ queryKey: qk.household(activeId) });
      },
    });
  };
  const linkApple = async () => {
    try {
      await signInWithApple();
    } catch (e) {
      if (!(e instanceof ProviderCancelled)) Alert.alert('', errorMessage(e));
    }
  };
  const confirmSignOut = () => {
    Alert.alert('', L.auth.signOutConfirm, [
      { text: L.common.cancel, style: 'cancel' },
      { text: L.auth.signOut, style: 'destructive', onPress: () => { void (async () => { await signOut(); router.replace('/'); })(); } },
    ]);
  };
  const confirmDelete = () => {
    Alert.alert(L.auth.deleteAccountConfirm, L.auth.deleteAccountBody, [
      { text: L.common.cancel, style: 'cancel' },
      {
        text: L.auth.deleteAccountYes,
        style: 'destructive',
        onPress: () => {
          void run(async () => { await deleteMe(); await signOut(); }, {
            onDone: () => router.replace('/'),
          });
        },
      },
    ]);
  };

  return (
    <Screen scroll dock>
      {/* Header */}
      <Row style={styles.header}>
        <View style={{ flex: 1 }}>
          <Title>{household.name}</Title>
          <Muted style={{ marginTop: spacing.xs }}>
            {count(members.length, 'mājinieks', 'mājinieki')} · šovakar ēd {eatsTonight}
          </Muted>
        </View>
        <IngredientConstellation />
        <IconButton icon="settings-outline" bg onPress={() => router.push('/household/settings')} />
      </Row>

      {/* Household switcher */}
      {households && households.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
          {households.map((h) => (
            <Chip key={h.id} label={h.name} selected={h.id === activeId} onPress={() => setActive(h.id)} />
          ))}
        </ScrollView>
      ) : null}

      {/* Members */}
      <SectionHeader title={L.household.members} />
      {members.map((m) => (
        <MemberCard key={m.id} member={m} onPress={() => router.push(`/member/${m.id}`)} />
      ))}

      {/* Add member / child */}
      <Row gap={spacing.sm} style={styles.tiles}>
        <ActionTile
          icon="person-add-outline"
          title={L.household.inviteMember}
          tint={colors.accent}
          active={showInvite}
          onPress={() => setShowInvite((v) => !v)}
        />
        <ActionTile
          icon="happy-outline"
          title={L.household.addChild}
          tint={colors.accentSoft}
          active={showAddChild}
          onPress={() => setShowAddChild((v) => !v)}
        />
      </Row>

      {showInvite ? (
        <View style={{ marginTop: spacing.md }}>
          <InviteCard code={household.invite_code} onRotate={rotate} rotating={busy} />
        </View>
      ) : null}

      {showAddChild ? (
        <Card style={{ marginTop: spacing.md }}>
          <Field
            label={L.household.childName}
            value={childName}
            onChangeText={setChildName}
            placeholder={L.household.childName}
            returnKeyType="done"
            onSubmitEditing={addChild}
          />
          <Button label={L.common.add} onPress={addChild} loading={busy} />
        </Card>
      ) : null}

      {/* House */}
      <SectionHeader title={L.household.title} />
      <View style={{ gap: spacing.sm }}>
        <MetricCard
          icon="options-outline"
          tint={colors.accent}
          title="Mājas iestatījumi"
          detail="Prioritātes, budžets un tonis"
          onPress={() => router.push('/household/settings')}
        />
        <MetricCard
          icon="heart-outline"
          tint={colors.heart}
          title="Iecienītās receptes"
          detail={count(favourites.length, 'recepte', 'receptes')}
        />
        <MetricCard
          icon="calendar-outline"
          tint={colors.blue}
          title="Nedēļas plāni"
          detail={L.plan.planWeek}
          onPress={() => router.push('/plan')}
        />
        <MetricCard
          icon="cart-outline"
          tint={colors.herb}
          title={L.shopping.title}
          detail="Kopīgais saraksts mājai"
          onPress={() => router.push('/shopping')}
        />
        <MetricCard
          icon="download-outline"
          tint={colors.accentSoft}
          title={L.meals.importTitle}
          detail="No saites, teksta vai attēla"
          onPress={() => router.push('/meals/import')}
        />
      </View>

      {/* Recent meals */}
      <SectionHeader title="Nesen gatavots" />
      {recent.length === 0 ? (
        <Muted>Vēl nekas nav gatavots.</Muted>
      ) : (
        recent.map((h) => (
          <ListRow
            key={h.id}
            title={h.recipe_title}
            subtitle={`${fmtDate(h.cooked_on)}${h.rating ? ` · ${ratingLabel[h.rating]}` : ''}`}
          />
        ))
      )}

      {/* Favourites */}
      <SectionHeader title="Mājas favorīti" />
      {favourites.length === 0 ? (
        <Muted>Vēl nav neviena favorīta.</Muted>
      ) : (
        favourites.map((r) => (
          <ListRow key={r.id} title={r.title} subtitle={r.summary || undefined} />
        ))
      )}

      {/* Saved recipes */}
      <SectionHeader title="Saglabātās receptes" />
      {saved.length === 0 ? (
        <Muted>Vēl nav saglabātu recepšu.</Muted>
      ) : (
        saved.map((r) => (
          <ListRow
            key={r.id}
            title={r.title}
            subtitle={r.summary || undefined}
            onPress={() => router.push(`/meals/${r.id}`)}
          />
        ))
      )}

      {/* Profile */}
      <SectionHeader title="Profils" />
      <Field label={L.member.displayName} value={name} onChangeText={setName} placeholder={L.member.displayName} />
      <Button label={L.common.save} onPress={saveName} loading={busy} />

      {isLinked ? (
        <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
          <Ionicons name="logo-apple" size={18} color={colors.text} />
          <Body>Pierakstīts ar Apple</Body>
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
        </Row>
      ) : canApple ? (
        <Button
          variant="secondary"
          icon="logo-apple"
          label={L.auth.continueApple}
          onPress={() => { void linkApple(); }}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      {/* Account */}
      <SectionHeader title="Konts" />
      <Button variant="secondary" icon="log-out-outline" label={L.auth.signOut} onPress={confirmSignOut} />
      <Button variant="danger" icon="trash-outline" label={L.auth.deleteAccount} onPress={confirmDelete} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  switcher: { gap: spacing.sm, paddingVertical: spacing.sm },
  tiles: { marginTop: spacing.sm, alignItems: 'stretch' },
  tile: { minHeight: 116, gap: spacing.md, justifyContent: 'flex-start' },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
