// "Palīdzība" during cook mode — the user asks a question while cooking
// ("mērce par šķidru", "nav krējuma") and gets concise, safe Latvian advice.
import { json, preflight } from '../_shared/cors.ts';
import { callClaude, TEXT_MODEL } from '../_shared/claude.ts';
import { adminClient, HttpError, requireMember, requireUser } from '../_shared/supa.ts';

const SYSTEM = `Tu esi mierīgs Latvijas virtuves palīgs. Lietotājs gatavo un uzdod jautājumu.
Atbildi īsi un konkrēti latviešu valodā (1–3 teikumi), praktiski un droši.
Nekad nedod nedrošus pārtikas drošības padomus — ja kaut kas attiecas uz gaļas gatavību vai
uzglabāšanu, iesaki pārliecināties par drošu iekšējo temperatūru / neriskēt.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const uid = await requireUser(req);
    const { recipe: recipeId, question } = await req.json() as { recipe?: string; question: string };
    const q = String(question ?? '').trim().slice(0, 500);
    if (!q) throw new HttpError(400, 'no_question');
    const admin = adminClient();

    let context = '';
    if (recipeId) {
      const { data: r } = await admin.from('recipes').select('title, ingredients, steps, household_id').eq('id', recipeId).single();
      if (r) {
        if (r.household_id) await requireMember(admin, r.household_id, uid);
        context = `Recepte: ${r.title}\nSastāvdaļas: ${JSON.stringify(r.ingredients)}\nSoļi: ${JSON.stringify(r.steps)}\n\n`;
      }
    }

    const answer = await callClaude({
      model: TEXT_MODEL,
      system: SYSTEM,
      blocks: [{ type: 'text', text: `${context}Jautājums gatavošanas laikā: ${q}` }],
      maxTokens: 500,
      effort: 'low',
    });
    return json({ answer: answer.trim() });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'error');
    return json({ error: err.code }, err.status);
  }
});
