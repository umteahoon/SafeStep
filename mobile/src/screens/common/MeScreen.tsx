import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { PREVIEW_MODE, useAuth } from '../../lib/useAuth';
import type { PreviewRole } from '../../lib/useAuth';
import { useFavorites } from '../../lib/favorites';
import { useNotifications } from '../../lib/notifications';
import { ROLE_LABEL, canExplore, canUseChat, canUseTeams } from '../../lib/teams';
import { Avatar, Badge, Banner, Button, Icon, Loading, Screen } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { colors, radius } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { UserRole } from '../../types';

interface MenuItem {
  title: string;
  desc?: string;
  icon: IconName;
  to: keyof RootStackParamList;
}

// 역할별 "내 활동" 메뉴 — 단순한 선 아이콘만 사용 (색 타일 없음)
function activityMenu(role: UserRole, hasAcademy: boolean, isMember: boolean): MenuItem[] {
  if (isMember) return [{ title: '학원·스터디카페 연동하기', desc: '다니는 곳에서 받은 6자리 코드로 이용권·출결·채팅 사용', icon: 'link-outline', to: 'StudentQr' }];
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { title: '플랫폼 관리', desc: '가입 학원 · 매출 · 원장 승인', icon: 'business-outline', to: 'SuperAdmin' },
        { title: '접속 로그', desc: '로그인 시도 · 반복 실패 감지', icon: 'shield-checkmark-outline', to: 'AdminLogs' },
      ];
    case 'ACADEMY_ADMIN':
      return hasAcademy
        ? [
            { title: '원장 대시보드', desc: '학생 수 · 출석률 · 엑셀 추출', icon: 'stats-chart-outline', to: 'Dashboard' },
            { title: '학생 관리', icon: 'people-outline', to: 'Students' },
            { title: '강사 관리', desc: '승인 대기 · 소속 강사', icon: 'person-add-outline', to: 'Teachers' },
            { title: '반 · 시간표', icon: 'calendar-outline', to: 'Classes' },
            { title: '출석부', icon: 'checkbox-outline', to: 'Attendance' },
            { title: '이용권 결제', desc: 'SafeStep 30일 이용권', icon: 'card-outline', to: 'Billing' },
          ]
        : [{ title: '학원 등록', desc: '등록 코드 입력', icon: 'key-outline', to: 'OwnerClaim' }];
    case 'TEACHER':
      if (!hasAcademy) return [{ title: '학원 합류', desc: '원장님께 받은 초대 코드 입력', icon: 'key-outline', to: 'TeacherJoin' }];
      return [
        { title: '출석부', icon: 'checkbox-outline', to: 'Attendance' },
        { title: '학생 관리', icon: 'people-outline', to: 'Students' },
        { title: '반 · 시간표', icon: 'calendar-outline', to: 'Classes' },
      ];
    case 'STUDENT':
      return [
        { title: '출석 체크', desc: '큰 버튼으로 출석하고 기록 확인', icon: 'checkmark-done-circle-outline', to: 'CheckIn' },
        { title: '내 출결 QR', desc: '키오스크에 스캔하세요', icon: 'qr-code-outline', to: 'StudentQr' },
        { title: '이용권', desc: '시간권·기간권 구매 · 잔여 현황', icon: 'ticket-outline', to: 'StudentPasses' },
        { title: '이용 내역', icon: 'receipt-outline', to: 'History' },
        { title: '내 시간표', icon: 'calendar-outline', to: 'Timetable' },
        { title: '학습 플래너', desc: '오늘 할 일 · D-day · 주간 계획', icon: 'checkbox-outline', to: 'Planner' },
        { title: '집중 타이머', icon: 'timer-outline', to: 'FocusTimer' },
      ];
    case 'PARENT':
      return [{ title: '자녀 출결 리포트', desc: '주간 리포트 · 사전 결석 신청', icon: 'document-text-outline', to: 'ParentReport' }];
  }
}

function Row({ icon, title, desc, onPress, last, right }: { icon: IconName; title: string; desc?: string; onPress: () => void; last?: boolean; right?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { backgroundColor: '#F7F8FA' }]}>
      <Icon name={icon} size={22} color={colors.textSub} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {desc && <Text style={styles.rowDesc}>{desc}</Text>}
      </View>
      {right ? <Text style={styles.rowRight}>{right}</Text> : null}
      <Icon name="chevron-forward" size={18} color={colors.borderStrong} />
    </Pressable>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      {title && <Text style={styles.groupTitle}>{title}</Text>}
      <View>{children}</View>
    </View>
  );
}

/** 미리보기 모드 전용: 역할 전환 (가로 스크롤 칩 한 줄) */
function PreviewSwitcher({ value, onChange }: { value: PreviewRole | null; onChange: (r: PreviewRole) => void }) {
  if (!PREVIEW_MODE) return null;
  const roles: PreviewRole[] = ['GUEST', 'MEMBER', ...(Object.keys(ROLE_LABEL) as UserRole[])];
  return (
    <View style={styles.preview}>
      <Text style={styles.previewLabel}>미리보기 · 역할 전환</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6 }}>
        {roles.map((r) => (
          <Pressable key={r} onPress={() => onChange(r)} style={[styles.pChip, value === r && styles.pChipOn]}>
            <Text style={[styles.pChipText, value === r && { color: colors.white }]}>
              {r === 'GUEST' ? '비로그인' : r === 'MEMBER' ? '일반 회원' : ROLE_LABEL[r]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function MeScreen() {
  const navigation = useNavigation<RootNav>();
  const { user, profile, isLoading, signOut, previewRole, setPreviewRole, isMember, academyId } = useAuth();
  const [affiliation, setAffiliation] = useState<{ name: string; kind: string | null } | null>(null);
  const { favorites } = useFavorites();
  const { unread } = useNotifications();
  const go = (to: keyof RootStackParamList) => navigation.navigate(to as any);

  // 소속 학원·스터디카페 이름
  useEffect(() => {
    if (!academyId) return setAffiliation(null);
    let alive = true;
    supabase
      .from('academies')
      .select('name, kind')
      .eq('id', academyId)
      .maybeSingle()
      .then(({ data }) => alive && setAffiliation(data ? { name: String((data as any).name), kind: (data as any).kind ?? null } : null));
    return () => {
      alive = false;
    };
  }, [academyId]);

  if (isLoading) return <Loading />;

  // ── 비로그인 ──
  if (!user) {
    return (
      <Screen edges={['top', 'left', 'right']} backgroundColor={colors.white} contentStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={styles.pageTitle}>내 정보</Text>
        <PreviewSwitcher value={previewRole} onChange={setPreviewRole} />

        <View style={styles.guestCard}>
          <View style={styles.guestIcon}>
            <Icon name="person-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.guestTitle}>로그인하고 시작해보세요</Text>
          <Text style={styles.guestSub}>즐겨찾기, 학원 채팅·공지,{'\n'}이용권과 출결을 한곳에서 관리해요</Text>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 20 }}>
            <Button title="로그인" onPress={() => go('Login')} style={{ height: 52, borderRadius: 16 }} />
            <Button title="회원가입" variant="secondary" onPress={() => go('Register')} style={{ height: 52, borderRadius: 16 }} />
          </View>
        </View>

        <Group title="둘러보기">
          <Row icon="map-outline" title="학원·스터디카페 찾기" onPress={() => navigation.navigate('Main', { screen: 'MapTab' })} />
          <Row icon="school-outline" title="학원" desc="채팅방 · 공지방 · 출결" onPress={() => navigation.navigate('Main', { screen: 'AcademyTab' })} last />
        </Group>
        <Group title="학원·스터디카페를 운영하시나요?">
          <Row icon="rocket-outline" title="무료로 시작하기" desc="도입 가이드" onPress={() => go('StartGuide')} />
          <Row icon="chatbox-ellipses-outline" title="도입 문의" onPress={() => go('Inquiry')} />
          {Platform.OS === 'web' && (
            <Row icon="desktop-outline" title="데스크톱 버전으로 보기" desc="컴퓨터용 웹 화면" onPress={() => Linking.openURL('https://safestep-kr.netlify.app/?site=desktop')} />
          )}
          <Row icon="sparkles-outline" title="앱 소개 다시 보기" desc="처음 실행할 때 나오는 안내 화면" onPress={() => navigation.navigate('Welcome', { replay: true })} last />
        </Group>
        <Text style={styles.version}>SafeStep Mobile 1.0.0</Text>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Loading text="프로필을 불러오는 중..." />
        <Button title="로그아웃" variant="secondary" onPress={signOut} />
      </Screen>
    );
  }

  const items = activityMenu(profile.role, !!profile.academy_id, isMember);
  const teacherPending = profile.role === 'TEACHER' && profile.approval_status !== 'APPROVED';
  // 즐겨찾기(지도)는 원장·강사·학부모에게 보이지 않으므로 요약도 숨김
  const showStats = profile.role !== 'SUPER_ADMIN' && canExplore(profile.role);
  const roleText = isMember ? '일반 회원' : ROLE_LABEL[profile.role];

  return (
    <Screen edges={['top', 'left', 'right']} backgroundColor={colors.white} contentStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 56 }}>
      <Text style={styles.pageTitle}>내 정보</Text>
      <PreviewSwitcher value={previewRole} onChange={setPreviewRole} />

      {/* 프로필 */}
      <View style={styles.profile}>
        <Avatar name={profile.name} size={64} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {profile.email}
          </Text>
          {affiliation && (
            <Text style={styles.affiliation} numberOfLines={1}>
              {affiliation.kind === 'ACADEMY' ? '학원' : affiliation.kind === 'STUDY_CAFE' ? '스터디카페' : '소속'} · {affiliation.name}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            <Badge text={roleText} />
            {profile.role === 'TEACHER' && (
              <Badge
                text={profile.approval_status === 'APPROVED' ? '승인됨' : profile.approval_status === 'REJECTED' ? '반려됨' : '승인 대기'}
                bg={profile.approval_status === 'APPROVED' ? colors.successSoft : colors.warnSoft}
                fg={profile.approval_status === 'APPROVED' ? colors.success : colors.warnText}
              />
            )}
          </View>
        </View>
      </View>

      {/* 활동 요약 */}
      {showStats && (
        <View style={styles.stats}>
          <Pressable style={styles.stat} onPress={() => navigation.navigate('Main', { screen: 'MapTab', params: { preset: 'fav', ts: Date.now() } })}>
            <Text style={styles.statValue}>{favorites.length}</Text>
            <Text style={styles.statLabel}>즐겨찾기</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.stat} onPress={() => go('Notifications')}>
            <Text style={[styles.statValue, unread > 0 && { color: colors.danger }]}>{unread}</Text>
            <Text style={styles.statLabel}>새 알림</Text>
          </Pressable>
        </View>
      )}

      {teacherPending && (
        <View style={{ marginTop: 20 }}>
          <Banner kind="warn">원장 승인 대기 중입니다. 소속 학원 원장이 승인하면 모든 기능을 사용할 수 있어요.</Banner>
        </View>
      )}

      {!teacherPending && (
        <Group title={isMember ? '시작하기' : '내 활동'}>
          {items.map((it, i) => (
            <Row key={it.title} icon={it.icon} title={it.title} desc={it.desc} onPress={() => go(it.to)} last={i === items.length - 1} />
          ))}
        </Group>
      )}

      {!teacherPending && (canUseChat(profile.role) || canUseTeams(profile.role)) && (
        <Group title="소통">
          {canUseChat(profile.role) && (
            <Row
              icon="chatbubbles-outline"
              title="채팅"
              desc={isMember ? '스터디 팀 만들기 · 코드로 참가' : '공지방 · 반 채팅방 · 코드로 참가'}
              onPress={() => go('Chats')}
              last
            />
          )}
        </Group>
      )}

      <Group title="계정">
        <Row icon="create-outline" title="프로필 수정" desc="이름 · 연락처" onPress={() => go('ProfileEdit')} last />
      </Group>

      <Group title="고객 지원">
        <Row icon="file-tray-full-outline" title="내 문의 내역" onPress={() => go('MyInquiries')} />
        <Row icon="chatbox-ellipses-outline" title="도입 문의" onPress={() => go('Inquiry')} />
        <Row icon="rocket-outline" title="시작 가이드" onPress={() => go('StartGuide')} />
        {Platform.OS === 'web' && (
          <Row icon="desktop-outline" title="데스크톱 버전으로 보기" desc="컴퓨터용 웹 화면" onPress={() => Linking.openURL('https://safestep-kr.netlify.app/?site=desktop')} />
        )}
        <Row icon="sparkles-outline" title="앱 소개 다시 보기" desc="처음 실행할 때 나오는 안내 화면" onPress={() => navigation.navigate('Welcome', { replay: true })} last />
      </Group>

      <View style={{ marginTop: 32, alignItems: 'center', gap: 14 }}>
        <Pressable onPress={signOut} hitSlop={10} style={styles.logout}>
          <Icon name="log-out-outline" size={18} color={colors.textSub} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
        <Text style={styles.version}>SafeStep Mobile 1.0.0</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginBottom: 14 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 6 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  email: { fontSize: 13, color: colors.textMuted },
  affiliation: { fontSize: 13, fontWeight: '700', color: colors.primary },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: radius.lg, marginTop: 22, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.borderStrong },
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowDesc: { fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  rowRight: { fontSize: 13, color: colors.textMuted },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14 },
  logoutText: { fontSize: 14, fontWeight: '600', color: colors.textSub },
  version: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  preview: { marginBottom: 14, gap: 8 },
  previewLabel: { fontSize: 11, fontWeight: '800', color: colors.warnText },
  pChip: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pChipOn: { backgroundColor: colors.warnText },
  pChipText: { fontSize: 12, fontWeight: '700', color: colors.warnText },
  guestCard: { alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 24, paddingVertical: 30, paddingHorizontal: 22, marginTop: 4 },
  guestIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  guestTitle: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  guestSub: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
