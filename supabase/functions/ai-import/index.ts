// Parse a recipe from a URL, pasted text, or a screenshot into a stored recipe.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL, VISION_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';

const SYSTEM = `Tu izvelc vienu recepti no dotā teksta vai attēla un atgriez TIKAI JSON:
{"title","summary","time_active_min","time_total_min","servings","kcal","tags":[],"ingredients":[{"name","qty","have":false}],"steps":[{"n","text","timer_min"}]}.
Visu pārtulko un uzraksti latviešu valodā. Ja kāda informācija nav zināma, liec saprātīgu vērtību vai null. Nekādu paskaidrojumu, tikai JSON.`;

type Block = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { household, payload } = await req.json() as { household: string; payload: { kind: string; data: string } };
    if (!household || !payload?.data) throw new HttpError(400, 'bad_input');
    const admin = adminClient();
    await requireMember(admin, household, uid);

    let blocks: Block[];
    let model = TEXT_MODEL;
    if (payload.kind === 'image') {
      model = VISION_MODEL;
      blocks = [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: payload.data } },
        { type: 'text', text: 'Izvelc recepti no šī attēla.' },
      ];
    } else {
      let text = payload.data;
      if (payload.kind === 'url') {
        try {
          const html = await (await fetch(payload.data)).text();
          text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 9000);
        } catch { throw new HttpError(400, 'fetch_failed'); }
      }
      blocks = [{ type: 'text', text: `Izvelc recepti no šī:\n\n${text.slice(0, 9000)}` }];
    }

    const raw = await callClaude({ model, system: SYSTEM, blocks, maxTokens: 3000 });
    const r = extractJson<Record<string, unknown>>(raw);

    const { data: inv } = await admin.from('inventory_items').select('id,name').eq('household_id', household);
    const items = (inv ?? []) as { id: string; name: string }[];
    const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).map((i: Record<string, unknown>) => {
      const name = String(i.name ?? '').slice(0, 80);
      const have = items.some((it) => match(name, it.name));
      return { name, qty: String(i.qty ?? ''), have };
    }).filter((i) => i.name);
    const steps = (Array.isArray(r.steps) ? r.steps : []).map((s: Record<string, unknown>, idx: number) => ({ n: Number(s.n ?? idx + 1), text: String(s.text ?? ''), timer_min: s.timer_min != null ? Number(s.timer_min) : null })).filter((s) => s.text);
    const missing = ingredients.filter((i) => !i.have).map((i) => ({ name: i.name, qty: i.qty, have: false, category: 'other' }));
    const uses = items.filter((it) => ingredients.some((ing) => ing.have && match(ing.name, it.name))).map((it) => it.id);

    const row = {
      household_id: household, title: String(r.title ?? 'Recepte').slice(0, 120), summary: String(r.summary ?? '').slice(0, 300),
      time_active_min: int(r.time_active_min, 20), time_total_min: int(r.time_total_min, 30), servings: int(r.servings, 2),
      kcal: r.kcal != null ? int(r.kcal, 0) : null, tags: (Array.isArray(r.tags) ? r.tags : []).map(String).slice(0, 8),
      ingredients, steps, uses_item_ids: uses, missing, est_cost_eur: null,
      image_url: null, image_is_ai: false, source: 'import', created_by: uid,
    };
    const { data, error } = await admin.from('recipes').insert(row).select('*').single();
    if (error) { console.error(error); throw new HttpError(500, 'db_error'); }
    return json({ recipe: data });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});

function int(v: unknown, dflt: number): number { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : dflt; }
function match(a: string, b: string): boolean { const x = a.toLowerCase().trim(), y = b.toLowerCase().trim(); return x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x)); }
