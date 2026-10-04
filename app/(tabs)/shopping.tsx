/**
 * Shared shopping list. Action-first "Pirkumi" screen: a header store-mode toggle,
 * an inline add composer, items grouped into store sections, and bought items that
 * collapse to the bottom. Live across the household (realtime invalidates these
 * queries). Claim items so nobody buys the same thing twice. Flip "Esmu veikalā"
 * to enlarge targets while you shop.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { FoodCategory } from '@src/api/types';
import {
  addShoppingItems, clearBought, endShopping, getShoppers, getShoppingList,
  startShopping, stockBought,
} from '@src/api/rpc';
import { qk, queryClient } from '@src/api/queryClient';
import { useHouseholdCtx } from '@src/household/context';
import { useUserId } from '@src/auth/store';
import { useAction } from '@src/ui/useAction';
import {
  Body, Button, Card, Chip, EmptyState, Field, Row, Screen, SectionHeader, SectionLabel, Spinner, Title,
} from '@src/ui/kit';
import { colors, radius, spacing } from '@src/ui/theme';
import { L, categoryLabel } from '@src/i18n/lv';
import { tap } from '@src/ui/haptics';
import { CategoryPicker } from '@src/shopping/CategoryPicker';
import { ShoppingRow } from '@src/shopping/ShoppingRow';

const CATEGORY_ORDER = Object.keys(categoryLabel) as FoodCategory[];

export default function ShoppingScreen() {
  const { activeId } = useHouseholdCtx();
  const myId = useUserId();

  const listQ = useQuery({
    queryKey: qk.shopping(activeId ?? 'none'),
    queryFn: () => getShoppingList(activeId!),
    enabled: !!activeId,
  });
  const shoppersQ = useQuery({
    queryKey: qk.shoppers(activeId ?? 'none'),
    queryFn: () => getShoppers(activeId!),
    enabled: !!activeId,
  });

  const [name, setName] = useState('');
  const [cat, setCat] = useState<FoodCategory>('other');
  const [focused, setFocused] = useState(false);
  const [showBought, setShowBought] = useState(false);

  const addAction = useAction();
  const shopAction = useAction();
  const clearAction = useAction();
  const stockAction = useAction();

  const items = listQ.data ?? [];
  const bought = useMemo(() => items.filter((i) => i.status === 'bought'), [items]);
  const groups = useMemo(() => {
    const active = items.filter((i) => i.status !== 'bought');
    return CATEGORY_ORDER
      .map((category) => ({ category, rows: active.filter((i) => i.category === category) }))
      .filter((g) => g.rows.length > 0);
  }, [items]);

  if (!activeId) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  const invShopping = () => queryClient.invalidateQueries({ queryKey: qk.shopping(activeId) });
  const invShoppers = () => queryClient.invalidateQueries({ queryKey: qk.shoppers(activeId) });
  const invInventory = () => queryClient.invalidateQueries({ queryKey: qk.inventory(activeId) });

  const shoppers = shoppersQ.data ?? [];
  const iAmShopping = shoppers.some((s) => s.user_id === myId);
  const otherShopper = shoppers.find((s) => s.user_id !== myId);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    void addAction.run(() => addShoppingItems(activeId, [{ name: n, category: cat }]), {
      onDone: () => { setName(''); invShopping(); },
    });
  };
  const toggleShopping = () =>
    void shopAction.run(() => (iAmShopping ? endShopping(activeId) : startShopping(activeId)), { onDone: invShoppers });
  const doClear = () => void clearAction.run(() => clearBought(activeId), { onDone: invShopping });
  const doStock = () =>
    Alert.alert(L.shopping.stockBought, L.shopping.stockBoughtBody, [
      { text: L.common.cancel, style: 'cancel' },
      {
        text: L.common.confirm,
        onPress: () => void stockAction.run(() => stockBought(activeId), { onDone: () => { invShopping(); invInventory(); } }),
      },
    ]);

  const loading = listQ.isLoading && !listQ.data;
  const empty = !loading && items.length === 0;
  const canAdd = !!name.trim() && !addAction.busy;
  const showPicker = focused || name.trim().length > 0;

  return (
    <Screen scroll dock>
      <Row style={{ marginBottom: spacing.sm }}>
        <Title style={{ flex: 1 }}>Pirkumi</Title>
        <Chip
          label={iAmShopping ? L.shopping.leaveShop : L.shopping.atShop}
          icon={iAmShopping ? 'checkmark-done' : 'cart'}
          selected={iAmShopping}
          onPress={toggleShopping}
        />
      </Row>

      {otherShopper ? (
        <Card style={{ marginTop: spacing.sm, backgroundColor: colors.surfaceAlt, borderColor: colors.accent }}>
          <Row gap={spacing.sm}>
            <Ionicons name="cart" size={18} color={colors.accent} />
            <Body style={{ flex: 1 }}>{L.shopping.someoneShopping(otherShopper.name)}</Body>
          </Row>
        </Card>
      ) : null}

      <Row style={{ marginTop: spacing.lg, alignItems: 'flex-start' }} gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <Field
            placeholder={L.shopping.addItem}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="done"
            onSubmitEditing={add}
            autoCapitalize="sentences"
          />
        </View>
        <Pressable
          onPress={() => { if (canAdd) { tap(); add(); } }}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel={L.shopping.addItem}
          style={({ pressed }) => [
            {
              width: 54,
              height: 54,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
            },
            pressed && canAdd && { transform: [{ scale: 0.97 }], opacity: 0.92 },
            !name.trim() && { opacity: 0.45 },
          ]}
        >
          {addAction.busy ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Ionicons name="add" size={28} color={colors.accentText} />
          )}
        </Pressable>
      </Row>

      {showPicker ? (
        <View style={{ marginTop: spacing.sm }}>
          <CategoryPicker value={cat} onChange={setCat} />
        </View>
      ) : null}

      {loading ? (
        <View style={{ marginTop: spacing.xl }}>
          <Spinner />
        </View>
      ) : null}

      {empty ? <EmptyState icon="cart-outline" title={L.shopping.empty} /> : null}

      {iAmShopping && groups.length > 0 ? (
        <SectionLabel style={{ color: colors.accent, marginTop: spacing.lg }}>Paņem un atzīmē</SectionLabel>
      ) : null}

      {groups.map((g) => (
        <View key={g.category} style={{ marginTop: spacing.sm }}>
          <SectionHeader title={categoryLabel[g.category]} />
          {g.rows.map((item) => (
            <ShoppingRow key={item.id} item={item} myId={myId} onChanged={invShopping} storeMode={iAmShopping} />
          ))}
        </View>
      ))}

      {bought.length > 0 ? (
        <View style={{ marginTop: spacing.xl }}>
          <Pressable
            onPress={() => { tap(); setShowBought((v) => !v); }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}
          >
            <Row gap={spacing.sm}>
              <Ionicons name="checkmark-done-circle" size={18} color={colors.herb} />
              <SectionLabel>{L.shopping.boughtCount(bought.length)}</SectionLabel>
            </Row>
            <Ionicons name={showBought ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
          </Pressable>

          {showBought
            ? bought.map((item) => <ShoppingRow key={item.id} item={item} myId={myId} onChanged={invShopping} />)
            : null}

          <Button
            label={L.shopping.stockBought}
            icon="file-tray-stacked-outline"
            onPress={doStock}
            loading={stockAction.busy}
            style={{ marginTop: spacing.md }}
          />
          <Button
            label={L.shopping.clearBought}
            icon="trash-outline"
            variant="secondary"
            onPress={doClear}
            loading={clearAction.busy}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
