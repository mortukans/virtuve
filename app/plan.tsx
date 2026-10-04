/**
 * Weekly meal plan — the next 7 days as a clean agenda, plus the household's
 * "Ko gribam apēst" wishes and one-tap AI week planning. This is a standalone
 * route (outside the tabs group), so it resolves the active household directly
 * rather than through the tabs' HouseholdProvider. Realtime (running under the
 * tabs) keeps the plan / requests queries live.
 *
 * "Virtuve dzīvo" redesign: a titled header with the week's date range and the
 * ingredient-constellation motif, a weekday strip that marks today in saffron,
 * the AI "Saplānot nedēļu" action, the day agenda (DaySection) and the wishes as
 * tokens. Visual only — getMealPlan / setPlanEntry / aiPlanWeek / requests wiring
 * is unchanged.
 */
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import type { PlanEntry } from '@src/api/types';
import { addRequest, aiPlanWeek, getMealPlan, getRequests, removeRequest } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useResolvedHousehold } from '@src/household/queries';
import { useAction } from '@src/ui/useAction';
import { Button, Card, Chip, Field, IconButton, IngredientConstellation, Muted, Row, Screen, SectionHeader, Spinner, Title } from '@src/ui/kit';
import { colors, radius, spacing, type as t } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { DaySection } from '@src/shopping/DaySection';

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const TODAY = toISO(new Date());
const TODAY_PLUS6 = toISO(new Date(Date.now() + 6 * 86400000));
const WEEK = Array.from({ length: 7 }, (_, i) => toISO(new Date(Date.now() + i * 86400000)));

/** Latvian weekday initials, indexed by Date.getDay() (0 = Sunday). */
const LV_WEEKDAY_INITIAL = ['Sv', 'P', 'O', 'T', 'C', 'P', 'S'];

export default function PlanScreen() {
  const { activeId } = useResolvedHousehold();

  const planQ = useQuery({
    queryKey: qk.plan(activeId ?? 'none', TODAY, TODAY_PLUS6),
    queryFn: () => getMealPlan(activeId!, TODAY, TODAY_PLUS6),
    enabled: !!activeId,
  });
  const reqQ = useQuery({
    queryKey: qk.requests(activeId ?? 'none'),
    queryFn: () => getRequests(activeId!),
    enabled: !!activeId,
  });

  const [req, setReq] = useState('');
  const planAction = useAction();
  const reqAction = useAction();

  const byDate = useMemo(() => {
    const m = new Map<string, PlanEntry>();
    for (const e of planQ.data ?? []) m.set(e.plan_date, e);
    return m;
  }, [planQ.data]);

  if (!activeId) {
    return (
      <Screen>
        <Spinner label={L.common.loading} />
      </Screen>
    );
  }

  const invPlan = () => queryClient.invalidateQueries({ queryKey: ['plan', activeId] });
  const invReq = () => queryClient.invalidateQueries({ queryKey: qk.requests(activeId) });

  const runPlan = (days: number) => void planAction.run(() => aiPlanWeek(activeId, days), { onDone: invPlan });
  const planWeek = () =>
    Alert.alert(L.plan.howMany, undefined, [
      { text: L.plan.days3, onPress: () => runPlan(3) },
      { text: L.plan.days5, onPress: () => runPlan(5) },
      { text: L.plan.days7, onPress: () => runPlan(7) },
      { text: L.common.cancel, style: 'cancel' },
    ]);

  const addReq = () => {
    const n = req.trim();
    if (!n) return;
    void reqAction.run(() => addRequest(activeId, n), { onDone: () => { setReq(''); invReq(); } });
  };
  const delReq = (id: string) => void reqAction.run(() => removeRequest(id), { onDone: invReq });

  const requests = reqQ.data ?? [];
  const planLoading = planQ.isLoading && !planQ.data;

  const rangeLabel = `${format(new Date(WEEK[0]), 'd. MMM', { locale: lv })} – ${format(new Date(WEEK[6]), 'd. MMM', { locale: lv })}`;

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <IngredientConstellation size={0.8} />
      </Row>

      <Title style={{ marginTop: spacing.sm }}>{L.home.weekPlan}</Title>
      <Muted style={{ marginTop: 4 }}>{rangeLabel}</Muted>

      <Row gap={spacing.xs} style={{ marginTop: spacing.lg }}>
        {WEEK.map((iso) => {
          const d = new Date(iso);
          const today = iso === TODAY;
          return (
            <View key={iso} style={[styles.day, today ? styles.dayOn : null]}>
              <Text style={[styles.dayLetter, today && { color: colors.accentText }]}>{LV_WEEKDAY_INITIAL[d.getDay()]}</Text>
              <Text style={[styles.dayNum, today && { color: colors.accentText }]}>{d.getDate()}</Text>
            </View>
          );
        })}
      </Row>

      <Button
        label={L.plan.planWeek}
        icon="sparkles"
        onPress={planWeek}
        disabled={planAction.busy}
        style={{ marginTop: spacing.lg }}
      />
      {planAction.busy ? (
        <Card style={{ marginTop: spacing.md }}>
          <Spinner label={L.plan.planning} />
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        {planLoading ? (
          <Spinner />
        ) : (
          WEEK.map((d) => (
            <DaySection key={d} activeId={activeId} iso={d} entry={byDate.get(d)} onChanged={invPlan} />
          ))
        )}
      </View>

      <SectionHeader title={L.plan.requests} />
      <Muted style={{ marginBottom: spacing.md }}>Pievieno, ko gribētu ēst šonedēļ — ņemsim vērā, plānojot.</Muted>

      <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field
            placeholder={L.plan.requestPlaceholder}
            value={req}
            onChangeText={setReq}
            returnKeyType="done"
            onSubmitEditing={addReq}
            autoCapitalize="sentences"
          />
        </View>
        <Button label={L.common.add} onPress={addReq} disabled={!req.trim()} loading={reqAction.busy} full={false} />
      </Row>

      {requests.length > 0 ? (
        <View style={styles.reqWrap}>
          {requests.map((r) => (
            <Chip key={r.id} label={r.text} onRemove={() => delReq(r.id)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayLetter: { ...t.tiny, color: colors.textMuted, letterSpacing: 0.5 },
  dayNum: { ...t.bodyStrong, color: colors.text },
  reqWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
