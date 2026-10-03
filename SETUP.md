# Virtuve — setup

Virtuve is a Latvian-only "ko ēdam?" household food app: photograph the fridge, AI
recognises the food, and it suggests dinners from what you already have. Stack: Expo
SDK 57 (iOS-first) + Supabase (EU) + Claude for vision/recipes. No Mac needed — iOS
builds run on GitHub Actions.

## 1. Install

```bash
npm install
cp .env.example .env   # fill in after step 2
```

## 2. Supabase project (EU)

1. Create a project at supabase.com (region **EU / Frankfurt or Paris**).
2. Link and push the schema:
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
3. In the dashboard: **Authentication → Providers** enable **Anonymous** and **Apple**
   (Apple: turn **"Skip nonce check" ON** — the app sends the identity token without a nonce).
4. Put the project URL + publishable (anon) key into `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   ```

## 3. AI edge functions

Set the server-side secrets (never shipped to the app):

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# optional overrides (defaults shown):
npx supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5-5
npx supabase secrets set ANTHROPIC_VISION_MODEL=claude-haiku-4-5
# optional AI meal-preview images (any OpenAI-compatible images endpoint):
npx supabase secrets set IMAGE_API_KEY=... IMAGE_MODEL=gpt-image-1
```

Deploy the functions:

```bash
npx supabase functions deploy ai-scan ai-recipes ai-image ai-plan ai-import
```

> Cost note: recipe generation uses Claude Sonnet 5.5 and fridge scanning uses Claude
> Haiku 4.5 — a few cents per use, fine for TestFlight. If AI preview images have no key
> set, the app shows clean typographic meal cards instead. Plan pricing before opening to
> many free users.

## 4. Run locally

```bash
npx expo start      # press i for the iOS simulator, or scan with Expo Go / a dev build
npm run typecheck
npm test
```

## 5. iOS build → TestFlight (no Mac)

Reuses the Apple account secrets from your other apps. One-time:

1. In App Store Connect → **My Apps → +**, create the app with bundle id `lv.virtuve.app`.
2. Create an EAS project (or reuse) and note its id.
3. Add these **GitHub repo secrets** (Settings → Secrets → Actions):
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EAS_PROJECT_ID`,
   `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`,
   `DIST_CERT_P12`, `DIST_CERT_PASSWORD`, `DIST_CERT_ID`
   (the `ASC_*` and `DIST_CERT_*` values are the same ones Uzmini Cenu uses).
4. Run the **iOS → TestFlight** workflow (Actions tab → Run workflow), or push a `v*` tag.

## Layout

See `CLAUDE.md` for the repo map. Backend lives in `supabase/` (migrations + edge
functions), the app in `app/` (routes) and `src/` (logic, UI, i18n).
