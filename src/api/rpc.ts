/**
 * Typed wrappers over Supabase RPCs and Edge Functions — THE contract.
 * Rule (see CLAUDE.md): every name here must exist in a migration with the same
 * name and p_* argument names. Reads/writes go through security-definer RPCs so
 * prices/preferences stay governed by the server; AI generation goes through
 * Edge Functions that hold the Anthropic key.
 */
import { supabase } from './supabase';
import type {
  Attendance, AttendanceStatus, Household, HouseholdSettings, InventoryDraft, InventoryItem,
  MealHistoryEntry, MealQuery, MealRating, MealRequest, Member, MemberPrefs, MemberRole,
  PlanEntry, PlanStatus, Portion, Profile, Recipe, ScanResult, Shopper, ShoppingDraft,
  ShoppingItem, VoteChoice, VoteSession,
} from './types';

export class RpcError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = 'RpcError';
  }
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) throw new RpcError(error.message ?? 'rpc_error', error.message);
  return data as T;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Edge functions return a JSON { error } body on failure.
    const detail = (error as { context?: { error?: string } })?.context?.error;
    throw new RpcError(detail ?? 'fn_error', error.message);
  }
  return data as T;
}

// ─── profile ────────────────────────────────────────────────────────────────

export const getMyProfile = () => rpc<Profile>('get_my_profile');
export const setDisplayName = (p_name: string) => rpc<Profile>('set_display_name', { p_name });
export const registerPushToken = (p_token: string, p_platform = 'ios') =>
  rpc<void>('register_push_token', { p_token, p_platform });
export const deleteMe = () => rpc<void>('delete_me');
/** After upgrading an anonymous account to Apple: move the old anon user's
 *  profile + memberships to the current (Apple) user, then drop the old user. */
export const claimMerge = (p_prev_user: string) => rpc<void>('claim_merge', { p_prev_user });

// ─── household & members ────────────────────────────────────────────────────

export const createHousehold = (p_name: string) => rpc<Household>('create_household', { p_name });
export const joinHousehold = (p_code: string) => rpc<Household>('join_household', { p_code });
export const getMyHouseholds = () => rpc<Household[]>('get_my_households');
export const getHousehold = (p_household: string) => rpc<Household>('get_household', { p_household });
export const updateHousehold = (p_household: string, p_patch: Partial<{ name: string; settings: HouseholdSettings }>) =>
  rpc<Household>('update_household', { p_household, p_patch });
export const leaveHousehold = (p_household: string) => rpc<void>('leave_household', { p_household });
export const rotateInvite = (p_household: string) => rpc<{ invite_code: string }>('rotate_invite', { p_household });

export type MemberPatch = Partial<{
  display_name: string; portion: Portion; eats_by_default: boolean; prefs: MemberPrefs; role: MemberRole;
}>;
/** Update a member row (self always; others/children require admin). */
export const updateMember = (p_member: string, p_patch: MemberPatch) =>
  rpc<Member>('update_member', { p_member, p_patch });
/** Add a virtual member with no login (child/guest). Admin only. */
export const addMember = (p_household: string, p_name: string, p_role: MemberRole = 'child', p_prefs?: MemberPrefs) =>
  rpc<Member>('add_member', { p_household, p_name, p_role, p_prefs: p_prefs ?? null });
export const removeMember = (p_member: string) => rpc<void>('remove_member', { p_member });

// ─── kitchen inventory ──────────────────────────────────────────────────────

export const getInventory = (p_household: string) => rpc<InventoryItem[]>('get_inventory', { p_household });
export const addInventoryItems = (p_household: string, p_items: InventoryDraft[]) =>
  rpc<InventoryItem[]>('add_inventory_items', { p_household, p_items });
export const updateInventoryItem = (p_item: string, p_patch: Partial<InventoryItem>) =>
  rpc<InventoryItem>('update_inventory_item', { p_item, p_patch });
export const removeInventoryItem = (p_item: string) => rpc<void>('remove_inventory_item', { p_item });
export const setStaples = (p_household: string, p_names: string[]) =>
  rpc<InventoryItem[]>('set_staples', { p_household, p_names });
/** Reduce/remove an item after cooking. p_amount: 'all' | 'some'. */
export const markUsed = (p_item: string, p_amount: 'all' | 'some' = 'all') =>
  rpc<InventoryItem | null>('mark_used', { p_item, p_amount });

// ─── recipes, cooking, history ──────────────────────────────────────────────

export const getRecipe = (p_recipe: string) => rpc<Recipe>('get_recipe', { p_recipe });
export const getRecipes = (p_household: string, p_filter: 'recent' | 'saved' | 'favourites' = 'recent') =>
  rpc<Recipe[]>('get_recipes', { p_household, p_filter });
/** Free, global "recommended" recipes (household_id null). The recipes RLS allows
 *  selecting null-household rows, so this reads directly — no household needed. */
export const getRecommendedRecipes = async (): Promise<Recipe[]> => {
  const { data, error } = await supabase
    .from('recipes').select('*').is('household_id', null)
    .order('id', { ascending: true }).limit(50);
  if (error) throw new RpcError(error.message ?? 'rpc_error', error.message);
  return (data ?? []) as Recipe[];
};
export const saveRecipe = (p_recipe: string, p_saved = true) => rpc<void>('save_recipe', { p_recipe, p_saved });
export const rateMeal = (
  p_recipe: string,
  p_rating: MealRating,
  p_feedback: string[] = [],
  p_notes: string | null = null,
) => rpc<MealHistoryEntry>('rate_meal', { p_recipe, p_rating, p_feedback, p_notes });
export const getHistory = (p_household: string) => rpc<MealHistoryEntry[]>('get_history', { p_household });

// ─── voting ("Dinner Match") ────────────────────────────────────────────────

export const startVote = (p_household: string, p_recipe_ids: string[], p_deadline: string | null = null) =>
  rpc<VoteSession>('start_vote', { p_household, p_recipe_ids, p_deadline });
export const castVote = (p_session: string, p_recipe: string, p_choice: VoteChoice) =>
  rpc<VoteSession>('cast_vote', { p_session, p_recipe, p_choice });
export const getVote = (p_session: string) => rpc<VoteSession>('get_vote', { p_session });
export const getActiveVote = (p_household: string) => rpc<VoteSession | null>('get_active_vote', { p_household });
export const closeVote = (p_session: string, p_recipe: string | null = null) =>
  rpc<VoteSession>('close_vote', { p_session, p_recipe });

// ─── attendance / shopping trips / requests ─────────────────────────────────

export const setAttendance = (p_household: string, p_date: string, p_status: AttendanceStatus, p_member: string | null = null) =>
  rpc<void>('set_attendance', { p_household, p_date, p_status, p_member });
export const getAttendance = (p_household: string, p_date: string) =>
  rpc<Attendance[]>('get_attendance', { p_household, p_date });
export const startShopping = (p_household: string) => rpc<void>('start_shopping', { p_household });
export const endShopping = (p_household: string) => rpc<void>('end_shopping', { p_household });
export const getShoppers = (p_household: string) => rpc<Shopper[]>('get_shoppers', { p_household });
export const addRequest = (p_household: string, p_text: string) => rpc<MealRequest>('add_request', { p_household, p_text });
export const getRequests = (p_household: string) => rpc<MealRequest[]>('get_requests', { p_household });
export const removeRequest = (p_request: string) => rpc<void>('remove_request', { p_request });

// ─── shopping list ──────────────────────────────────────────────────────────

export const getShoppingList = (p_household: string) => rpc<ShoppingItem[]>('get_shopping_list', { p_household });
export const addShoppingItems = (p_household: string, p_items: ShoppingDraft[]) =>
  rpc<ShoppingItem[]>('add_shopping_items', { p_household, p_items });
export const updateShoppingItem = (
  p_item: string,
  p_patch: Partial<{ status: ShoppingItem['status']; qty_text: string | null; name: string; claim: boolean }>,
) => rpc<ShoppingItem>('update_shopping_item', { p_item, p_patch });
export const removeShoppingItem = (p_item: string) => rpc<void>('remove_shopping_item', { p_item });
export const addMissingFromRecipe = (p_household: string, p_recipe: string) =>
  rpc<ShoppingItem[]>('add_missing_from_recipe', { p_household, p_recipe });
export const clearBought = (p_household: string) => rpc<void>('clear_bought', { p_household });
/** Move bought items into the kitchen inventory. */
export const stockBought = (p_household: string) => rpc<InventoryItem[]>('stock_bought', { p_household });

// ─── meal plan ──────────────────────────────────────────────────────────────

export const getMealPlan = (p_household: string, p_from: string, p_to: string) =>
  rpc<PlanEntry[]>('get_meal_plan', { p_household, p_from, p_to });
export const setPlanEntry = (
  p_household: string,
  p_date: string,
  p_patch: Partial<{ recipe_id: string | null; status: PlanStatus; who_eats: string[]; note: string | null }>,
) => rpc<PlanEntry>('set_plan_entry', { p_household, p_date, p_patch });

// ─── AI edge functions (hold the Anthropic key server-side) ─────────────────

/** Recognise food in one or more base64 JPEGs. Returns drafts to confirm. */
export const aiScan = (p_images: string[], p_household: string | null = null) =>
  invoke<{ items: ScanResult[] }>('ai-scan', { images: p_images, household: p_household });

/** Generate 3 recipes from the household's inventory + preferences. Persists and returns them. */
export const aiRecipes = (p_household: string, p_query: MealQuery) =>
  invoke<{ recipes: Recipe[] }>('ai-recipes', { household: p_household, query: p_query });

/** Generate (and store) an AI preview image for a recipe. */
export const aiRecipeImage = (p_recipe: string) =>
  invoke<{ image_url: string | null }>('ai-image', { recipe: p_recipe });

/** Plan N dinners from inventory + attendance + preferences. Persists plan entries. */
export const aiPlanWeek = (p_household: string, p_days: number) =>
  invoke<{ entries: PlanEntry[] }>('ai-plan', { household: p_household, days: p_days });

/** Parse a recipe from a URL / pasted text / screenshot into a stored recipe. */
export const aiImportRecipe = (
  p_household: string,
  p_payload: { kind: 'url' | 'text' | 'image'; data: string },
) => invoke<{ recipe: Recipe }>('ai-import', { household: p_household, payload: p_payload });

/** Transform a recipe (healthier/cheaper/faster/vegetarian/air fryer/bigger) into a new one. */
export const aiTransform = (p_recipe: string, p_transform: import('./types').TransformKey) =>
  invoke<{ recipe: Recipe }>('ai-transform', { recipe: p_recipe, transform: p_transform });

/** Turn leftovers into 3 new meal ideas. */
export const aiLeftovers = (p_household: string, p_items: string[], p_eaters: string[] = []) =>
  invoke<{ recipes: Recipe[] }>('ai-leftovers', { household: p_household, items: p_items, eaters: p_eaters });

/** Ask a cooking question during cook mode; returns short Latvian advice. */
export const aiCookHelp = (p_question: string, p_recipe: string | null = null) =>
  invoke<{ answer: string }>('ai-cook-help', { recipe: p_recipe, question: p_question });
