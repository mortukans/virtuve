/**
 * Virtuve kitchen — shared enum option lists for the pickers. Kept in one place
 * so the manual-add form, the item editor and the scan review stay in sync.
 */
import { amountLabel, categoryLabel } from '@src/i18n/lv';
import type { AmountLabel, FoodCategory, ItemState, StorageLocation } from '@src/api/types';

export const CATEGORY_OPTIONS = Object.keys(categoryLabel) as FoodCategory[];
export const LOCATION_OPTIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'staple'];
export const AMOUNT_OPTIONS = Object.keys(amountLabel) as AmountLabel[];
export const STATE_OPTIONS: ItemState[] = ['sealed', 'opened', 'cooked', 'frozen'];
