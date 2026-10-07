import { useCallback, useEffect, useReducer, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { getJSON, setJSON } from './storage';
import { formatMinutes } from './studyStats';
import { useAuth } from './useAuth';
import type { IconName } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

export interface NotificationItem {
  id: string;
  icon: IconName;
  tint: string;
  bg: string;
  title: string;
  desc: string;
  at: string; // ISO
  to?: keyof RootStackParamList;
}

const SEEN_KEY = 'safestep:notif-seen';
let seenAt = 0;
let seenLoaded = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

const STATUS_LABEL: Record<string, string> = { PRESENT: '출석', LATE: '지각', ABSENT: '결석', EXCUSED: '사유결석' };
const STATUS_STYLE: Record<string, { icon: IconName; tint: string; bg: string }> = {
  PRESENT: { icon: 'checkmark-circle', tint: '#12A150', bg: '#E6F7EE' },
  LATE: { icon: 'time', tint: '#B54708', bg: '#FFF4DB' },
  ABSENT: { icon: 'close-circle', tint: '#D92D20', bg: '#FEECEC' },
  EXCUSED: { icon: 'information-circle', tint: '#475467', bg: '#F0F2F5' },
};

/** 앱 안에서 모은 알림 목록을 만듭니다 (서버 푸시가 아니라 기존 데이터를 모아서 보여줌). */
export async function buildNotifications(opts: {
  role?: string;
  userId?: string;
  academyId?: string | null;
}): Promise<NotificationItem[]> {
  const { role, userId, academyId } = opts;
  const items: NotificationItem[] = [];
  if (!role || !userId) return items;

  // 공지 (직원·학생·학부모 공통)
  if (['STUDENT', 'ACADEMY_ADMIN', 'TEACHER', 'PARENT'].includes(role)) {
    const { data: room } = await supabase.from('chat_rooms').select('id').eq('type', 'ANNOUNCEMENT').maybeSingle();
    if (room) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles(name)')
        .eq('room_id', (room as any).id)
        .order('created_at', { ascending: false })
        .limit(5);
      for (const m of (msgs as any[]) ?? []) {
        items.push({
          id: `ann-${m.id}`,
          icon: 'megaphone',
          tint: '#B54708',
          bg: '#FFF4DB',
          title: '새 공지',
          desc: String(m.content ?? ''),
          at: m.created_at,
        });
      }
    }
  }

  if (role === 'STUDENT') {
    const { data: st } = await supabase.from('students').select('id').eq('user_id', userId).maybeSingle();
    if (st) {
      const sid = (st as any).id;
      // 출결 처리 결과
      const { data: recs } = await supabase.from('class_attendance_records').select('*').eq('student_id', sid);
      const classIds = [...new Set(((recs as any[]) ?? []).map((r) => r.class_id))];
      const { data: cls } = classIds.length
        ? await supabase.from('classes').select('id, name').in('id', classIds)
        : { data: [] as any[] };
      for (const r of (recs as any[]) ?? []) {
        const st2 = STATUS_STYLE[r.status] ?? STATUS_STYLE.PRESENT;
        const cname = ((cls as any[]) ?? []).find((c) => c.id === r.class_id)?.name ?? '수업';
        items.push({
          id: `att-${r.id}`,
          icon: st2.icon,
          tint: st2.tint,
          bg: st2.bg,
          title: `${cname} ${STATUS_LABEL[r.status] ?? r.status} 처리`,
          desc: r.reason ? `사유: ${r.reason}` : String(r.date),
          at: r.recorded_at ?? `${r.date}T09:00:00`,
        });
      }
      // 이용권 만료/소진 임박
      const { data: passes } = await supabase.from('student_passes').select('*').eq('student_id', sid);
      for (const p of (passes as any[]) ?? []) {
        if (p.status !== 'ACTIVE') continue;
        if (p.pass_type === 'PERIOD' && p.expires_at) {
          const days = Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / 86400_000);
          if (days <= 7)
            items.push({
              id: `pass-exp-${p.id}`,
              icon: 'alarm',
              tint: '#D92D20',
              bg: '#FEECEC',
              title: `${p.product_name} 만료 D-${Math.max(days, 0)}`,
              desc: '기간이 끝나기 전에 이용권을 갱신하세요',
              at: new Date().toISOString(),
              to: 'StudentPasses',
            });
        }
        if (p.pass_type === 'TIME' && (p.remaining_minutes ?? 0) < 120)
          items.push({
            id: `pass-left-${p.id}`,
            icon: 'hourglass',
            tint: '#B54708',
            bg: '#FFF4DB',
            title: `${p.product_name} 잔여 ${formatMinutes(p.remaining_minutes ?? 0)}`,
            desc: '시간이 얼마 남지 않았어요',
            at: new Date().toISOString(),
            to: 'StudentPasses',
          });
      }
    }
  }

  if ((role === 'ACADEMY_ADMIN' || role === 'TEACHER') && academyId) {
    const { data: reps } = await supabase.from('seat_reports').select('*').eq('academy_id', academyId);
    const open = ((reps as any[]) ?? []).filter((r) => !r.resolved);
    if (open.length > 0)
      items.push({
        id: 'reports-open',
        icon: 'flag',
        tint: '#D92D20',
        bg: '#FEECEC',
        title: `미처리 신고 ${open.length}건`,
        desc: '소음·자리 독점 신고를 확인해주세요',
        at: open[0].created_at ?? new Date().toISOString(),
        to: 'Reports',
      });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** 알림 목록 + 읽지 않은 개수. 화면이 포커스될 때마다 갱신 */
export function useNotifications() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    subs.add(force);
    if (!seenLoaded) {
      seenLoaded = true;
      getJSON<number>(SEEN_KEY, 0).then((v) => {
        seenAt = v;
        notify();
      });
    }
    return () => {
      subs.delete(force);
    };
  }, []);

  const role = user ? profile?.role : undefined;
  const userId = user?.id;
  const academyId = profile?.academy_id ?? null;

  const refresh = useCallback(async () => {
    try {
      setItems(await buildNotifications({ role, userId, academyId }));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [role, userId, academyId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const unread = items.filter((i) => new Date(i.at).getTime() > seenAt).length;
  const markAllSeen = () => {
    seenAt = Date.now();
    setJSON(SEEN_KEY, seenAt);
    notify();
  };

  return { items, loading, unread, refresh, markAllSeen, seenAt };
}
