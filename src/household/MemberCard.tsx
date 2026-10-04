/**
 * MemberCard — one household member in the "Mēs" list: a warm person card with a
 * saffron avatar, name, an optional role badge (for admins / children), a
 * "portion · diet" subtitle and a small "eats tonight" status dot. Tappable to
 * open the member profile.
 */
import React from 'react';
import { View } from 'react-native';
import { Avatar, Body, Card, Muted, Pill, Row } from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
import { dietLabel, portionLabel, roleLabel } from '@src/i18n/lv';
import type { Member } from '@src/api/types';

export function MemberCard({ member, onPress }: { member: Member; onPress?: () => void }) {
  const diet = member.prefs?.diet ?? [];
  const dietText = diet.map((d) => dietLabel[d] ?? d).join(', ');
  const sub = dietText ? `${portionLabel[member.portion]} · ${dietText}` : portionLabel[member.portion];

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <Row gap={spacing.md}>
        <Avatar name={member.display_name} size={46} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Row gap={spacing.sm}>
            <Body style={[t.bodyStrong, { flexShrink: 1 }]}>{member.display_name}</Body>
            {member.role !== 'member' ? <Pill label={roleLabel[member.role]} /> : null}
          </Row>
          <Muted style={{ marginTop: 2 }}>{sub}</Muted>
        </View>
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: member.eats_by_default ? colors.herb : colors.textFaint,
          }}
        />
      </Row>
    </Card>
  );
}
