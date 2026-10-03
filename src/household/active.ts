import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'virtuve.activeHousehold';

/** The household the user is currently looking at. Persisted locally; the data
 *  itself comes from react-query (see queries.ts). */
interface ActiveState {
  activeId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setActive: (id: string | null) => void;
}

export const useActiveHousehold = create<ActiveState>((set) => ({
  activeId: null,
  hydrated: false,
  hydrate: async () => {
    try {
      const id = await AsyncStorage.getItem(KEY);
      set({ activeId: id, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setActive: (id) => {
    set({ activeId: id });
    void AsyncStorage.setItem(KEY, id ?? '').catch(() => undefined);
  },
}));
