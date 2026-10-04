/**
 * One shopping-list row — a soft "ko" card. Tap the left area to toggle "bought";
 * a claim toggle ("Paņemšu") and an overflow menu (Nav veikalā / Dzēst) cover the
 * rest. Each row owns its mutations so the list stays independently responsive.
 * In store mode the name and the check target grow for easy one-handed tapping
 * while walking the aisles.
 */
import React from 'react';
import { Alert, Pressable, Text, View, type AlertButton } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem } from '@src/api/types';
import { removeShoppingItem, updateShoppingItem } from '@src/api/rpc';
import { useAction } from '@src/ui/useAction';
import { Pill, Row } from '@src/ui/kit';
import { colors, radius, spacing, type as t, withAlpha } from '@src/ui/theme';
import { L, categoryLabel, shoppingStatusLabel } from '@src/i18n/lv';
import { tap } from '@src/ui/haptics';

export function ShoppingRow({
  item,
  myId,
  onChanged,
  storeMode = false,
}: {
  item: ShoppingItem;
  myId: string | null;
  onChanged: () => void;
  storeMode?: boolean;
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

  // Store mode = higher contrast, larger targets for shopping on the move.
  const checkSize = storeMode ? 28 : 24;
  const nameStyle = storeMode
    ? { fontSize: 19, fontWeight: '700' as const }
    : { fontSize: 17, fontWeight: '600' as const };
  const padV = storeMode ? spacing.md : spacing.sm;

  const subtitle = [item.qty_text, categoryLabel[item.category]].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: padV,
        marginTop: spacing.sm,
        opacity: busy ? 0.5 : bought ? 0.6 : 1,
      }}
    >
      <Row gap={spacing.sm}>
        <Pressable
          onPress={toggleBought}
          hitSlop={6}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}
        >
          <Ionicons
            name={bought ? 'checkmark-circle' : 'ellipse-outline'}
            size={checkSize}
            color={bought ? colors.herb : colors.textFaint}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[nameStyle, { color: bought ? colors.textFaint : colors.text }, bought && { textDecorationLine: 'line-through' }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            {subtitle || claimedByMe || claimedByOther || unavailable ? (
              <Row gap={spacing.sm} style={{ marginTop: 3, flexWrap: 'wrap' }}>
                {subtitle ? <Text style={t.small} numberOfLines={1}>{subtitle}</Text> : null}
                {!bought && claimedByMe ? (
                  <Pill label={shoppingStatusLabel.claimed} color={colors.accent} bg={withAlpha(colors.accent, 0.14)} icon="bag-check" />
                ) : null}
                {!bought && claimedByOther ? (
                  <Pill label={`Paņems: ${item.claimed_by_name ?? ''}`.trim()} color={colors.blue} bg={withAlpha(colors.blue, 0.14)} icon="bag-check" />
                ) : null}
                {unavailable ? (
                  <Pill label={shoppingStatusLabel.unavailable} color={colors.paprika} bg={withAlpha(colors.paprika, 0.14)} icon="close-circle" />
                ) : null}
              </Row>
            ) : null}
          </View>
        </Pressable>

        {!bought && !claimedByOther ? (
          <Pressable
            onPress={toggleClaim}
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: claimedByMe ? withAlpha(colors.accent, 0.14) : 'transparent',
            }}
          >
            <Ionicons
              name={claimedByMe ? 'bag-check' : 'bag-add-outline'}
              size={storeMode ? 24 : 22}
              color={claimedByMe ? colors.accent : colors.textMuted}
            />
          </Pressable>
        ) : null}

        <Pressable onPress={openMenu} hitSlop={8} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      </Row>
    </View>
  );
}
