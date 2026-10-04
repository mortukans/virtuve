/**
 * "Mūsu virtuve" — the household inventory. Items are grouped by where they live
 * (fridge / freezer / pantry / staples). A highlighted "Jāizlieto drīz" card
 * surfaces anything about to go off with a one-tap jump to meal suggestions. The
 * "+" reveals add options: photo scan, gallery scan, a manual form, and the
 * always-at-home staples editor.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  Body, Button, Card, EmptyState, H2, IconButton, ListRow, Muted, Pill, Row, Screen,
  SectionHeader, Spinner, Title,
} from '@src/ui/kit';
import { colors, freshnessColor, spacing } from '@src/ui/theme';
import { freshnessLabel, locationLabel, L } from '@src/i18n/lv';
import { addInventoryItems, getInventory, setStaples } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useAction } from '@src/ui/useAction';
import { useHouseholdCtx } from '@src/household/context';
import type { Freshness, InventoryDraft, InventoryItem, StorageLocation } from '@src/api/types';
import { ItemRow } from '@src/kitchen/ItemRow';
import { ManualAddForm } from '@src/kitchen/ManualAddForm';
import { ChipEditor } from '@src/kitchen/ChipEditor';

const GROUP_ORDER: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'staple'];
const URGENT: Freshness[] = ['expired', 'use_today', 'use_soon'];
const FRESH_RANK: Record<Freshness, number> = { expired: 0, use_today: 1, use_soon: 2, fresh: 3, unknown: 4 };

const bySeverity = (a: InventoryItem, b: InventoryItem) =>
  FRESH_RANK[a.freshness] - FRESH_RANK[b.freshness] || a.name.localeCompare(b.name, 'lv');

export default function KitchenScreen() {
  const { activeId, isLoading: hhLoading } = useHouseholdCtx();
  const { data: items, isLoading } = useQuery({
    queryKey: qk.inventory(activeId!),
    queryFn: () => getInventory(activeId!),
    enabled: !!activeId,
  });
  const [addOpen, setAddOpen] = useState(false);

  if (hhLoading || (activeId && isLoading && !items)) {
    return (
      <Screen>
        <Spinner label={L.common.loading} />
      </Screen>
    );
  }
  if (!activeId) {
    return (
      <Screen>
        <EmptyState
          icon="home-outline"
          title={L.home.noHousehold}
          action={L.home.createHousehold}
          onAction={() => router.push('/household/create')}
        />
      </Screen>
    );
  }

  const list = items ?? [];
  const urgent = list.filter((i) => URGENT.includes(i.freshness)).sort(bySeverity);
  const staples = list.filter((i) => i.location === 'staple').map((i) => i.name);

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Title>{L.kitchen.title}</Title>
        <IconButton icon={addOpen ? 'close' : 'add'} onPress={() => setAddOpen((o) => !o)} />
      </Row>

      {addOpen ? (
        <AddPanel activeId={activeId} staples={staples} onClose={() => setAddOpen(false)} />
      ) : null}

      {list.length === 0 && !addOpen ? (
        <EmptyState
          icon="fast-food-outline"
          title={L.kitchen.empty}
          action={L.kitchen.addItem}
          onAction={() => setAddOpen(true)}
        />
      ) : null}

      {urgent.length > 0 ? <UrgentCard items={urgent} /> : null}

      {GROUP_ORDER.map((loc) => {
        const group = list.filter((i) => i.location === loc).sort(bySeverity);
        if (group.length === 0) return null;
        return (
          <View key={loc}>
            <SectionHeader title={`${locationLabel[loc]} · ${L.kitchen.itemsCount(group.length)}`} />
            <Card style={{ paddingVertical: spacing.xs }}>
              {group.map((it, i) => (
                <View key={it.id}>
                  {i > 0 ? <View style={styles.sep} /> : null}
                  <ItemRow item={it} activeId={activeId} />
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

// ─── urgent highlight ─────────────────────────────────────────────────────────

function UrgentCard({ items }: { items: InventoryItem[] }) {
  const shown = items.slice(0, 6);
  return (
    <Card style={{ borderColor: colors.orange, marginBottom: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Row gap={spacing.sm}>
          <Ionicons name="alert-circle" size={18} color={colors.orange} />
          <H2 style={{ fontSize: 18 }}>{L.home.useSoon}</H2>
        </Row>
        <Pill label={L.kitchen.itemsCount(items.length)} color={colors.orange} />
      </Row>
      <Muted style={{ marginBottom: spacing.md }}>{L.kitchen.saveFridgeBody(items.length)}</Muted>
      <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
        {shown.map((it) => (
          <Row key={it.id} gap={spacing.sm}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: freshnessColor(it.freshness) }} />
            <Body style={{ flex: 1 }}>{it.name}</Body>
            <Muted style={{ color: freshnessColor(it.freshness) }}>{freshnessLabel[it.freshness]}</Muted>
          </Row>
        ))}
        {items.length > shown.length ? <Muted>{`+ vēl ${items.length - shown.length}`}</Muted> : null}
      </View>
      <Button label={L.kitchen.saveFridge} icon="sparkles" onPress={() => router.push('/meals/suggest?expiring=1')} />
    </Card>
  );
}

// ─── add panel (menu / manual / staples) ──────────────────────────────────────

function AddPanel({ activeId, staples, onClose }: { activeId: string; staples: string[]; onClose: () => void }) {
  const [view, setView] = useState<'menu' | 'manual' | 'staples'>('menu');

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      {view === 'menu' ? (
        <View>
          <AddOption icon="camera-outline" label={L.kitchen.scanPhoto} onPress={() => router.push('/scan')} />
          <View style={styles.sep} />
          <AddOption icon="images-outline" label={L.kitchen.scanLibrary} onPress={() => router.push('/scan?lib=1')} />
          <View style={styles.sep} />
          <AddOption icon="create-outline" label={L.kitchen.addManual} onPress={() => setView('manual')} />
          <View style={styles.sep} />
          <AddOption icon="star-outline" label={L.kitchen.staplesTitle} onPress={() => setView('staples')} />
          <View style={styles.sep} />
          <AddOption icon="restaurant-outline" label={L.meals.transformLeftovers} onPress={() => router.push('/meals/leftovers')} />
        </View>
      ) : view === 'manual' ? (
        <View>
          <PanelHeader title={L.kitchen.addManual} onBack={() => setView('menu')} />
          <ManualAddPanel activeId={activeId} onClose={onClose} />
        </View>
      ) : (
        <View>
          <PanelHeader title={L.kitchen.staplesTitle} onBack={() => setView('menu')} />
          <StaplesEditor activeId={activeId} initial={staples} onClose={onClose} />
        </View>
      )}
    </Card>
  );
}

function AddOption({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return <ListRow title={label} onPress={onPress} left={<Ionicons name={icon} size={22} color={colors.accent} />} />;
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <Row gap={spacing.xs} style={{ marginBottom: spacing.md, marginLeft: -8 }}>
      <IconButton icon="chevron-back" onPress={onBack} size={22} />
      <H2 style={{ fontSize: 18 }}>{title}</H2>
    </Row>
  );
}

function ManualAddPanel({ activeId, onClose }: { activeId: string; onClose: () => void }) {
  const { run, busy } = useAction();
  const onAdd = async (draft: InventoryDraft): Promise<boolean> => {
    const res = await run(() => addInventoryItems(activeId, [draft]), {
      onDone: () => queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) }),
    });
    return res !== undefined;
  };
  return <ManualAddForm onAdd={onAdd} busy={busy} onCancel={onClose} />;
}

function StaplesEditor({ activeId, initial, onClose }: { activeId: string; initial: string[]; onClose: () => void }) {
  const [names, setNames] = useState<string[]>(initial);
  const { run, busy } = useAction();
  const save = () =>
    run(() => setStaples(activeId, names.map((n) => n.trim()).filter(Boolean)), {
      onDone: () => {
        queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) });
        onClose();
      },
    });
  return (
    <View>
      <Muted style={{ marginBottom: spacing.md }}>{L.kitchen.staplesBody}</Muted>
      <ChipEditor values={names} onChange={setNames} placeholder="piem., Sāls" />
      <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
        <Button label={L.common.cancel} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label={L.common.save} onPress={save} loading={busy} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
