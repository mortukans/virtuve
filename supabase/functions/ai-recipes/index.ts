// "Ko ēdam?" — generate 3 recipes from the household's inventory + preferences,
// persist them, and return them. Holds the Anthropic key server-side.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';
import { loadContext, renderContext } from '../_shared/context.ts';
import { buildRecipeRow, CATS, RECIPE_SHAPE, toneLine } from '../_shared/recipe.ts';

const moodLine: Record<string, string> = {
  fast: 'Gribas ātri pagatavojamu ēdienu.',
  healthy: 'Gribas veselīgu ēdienu.',
  hungry: 'Esam ļoti izsalkuši — sātīgs ēdiens.',
  comfort: 'Gribas mājīgu, sātīgu "comfort food".',
  light: 'Gribas vieglu ēdienu.',
  use_soon: 'Obligāti izmanto produktus, kas drīz jāizlieto.',
  any: 'Nav īpašu vēlmju — izvēlies labāko.',
};
const effortLine: Record<string, string> = {
  minimal: 'Gandrīz nekāda darba: maks. 5 sastāvdaļas, maks. 4 soļi, viens trauks.',
  normal: 'Normāls darba apjoms.',
  can_cook: 'Var arī pacensties — sarežģītāka recepte ir pieņemama.',
};

const SYSTEM = `Tu esi Latvijas mājas pavārs, kas iesaka vakariņas no tā, kas cilvēkiem jau ir mājās.
Atbildi TIKAI ar JSON objektu {"recipes":[...]} ar TIEŠI 3 receptēm, bez paskaidrojumiem, bez koda blokiem.
Katra recepte: ${RECIPE_SHAPE}
Noteikumi:
- Izmanto PĒC IESPĒJAS VAIRĀK produktu, kas jau ir mājās. "missing" = tikai tie, kas jānopērk.
- NEKAD neiekļauj produktus no NEDRĪKST saraksta (alerģijas/neēd). Ievēro uztura ierobežojumus un aprīkojumu.
- servings = ēdāju skaits. Reālistiski laiki. Soļi īsi un skaidri. Nekādu nedrošu pārtikas padomu.
- Visi teksti latviešu valodā. Droši piedāvā gan latviešu klasiku, gan modernus ēdienus.
- category "missing" ierakstiem: viens no: ${CATS.join(', ')}.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { household, query } = await req.json() as { household: string; query: Record<string, unknown> };
    if (!household) throw new HttpError(400, 'no_household');
    const admin = adminClient();
    await requireMember(admin, household, uid);

    const eaters = Array.isArray(query?.eaters) ? query.eaters as string[] : [];
    const ctx = await loadContext(admin, household, eaters);
    const guests = Math.max(0, Math.min(20, Math.round(Number(query?.guests) || 0)));
    const eaterCount = ctx.eaterCount + guests;

    const mood = String(query?.mood ?? 'any');
    const effort = String(query?.effort ?? 'normal');
    const focus = typeof query?.focus === 'string' ? query.focus.trim().slice(0, 80) : '';
    const craving = typeof query?.craving === 'string' ? query.craving.trim().slice(0, 40) : '';
    const lines = [
      moodLine[mood] ?? moodLine.any,
      effortLine[effort] ?? effortLine.normal,
      focus ? `OBLIGĀTI izmanto šo produktu galvenajā lomā: ${focus}.` : '',
      craving ? `Garšas noskaņa, ko gribas: ${craving}.` : '',
      query?.max_time_min ? `Maksimālais kopējais laiks: ${query.max_time_min} minūtes.` : '',
      query?.cheap ? 'Lētais režīms: izmanto gandrīz tikai to, kas jau ir mājās; minimāli jauni produkti.' : '',
      query?.prioritise_expiring ? 'Prioritāte produktiem, kas drīz jāizlieto.' : '',
      guests ? `Šovakar ir viesi — kopā ${eaterCount} ēdāji, palielini porcijas.` : '',
      toneLine(ctx.settings.tone),
      '',
      renderContext(ctx),
      '',
      'Izveido 3 dažādas vakariņu idejas.',
    ].filter(Boolean).join('\n');

    const raw = await callClaude({ model: TEXT_MODEL, system: SYSTEM, blocks: [{ type: 'text', text: lines }], maxTokens: 6000, effort: 'low' });
    const parsed = extractJson<{ recipes?: unknown[] }>(raw);
    const recipes = (parsed.recipes ?? []).slice(0, 3) as Record<string, unknown>[];
    if (recipes.length === 0) throw new HttpError(502, 'ai_empty');

    const rows = recipes.map((r) => buildRecipeRow(r, { household, uid, eaterCount, items: ctx.items }));
    const { data, error } = await admin.from('recipes').insert(rows).select('*');
    if (error) { console.error('insert recipes', error); throw new HttpError(500, 'db_error'); }
    return json({ recipes: data });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
