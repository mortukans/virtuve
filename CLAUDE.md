# Virtuve — repo guide

Latvian-only "ko ēdam?" household food app. Photograph the fridge → AI recognises
food → suggests dinners from what you have → household votes → shared shopping list.
Expo SDK 57 / Expo Router / TypeScript app in `app/` + `src/`, Supabase backend in
`supabase/`, Claude AI behind Supabase Edge Functions.

## Layout and ownership

| Path | What |
|------|------|
| `app/` | Expo Router routes only. No business logic. Tabs: home, kitchen, shopping, us. |
| `src/api/` | `supabase.ts` client, `rpc.ts` typed RPC + edge-fn wrappers (**the contract**), `types.ts`, `queryClient.ts` (`qk` keys) |
| `src/auth/` | anonymous-first auth store + Apple sign-in (upgrade via `claim_merge`) |
| `src/household/` | active-household store (`active.ts`), react-query hooks (`queries.ts`), `context.tsx` (provider + realtime) |
| `src/kitchen/` `src/meals/` `src/shopping/` | per-feature components |
| `src/realtime/` | `useHouseholdRealtime` — invalidates queries on shared-table changes |
| `src/ui/` | `theme.ts` tokens, `kit.tsx` components, `useAction.ts`, `errors.ts`, `haptics.ts` |
| `src/i18n/lv.ts` | all Latvian copy as a typed object (`L`) + enum label maps |
| `supabase/migrations/` | SQL schema + security-definer RPCs + RLS + realtime |
| `supabase/functions/` | Edge Functions: ai-scan, ai-recipes, ai-image, ai-plan, ai-import (+ `_shared/`) |

## Rules

- **Latvian only.** Never hardcode English UI text. Use `L.*` from `src/i18n/lv.ts`
  (or inline Latvian). Dark theme only; use tokens from `src/ui/theme.ts`.
- Every RPC the app calls must exist in `src/api/rpc.ts` AND in a migration with the
  same name and `p_*` args. Run `node supabase/tests/check-rpc-parity.mjs` to verify.
- All DB writes go through security-definer RPCs; tables have member-scoped SELECT RLS
  only (for Realtime). Prefs allergies/`never` are hard blocks in recipe generation.
- AI keys live only in Supabase function secrets, never `EXPO_PUBLIC_*`.
- Use `npx expo install <pkg>` for Expo/RN deps. Never edit `ios/`/`android/` — configure
  via `app.config.ts`. Photos are hotlinked/stored in Supabase Storage buckets.
- Run `npm run typecheck` and `npm test` before declaring done.

## Commands

```bash
npm run typecheck
npm test
npx expo start
npx supabase db push
npx supabase functions deploy ai-scan ai-recipes ai-image ai-plan ai-import
node supabase/tests/check-rpc-parity.mjs
```
