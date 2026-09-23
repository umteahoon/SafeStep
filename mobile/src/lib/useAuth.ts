import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
}

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

/** 웹의 useAuthListener()와 같은 역할. App.tsx 최상단에서 한 번만 호출하세요. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: Session | null) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (mounted) setState({ session, profile, isLoading: false });
      } else {
        setState({ session: null, profile: null, isLoading: false });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
