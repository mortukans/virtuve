/**
 * MemberCard — one household member in the "Mēs" list: avatar, name and a short
 * role · portion subtitle. Tappable to open the member profile.
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Body, Card, Muted, Row } from '@src/ui/kit';
import { colors, spacing } from '@src/ui/theme';
import { portionLabel, roleLabel } from '@src/i18n/lv';
import type { Member } from '@src/api/types';

export function MemberCard({ member, onPress }: { member: Member; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <Row gap={spacing.md}>
        <Avatar name={member.display_name} color={member.role === 'child' ? colors.blue : colors.accent} />
        <View style={{ flex: 1 }}>
          <Body>{member.display_name}</Body>
          <Muted>{roleLabel[member.role]} · {portionLabel[member.portion]}</Muted>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
      </Row>
    </Card>
  );
}
