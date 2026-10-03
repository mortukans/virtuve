import { useEffect } from 'react';
import { supabase } from '../api/supabase';
import { queryClient, qk } from '../api/queryClient';
import { isConfigured } from '../env';

/**
 * Subscribe to a household's shared tables and invalidate the matching queries on
 * any change, so every member sees live updates (shopping list, votes, who's at
 * the shop, attendance, inventory…). Partial query keys invalidate by prefix.
 */
export function useHouseholdRealtime(householdId: string | null): void {
  useEffect(() => {
    if (!householdId || !isConfigured) return;
    const id = householdId;
    const ch = supabase.channel(`hh:${id}`);
    const filter = `household_id=eq.${id}`;

    const scoped: [string, readonly unknown[]][] = [
      ['inventory_items', qk.inventory(id)],
      ['shopping_items', qk.shopping(id)],
      ['shoppers', qk.shoppers(id)],
      ['meal_requests', qk.requests(id)],
      ['household_members', qk.household(id)],
      ['plan_entries', ['plan', id]],
      ['attendance', ['attendance', id]],
      ['vote_sessions', qk.activeVote(id)],
    ];
    for (const [table, key] of scoped) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        void queryClient.invalidateQueries({ queryKey: key as unknown[] });
      });
    }
    // vote_choices has no household_id column → coarse invalidate.
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'vote_choices' }, () => {
      void queryClient.invalidateQueries({ queryKey: ['activeVote', id] });
      void queryClient.invalidateQueries({ queryKey: ['vote'] });
    });

    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [householdId]);
}
