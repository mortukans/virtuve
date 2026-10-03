import { z } from 'zod';

/**
 * Public runtime config. EXPO_PUBLIC_* vars are inlined at build time.
 * Copy .env.example to .env and fill in your Supabase project values.
 * Server-side secrets (ANTHROPIC_API_KEY, image-gen key) live only in Supabase
 * Edge Function secrets and never reach the client.
 */
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  UNIVERSAL_LINK_HOST: z.string().default('virtuve.lv'),
});

const parsed = schema.safeParse({
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key-placeholder',
  UNIVERSAL_LINK_HOST: process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST || undefined,
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid EXPO_PUBLIC_* configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
/** False when running against the placeholder config (no real Supabase project yet). */
export const isConfigured = !env.SUPABASE_URL.includes('placeholder');
