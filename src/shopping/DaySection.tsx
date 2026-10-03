/**
 * One day in the weekly plan: weekday + date, and either the planned recipe (tap
 * to open it), a status, or a "choose a meal" affordance. The overflow menu sets
 * eating-out / not-cooking / clears the day via setPlanEntry.
 */
import React from 'react';
import { Alert, Pressable, Text, View, type AlertButton } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import type { PlanEntry, PlanStatus } from '@src/api/types';
import { setPlanEntry } from '@src/api/rpc';
import { useAction } from '@src/ui/useAction';
import { Card, Row } from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
import { L, planStatusLabel } from '@src/i18n/lv';
import { tap } from '@src/ui/haptics';

const TODAY = new Date().toISOString().slice(0, 10);

export function DaySection({
  activeId,
  iso,
  entry,
  onChanged,
}: {
  activeId: string;
  iso: string;
  entry: PlanEntry | undefined;
  onChanged: () => void;
}) {
  const { run, busy } = useAction();
  const raw = format(new Date(iso), 'EEEE, d. MMM', { locale: lv });
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);
  const isToday = iso === TODAY;

  const status: PlanStatus = entry?.status ?? 'none';
  const hasRecipe = !!entry?.recipe_id && !!entry?.recipe_title;
  const openRecipe = () => { if (entry?.recipe_id) router.push(`/meals/${entry.recipe_id}`); };

  const setStatus = (s: PlanStatus) =>
    run(() => setPlanEntry(activeId, iso, { status: s, recipe_id: null }), { onDone: onChanged });

  const openMenu = () => {
    tap();
    const buttons: AlertButton[] = [];
    if (hasRecipe) buttons.push({ text: 'Skatīt recepti', onPress: openRecipe });
    buttons.push(
      { text: L.plan.eatingOut, onPress: () => void setStatus('eating_out') },
      { text: L.plan.notCooking, onPress: () => void setStatus('not_cooking') },
    );
    if (status !== 'none' || hasRecipe) {
      buttons.push({ text: 'Notīrīt', style: 'destructive', onPress: () => void setStatus('none') });
    }
    buttons.push({ text: L.common.cancel, style: 'cancel' });
    Alert.alert(title, undefined, buttons);
  };

  return (
    <Card style={{ marginBottom: spacing.sm, opacity: busy ? 0.6 : 1, borderColor: isToday ? colors.accent : colors.border }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Row gap={spacing.sm}>
            <Text style={t.tiny}>{title.toUpperCase()}</Text>
            {isToday ? <Text style={[t.tiny, { color: colors.accent }]}>{L.common.today.toUpperCase()}</Text> : null}
          </Row>

          {hasRecipe ? (
            <Pressable onPress={() => { tap(); openRecipe(); }} style={{ marginTop: 6 }}>
              <Row gap={spacing.sm}>
                <Ionicons name="restaurant" size={16} color={colors.accent} />
                <Text style={[t.h3, { flex: 1 }]} numberOfLines={2}>{entry?.recipe_title}</Text>
              </Row>
            </Pressable>
          ) : status === 'eating_out' || status === 'not_cooking' ? (
            <Row gap={spacing.sm} style={{ marginTop: 6 }}>
              <Ionicons
                name={status === 'eating_out' ? 'walk-outline' : 'close-circle-outline'}
                size={16}
                color={colors.textMuted}
              />
              <Text style={t.body}>{planStatusLabel[status]}</Text>
            </Row>
          ) : (
            <Pressable onPress={openMenu} style={{ marginTop: 6 }}>
              <Row gap={spacing.sm}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={[t.body, { color: colors.accent }]}>{L.plan.setMeal}</Text>
              </Row>
            </Pressable>
          )}
        </View>

        <Pressable onPress={openMenu} hitSlop={8} style={{ padding: 4, marginLeft: spacing.sm }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      </Row>
    </Card>
  );
}
