// Build a large, free, browsable recipe library (global recipes, household_id null)
// by importing real recipes from TheMealDB and LOCALISING them into Latvian with
// Claude — real photos, ingredients, steps, a discovery category and nutrition
// (calories in `kcal`, macros encoded in tags as p:/c:/f: to avoid a schema change).
// Idempotent + batched: call repeatedly until {remaining:0}. Each call processes a
// few new recipes so it never times out.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireUser } from '../_shared/supa.ts';

const BATCH = 6;

// TheMealDB category -> how many to import + our discovery category key.
// Sums to ~265 targets for a 200+ library with balanced category coverage.
const PLAN: { cat: string; n: number; key: string }[] = [
  { cat: 'Chicken', n: 32, key: 'chicken' },
  { cat: 'Beef', n: 36, key: 'beef' },
  { cat: 'Lamb', n: 14, key: 'beef' },
  { cat: 'Pork', n: 18, key: 'pork' },
  { cat: 'Seafood', n: 28, key: 'fish' },
  { cat: 'Pasta', n: 12, key: 'pasta' },
  { cat: 'Vegetarian', n: 32, key: 'vegetarian' },
  { cat: 'Vegan', n: 7, key: 'vegetarian' },
  { cat: 'Breakfast', n: 16, key: 'breakfast' },
  { cat: 'Dessert', n: 36, key: 'dessert' },
  { cat: 'Side', n: 22, key: 'side' },
  { cat: 'Starter', n: 12, key: 'side' },
];

const ALLOWED_TAGS = ['fast', 'healthy', 'cheap', 'high_protein', 'comfort', 'vegetarian', 'light', 'one_pan', 'baking'];

const idFor = (mealId: string) => `b0000000-0000-4000-8000-${mealId.padStart(12, '0')}`;
const thumb = (m: Record<string, string>) => m.strMealThumb;

const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { 'user-agent': 'virtuve-seed' } });
  if (!r.ok) throw new HttpError(502, 'mealdb_error');
  return await r.json();
}

/** English recipe (ingredients + instructions) -> structured Latvian recipe JSON. */
async function localise(m: Record<string, string>): Promise<any> {
  const ings: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] ?? '').trim();
    const qty = (m[`strMeasure${i}`] ?? '').trim();
    if (name) ings.push(`${qty} ${name}`.trim());
  }
  const system =
    `Tu esi latviešu pavārgrāmatas redaktors. Pārtulko un pielāgo recepti dabiskā, mūsdienīgā latviešu valodā ` +
    `Latvijas lietotājam. Pārrēķini daudzumus METRISKAJĀ sistēmā (g, ml, ēd.k., tēj.k., gab.). ` +
    `Atbildi TIKAI ar JSON (bez koda blokiem, bez paskaidrojumiem).`;
  const prompt =
    `Oriģinālā recepte (angliski):\n` +
    `Nosaukums: ${m.strMeal}\nKategorija: ${m.strCategory} / ${m.strArea}\n` +
    `Sastāvdaļas:\n${ings.join('\n')}\n\nPagatavošana:\n${(m.strInstructions ?? '').slice(0, 2500)}\n\n` +
    `Atgriez JSON ar šādu formu:\n` +
    `{"title":"latviešu nosaukums","summary":"viens pievilcīgs teikums latviski",` +
    `"servings":int,"time_active_min":int,"time_total_min":int,` +
    `"kcal":int_per_serving,"protein_g":int,"carbs_g":int,"fat_g":int,` +
    `"tags":["izvēlies 1-3 no: ${ALLOWED_TAGS.join(',')}"],` +
    `"ingredients":[{"name":"latviski","qty":"piem. 300 g"}],` +
    `"steps":["1. solis latviski","2. solis latviski"]}\n` +
    `Soļus raksti īsus un skaidrus. Saglabā garšu autentisku.`;

  const raw = await callClaude({
    model: TEXT_MODEL,
    system,
    blocks: [{ type: 'text', text: prompt }],
    maxTokens: 2000,
    effort: 'low',
  });
  return extractJson<any>(raw);
}

function toRow(mealId: string, key: string, m: Record<string, string>, t: any) {
  const macros = [
    `cat:${key}`,
    `p:${clampInt(t.protein_g, 0, 300, 0)}`,
    `c:${clampInt(t.carbs_g, 0, 400, 0)}`,
    `f:${clampInt(t.fat_g, 0, 300, 0)}`,
  ];
  const tags = Array.isArray(t.tags) ? t.tags.filter((x: string) => ALLOWED_TAGS.includes(x)).slice(0, 3) : [];
  const ingredients = Array.isArray(t.ingredients)
    ? t.ingredients.filter((i: any) => i?.name).map((i: any) => ({ name: String(i.name), qty: String(i.qty ?? ''), have: false }))
    : [];
  const steps = Array.isArray(t.steps)
    ? t.steps.filter((s: any) => typeof s === 'string' && s.trim()).map((text: string, i: number) => ({ n: i + 1, text }))
    : [];
  return {
    id: idFor(mealId),
    household_id: null,
    title: String(t.title ?? m.strMeal).slice(0, 120),
    summary: String(t.summary ?? '').slice(0, 300),
    time_active_min: clampInt(t.time_active_min, 5, 240, 20),
    time_total_min: clampInt(t.time_total_min, 5, 480, 35),
    servings: clampInt(t.servings, 1, 12, 4),
    kcal: clampInt(t.kcal, 0, 2000, 0) || null,
    tags: [...tags, ...macros],
    ingredients,
    steps,
    uses_item_ids: [],
    missing: [],
    est_cost_eur: null,
    image_url: thumb(m),
    image_is_ai: false,
    source: 'import',
    created_by: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    await requireUser(req);
    const admin = adminClient();

    // 1) Build the target id set from the plan (one filter call per category).
    const targets: { mealId: string; key: string }[] = [];
    for (const p of PLAN) {
      const list = await fetchJson(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(p.cat)}`);
      const meals = (list.meals ?? []).slice(0, p.n);
      for (const meal of meals) targets.push({ mealId: meal.idMeal, key: p.key });
    }
    const ids = targets.map((t) => idFor(t.mealId));

    // 2) Which already exist?
    const { data: have } = await admin.from('recipes').select('id').in('id', ids);
    const haveSet = new Set((have ?? []).map((r: { id: string }) => r.id));
    const todo = targets.filter((t) => !haveSet.has(idFor(t.mealId)));

    // 3) Process up to BATCH new ones.
    const batch = todo.slice(0, BATCH);
    const rows: any[] = [];
    const errors: string[] = [];
    for (const t of batch) {
      try {
        const detail = await fetchJson(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${t.mealId}`);
        const m = (detail.meals ?? [])[0];
        if (!m) { errors.push(`${t.mealId}:notfound`); continue; }
        const loc = await localise(m);
        rows.push(toRow(t.mealId, t.key, m, loc));
      } catch (e) {
        errors.push(`${t.mealId}:${e instanceof Error ? e.message : 'err'}`);
      }
    }
    if (rows.length) {
      const { error } = await admin.from('recipes').upsert(rows, { onConflict: 'id' });
      if (error) throw new HttpError(500, error.message);
    }

    return json({ processed: rows.length, remaining: todo.length - batch.length, total_target: targets.length, errors });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
