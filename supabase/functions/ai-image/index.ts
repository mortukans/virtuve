// Generate (and store) an AI preview image for a recipe. Pluggable provider via
// IMAGE_API_URL/IMAGE_API_KEY/IMAGE_MODEL (defaults to the OpenAI images shape).
// With no key set, returns {image_url: null} and the app shows a typographic card.
import { json, preflight } from '../_shared/cors.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';

const IMG_URL = Deno.env.get('IMAGE_API_URL') ?? 'https://api.openai.com/v1/images/generations';
const IMG_KEY = Deno.env.get('IMAGE_API_KEY') ?? '';
const IMG_MODEL = Deno.env.get('IMAGE_MODEL') ?? 'gpt-image-1';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { recipe } = await req.json() as { recipe: string };
    if (!recipe) throw new HttpError(400, 'no_recipe');
    const admin = adminClient();

    const { data: row, error } = await admin.from('recipes').select('id, title, summary, household_id, image_url').eq('id', recipe).single();
    if (error || !row) throw new HttpError(404, 'not_found');
    if (row.household_id) await requireMember(admin, row.household_id, uid);
    if (row.image_url) return json({ image_url: row.image_url });
    if (!IMG_KEY) return json({ image_url: null });

    const prompt = `Appetizing, realistic home-cooked food photo of "${row.title}". ${row.summary}. Served on a plate on a kitchen table, natural soft light, top-down, no text, no people.`;
    const res = await fetch(IMG_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${IMG_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: IMG_MODEL, prompt, size: '1024x1024', n: 1 }),
    });
    if (!res.ok) { console.error('image api', res.status, (await res.text()).slice(0, 300)); return json({ image_url: null }); }
    const out = await res.json();
    const first = out?.data?.[0] ?? {};
    let bytes: Uint8Array;
    if (first.b64_json) bytes = b64ToBytes(first.b64_json);
    else if (first.url) bytes = new Uint8Array(await (await fetch(first.url)).arrayBuffer());
    else return json({ image_url: null });

    const path = `${recipe}.png`;
    const up = await admin.storage.from('recipe-images').upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (up.error) { console.error('upload', up.error); return json({ image_url: null }); }
    const { data: pub } = admin.storage.from('recipe-images').getPublicUrl(path);
    await admin.from('recipes').update({ image_url: pub.publicUrl, image_is_ai: true }).eq('id', recipe);
    return json({ image_url: pub.publicUrl });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
