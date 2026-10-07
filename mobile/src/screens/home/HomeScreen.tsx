import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { useNotifications } from '../../lib/notifications';
import { useLiveSeat } from '../../lib/liveSeat';
import { useFavorites } from '../../lib/favorites';
import { Avatar, Empty, Icon, Muted, Screen } from '../../components/ui';
import {
  CafeCard,
  FlatCard,
  HScroll,
  MiniStat,
  QuickGrid,
  SectionHeader,
  TimelineRow,
} from '../../components/home';
import type { QuickItem } from '../../components/home';
import { LiveSeatCard } from '../../components/study';
import GuestHome from './GuestHome';
import { CommunityTeaser } from '../../components/CommunityTeaser';
import { colors, radius } from '../../theme';
import type { RootNav, RootStackParamList, TabParamList } from '../../navigation/types';
import type { ChatMessage, StudentPass } from '../../types';

interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  empty: number;
  total: number;
}
interface TodayClass {
  id: string;
  time: string;
  title: string;
  sub: string;
  color: string;
}
interface Child {
  id: string;
  name: string;
}
interface ParentReport {
  attendanceRate: number | null;
  totalStudyMinutes: number;
}

// 아이콘 색 팔레트 (중립 타일 위에 얹는 포인트 색)
const T = {
  blue: '#2563EB',
  indigo: '#4F46E5',
  green: '#12A150',
  amber: '#D97706',
  red: '#E11D48',
  teal: '#0E9384',
  violet: '#7C3AED',
  gray: '#475467',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '늦은 밤이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '안녕하세요';
  return '좋은 저녁이에요';
}

export default function HomeScreen() {
  const navigation = useNavigation<RootNav>();
  const { user, profile, academyId, isMember } = useAuth();
  const role = user ? profile?.role : undefined;

  const { unread } = useNotifications();
  const live = useLiveSeat();
  const { favorites, recent, isFavorite, toggleFavorite } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [today, setToday] = useState<TodayClass[]>([]);
  const [notice, setNotice] = useState<ChatMessage | null>(null);
  const [pass, setPass] = useState<StudentPass | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [attendCount, setAttendCount] = useState<number | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [parentReport, setParentReport] = useState<ParentReport | null>(null);
  const [academyCount, setAcademyCount] = useState<number | null>(null);

  const go = (to: keyof RootStackParamList) => navigation.navigate(to as any);
  const goTab = (screen: keyof TabParamList) => navigation.navigate('Main', { screen });

  const load = useCallback(async () => {
    const dow = new Date().getDay();
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    // 공통: 지금 자리 있는 스터디카페
    const [{ data: ac }, { data: seats }] = await Promise.all([
      supabase.from('academies').select('*'),
      supabase.from('seats').select('academy_id, status'),
    ]);
    const list: Cafe[] = ((ac as any[]) ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      address: a.address,
      lat: a.latitude,
      lng: a.longitude,
      total: a.total_seats,
      empty: ((seats as any[]) ?? []).filter((s) => s.academy_id === a.id && s.status === 'EMPTY').length,
    }));
    list.sort((a, b) => b.empty - a.empty);
    setCafes(list);
    setAcademyCount(list.length);

    // 오늘의 수업을 만드는 헬퍼
    const buildToday = async (classIds: string[]) => {
      if (classIds.length === 0) return setToday([]);
      const [{ data: cls }, { data: sch }] = await Promise.all([
        supabase.from('classes').select('*').in('id', classIds),
        supabase.from('class_schedules').select('*').in('class_id', classIds),
      ]);
      const rows = ((sch as any[]) ?? [])
        .filter((s) => s.day_of_week === dow)
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
        .map((s) => {
          const c = ((cls as any[]) ?? []).find((x) => x.id === s.class_id);
          return {
            id: s.id,
            time: String(s.start_time).slice(0, 5),
            title: c?.name ?? '수업',
            sub: `${String(s.start_time).slice(0, 5)} - ${String(s.end_time).slice(0, 5)}`,
            color: c?.color_code ?? colors.primary,
          } as TodayClass;
        });
      setToday(rows);
    };

    // 최근 공지
    const loadNotice = async () => {
      const { data: room } = await supabase.from('chat_rooms').select('id').eq('type', 'ANNOUNCEMENT').maybeSingle();
      if (!room) return setNotice(null);
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles(name)')
        .eq('room_id', (room as any).id)
        .order('created_at', { ascending: false })
        .limit(1);
      setNotice(((msgs as ChatMessage[]) ?? [])[0] ?? null);
    };

    try {
      if (role === 'STUDENT' && user) {
        const { data: st } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
        if (st) {
          const { data: passes } = await supabase
            .from('student_passes')
            .select('*')
            .eq('student_id', (st as any).id)
            .order('created_at', { ascending: false });
          setPass(((passes as StudentPass[]) ?? []).find((p) => p.status === 'ACTIVE') ?? null);
          const { data: en } = await supabase.from('class_enrollments').select('class_id').eq('student_id', (st as any).id);
          await buildToday(((en as any[]) ?? []).map((e) => e.class_id));
        }
        await loadNotice();
      } else if ((role === 'ACADEMY_ADMIN' || role === 'TEACHER') && academyId) {
        const { data: cls } = await supabase.from('classes').select('id').eq('academy_id', academyId);
        await buildToday(((cls as any[]) ?? []).map((c) => c.id));
        const [{ data: sts }, { data: reps }, { data: recs }] = await Promise.all([
          supabase.from('students').select('id').eq('academy_id', academyId),
          supabase.from('seat_reports').select('id, resolved').eq('academy_id', academyId),
          supabase.from('class_attendance_records').select('id').eq('academy_id', academyId).eq('date', dateStr),
        ]);
        setStudentCount(((sts as any[]) ?? []).length);
        setReportCount(((reps as any[]) ?? []).filter((r) => !r.resolved).length);
        setAttendCount(((recs as any[]) ?? []).length);
        await loadNotice();
      } else if (role === 'PARENT') {
        const res = await apiFetch<{ data: Child[] }>('/api/parent/children');
        setChildren(res.data ?? []);
        if (res.data?.[0]) setParentReport(await apiFetch<ParentReport>(`/api/parent/report?studentId=${res.data[0].id}`));
      }
    } catch {
      /* 일부 데이터를 못 불러와도 홈은 계속 표시 */
    }
  }, [role, user, academyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), live.reload()]);
    setRefreshing(false);
  };

  // ── 역할별 바로가기 ────────────────────────────────
  const q = (label: string, icon: QuickItem['icon'], color: string, onPress: () => void, badge?: number): QuickItem => ({
    label,
    icon,
    color,
    onPress,
    badge,
  });

  let quick: QuickItem[];
  switch (role) {
    case 'STUDENT':
      quick = [
        q('내 QR', 'mc:qrcode-scan', T.blue, () => go('StudentQr')),
        q('체크인', 'mc:account-check', T.green, () => navigation.navigate('Kiosk', { academyId: academyId ?? undefined, self: true })),
        q('이용권', 'mc:ticket-confirmation', T.violet, () => go('StudentPasses')),
        q('집중 타이머', 'mc:timer-sand', T.red, () => go('FocusTimer')),
        q('시간표', 'mc:calendar-clock', T.amber, () => go('Timetable')),
        q('이용 내역', 'mc:history', T.indigo, () => go('History')),
        q('팀', 'mc:account-group', T.teal, () => go('Teams')),
        q('채팅', 'mc:chat-processing', T.blue, () => go('Chats')),
      ];
      break;
    case 'ACADEMY_ADMIN':
      quick = [
        q('대시보드', 'mc:view-dashboard', T.blue, () => go('Dashboard')),
        q('출석부', 'mc:clipboard-check', T.green, () => go('Attendance')),
        q('학생', 'mc:school', T.indigo, () => go('Students')),
        q('강사', 'mc:account-tie', T.teal, () => go('Teachers')),
        q('반·시간표', 'mc:calendar-month', T.amber, () => go('Classes')),
        q('신고 관제', 'mc:alert-octagon', T.red, () => go('Reports'), reportCount ?? 0),
        q('이용권 결제', 'mc:credit-card-check', T.violet, () => go('Billing')),
        q('키오스크', 'mc:qrcode-scan', T.blue, () => go('Kiosk')),
      ];
      break;
    case 'TEACHER':
      quick = [
        q('출석부', 'mc:clipboard-check', T.green, () => go('Attendance')),
        q('학생', 'mc:school', T.indigo, () => go('Students')),
        q('반·시간표', 'mc:calendar-month', T.amber, () => go('Classes')),
        q('신고 관제', 'mc:alert-octagon', T.red, () => go('Reports'), reportCount ?? 0),
        q('채팅', 'mc:chat-processing', T.blue, () => go('Chats')),
        q('팀', 'mc:account-group', T.indigo, () => go('Teams')),
        q('키오스크', 'mc:qrcode-scan', T.teal, () => go('Kiosk')),
        q('시간표', 'mc:calendar-clock', T.amber, () => go('Timetable')),
      ];
      break;
    case 'PARENT':
      quick = [
        q('출결 리포트', 'mc:chart-box', T.blue, () => go('ParentReport')),
        q('사전 신청', 'mc:calendar-edit', T.amber, () => go('ParentReport')),
        q('채팅', 'mc:chat-processing', T.indigo, () => go('Chats')),
      ];
      break;
    case 'SUPER_ADMIN':
      quick = [
        q('플랫폼 관리', 'mc:domain', T.blue, () => go('SuperAdmin')),
        q('접속 로그', 'mc:shield-lock', T.red, () => go('AdminLogs')),
        q('스터디카페', 'mc:map-marker-radius', T.teal, () => goTab('MapTab')),
      ];
      break;
    default:
      quick = [];
  }

  // 비로그인과 일반 회원(학생 계정이지만 명부 미연동)은 "스터디카페 탐색" 홈
  if (!role || isMember) {
    return <GuestHome cafes={cafes} refreshing={refreshing} onRefresh={onRefresh} memberName={isMember ? profile?.name : undefined} />;
  }

  const isStaff = role === 'ACADEMY_ADMIN' || role === 'TEACHER';
  // 스터디카페 목록은 이용자(학생)에게만 의미가 있음 — 운영진·학부모·관리자 홈은 업무 정보에 집중
  const showCafes = role === 'STUDENT';
  const firstAvailable = cafes.filter((c) => c.empty > 0);
  const cafeList = (firstAvailable.length ? firstAvailable : cafes).slice(0, 8);

  return (
    <Screen
      edges={['top', 'left', 'right']}
      backgroundColor={colors.white}
      contentStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 인사 */}
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{greeting()}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.name}님
          </Text>
        </View>
        <Pressable onPress={() => go('Notifications')} hitSlop={10} style={styles.iconBtn}>
          <Icon name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.text} />
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => goTab('MeTab')} hitSlop={8}>
          <Avatar name={profile?.name ?? ''} size={38} />
        </Pressable>
      </View>

      {showCafes && (
        <Pressable onPress={() => goTab('MapTab')} style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <Text style={styles.searchText}>지점명 또는 주소로 스터디카페 찾기</Text>
        </Pressable>
      )}

      {/* 지금 이용 중 (학생) */}
      {role === 'STUDENT' && live.seat && (
        <LiveSeatCard
          seat={live.seat}
          academyName={live.academyName}
          elapsedSec={live.elapsedSec}
          onPress={() => navigation.navigate('Kiosk', { academyId: live.seat!.academy_id, self: true })}
        />
      )}

      <QuickGrid items={quick} />

      {/* 학생: 이용권 */}
      {role === 'STUDENT' && (
        <>
          <SectionHeader title="내 이용권" action="관리" onAction={() => go('StudentPasses')} />
          <FlatCard onPress={() => go('StudentPasses')} style={styles.row}>
            <View style={[styles.passIcon, { backgroundColor: pass ? '#E9E5FF' : colors.graySoft }]}>
              <Icon name="mc:ticket-confirmation" size={24} color={pass ? T.violet : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              {pass ? (
                <>
                  <Text style={styles.cardTitle}>{pass.product_name}</Text>
                  <Muted>
                    {pass.pass_type === 'TIME'
                      ? `잔여 ${Math.floor((pass.remaining_minutes ?? 0) / 60)}시간 ${(pass.remaining_minutes ?? 0) % 60}분`
                      : `${pass.expires_at ? new Date(pass.expires_at).toLocaleDateString('ko-KR') : ''}까지`}
                  </Muted>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>이용 중인 이용권이 없어요</Text>
                  <Muted>이용권을 구매하면 키오스크에서 입실할 수 있어요</Muted>
                </>
              )}
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </FlatCard>
        </>
      )}

      {/* 운영진: 오늘 현황 */}
      {isStaff && (
        <>
          <SectionHeader title="오늘 현황" />
          <View style={styles.statGrid}>
            <MiniStat icon="mc:school" label="전체 학생" value={studentCount === null ? '—' : `${studentCount}명`} tint={T.indigo} onPress={() => go('Students')} />
            <MiniStat icon="mc:clipboard-check" label="오늘 출결 처리" value={attendCount === null ? '—' : `${attendCount}건`} tint={T.green} onPress={() => go('Attendance')} />
            <MiniStat icon="mc:calendar-month" label="오늘 수업" value={`${today.length}개`} tint={T.amber} onPress={() => go('Classes')} />
            <MiniStat icon="mc:alert-octagon" label="미처리 신고" value={reportCount === null ? '—' : `${reportCount}건`} tint={T.red} onPress={() => go('Reports')} />
          </View>
        </>
      )}

      {(role === 'STUDENT' || isStaff) && (
        <>
          <SectionHeader title="오늘의 수업" action={isStaff ? '시간표' : undefined} onAction={() => go('Classes')} />
          {today.length === 0 ? (
            <FlatCard>
              <Empty icon="calendar-outline">오늘은 예정된 수업이 없어요</Empty>
            </FlatCard>
          ) : (
            <View>
              {today.map((c, i) => (
                <TimelineRow key={c.id} time={c.time} title={c.title} sub={c.sub} color={c.color} last={i === today.length - 1} />
              ))}
            </View>
          )}
        </>
      )}

      {/* 학부모 */}
      {role === 'PARENT' && (
        <>
          <SectionHeader title="자녀 이번 주" action="리포트" onAction={() => go('ParentReport')} />
          {children.length === 0 ? (
            <FlatCard onPress={() => go('ParentReport')} style={{ alignItems: 'center', paddingVertical: 26 }}>
              <Text style={styles.cardTitle}>자녀를 연동해보세요</Text>
              <Muted style={{ marginTop: 4 }}>학원에서 받은 6자리 코드로 연동할 수 있어요</Muted>
            </FlatCard>
          ) : (
            <View style={styles.statGrid}>
              <MiniStat icon="mc:account-circle" label="자녀" value={children[0].name} tint={T.blue} onPress={() => go('ParentReport')} />
              <MiniStat
                icon="mc:chart-box"
                label="주간 출석률"
                value={parentReport?.attendanceRate == null ? '—' : `${parentReport.attendanceRate}%`}
                tint={T.green}
                onPress={() => go('ParentReport')}
              />
              <MiniStat
                icon="mc:timer-sand"
                label="주간 학습시간"
                value={parentReport ? `${Math.round((parentReport.totalStudyMinutes / 60) * 10) / 10}h` : '—'}
                tint={T.indigo}
                onPress={() => go('ParentReport')}
              />
            </View>
          )}
        </>
      )}

      {/* 슈퍼관리자 */}
      {role === 'SUPER_ADMIN' && (
        <>
          <SectionHeader title="플랫폼" action="관리" onAction={() => go('SuperAdmin')} />
          <View style={styles.statGrid}>
            <MiniStat icon="mc:domain" label="등록된 지점" value={academyCount === null ? '—' : `${academyCount}곳`} tint={T.blue} onPress={() => go('SuperAdmin')} />
          </View>
        </>
      )}

      {/* 최근 공지 */}
      {(role === 'STUDENT' || isStaff) && (
        <>
          <SectionHeader title="최근 공지" action="더보기" onAction={() => go('Chats')} />
          <FlatCard onPress={() => go('Chats')} style={styles.row}>
            <View style={styles.noticeIcon}>
              <Icon name="megaphone" size={20} color="#B54708" />
            </View>
            <View style={{ flex: 1 }}>
              {notice ? (
                <>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {notice.content}
                  </Text>
                  <Muted style={{ marginTop: 4 }}>
                    {notice.sender?.name ?? '관리자'} · {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                  </Muted>
                </>
              ) : (
                <Muted>아직 올라온 공지가 없어요</Muted>
              )}
            </View>
          </FlatCard>
        </>
      )}

      {/* 스터디카페 (학생) */}
      {showCafes && favorites.length > 0 && (
        <>
          <SectionHeader title="내 스터디카페" />
          <HScroll>
            {cafes
              .filter((c) => favorites.includes(c.id))
              .map((c) => (
                <CafeCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  address={c.address}
                  empty={c.empty}
                  total={c.total}
                  fav
                  onToggleFav={() => toggleFavorite(c.id)}
                  onPress={() => navigation.navigate('SeatFloorPlan', { academyId: c.id })}
                />
              ))}
          </HScroll>
        </>
      )}

      {showCafes && (
        <>
          <SectionHeader title={firstAvailable.length ? '지금 자리 있는 스터디카페' : '등록된 스터디카페'} action="전체 보기" onAction={() => goTab('MapTab')} />
          {cafeList.length === 0 ? (
            <FlatCard>
              <Empty icon="cafe-outline">아직 등록된 스터디카페가 없어요</Empty>
            </FlatCard>
          ) : (
            <HScroll>
              {cafeList.map((c) => (
                <CafeCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  address={c.address}
                  empty={c.empty}
                  total={c.total}
                  fav={isFavorite(c.id)}
                  onToggleFav={() => toggleFavorite(c.id)}
                  onPress={() => navigation.navigate('SeatFloorPlan', { academyId: c.id })}
                />
              ))}
            </HScroll>
          )}
        </>
      )}

      {showCafes && <CommunityTeaser />}

      {showCafes && recent.length > 0 && cafes.length > 0 && (
        <>
          <SectionHeader title="최근 본 스터디카페" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {recent
              .map((id) => cafes.find((c) => c.id === id))
              .filter((c): c is Cafe => !!c)
              .slice(0, 6)
              .map((c) => (
                <Pressable key={c.id} onPress={() => navigation.navigate('SeatFloorPlan', { academyId: c.id })} style={styles.recentChip}>
                  <Icon name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.recentText}>{c.name}</Text>
                </Pressable>
              ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 18, gap: 14 },
  hello: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.7, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 3, right: 1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  bellBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F5F8', borderRadius: radius.md, height: 50, paddingHorizontal: 16, marginBottom: 18 },
  searchText: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  passIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  noticeIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center' },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F5F8', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  recentText: { fontSize: 13, color: colors.textSub, fontWeight: '600' },
});
