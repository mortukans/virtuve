/**
 * Virtuve domain types — the single source of truth shared by the app, the RPC
 * wrappers (rpc.ts) and the SQL schema (supabase/migrations). The app is
 * Latvian-only, but identifiers stay English for code; all user-facing strings
 * live in src/i18n/lv.
 */

export type Lang = 'lv';

// ─── identity & household ───────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  lang: Lang;
  created_at: string;
}

export type MemberRole = 'admin' | 'member' | 'child';
/** Relative appetite; drives portion maths without showing numbers. */
export type Portion = 'small' | 'normal' | 'large';

/** Per-member food profile. Allergies are a HARD block; `never` = never suggest;
 *  `dislikes` = suggest rarely; `likes`/`cuisines` nudge up. */
export interface MemberPrefs {
  likes: string[];
  dislikes: string[];
  never: string[];
  allergies: string[];
  cuisines: string[];
  /** Diet tags, e.g. 'vegetarian' | 'vegan' | 'no_pork' | 'no_dairy' | 'gluten_free'. */
  diet: string[];
}

export interface Member {
  id: string;
  household_id: string;
  /** null for a virtual member (child/guest) with no login of their own. */
  user_id: string | null;
  role: MemberRole;
  display_name: string;
  portion: Portion;
  /** Usually eats at home (default attendance). */
  eats_by_default: boolean;
  prefs: MemberPrefs;
  created_at: string;
}

/** How much cooking the household enjoys — caps recipe complexity. */
export type CookingLove = 'love' | 'fine' | 'duty' | 'minimal';

export interface HouseholdSettings {
  /** Priority weights 0..3 (none/low/med/high). */
  priorities: {
    fast: number;
    cheap: number;
    healthy: number;
    high_protein: number;
    tasty: number;
    low_effort: number;
    use_leftovers: number;
    reduce_waste: number;
  };
  cooking_love: CookingLove;
  /** Appliances the household owns; recipes respect these. */
  equipment: string[]; // 'stove','oven','microwave','air_fryer','blender','toaster','slow_cooker','rice_cooker','grill'
  /** Optional weekly food budget in EUR; null = off. */
  weekly_budget: number | null;
  /** App voice. */
  tone: 'neutral' | 'friendly' | 'humor';
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  settings: HouseholdSettings;
  created_by: string;
  created_at: string;
  /** Present on get_household / get_my_households. */
  members?: Member[];
  my_role?: MemberRole;
}

// ─── kitchen inventory ──────────────────────────────────────────────────────

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'staple';
/** Coarse amount, never pretend grams precision. */
export type AmountLabel = 'little' | 'some' | 'lot' | 'unknown';
export type Freshness = 'fresh' | 'use_soon' | 'use_today' | 'expired' | 'unknown';
export type ItemState = 'sealed' | 'opened' | 'cooked' | 'frozen';
export type ItemSource = 'photo' | 'manual' | 'barcode' | 'receipt' | 'shopping';

/** Food categories used for grouping and store sections. */
export type FoodCategory =
  | 'produce' | 'meat' | 'fish' | 'dairy' | 'bakery' | 'pantry_dry'
  | 'frozen' | 'drinks' | 'condiments' | 'snacks' | 'leftovers' | 'other';

export interface InventoryItem {
  id: string;
  household_id: string;
  name: string; // Latvian, e.g. "Vistas fileja"
  category: FoodCategory;
  location: StorageLocation;
  amount: AmountLabel;
  /** Optional free text qty when the user is specific, e.g. "~300 g", "½ paka". */
  qty_text: string | null;
  freshness: Freshness;
  /** Optional concrete expiry; freshness is derived from it when present. */
  expires_on: string | null;
  state: ItemState;
  source: ItemSource;
  /** For leftovers: approximate portions. */
  portions: number | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape the scan flow / manual add sends to add_inventory_items. */
export interface InventoryDraft {
  name: string;
  category: FoodCategory;
  location: StorageLocation;
  amount: AmountLabel;
  qty_text?: string | null;
  freshness?: Freshness;
  expires_on?: string | null;
  state?: ItemState;
  source: ItemSource;
  portions?: number | null;
}

/** One line returned by the ai-scan edge function (before the user confirms). */
export interface ScanResult {
  name: string;
  category: FoodCategory;
  location: StorageLocation;
  amount: AmountLabel;
  /** 0..1 model confidence; low values prompt a "confirm" chip. */
  confidence: number;
}

// ─── recipes, cooking, voting ───────────────────────────────────────────────

export interface RecipeIngredient {
  name: string; // Latvian
  qty: string; // "2 gab.", "300 g", "1 ēdamkarote"
  /** True when it's already in the household inventory. */
  have: boolean;
}

export interface RecipeStep {
  n: number;
  text: string;
  /** Optional timer the step suggests, in minutes. */
  timer_min?: number | null;
}

export type RecipeSource = 'ai' | 'import' | 'family';

export interface Recipe {
  id: string;
  household_id: string | null;
  title: string;
  summary: string;
  time_active_min: number;
  time_total_min: number;
  servings: number;
  kcal: number | null;
  tags: string[]; // 'fast','healthy','cheap','high_protein','comfort','air_fryer','one_pan',...
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  /** Inventory item ids this recipe uses (for "uses 7 things you have"). */
  uses_item_ids: string[];
  /** Ingredients to buy (not in inventory). */
  missing: RecipeIngredient[];
  est_cost_eur: number | null;
  /** AI preview image (Storage URL); null → the app shows a typographic card. */
  image_url: string | null;
  image_is_ai: boolean;
  source: RecipeSource;
  created_by: string | null;
  created_at: string;
}

export type MealRating = 'love' | 'ok' | 'never';

export interface MealHistoryEntry {
  id: string;
  household_id: string;
  recipe_id: string;
  recipe_title: string;
  cooked_on: string;
  cooked_by: string | null;
  rating: MealRating | null;
  feedback: string[]; // 'too_salty','too_spicy','too_long','too_heavy','loved','kids_liked',...
  notes: string | null;
  user_photo_url: string | null;
}

export type VoteChoice = 'want' | 'ok' | 'no';
export type VoteStatus = 'open' | 'matched' | 'closed';

export interface VoteSession {
  id: string;
  household_id: string;
  created_by: string;
  status: VoteStatus;
  deadline: string | null;
  recipe_ids: string[];
  recipes?: Recipe[];
  /** member_id/user -> recipe_id -> choice, flattened for the client. */
  votes: VoteTally[];
  matched_recipe_id: string | null;
  created_at: string;
}

export interface VoteTally {
  voter: string; // user id
  voter_name: string;
  recipe_id: string;
  choice: VoteChoice;
}

// ─── attendance, shopping trips, requests ───────────────────────────────────

export type AttendanceStatus = 'home' | 'away' | 'unknown';

export interface Attendance {
  household_id: string;
  member_id: string;
  member_name: string;
  date: string;
  status: AttendanceStatus;
}

export interface Shopper {
  household_id: string;
  user_id: string;
  name: string;
  started_at: string;
}

export interface MealRequest {
  id: string;
  household_id: string;
  user_id: string;
  requester_name: string;
  text: string;
  created_at: string;
}

// ─── shopping list ──────────────────────────────────────────────────────────

export type ShoppingStatus = 'todo' | 'claimed' | 'bought' | 'unavailable';

export interface ShoppingItem {
  id: string;
  household_id: string;
  name: string;
  category: FoodCategory;
  qty_text: string | null;
  status: ShoppingStatus;
  claimed_by: string | null;
  claimed_by_name: string | null;
  added_by: string | null;
  from_recipe_id: string | null;
  created_at: string;
}

export interface ShoppingDraft {
  name: string;
  category: FoodCategory;
  qty_text?: string | null;
  from_recipe_id?: string | null;
}

// ─── meal plan ──────────────────────────────────────────────────────────────

export type PlanStatus = 'planned' | 'none' | 'eating_out' | 'not_cooking';

export interface PlanEntry {
  household_id: string;
  plan_date: string;
  recipe_id: string | null;
  recipe_title: string | null;
  status: PlanStatus;
  who_eats: string[]; // member ids
  note: string | null;
}

// ─── "Ko ēdam?" request filters ─────────────────────────────────────────────

export type Mood = 'fast' | 'healthy' | 'hungry' | 'comfort' | 'light' | 'use_soon' | 'any';
export type Effort = 'minimal' | 'normal' | 'can_cook';

export interface MealQuery {
  mood: Mood;
  effort: Effort;
  max_time_min: number | null;
  /** member ids eating tonight; drives servings and combined preferences. */
  eaters: string[];
  /** Force using items that expire soon. */
  prioritise_expiring?: boolean;
  /** Cheap mode: maximise use of what's already home. */
  cheap?: boolean;
  /** An inventory item name the recipes must use ("izmantot šo šovakar"). */
  focus?: string;
  /** A craving/texture mood, e.g. "krēmīgs", "ass", "svaigs". */
  craving?: string;
  /** Extra guests tonight on top of the eaters. */
  guests?: number;
}

/** Recipe transformations offered on a recipe. */
export type TransformKey = 'healthier' | 'cheaper' | 'faster' | 'vegetarian' | 'air_fryer' | 'more_portions';
