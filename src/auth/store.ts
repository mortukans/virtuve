import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import { claimMerge, getMyProfile } from '../api/rpc';
import type { Profile } from '../api/types';
import { isConfigured } from '../env';
import { appleIdToken } from './apple';

/**
 * Auth contract. Every device starts as an anonymous Supabase user
 * (signInAnonymously on first launch) — the whole app works anonymously for one
 * household. "Turpināt ar Apple" upgrades that account: it signs in with Apple
 * and, if the Apple user differs from the anonymous one, calls claim_merge to
 * carry the anonymous profile + household memberships over, then drops the old
 * user. isLinked is true once an apple identity exists (needed to invite members
 * / sync across devices).
 */
interface AuthState {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  isAnonymous: boolean;
  isLinked: boolean;
  justRestored: boolean;
  bootstrap: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  clearJustRestored: () => void;
}

const isAnon = (u: User | null | undefined): boolean =>
  !u || Boolean((u as { is_anonymous?: boolean }).is_anonymous);
const hasApple = (u: User | null | undefined): boolean =>
  Boolean(u?.identities?.some((i) => i.provider === 'apple'));

let listening = false;

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  ready: false,
  isAnonymous: true,
  isLinked: false,
  justRestored: false,
  clearJustRestored: () => set({ justRestored: false }),

  bootstrap: async () => {
    if (!isConfigured) {
      set({ ready: true });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      set({ session, isAnonymous: isAnon(session.user), isLinked: hasApple(session.user) });
    } else {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.session) set({ session: data.session, isAnonymous: true, isLinked: false });
    }
    if (!listening) {
      listening = true;
      supabase.auth.onAuthStateChange((_e, s) => {
        set({ session: s, isAnonymous: isAnon(s?.user), isLinked: hasApple(s?.user) });
        if (s) setTimeout(() => void get().refreshProfile(), 0);
      });
    }
    await get().refreshProfile();
    set({ ready: true });
  },

  refreshProfile: async () => {
    if (!isConfigured) return;
    const profile = await getMyProfile().catch(() => null);
    if (profile) set({ profile });
  },

  signInWithApple: async () => {
    set({ justRestored: false });
    const prev = get().session?.user.id ?? null;
    const prevAnon = get().isAnonymous;
    const token = await appleIdToken();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token });
    if (error) throw error;
    const next = data.user?.id ?? null;
    if (prev && prevAnon && next && prev !== next) {
      await claimMerge(prev).catch(() => undefined); // best-effort migration of anon data
    }
    set({
      session: data.session,
      isAnonymous: isAnon(data.user),
      isLinked: hasApple(data.user),
      justRestored: !prevAnon,
    });
    await get().refreshProfile();
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, session: null, isAnonymous: true, isLinked: false, justRestored: false });
    await get().bootstrap();
  },
}));

export const useUserId = (): string | null => useAuth((s) => s.session?.user.id ?? null);
