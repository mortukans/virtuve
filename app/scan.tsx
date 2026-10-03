/**
 * Fridge-scan review (presented as a modal). On mount it picks photos — from the
 * library when opened with ?lib=1, otherwise the camera — sends them to the
 * ai-scan edge function, and lets the user confirm/correct each recognised item
 * before adding them to the kitchen. "Vēl viena bilde" appends more photos.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, EmptyState, IconButton, Muted, Row, Screen, SectionHeader, Spinner, Title } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { addInventoryItems, aiScan } from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useAction } from '@src/ui/useAction';
import { useHouseholdCtx } from '@src/household/context';
import type { InventoryDraft, ScanResult } from '@src/api/types';
import { ScanRow, type ScanDraft } from '@src/kitchen/ScanRow';

type Status = 'picking' | 'scanning' | 'review' | 'empty' | 'failed';

let COUNTER = 0;
const toDraft = (r: ScanResult): ScanDraft => ({
  id: `scan-${COUNTER++}`,
  include: true,
  name: r.name,
  category: r.category,
  location: r.location,
  amount: r.amount,
  confidence: r.confidence,
});

const base64Of = (assets: ImagePicker.ImagePickerAsset[]): string[] =>
  assets.map((a) => a.base64).filter((b): b is string => !!b);

export default function ScanScreen() {
  const { lib } = useLocalSearchParams<{ lib?: string }>();
  const fromLib = lib === '1' || lib === 'true';
  const { activeId } = useHouseholdCtx();
  const { run, busy } = useAction();

  const [status, setStatus] = useState<Status>('picking');
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const imagesRef = useRef<string[]>([]);
  const started = useRef(false);

  const pick = async (): Promise<string[] | null> => {
    if (fromLib) {
      const res = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.5,
        allowsMultipleSelection: true,
        selectionLimit: 4,
      });
      if (res.canceled) return null;
      return base64Of(res.assets);
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (res.canceled) return null;
    return base64Of(res.assets);
  };

  const scan = async (images: string[], append: boolean) => {
    setStatus('scanning');
    try {
      const { items } = await aiScan(images, activeId);
      const fresh = items.map(toDraft);
      if (append) {
        setDrafts((prev) => [...prev, ...fresh]);
        setStatus('review');
      } else {
        setDrafts(fresh);
        setStatus(fresh.length ? 'review' : 'empty');
      }
    } catch {
      setStatus('failed');
    }
  };

  const begin = async () => {
    const picked = await pick();
    if (!picked || picked.length === 0) {
      router.back();
      return;
    }
    imagesRef.current = picked;
    await scan(picked, false);
  };

  const addMore = async () => {
    const picked = await pick();
    if (!picked || picked.length === 0) return;
    imagesRef.current = [...imagesRef.current, ...picked];
    await scan(picked, true);
  };

  const retry = () => {
    if (imagesRef.current.length) void scan(imagesRef.current, false);
    else void begin();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (id: string, patch: Partial<ScanDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const includedCount = drafts.filter((d) => d.include).length;
  const canSubmit = !!activeId && includedCount > 0 && drafts.every((d) => !d.include || d.name.trim().length > 0);

  const submit = () => {
    if (!activeId) return;
    const invDrafts: InventoryDraft[] = drafts
      .filter((d) => d.include && d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        category: d.category,
        location: d.location,
        amount: d.amount,
        source: 'photo' as const,
      }));
    if (invDrafts.length === 0) return;
    void run(() => addInventoryItems(activeId, invDrafts), {
      onDone: () => {
        queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) });
        router.back();
      },
    });
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Title>{L.scan.title}</Title>
        <IconButton icon="close" onPress={() => router.back()} />
      </Row>

      {status === 'picking' || status === 'scanning' ? (
        <View style={{ paddingVertical: spacing.huge }}>
          <Spinner label={L.scan.scanning} />
        </View>
      ) : null}

      {status === 'failed' ? (
        <EmptyState icon="image-outline" title={L.scan.failed} action={L.common.retry} onAction={retry} />
      ) : null}

      {status === 'empty' ? (
        <EmptyState icon="search-outline" title={L.scan.nothing} action={L.scan.takeAnother} onAction={() => void addMore()} />
      ) : null}

      {status === 'review' ? (
        <>
          <Muted style={{ marginBottom: spacing.xs }}>{L.scan.aiPreview}</Muted>
          <SectionHeader title={L.scan.found(drafts.length)} />
          {drafts.map((d) => (
            <ScanRow key={d.id} draft={d} onChange={(patch) => updateDraft(d.id, patch)} />
          ))}
          <Button
            label={L.scan.takeAnother}
            variant="secondary"
            icon="add"
            onPress={() => void addMore()}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label={includedCount === drafts.length ? L.scan.addAll : L.scan.addSelected(includedCount)}
            icon="checkmark"
            onPress={submit}
            loading={busy}
            disabled={!canSubmit}
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : null}
    </Screen>
  );
}
