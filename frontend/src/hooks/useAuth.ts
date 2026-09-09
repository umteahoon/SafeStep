import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  setSession: (user: User | null, profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setSession: (user, profile) => set({ user, profile, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[SafeStep] 프로필 조회 실패:', error.message);
    return null;
  }
  return data as Profile;
}

/**
 * 앱 최상단(App.tsx)에서 한 번만 호출하여 세션 변화를 구독합니다.
 * 각 컴포넌트는 useAuth()만 호출하여 user/profile/isLoading을 읽습니다.
 */
export function useAuthListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setSession(session.user, profile);
      } else {
        setSession(null, null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setSession(session.user, profile);
        } else {
          setSession(null, null);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  return { user, profile, isLoading };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** 프로필이 서버에서 바뀐 뒤(온보딩 등) 스토어를 다시 채웁니다. */
export async function refreshProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;
  const profile = await fetchProfile(session.user.id);
  useAuthStore.getState().setSession(session.user, profile);
}
