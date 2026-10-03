// Static contract check: every rpc<...>('name') in src/api/rpc.ts must have a
// matching `create ... function public.name(` in a migration, and every
// invoke<...>('fn') must have a supabase/functions/fn/index.ts. Run: node supabase/tests/check-rpc-parity.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rpcSrc = readFileSync(join(root, 'src/api/rpc.ts'), 'utf8');

const rpcNames = [...rpcSrc.matchAll(/\brpc<[^>]*>\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
const fnNames = [...rpcSrc.matchAll(/\binvoke<[^>]*>\(\s*'([a-z-]+)'/g)].map((m) => m[1]);

const migDir = join(root, 'supabase/migrations');
const migSql = readdirSync(migDir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(migDir, f), 'utf8')).join('\n');

const missingRpc = [...new Set(rpcNames)].filter(
  (n) => !new RegExp(`function\\s+public\\.${n}\\s*\\(`).test(migSql),
);
const missingFn = [...new Set(fnNames)].filter((n) => !existsSync(join(root, 'supabase/functions', n, 'index.ts')));

let ok = true;
if (missingRpc.length) { ok = false; console.error('Missing SQL functions for RPCs:', missingRpc.join(', ')); }
if (missingFn.length) { ok = false; console.error('Missing edge functions:', missingFn.join(', ')); }
if (ok) {
  console.log(`OK — ${new Set(rpcNames).size} RPCs + ${new Set(fnNames).size} edge functions all present.`);
} else {
  process.exit(1);
}
