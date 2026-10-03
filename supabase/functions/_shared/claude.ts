import { HttpError } from './supa.ts';

const API = 'https://api.anthropic.com/v1/messages';
const KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// Cost-tuned defaults for a per-use consumer app; override via secrets.
export const TEXT_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
export const VISION_MODEL = Deno.env.get('ANTHROPIC_VISION_MODEL') ?? 'claude-haiku-4-5';

export const aiConfigured = () => KEY.length > 0;

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface CallOpts {
  model: string;
  system: string;
  blocks: Block[];
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

/** Single Messages API call; returns the concatenated text blocks. */
export async function callClaude({ model, system, blocks, maxTokens = 4000, effort }: CallOpts): Promise<string> {
  if (!KEY) throw new HttpError(503, 'ai_unavailable');
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: blocks }],
  };
  // `effort` is rejected on Haiku 4.5 and older; only send it on 5.x models.
  if (effort && !model.includes('haiku')) body.output_config = { effort };

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('anthropic error', res.status, detail.slice(0, 500));
    throw new HttpError(502, 'ai_error');
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new HttpError(422, 'ai_refused');
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
}

/** Parse JSON out of a model response, tolerating code fences and surrounding prose. */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new HttpError(502, 'ai_bad_json');
  }
}
