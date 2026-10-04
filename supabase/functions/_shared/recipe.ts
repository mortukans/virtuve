// Shared recipe JSON → DB row builder, used by ai-recipes, ai-transform, ai-leftovers.
export const CATS = ['produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other'];

export function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
}
export function namesMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().trim(), y = b.toLowerCase().trim();
  return x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x));
}

export interface RowCtx {
  household: string;
  uid: string;
  eaterCount: number;
  items: { id: string; name: string }[];
  source?: string;
}

/** Sanitise one AI recipe object into an inventory-aware `recipes` insert row. */
export function buildRecipeRow(r: Record<string, unknown>, ctx: RowCtx) {
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).map((i: Record<string, unknown>) => ({
    name: String(i.name ?? '').slice(0, 80), qty: String(i.qty ?? ''), have: Boolean(i.have),
  })).filter((i) => i.name);
  const missing = (Array.isArray(r.missing) ? r.missing : []).map((m: Record<string, unknown>) => ({
    name: String(m.name ?? '').slice(0, 80), qty: String(m.qty ?? ''), have: false,
    category: CATS.includes(String(m.category)) ? String(m.category) : 'other',
  })).filter((m) => m.name);
  const steps = (Array.isArray(r.steps) ? r.steps : []).map((s: Record<string, unknown>, idx: number) => ({
    n: Number(s.n ?? idx + 1), text: String(s.text ?? ''), timer_min: s.timer_min != null ? Number(s.timer_min) : null,
  })).filter((s) => s.text);
  const uses = ctx.items
    .filter((it) => ingredients.some((ing) => ing.have && namesMatch(ing.name, it.name)))
    .map((it) => it.id);
  return {
    household_id: ctx.household,
    title: String(r.title ?? 'Vakariņas').slice(0, 120),
    summary: String(r.summary ?? '').slice(0, 300),
    time_active_min: clampInt(r.time_active_min, 5, 240, 15),
    time_total_min: clampInt(r.time_total_min, 5, 360, 25),
    servings: clampInt(r.servings, 1, 20, ctx.eaterCount),
    kcal: r.kcal != null ? clampInt(r.kcal, 0, 5000, 0) : null,
    tags: (Array.isArray(r.tags) ? r.tags : []).map(String).slice(0, 8),
    ingredients, steps,
    uses_item_ids: uses,
    missing,
    est_cost_eur: r.est_cost_eur != null ? Number(r.est_cost_eur) : null,
    image_url: null, image_is_ai: true, source: ctx.source ?? 'ai', created_by: ctx.uid,
  };
}

/** The JSON recipe shape, reused in every recipe-generating prompt. */
export const RECIPE_SHAPE = `{
 "title": "<latviski>",
 "summary": "<īss apraksts latviski, 1 teikums>",
 "time_active_min": <int>, "time_total_min": <int>, "servings": <int>, "kcal": <int vai null>,
 "tags": ["fast"|"healthy"|"cheap"|"high_protein"|"comfort"|"light"|"one_pan"|"air_fryer"|"vegetarian"|...],
 "ingredients": [{"name":"<latviski>","qty":"<piem. 300 g / 2 gab. / 1 ēdamkarote>","have": <true ja produkts ir mājās>}],
 "steps": [{"n":1,"text":"<latviski>","timer_min":<int vai null>}],
 "missing": [{"name":"<latviski>","qty":"<...>","category":"<kategorija>"}],
 "est_cost_eur": <skaitlis par porciju vai null>
}`;

/** Household "voice" instruction for recipe summaries. */
export const toneLine = (tone: unknown): string =>
  tone === 'humor' ? 'Aprakstus raksti ar vieglu, draudzīgu humoru.'
  : tone === 'neutral' ? 'Aprakstus raksti neitrāli un lietišķi.'
  : 'Aprakstus raksti draudzīgi un sirsnīgi.';
