import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Central query-key factory so every feature invalidates consistently. */
export const qk = {
  profile: ['profile'] as const,
  households: ['households'] as const,
  household: (id: string) => ['household', id] as const,
  inventory: (hid: string) => ['inventory', hid] as const,
  shopping: (hid: string) => ['shopping', hid] as const,
  recipes: (hid: string, filter: string) => ['recipes', hid, filter] as const,
  recipe: (id: string) => ['recipe', id] as const,
  history: (hid: string) => ['history', hid] as const,
  vote: (id: string) => ['vote', id] as const,
  activeVote: (hid: string) => ['activeVote', hid] as const,
  attendance: (hid: string, date: string) => ['attendance', hid, date] as const,
  shoppers: (hid: string) => ['shoppers', hid] as const,
  requests: (hid: string) => ['requests', hid] as const,
  plan: (hid: string, from: string, to: string) => ['plan', hid, from, to] as const,
};
