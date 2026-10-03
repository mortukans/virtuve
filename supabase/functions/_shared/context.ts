import { type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface InvItem {
  id: string; name: string; category: string; location: string;
  amount: string; qty_text: string | null; expires_on: string | null; freshness: string;
}

function effFreshness(expires: string | null, stored: string): string {
  if (!expires) return stored;
  const days = Math.floor((new Date(expires).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 1) return 'use_today';
  if (days <= 3) return 'use_soon';
  return 'fresh';
}

export interface HouseholdContext {
  settings: Record<string, unknown>;
  memberCount: number;
  eaterCount: number;
  likes: string[]; dislikes: string[]; avoid: string[]; diet: string[]; cuisines: string[];
  items: InvItem[];
  recentTitles: string[];
}

/** Load everything the recipe/plan prompts need. `eaters` = member ids eating; empty → all who eat by default. */
export async function loadContext(admin: SupabaseClient, household: string, eaters: string[] = []): Promise<HouseholdContext> {
  const [{ data: hh }, { data: members }, { data: inv }, { data: hist }] = await Promise.all([
    admin.from('households').select('settings').eq('id', household).single(),
    admin.from('household_members').select('id, prefs, eats_by_default'),
    admin.from('inventory_items').select('id,name,category,location,amount,qty_text,expires_on,freshness').eq('household_id', household),
    admin.from('meal_history').select('recipe_title').eq('household_id', household).order('cooked_on', { ascending: false }).limit(10),
  ]);

  const allMembers = (members ?? []).filter((m: { household_id?: string }) => true);
  const eating = eaters.length
    ? allMembers.filter((m: { id: string }) => eaters.includes(m.id))
    : allMembers.filter((m: { eats_by_default: boolean }) => m.eats_by_default);

  const likes = new Set<string>(), dislikes = new Set<string>(), avoid = new Set<string>(), diet = new Set<string>(), cuisines = new Set<string>();
  for (const m of eating) {
    const p = (m.prefs ?? {}) as Record<string, string[]>;
    (p.likes ?? []).forEach((x) => likes.add(x));
    (p.dislikes ?? []).forEach((x) => dislikes.add(x));
    (p.never ?? []).forEach((x) => avoid.add(x));
    (p.allergies ?? []).forEach((x) => avoid.add(x));
    (p.diet ?? []).forEach((x) => diet.add(x));
    (p.cuisines ?? []).forEach((x) => cuisines.add(x));
  }

  const items: InvItem[] = (inv ?? []).map((i: InvItem) => ({ ...i, freshness: effFreshness(i.expires_on, i.freshness) }));

  return {
    settings: (hh?.settings ?? {}) as Record<string, unknown>,
    memberCount: allMembers.length,
    eaterCount: eating.length || 1,
    likes: [...likes], dislikes: [...dislikes], avoid: [...avoid], diet: [...diet], cuisines: [...cuisines],
    items,
    recentTitles: (hist ?? []).map((h: { recipe_title: string }) => h.recipe_title),
  };
}

/** Compact Latvian-oriented context block for the prompt. */
export function renderContext(ctx: HouseholdContext): string {
  const inv = ctx.items.length
    ? ctx.items.map((i) => `- ${i.name}${i.qty_text ? ` (${i.qty_text})` : ` (${i.amount})`} [${i.location}, ${i.freshness}]`).join('\n')
    : '(tukšs)';
  const expiring = ctx.items.filter((i) => i.freshness === 'use_today' || i.freshness === 'use_soon' || i.freshness === 'expired').map((i) => i.name);
  const pr = (ctx.settings.priorities ?? {}) as Record<string, number>;
  const topPriorities = Object.entries(pr).filter(([, v]) => v >= 2).map(([k]) => k).join(', ') || 'nav īpašu';
  return [
    `Ēdāju skaits: ${ctx.eaterCount}.`,
    `Mājsaimniecības prioritātes (svarīgas): ${topPriorities}.`,
    `Gatavošanas attieksme: ${ctx.settings.cooking_love ?? 'fine'}.`,
    `Aprīkojums: ${((ctx.settings.equipment as string[]) ?? []).join(', ') || 'plīts'}.`,
    ctx.settings.weekly_budget ? `Nedēļas budžets: €${ctx.settings.weekly_budget}.` : '',
    `Garšo: ${ctx.likes.join(', ') || '-'}.`,
    `Negaršo (reti): ${ctx.dislikes.join(', ') || '-'}.`,
    `NEDRĪKST (alerģijas/neēd): ${ctx.avoid.join(', ') || '-'}.`,
    `Uztura ierobežojumi: ${ctx.diet.join(', ') || '-'}.`,
    `Mīļākās virtuves: ${ctx.cuisines.join(', ') || '-'}.`,
    expiring.length ? `Drīz jāizlieto: ${expiring.join(', ')}.` : '',
    ctx.recentTitles.length ? `Nesen gatavots (neatkārto): ${ctx.recentTitles.join(', ')}.` : '',
    '',
    `Produkti mājās:\n${inv}`,
  ].filter(Boolean).join('\n');
}
