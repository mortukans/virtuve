/**
 * InviteCard — shows the household invite code big, with copy / share / rotate
 * actions. Sharing uses the universal link https://virtuve.lv/i/<code>.
 */
import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, Muted, Row } from '@src/ui/kit';
import { colors, radius, spacing } from '@src/ui/theme';
import { success as hapticSuccess } from '@src/ui/haptics';
import { L } from '@src/i18n/lv';

export function InviteCard({ code, onRotate, rotating }: {
  code: string;
  onRotate: () => void;
  rotating?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable — ignore */ }
  };

  const share = () => {
    void Share.share({ message: `https://virtuve.lv/i/${code}` }).catch(() => undefined);
  };

  return (
    <Card raised style={{ marginBottom: spacing.md }}>
      <Muted>{L.household.inviteBody}</Muted>

      <View style={styles.codeBox}>
        <Text style={styles.code}>{code}</Text>
      </View>

      <Row gap={spacing.sm}>
        <Button
          full={false}
          style={{ flex: 1 }}
          variant="secondary"
          icon={copied ? 'checkmark' : 'copy-outline'}
          label={copied ? L.common.done : L.household.copyCode}
          onPress={() => { void copy(); }}
        />
        <Button
          full={false}
          style={{ flex: 1 }}
          variant="secondary"
          icon="share-outline"
          label={L.household.shareLink}
          onPress={share}
        />
      </Row>

      <Button
        variant="ghost"
        icon="refresh"
        label={L.household.rotateCode}
        onPress={onRotate}
        loading={rotating}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    marginVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 6, color: colors.accent },
});
