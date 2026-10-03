/**
 * Create-household modal. Names a new household, makes it active and jumps home.
 */
import React, { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Body, Button, Field, IconButton, Row, Screen, Title } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { createHousehold } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import { useActiveHousehold } from '@src/household/active';
import { useAction } from '@src/ui/useAction';

export default function CreateHousehold() {
  const [name, setName] = useState('');
  const setActive = useActiveHousehold((s) => s.setActive);
  const qc = useQueryClient();
  const { run, busy } = useAction();

  const create = () => {
    void run(() => createHousehold(name.trim() || 'Mūsu mājas'), {
      onDone: (h) => {
        setActive(h.id);
        void qc.invalidateQueries({ queryKey: qk.households });
        router.replace('/home');
      },
    });
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'flex-end', marginBottom: spacing.sm }}>
        <IconButton icon="close" onPress={() => router.back()} />
      </Row>
      <Title>{L.household.createTitle}</Title>
      <Body muted style={{ marginBottom: spacing.lg }}>{L.household.createBody}</Body>
      <Field
        label={L.member.displayName}
        value={name}
        onChangeText={setName}
        placeholder={L.household.namePlaceholder}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={create}
      />
      <Button label={L.household.create} onPress={create} loading={busy} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}
