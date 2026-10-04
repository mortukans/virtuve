import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Client acting as the calling user (forwards their JWT) — used only to read auth. */
export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? '';
  return createClient(URL, ANON, { global: { headers: { authorization } }, auth: { persistSession: false } });
}

/** Service-role client — bypasses RLS for privileged reads/writes (recipes, plan). */
export function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

export async function requireUser(req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'sign_in_required');
  // Validate the user's JWT with the service-role client (the anon/publishable key
  // isn't reliably accepted as apikey for the auth endpoint under the new key system).
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'sign_in_required');
  return data.user.id;
}

/** Verify the user belongs to the household (uses the same helper the RPCs use). */
export async function requireMember(admin: SupabaseClient, household: string, uid: string): Promise<void> {
  const { count, error } = await admin
    .from('household_members')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', household)
    .eq('user_id', uid);
  if (error) throw new HttpError(500, 'db_error');
  if (!count) throw new HttpError(403, 'not_member');
}

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}
