/**
 * One shopping-list row. Tap the left area to toggle "bought"; a claim toggle
 * ("Paņemšu") and an overflow menu (Nav veikalā / Dzēst) cover the rest. Each row
 * owns its mutations so the list stays independently responsive.
 */
import React from 'react';
import { Alert, Pressable, Text, View, type AlertButton } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem } from '@src/api/types';
import { removeShoppingItem, updateShoppingItem } from '@src/api/rpc';
import { useAction } from '@src/ui/useAction';
import { Pill, Row } from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
import { L, shoppingStatusLabel } from '@src/i18n/lv';
import { tap } from '@src/ui/haptics';

export function ShoppingRow({
  item,
  myId,
  onChanged,
}: {
  item: ShoppingItem;
  myId: string | null;
  onChanged: () => void;
}) {
  const { run, busy } = useAction();
  const bought = item.status === 'bought';
  const unavailable = item.status === 'unavailable';
  const claimedByMe = !!myId && item.claimed_by === myId;
  const claimedByOther = !!item.claimed_by && item.claimed_by !== myId;

  const patch = (p: Parameters<typeof updateShoppingItem>[1]) =>
    run(() => updateShoppingItem(item.id, p), { onDone: onChanged });
  const remove = () => run(() => removeShoppingItem(item.id), { onDone: onChanged });

  const toggleBought = () => { tap(); void patch({ status: bought ? 'todo' : 'bought' }); };
  const toggleClaim = () => { tap(); void patch({ claim: !claimedByMe }); };

  const openMenu = () => {
    tap();
    const buttons: AlertButton[] = [];
    if (!bought) {
      buttons.push(
        unavailable
          ? { text: 'Atjaunot sarakstā', onPress: () => void patch({ status: 'todo' }) }
          : { text: L.shopping.markUnavailable, onPress: () => void patch({ status: 'unavailable' }) },
      );
    }
    buttons.push({ text: L.common.delete, style: 'destructive', onPress: remove });
    buttons.push({ text: L.common.cancel, style: 'cancel' });
    Alert.alert(item.name, item.qty_text ?? undefined, buttons);
  };

  return (
    <Row style={{ paddingVertical: spacing.sm, opacity: busy ? 0.5 : 1 }}>
      <Pressable
        onPress={toggleBought}
        hitSlop={6}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <Ionicons
          name={bought ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={bought ? colors.accent : colors.textFaint}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[t.body, bought && { color: colors.textFaint, textDecorationLine: 'line-through' }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.qty_text || claimedByMe || claimedByOther || unavailable ? (
            <Row gap={spacing.sm} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              {item.qty_text ? <Text style={t.small}>{item.qty_text}</Text> : null}
              {!bought && claimedByMe ? (
                <Pill label={shoppingStatusLabel.claimed} color={colors.accent} bg={colors.surfaceAlt} icon="bag-check" />
              ) : null}
              {!bought && claimedByOther ? (
                <Pill label={`Paņems: ${item.claimed_by_name ?? ''}`.trim()} color={colors.blue} bg={colors.surfaceAlt} icon="bag-check" />
              ) : null}
              {unavailable ? (
                <Pill label={shoppingStatusLabel.unavailable} color={colors.red} bg={colors.surfaceAlt} icon="close-circle" />
              ) : null}
            </Row>
          ) : null}
        </View>
      </Pressable>

      {!bought && !claimedByOther ? (
        <Pressable onPress={toggleClaim} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons
            name={claimedByMe ? 'bag-check' : 'bag-add-outline'}
            size={22}
            color={claimedByMe ? colors.accent : colors.textMuted}
          />
        </Pressable>
      ) : null}

      <Pressable onPress={openMenu} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </Pressable>
    </Row>
  );
}
