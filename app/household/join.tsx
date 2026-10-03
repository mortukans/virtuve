/**
 * Join-household modal. Enter an invite code, join and jump home. An invalid
 * code surfaces via the useAction error alert (code_invalid).
 */
import React, { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Body, Button, Field, IconButton, Row, Screen, Title } from '@src/ui/kit';
import { spacing } from '@src/ui/theme';
import { L } from '@src/i18n/lv';
import { joinHousehold } from '@src/api/rpc';
import { qk } from '@src/api/queryClient';
import { useActiveHousehold } from '@src/household/active';
import { useAction } from '@src/ui/useAction';

export default function JoinHousehold() {
  const [code, setCode] = useState('');
  const setActive = useActiveHousehold((s) => s.setActive);
  const qc = useQueryClient();
  const { run, busy } = useAction();

  const join = () => {
    void run(() => joinHousehold(code.trim().toUpperCase()), {
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
      <Title>{L.household.joinTitle}</Title>
      <Body muted style={{ marginBottom: spacing.lg }}>{L.household.joinBody}</Body>
      <Field
        label={L.household.inviteCode}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="XXXXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={join}
      />
      <Button label={L.household.join} onPress={join} loading={busy} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}
