// Recognise groceries in one or more fridge/shelf photos. Returns drafts for the
// user to confirm/correct (never writes inventory directly).
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, extractJson, VISION_MODEL } from '../_shared/claude.ts';
import { HttpError, requireUser } from '../_shared/supa.ts';

const CATS = ['produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other'];
const LOCS = ['fridge','freezer','pantry','staple'];
const AMTS = ['little','some','lot','unknown'];

const SYSTEM = `Tu esi Latvijas virtuves palīgs, kas atpazīst pārtikas produktus ledusskapja vai plaukta fotoattēlos.
Atbildi TIKAI ar JSON objektu formā {"items":[...]}, bez paskaidrojumiem un bez koda blokiem.
Katrs produkts: {"name": "<latviski>", "category": "<kategorija>", "location": "<vieta>", "amount": "<daudzums>", "confidence": <0..1>}.
- name: konkrēts latviešu nosaukums (piem., "Vistas fileja", "Kefīrs", "Paprika"). Atpazīsti arī Latvijas produktus (biezpiens, skābais krējums, rupjmaize, griķi, pelmeņi).
- category: viens no: ${CATS.join(', ')}.
- location: viens no: ${LOCS.join(', ')} (parasti fridge).
- amount: viens no: ${AMTS.join(', ')}.
- confidence: cik pārliecināts esi (0..1). Neskaidriem produktiem liec zemāku.
Iekļauj tikai reālus pārtikas/dzērienu produktus. Neizdomā produktus, kurus neredzi.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    await requireUser(req);
    const { images } = await req.json() as { images: string[] };
    if (!Array.isArray(images) || images.length === 0) throw new HttpError(400, 'no_images');
    const capped = images.slice(0, 4);

    const blocks = [
      ...capped.map((data) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg', data } })),
      { type: 'text' as const, text: 'Atpazīsti visus pārtikas produktus šajos attēlos. Atbildi ar {"items":[...]}.' },
    ];

    const raw = await callClaude({ model: VISION_MODEL, system: SYSTEM, blocks, maxTokens: 1800 });
    const parsed = extractJson<{ items?: unknown[] } | unknown[]>(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed.items ?? []);

    const items = (list as Record<string, unknown>[])
      .map((r) => ({
        name: String(r.name ?? '').trim().slice(0, 80),
        category: CATS.includes(String(r.category)) ? String(r.category) : 'other',
        location: LOCS.includes(String(r.location)) ? String(r.location) : 'fridge',
        amount: AMTS.includes(String(r.amount)) ? String(r.amount) : 'some',
        confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0.7))),
      }))
      .filter((r) => r.name.length > 0);

    return json({ items });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
