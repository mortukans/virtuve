/**
 * Helpers for the recipe library + discovery. Library recipes encode a discovery
 * category and macros inside the `tags` array (no schema change): `cat:<key>`,
 * `p:<g>`, `c:<g>`, `f:<g>`. These helpers read that encoding and keep it out of
 * the visible tag chips. Also a best-effort serving-quantity scaler.
 */
import type { Recipe } from '@src/api/types';

/** Discovery category keys (order defines the filter row). */
export const RECIPE_CATEGORY_KEYS = [
  'chicken', 'beef', 'pork', 'fish', 'pasta', 'vegetarian', 'breakfast', 'dessert', 'side',
] as const;
export type RecipeCategoryKey = (typeof RECIPE_CATEGORY_KEYS)[number];

const ENCODED = /^(cat|p|c|f):/;

/** The recipe's discovery category key, if tagged. */
export function recipeCategory(recipe: Recipe): RecipeCategoryKey | null {
  const tag = (recipe.tags ?? []).find((t) => t.startsWith('cat:'));
  const key = tag?.slice(4);
  return (RECIPE_CATEGORY_KEYS as readonly string[]).includes(key ?? '') ? (key as RecipeCategoryKey) : null;
}

/** Visible, human tags (drops the encoded cat:/p:/c:/f: entries). */
export function visibleTags(recipe: Recipe): string[] {
  return (recipe.tags ?? []).filter((t) => !ENCODED.test(t));
}

export interface Nutrition {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

const macroTag = (recipe: Recipe, prefix: string): number | null => {
  const tag = (recipe.tags ?? []).find((t) => t.startsWith(`${prefix}:`));
  if (!tag) return null;
  const n = Number(tag.slice(prefix.length + 1));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Per-serving nutrition from `kcal` + the encoded macro tags. */
export function parseNutrition(recipe: Recipe): Nutrition {
  return {
    kcal: recipe.kcal && recipe.kcal > 0 ? recipe.kcal : null,
    protein: macroTag(recipe, 'p'),
    carbs: macroTag(recipe, 'c'),
    fat: macroTag(recipe, 'f'),
  };
}

export const hasNutrition = (n: Nutrition): boolean =>
  n.kcal != null || n.protein != null || n.carbs != null || n.fat != null;

// ─── serving scaler ─────────────────────────────────────────────────────────

const fmtNum = (v: number): string => {
  if (!Number.isFinite(v)) return '';
  const rounded = v >= 10 ? Math.round(v) : Math.round(v * 4) / 4; // quarter steps under 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
};

/**
 * Scale the leading quantity of an ingredient string by `factor`. Handles ints,
 * decimals, "a/b" fractions and "a-b" ranges; leaves unparseable amounts
 * ("pēc garšas", "šķipsna", "½ paka") untouched.
 */
export function scaleQty(qty: string, factor: number): string {
  if (!qty || !Number.isFinite(factor) || factor === 1) return qty;
  const m = qty.match(/^\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return qty;
  const rest = m[2] ?? '';
  const numStr = m[1].replace(/,/g, '.');

  if (numStr.includes('-')) {
    const [a, b] = numStr.split('-').map((x) => parseFloat(x.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return qty;
    return `${fmtNum(a * factor)}–${fmtNum(b * factor)} ${rest}`.trim();
  }
  let value: number;
  if (numStr.includes('/')) {
    const [a, b] = numStr.split('/').map((x) => parseFloat(x.trim()));
    value = b ? a / b : a;
  } else {
    value = parseFloat(numStr);
  }
  if (!Number.isFinite(value)) return qty;
  return `${fmtNum(value * factor)} ${rest}`.trim();
}
