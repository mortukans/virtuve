// Plan N dinners from inventory + preferences, reusing ingredients across days
// to cut shopping and waste. Persists recipes + plan entries; returns the plan.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';
import { loadContext, renderContext } from '../_shared/context.ts';

const CATS = ['produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other'];

const SYSTEM = `Tu esi Latvijas mājas pavārs, kas saplāno vakariņas vairākām dienām no tā, kas jau ir mājās.
Atbildi TIKAI ar JSON {"days":[...]}, bez paskaidrojumiem. Katra diena = viena recepte tādā pašā formā kā parasti:
{"title","summary","time_active_min","time_total_min","servings","kcal","tags":[],"ingredients":[{"name","qty","have"}],"steps":[{"n","text","timer_min"}],"missing":[{"name","qty","category"}],"est_cost_eur"}.
Noteikumi: izmanto produktus, kas jau ir mājās; plāno tā, lai vienu nopirktu produktu izmanto vairākās dienās (mazāk atkritumu); dažādas receptes; ievēro NEDRĪKST sarakstu, uztura ierobežojumus, aprīkojumu; viss latviski; "missing".category no: ${CATS.join(', ')}.`;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { household, days } = await req.json() as { household: string; days: number };
    if (!household) throw new HttpError(400, 'no_household');
    const n = Math.max(1, Math.min(7, Math.round(Number(days) || 3)));
    const admin = adminClient();
    await requireMember(admin, household, uid);

    const ctx = await loadContext(admin, household);
    const { data: eaterRows } = await admin.from('household_members').select('id, eats_by_default').eq('household_id', household);
    const whoEats = (eaterRows ?? []).filter((m: { eats_by_default: boolean }) => m.eats_by_default).map((m: { id: string }) => m.id);

    const prompt = `${renderContext(ctx)}\n\nSaplāno ${n} vakariņas.`;
    const raw = await callClaude({ model: TEXT_MODEL, system: SYSTEM, blocks: [{ type: 'text', text: prompt }], maxTokens: 8000, effort: 'low' });
    const parsed = extractJson<{ days?: unknown[] }>(raw);
    const list = (parsed.days ?? []).slice(0, n) as Record<string, unknown>[];
    if (list.length === 0) throw new HttpError(502, 'ai_empty');

    const rows = list.map((r) => {
      const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).map((i: Record<string, unknown>) => ({ name: String(i.name ?? '').slice(0, 80), qty: String(i.qty ?? ''), have: Boolean(i.have) })).filter((i) => i.name);
      const missing = (Array.isArray(r.missing) ? r.missing : []).map((m: Record<string, unknown>) => ({ name: String(m.name ?? '').slice(0, 80), qty: String(m.qty ?? ''), have: false, category: CATS.includes(String(m.category)) ? String(m.category) : 'other' })).filter((m) => m.name);
      const steps = (Array.isArray(r.steps) ? r.steps : []).map((s: Record<string, unknown>, idx: number) => ({ n: Number(s.n ?? idx + 1), text: String(s.text ?? ''), timer_min: s.timer_min != null ? Number(s.timer_min) : null })).filter((s) => s.text);
      const uses = ctx.items.filter((it) => ingredients.some((ing) => ing.have && match(ing.name, it.name))).map((it) => it.id);
      return {
        household_id: household, title: String(r.title ?? 'Vakariņas').slice(0, 120), summary: String(r.summary ?? '').slice(0, 300),
        time_active_min: int(r.time_active_min, 15), time_total_min: int(r.time_total_min, 25), servings: int(r.servings, ctx.eaterCount),
        kcal: r.kcal != null ? int(r.kcal, 0) : null, tags: (Array.isArray(r.tags) ? r.tags : []).map(String).slice(0, 8),
        ingredients, steps, uses_item_ids: uses, missing, est_cost_eur: r.est_cost_eur != null ? Number(r.est_cost_eur) : null,
        image_url: null, image_is_ai: true, source: 'ai', created_by: uid,
      };
    });

    const { data: inserted, error } = await admin.from('recipes').insert(rows).select('id, title');
    if (error || !inserted) { console.error('insert', error); throw new HttpError(500, 'db_error'); }

    const today = new Date();
    const entries = inserted.map((rec: { id: string; title: string }, i: number) => ({
      household_id: household, plan_date: isoDate(new Date(today.getTime() + i * 86400000)),
      recipe_id: rec.id, status: 'planned', who_eats: whoEats, note: null as string | null,
    }));
    await admin.from('plan_entries').upsert(entries, { onConflict: 'household_id,plan_date' });

    return json({
      entries: entries.map((e, i) => ({ ...e, recipe_title: inserted[i].title })),
    });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});

function int(v: unknown, dflt: number): number { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : dflt; }
function match(a: string, b: string): boolean { const x = a.toLowerCase().trim(), y = b.toLowerCase().trim(); return x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x)); }
