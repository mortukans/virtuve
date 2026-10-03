/**
 * Food-category selector built on EnumPicker. Options (and their order) come
 * straight from the shared Latvian categoryLabel map.
 */
import React from 'react';
import type { FoodCategory } from '@src/api/types';
import { categoryLabel } from '@src/i18n/lv';
import { EnumPicker } from './EnumPicker';

export const CATEGORY_OPTIONS = (Object.keys(categoryLabel) as FoodCategory[]).map((value) => ({
  value,
  label: categoryLabel[value],
}));

export function CategoryPicker({ value, onChange }: { value: FoodCategory; onChange: (v: FoodCategory) => void }) {
  return <EnumPicker value={value} options={CATEGORY_OPTIONS} onChange={onChange} />;
}
