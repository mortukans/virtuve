// "Pagatavo no atlikumiem" — turn yesterday's leftovers into a NEW meal (not a
// reheat). Takes a list of leftover items; returns 3 persisted recipe ideas.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';
import { loadContext, renderContext } from '../_shared/context.ts';
import { buildRecipeRow, CATS, RECIPE_SHAPE, toneLine } from '../_shared/recipe.ts';

const SYSTEM = `Tu esi Latvijas mājas pavārs. Tev iedos pāri palikušus produktus/ēdienus.
Nepiedāvā tos vienkārši uzsildīt — PĀRVĒRT tos jaunā maltītē.
Atbildi TIKAI ar JSON {"recipes":[...]} ar līdz 3 idejām, bez paskaidrojumiem, bez koda blokiem.
Katra recepte: ${RECIPE_SHAPE}
Noteikumi: balsties galvenokārt uz atlikumiem; NEKAD neiekļauj NEDRĪKST produktus; viss latviski;
"missing".category no: ${CATS.join(', ')}.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { household, items, eaters } = await req.json() as { household: string; items: string[]; eaters?: string[] };
    if (!household) throw new HttpError(400, 'no_household');
    const list = (Array.isArray(items) ? items : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 15);
    if (list.length === 0) throw new HttpError(400, 'no_items');
    const admin = adminClient();
    await requireMember(admin, household, uid);

    const ctx = await loadContext(admin, household, Array.isArray(eaters) ? eaters : []);
    const text = [
      'Pāri palikušie produkti/ēdieni:',
      list.map((x) => `- ${x}`).join('\n'),
      toneLine(ctx.settings.tone),
      '',
      renderContext(ctx),
      '',
      'Izveido 3 idejas, kā no šiem atlikumiem pagatavot jaunu maltīti.',
    ].join('\n');

    const raw = await callClaude({ model: TEXT_MODEL, system: SYSTEM, blocks: [{ type: 'text', text }], maxTokens: 5000, effort: 'low' });
    const parsed = extractJson<{ recipes?: unknown[] }>(raw);
    const recipes = (parsed.recipes ?? []).slice(0, 3) as Record<string, unknown>[];
    if (recipes.length === 0) throw new HttpError(502, 'ai_empty');

    const rows = recipes.map((r) => buildRecipeRow(r, { household, uid, eaterCount: ctx.eaterCount, items: ctx.items }));
    const { data, error } = await admin.from('recipes').insert(rows).select('*');
    if (error) { console.error(error); throw new HttpError(500, 'db_error'); }
    return json({ recipes: data });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
