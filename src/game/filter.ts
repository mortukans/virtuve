/**
 * Dietary filtering for the dinner swipe game. Honours the eating household
 * members' saved preferences: allergies + "never" are HARD blocks (matched
 * against ingredient names, safety-first), and if anyone eating is vegetarian/
 * vegan the deck drops meat/fish dishes (by category + a conservative Latvian
 * meat-term scan over the ingredients).
 */
import type { Member, Recipe } from '@src/api/types';
import { recipeCategory, visibleTags } from '@src/meals/library';

const norm = (s: string): string => s.toLowerCase().trim();

const MEAT_CATS = new Set(['chicken', 'beef', 'pork', 'fish']);
// Conservative Latvian roots for meat/fish, to catch it inside non-meat categories.
const MEAT_TERMS = [
  'gaļ', 'vist', 'cāl', 'cūk', 'liellop', 'jēr', 'speķ', 'bekon', 'šķiņķ', 'desa',
  'kotlet', 'frikadel', 'malt', 'zivs', 'zivj', 'lasi', 'lasis', 'tunz', 'garnel', 'vēž', 'siļķ',
];

export interface DeckFilter {
  blocks: string[];
  veg: boolean;
}

/** Build the filter from the members who eat by default (fall back to all). */
export function buildDeckFilter(members: Member[]): DeckFilter {
  const eaters = members.filter((m) => m.eats_by_default);
  const base = eaters.length ? eaters : members;
  const blocks = new Set<string>();
  for (const m of base) {
    for (const a of m.prefs?.allergies ?? []) { const t = norm(a); if (t) blocks.add(t); }
    for (const n of m.prefs?.never ?? []) { const t = norm(n); if (t) blocks.add(t); }
  }
  const veg = base.some((m) => (m.prefs?.diet ?? []).some((d) => d === 'vegetarian' || d === 'vegan'));
  return { blocks: [...blocks], veg };
}

/** True if the recipe is allowed under the filter. */
export function allowRecipe(r: Recipe, f: DeckFilter): boolean {
  const ings = (r.ingredients ?? []).map((i) => norm(i.name));
  const title = norm(r.title);
  // Hard blocks (allergies / never): drop if any ingredient or the title matches.
  for (const b of f.blocks) {
    if (ings.some((n) => n.includes(b)) || title.includes(b)) return false;
  }
  if (f.veg) {
    const cat = recipeCategory(r);
    if (cat && MEAT_CATS.has(cat)) return false;
    if (MEAT_TERMS.some((t) => ings.some((n) => n.includes(t)) || title.includes(t))) {
      // allow only if the recipe is explicitly tagged vegetarian (false positive guard)
      if (!visibleTags(r).includes('vegetarian')) return false;
    }
  }
  return true;
}

/** Fisher–Yates shuffle (new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Filter + shuffle a deck for the given members. */
export function prepareDeck(recipes: Recipe[], members: Member[]): Recipe[] {
  const f = buildDeckFilter(members);
  return shuffle(recipes.filter((r) => allowRecipe(r, f)));
}
