import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { UserRole } from '../types';
import type { RootNav, RootStackParamList } from '../navigation/types';
import { Button, Loading } from './ui';
import { colors } from '../theme';

function Notice({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{title}</Text>
      {desc && <Text style={styles.noticeDesc}>{desc}</Text>}
      {action && <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

interface RequireRoleProps {
  roles: UserRole[];
  /** 학생은 학원 명부와 연동된 뒤에만 접근 (웹의 RequireStudentLink) */
  requireStudentLink?: boolean;
  /** 학원 미연결 원장도 허용 (등록 코드 입력 화면 자체) */
  allowNoAcademy?: boolean;
  /** 로그인 후 돌아올 화면 */
  next?: { name: keyof RootStackParamList; params?: any };
  children: ReactNode;
}

/**
 * 웹의 ProtectedRoute + RequireStudentLink 를 합친 화면 단위 가드.
 * - 비로그인 → 로그인 안내
 * - 역할 불일치 → 접근 권한 없음
 * - 미승인 강사 → 승인 대기 안내
 * - 학원 미연결 원장 → 등록 코드 입력 화면으로 이동
 * - 명부 미연동 학생(requireStudentLink) → 연동 안내 + 이동 버튼
 */
export function RequireRole({
  roles,
  requireStudentLink,
  allowNoAcademy,
  next,
  children,
}: RequireRoleProps) {
  const navigation = useNavigation<RootNav>();
  const { user, profile, isLoading } = useAuth();

  const needsLinkCheck = !!requireStudentLink && profile?.role === 'STUDENT';
  const [linked, setLinked] = useState<boolean | null>(null);

  const shouldRedirectOwner =
    profile?.role === 'ACADEMY_ADMIN' &&
    !profile.academy_id &&
    roles.includes('ACADEMY_ADMIN') &&
    !allowNoAcademy;

  useEffect(() => {
    if (!needsLinkCheck || !user) return;
    let cancelled = false;
    supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLinked(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [needsLinkCheck, user]);

  useEffect(() => {
    if (shouldRedirectOwner) navigation.replace('OwnerClaim');
  }, [shouldRedirectOwner, navigation]);

  if (isLoading) return <Loading text="인증 확인 중..." />;

  if (!user || !profile) {
    return (
      <Notice
        title="로그인이 필요합니다"
        desc="이 기능은 로그인 후 이용할 수 있어요."
        action={
          <Button
            title="로그인하기"
            onPress={() => navigation.navigate('Login', next ? { next } : undefined)}
          />
        }
      />
    );
  }

  if (!roles.includes(profile.role)) {
    return (
      <Notice
        title="접근 권한이 없습니다"
        desc="현재 계정으로는 이용할 수 없는 화면입니다."
      />
    );
  }

  if (profile.role === 'TEACHER' && profile.approval_status !== 'APPROVED') {
    return (
      <Notice
        title="원장 승인 대기 중입니다"
        desc="소속 학원 원장이 승인하면 모든 기능을 사용할 수 있어요."
      />
    );
  }

  if (shouldRedirectOwner) return <Loading text="학원 등록 화면으로 이동 중..." />;

  if (needsLinkCheck && linked === null) return <Loading text="확인 중..." />;

  // 탭 안에서 replace 를 쓰면 탭 전체가 교체되어 돌아갈 수 없으므로, 안내 + 이동 버튼으로 처리
  if (needsLinkCheck && linked === false) {
    return (
      <Notice
        title="학원·스터디카페 연동이 필요해요"
        desc="다니는 학원·스터디카페에서 받은 6자리 연동코드를 입력하면 이용권, 채팅, 팀을 이용할 수 있어요."
        action={<Button title="연동하러 가기" onPress={() => navigation.navigate('StudentQr')} />}
      />
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  noticeTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  noticeDesc: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});

/**
 * 지정한 역할이 직접 열었을 때 막는 보조 안전장치(진입점은 이미 숨김).
 * 비로그인은 통과 — 일반 이용자도 볼 수 있는 화면에 씀.
 */
export function BlockRoles({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return <Loading text="확인 중..." />;
  if (user && profile && roles.includes(profile.role)) {
    return <Notice title="이용할 수 없는 화면이에요" desc="현재 계정에서는 사용할 수 없는 기능입니다." />;
  }
  return <>{children}</>;
}
