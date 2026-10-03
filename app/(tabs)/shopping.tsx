/**
 * Shared shopping list. Non-bought items are grouped into store sections; bought
 * items collapse to the bottom. Live across the household (realtime invalidates
 * these queries). Claim items so nobody buys the same thing twice.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
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
import { Body, Button, Card, Field, Row, Screen, SectionHeader, Spinner, Title } from '@src/ui/kit';
import { colors, spacing, type as t } from '@src/ui/theme';
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

  return (
    <Screen scroll>
      <Title>{L.shopping.title}</Title>

      {otherShopper ? (
        <Card style={{ marginTop: spacing.md, backgroundColor: colors.surfaceAlt, borderColor: colors.accent }}>
          <Row gap={spacing.sm}>
            <Ionicons name="cart" size={18} color={colors.accent} />
            <Body style={{ flex: 1 }}>{L.shopping.someoneShopping(otherShopper.name)}</Body>
          </Row>
        </Card>
      ) : null}

      <Button
        label={iAmShopping ? L.shopping.leaveShop : L.shopping.atShop}
        icon={iAmShopping ? 'checkmark-done' : 'cart'}
        variant={iAmShopping ? 'secondary' : 'primary'}
        onPress={toggleShopping}
        loading={shopAction.busy}
        style={{ marginTop: spacing.md }}
      />

      <Card style={{ marginTop: spacing.lg }}>
        <Field
          placeholder={L.shopping.namePlaceholder}
          value={name}
          onChangeText={setName}
          returnKeyType="done"
          onSubmitEditing={add}
          autoCapitalize="sentences"
        />
        <Text style={[t.small, { marginBottom: 6 }]}>{L.kitchen.category}</Text>
        <CategoryPicker value={cat} onChange={setCat} />
        <Button
          label={L.shopping.addItem}
          icon="add"
          onPress={add}
          disabled={!name.trim()}
          loading={addAction.busy}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {loading ? (
        <View style={{ marginTop: spacing.xl }}>
          <Spinner />
        </View>
      ) : null}

      {empty ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.huge }}>
          <Ionicons name="cart-outline" size={44} color={colors.textFaint} />
          <Text style={[t.h3, { marginTop: spacing.md }]}>{L.shopping.empty}</Text>
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.category} style={{ marginTop: spacing.sm }}>
          <SectionHeader title={categoryLabel[g.category]} />
          {g.rows.map((item) => (
            <ShoppingRow key={item.id} item={item} myId={myId} onChanged={invShopping} />
          ))}
        </View>
      ))}

      {bought.length > 0 ? (
        <View style={{ marginTop: spacing.xl }}>
          <Pressable
            onPress={() => { tap(); setShowBought((v) => !v); }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}
          >
            <Text style={[t.tiny, { color: colors.textFaint }]}>{L.shopping.boughtCount(bought.length).toUpperCase()}</Text>
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
