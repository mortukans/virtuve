// Transform an existing recipe (healthier / cheaper / faster / vegetarian / air
// fryer / bigger batch) into a new persisted recipe. Respects household allergies.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';
import { loadContext, renderContext } from '../_shared/context.ts';
import { buildRecipeRow, CATS, RECIPE_SHAPE, toneLine } from '../_shared/recipe.ts';

const INSTRUCTION: Record<string, string> = {
  healthier: 'Padari recepti veselīgāku: mazāk tauku un cukura, vairāk dārzeņu un olbaltumvielu, bet saglabā garšu.',
  cheaper: 'Padari recepti lētāku: izmanto lētākus produktus un pēc iespējas vairāk no tā, kas jau ir mājās.',
  faster: 'Padari recepti ātrāku un vienkāršāku: mazāk soļu, īsāks laiks, mazāk trauku.',
  vegetarian: 'Pārveido recepti veģetārā versijā (bez gaļas un zivīm), saglabājot sātīgumu.',
  air_fryer: 'Pielāgo recepti pagatavošanai ar air fryer (gaisa grilu): norādi temperatūru un laiku.',
  more_portions: 'Pagatavo lielāku daudzumu — dubultās porcijas (reizini sastāvdaļas ar 2).',
};

const SYSTEM = `Tu esi Latvijas mājas pavārs. Tev iedos esošu recepti un pārveidojuma uzdevumu.
Atbildi TIKAI ar JSON objektu {"recipe": <recepte>}, bez paskaidrojumiem, bez koda blokiem.
Receptes forma: ${RECIPE_SHAPE}
Noteikumi: saglabā to pašu ēdiena ideju, tikai pielāgo; NEKAD neiekļauj produktus no NEDRĪKST saraksta;
visi teksti latviešu valodā; "missing".category no: ${CATS.join(', ')}.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { recipe: recipeId, transform } = await req.json() as { recipe: string; transform: string };
    if (!recipeId || !INSTRUCTION[transform]) throw new HttpError(400, 'bad_input');
    const admin = adminClient();

    const { data: r, error: re } = await admin.from('recipes').select('*').eq('id', recipeId).single();
    if (re || !r) throw new HttpError(404, 'not_found');
    if (r.household_id) await requireMember(admin, r.household_id, uid);

    const ctx = r.household_id ? await loadContext(admin, r.household_id, []) : null;
    const original = JSON.stringify({ title: r.title, servings: r.servings, ingredients: r.ingredients, steps: r.steps });
    const text = [
      `Pārveidojuma uzdevums: ${INSTRUCTION[transform]}`,
      ctx ? toneLine(ctx.settings.tone) : '',
      '',
      'Esošā recepte:',
      original,
      ctx ? '\n' + renderContext(ctx) : '',
    ].filter(Boolean).join('\n');

    const raw = await callClaude({ model: TEXT_MODEL, system: SYSTEM, blocks: [{ type: 'text', text }], maxTokens: 3500, effort: 'low' });
    const parsed = extractJson<{ recipe?: Record<string, unknown> }>(raw);
    if (!parsed.recipe) throw new HttpError(502, 'ai_empty');

    const row = buildRecipeRow(parsed.recipe, {
      household: r.household_id, uid, eaterCount: r.servings, items: ctx?.items ?? [],
    });
    const { data, error } = await admin.from('recipes').insert(row).select('*').single();
    if (error) { console.error(error); throw new HttpError(500, 'db_error'); }
    return json({ recipe: data });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
