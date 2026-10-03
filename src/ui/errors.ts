import { RpcError } from '../api/rpc';
import { L } from '../i18n/lv';

const MAP: Record<string, string> = {
  sign_in_required: L.errors.sign_in_required,
  not_member: L.errors.not_member,
  not_admin: L.errors.not_admin,
  code_invalid: L.errors.code_invalid,
  name_invalid: L.errors.name_invalid,
  ai_unavailable: L.errors.ai_unavailable,
  ai_error: L.errors.ai_unavailable,
  ai_refused: L.errors.ai_unavailable,
  ai_empty: L.errors.ai_unavailable,
  ai_bad_json: L.errors.ai_unavailable,
};

/** Human (Latvian) message for any thrown error. */
export function errorMessage(e: unknown): string {
  if (e instanceof RpcError) return MAP[e.code] ?? L.errors.generic;
  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as { code: unknown }).code);
    return MAP[code] ?? L.errors.generic;
  }
  return L.errors.generic;
}
