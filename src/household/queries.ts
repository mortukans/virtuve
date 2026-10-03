import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHousehold, getMyHouseholds } from '../api/rpc';
import { qk } from '../api/queryClient';
import { isConfigured } from '../env';
import { useAuth } from '../auth/store';
import type { Household } from '../api/types';
import { useActiveHousehold } from './active';

export function useMyHouseholds() {
  const uid = useAuth((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: [...qk.households, uid],
    queryFn: getMyHouseholds,
    enabled: isConfigured && !!uid,
  });
}

export function useHousehold(id: string | null) {
  return useQuery({
    queryKey: id ? qk.household(id) : ['household', 'none'],
    queryFn: () => getHousehold(id as string),
    enabled: isConfigured && !!id,
  });
}

/**
 * Resolves the active household: the persisted active id if it's still one the
 * user belongs to, otherwise the first. Keeps the active id in sync.
 */
export function useResolvedHousehold(): {
  household: Household | undefined;
  households: Household[] | undefined;
  activeId: string | null;
  isLoading: boolean;
} {
  const { data: households, isLoading } = useMyHouseholds();
  const { activeId, hydrated, setActive } = useActiveHousehold();

  useEffect(() => {
    if (!hydrated || !households) return;
    const stillValid = activeId && households.some((h) => h.id === activeId);
    if (!stillValid) setActive(households[0]?.id ?? null);
  }, [hydrated, households, activeId, setActive]);

  const resolvedId = activeId && households?.some((h) => h.id === activeId) ? activeId : households?.[0]?.id ?? null;
  const detail = useHousehold(resolvedId);

  return {
    household: detail.data,
    households,
    activeId: resolvedId,
    isLoading: isLoading || detail.isLoading,
  };
}
