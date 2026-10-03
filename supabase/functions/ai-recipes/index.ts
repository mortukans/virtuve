// "Ko ēdam?" — generate 3 recipes from the household's inventory + preferences,
// persist them, and return them. Holds the Anthropic key server-side.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';
import { loadContext, renderContext } from '../_shared/context.ts';

const CATS = ['produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other'];

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
Katra recepte:
{
 "title": "<latviski>",
 "summary": "<īss apraksts latviski, 1 teikums>",
 "time_active_min": <int>, "time_total_min": <int>, "servings": <int>, "kcal": <int vai null>,
 "tags": ["fast"|"healthy"|"cheap"|"high_protein"|"comfort"|"light"|"one_pan"|"air_fryer"|...],
 "ingredients": [{"name":"<latviski>","qty":"<piem. 300 g / 2 gab. / 1 ēdamkarote>","have": <true ja produkts ir mājās>}],
 "steps": [{"n":1,"text":"<latviski>","timer_min":<int vai null>}],
 "missing": [{"name":"<latviski>","qty":"<...>","category":"<kategorija>"}],
 "est_cost_eur": <skaitlis par porciju vai null>
}
Noteikumi:
- Izmanto PĒC IESPĒJAS VAIRĀK produktu, kas jau ir mājās. "missing" = tikai tie, kas jānopērk.
- NEKAD neiekļauj produktus no NEDRĪKST saraksta (alerģijas/neēd). Ievēro uztura ierobežojumus un aprīkojumu.
- servings = ēdāju skaits. Reālistiski laiki. Soļi īsi un skaidri.
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

    const mood = String(query?.mood ?? 'any');
    const effort = String(query?.effort ?? 'normal');
    const lines = [
      moodLine[mood] ?? moodLine.any,
      effortLine[effort] ?? effortLine.normal,
      query?.max_time_min ? `Maksimālais kopējais laiks: ${query.max_time_min} minūtes.` : '',
      query?.cheap ? 'Lētais režīms: izmanto gandrīz tikai to, kas jau ir mājās.' : '',
      query?.prioritise_expiring ? 'Prioritāte produktiem, kas drīz jāizlieto.' : '',
      '',
      renderContext(ctx),
      '',
      'Izveido 3 dažādas vakariņu idejas.',
    ].filter(Boolean).join('\n');

    const raw = await callClaude({ model: TEXT_MODEL, system: SYSTEM, blocks: [{ type: 'text', text: lines }], maxTokens: 6000, effort: 'low' });
    const parsed = extractJson<{ recipes?: unknown[] }>(raw);
    const recipes = (parsed.recipes ?? []).slice(0, 3) as Record<string, unknown>[];
    if (recipes.length === 0) throw new HttpError(502, 'ai_empty');

    const rows = recipes.map((r) => {
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
      // Map have=true ingredients to inventory item ids (loose name match).
      const uses = ctx.items
        .filter((it) => ingredients.some((ing) => ing.have && namesMatch(ing.name, it.name)))
        .map((it) => it.id);
      return {
        household_id: household,
        title: String(r.title ?? 'Vakariņas').slice(0, 120),
        summary: String(r.summary ?? '').slice(0, 300),
        time_active_min: clampInt(r.time_active_min, 5, 240, 15),
        time_total_min: clampInt(r.time_total_min, 5, 360, 25),
        servings: clampInt(r.servings, 1, 12, ctx.eaterCount),
        kcal: r.kcal != null ? clampInt(r.kcal, 0, 5000, 0) : null,
        tags: (Array.isArray(r.tags) ? r.tags : []).map(String).slice(0, 8),
        ingredients, steps,
        uses_item_ids: uses,
        missing,
        est_cost_eur: r.est_cost_eur != null ? Number(r.est_cost_eur) : null,
        image_url: null, image_is_ai: true, source: 'ai', created_by: uid,
      };
    });

    const { data, error } = await admin.from('recipes').insert(rows).select('*');
    if (error) { console.error('insert recipes', error); throw new HttpError(500, 'db_error'); }
    return json({ recipes: data });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
}
function namesMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().trim(), y = b.toLowerCase().trim();
  return x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x));
}
