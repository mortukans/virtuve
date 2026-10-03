import React, { createContext, useContext } from 'react';
import type { Household } from '../api/types';
import { useResolvedHousehold } from './queries';
import { useHouseholdRealtime } from '../realtime/useHouseholdRealtime';

interface Ctx {
  household: Household | undefined;
  activeId: string | null;
  households: Household[] | undefined;
  isLoading: boolean;
}

const HouseholdContext = createContext<Ctx>({ household: undefined, activeId: null, households: undefined, isLoading: true });

/** Resolves the active household once for all tabs and opens one realtime channel. */
export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const resolved = useResolvedHousehold();
  useHouseholdRealtime(resolved.activeId);
  return <HouseholdContext.Provider value={resolved}>{children}</HouseholdContext.Provider>;
}

export const useHouseholdCtx = () => useContext(HouseholdContext);
