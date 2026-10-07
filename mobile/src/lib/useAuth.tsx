import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, UserRole } from '../types';
import { PREVIEW_ACADEMY_ID, PREVIEW_MEMBER_ID, PREVIEW_MODE, PREVIEW_USER_ID } from './preview';
import { setMockUserId } from './mockSupabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

// 로그인 없이 모든 화면을 둘러보는 미리보기 모드 (EXPO_PUBLIC_PREVIEW_MODE=1).
// 가짜 사용자/프로필로 권한 가드를 통과시킵니다. 서버 데이터는 Supabase 값이 올바를 때만 보입니다.
export { PREVIEW_MODE };

/** 미리보기 역할: GUEST=비로그인, MEMBER=일반 회원(학생 계정이지만 학원 명부에 연동 안 됨) */
export type PreviewRole = UserRole | 'GUEST' | 'MEMBER';

function previewState(role: PreviewRole): AuthState {
  if (role === 'GUEST') return { session: null, user: null, profile: null, isLoading: false };
  const isMember = role === 'MEMBER';
  const id = isMember ? PREVIEW_MEMBER_ID : PREVIEW_USER_ID;
  const user = { id, email: 'preview@safestep.app' } as User;
  const profile: Profile = {
    id,
    email: 'preview@safestep.app',
    name: isMember ? '일반회원' : '미리보기',
    role: isMember ? 'STUDENT' : role,
    academy_id: isMember || role === 'SUPER_ADMIN' || role === 'PARENT' ? null : PREVIEW_ACADEMY_ID,
    approval_status: 'APPROVED',
    phone: null,
    created_at: new Date().toISOString(),
  };
  return { session: null, user, profile, isLoading: false };
}

/** 학생 계정의 학원 명부 연동 정보 (students.user_id = 내 계정) */
export interface StudentRef {
  id: string;
  academy_id: string;
}

interface AuthContextValue extends AuthState {
  /** 학생(STUDENT) 계정이 학원 명부에 연동돼 있으면 그 학생 정보, 아니면 null */
  student: StudentRef | null;
  /** 학생 계정이 명부에 연동됐는가 (학생이 아니면 false) */
  studentLinked: boolean;
  /**
   * 일반 회원 = 학생으로 가입했지만 아직 학원 명부에 연동하지 않은 계정.
   * 로그인했지만 소속 학원·스터디카페가 없어 이용권·출결·채팅은 못 쓰고, 탐색·즐겨찾기·커뮤니티는 쓸 수 있음.
   */
  isMember: boolean;
  /**
   * 내 소속 스터디카페(학원) id. 학생은 프로필이 아니라 연동된 students 행의 academy_id 를 사용
   * (연동은 students.user_id 만 채우고 프로필의 academy_id 는 바꾸지 않기 때문)
   */
  academyId: string | null;
  /** 학생 연동(코드 입력) 직후 연동 상태를 다시 읽음 */
  refreshStudentLink: () => Promise<void>;
  /** 미리보기 모드에서만 사용: 보고 있는 역할 */
  previewRole: PreviewRole | null;
  setPreviewRole: (role: PreviewRole) => void;
  /** 온보딩 등으로 서버에서 프로필이 바뀐 뒤 다시 읽어옵니다. */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
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

const AuthContext = createContext<AuthContextValue | null>(null);

/** 웹의 useAuthListener()와 같은 역할. App.tsx 최상단에서 한 번만 감싸세요. */
async function fetchStudent(userId: string): Promise<StudentRef | null> {
  const { data } = await supabase.from('students').select('id, academy_id').eq('user_id', userId).maybeSingle();
  return data ? { id: (data as any).id, academy_id: (data as any).academy_id } : null;
}

/** 웹의 useAuthListener()와 같은 역할. App.tsx 최상단에서 한 번만 감싸세요. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
  });
  const [student, setStudent] = useState<StudentRef | null>(null);
  // 학생 계정의 연동 여부를 아직 모르는 동안 true (탭/홈이 잠깐 틀린 모습으로 번쩍이지 않게 로딩으로 처리)
  const [studentPending, setStudentPending] = useState(false);

  const [previewRole, setPreviewRole] = useState<PreviewRole>('ACADEMY_ADMIN');

  useEffect(() => {
    if (PREVIEW_MODE) return;
    let mounted = true;

    const applySession = async (session: Session | null) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const st = profile?.role === 'STUDENT' ? await fetchStudent(session.user.id) : null;
        if (mounted) {
          setStudent(st);
          setStudentPending(false);
          setState({ session, user: session.user, profile, isLoading: false });
        }
      } else {
        setStudent(null);
        setStudentPending(false);
        setState({ session: null, user: null, profile: null, isLoading: false });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // onAuthStateChange 콜백 안에서 supabase 호출을 await 하면 데드락이 날 수 있어
      // 다음 틱으로 미룹니다.
      setTimeout(() => applySession(session), 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 미리보기: 역할이 바뀔 때마다 가짜 사용자 id 를 가짜 서버에 알리고, 학생이면 연동 여부를 조회
  const previewBase = useMemo(() => (PREVIEW_MODE ? previewState(previewRole) : null), [previewRole]);
  useEffect(() => {
    if (!PREVIEW_MODE || !previewBase) return;
    setMockUserId(previewBase.user?.id ?? PREVIEW_USER_ID);
    if (previewBase.profile?.role === 'STUDENT' && previewBase.user) {
      let alive = true;
      setStudentPending(true);
      fetchStudent(previewBase.user.id).then((st) => {
        if (!alive) return;
        setStudent(st);
        setStudentPending(false);
      });
      return () => {
        alive = false;
      };
    }
    setStudent(null);
    setStudentPending(false);
  }, [previewBase]);

  const refreshProfile = useCallback(async () => {
    if (PREVIEW_MODE) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const profile = await fetchProfile(session.user.id);
    setState({ session, user: session.user, profile, isLoading: false });
  }, []);

  const baseUserId = (PREVIEW_MODE ? previewBase?.user?.id : state.user?.id) ?? null;
  const refreshStudentLink = useCallback(async () => {
    if (!baseUserId) return;
    setStudent(await fetchStudent(baseUserId));
  }, [baseUserId]);

  const signOut = useCallback(async () => {
    if (PREVIEW_MODE) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const base = PREVIEW_MODE ? (previewBase as AuthState) : state;
    const isStudent = base.profile?.role === 'STUDENT';
    return {
      ...base,
      isLoading: base.isLoading || (isStudent && studentPending),
      student,
      studentLinked: isStudent && !!student,
      isMember: isStudent && !student,
      academyId: base.profile?.academy_id ?? student?.academy_id ?? null,
      refreshStudentLink,
      previewRole: PREVIEW_MODE ? previewRole : null,
      setPreviewRole,
      refreshProfile,
      signOut,
    };
  }, [state, previewBase, previewRole, student, studentPending, refreshStudentLink, refreshProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
