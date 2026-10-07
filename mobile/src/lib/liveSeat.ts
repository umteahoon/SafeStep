import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { useAuth } from './useAuth';
import type { Seat } from '../types';

/**
 * 내가 지금 이용 중인 좌석과 경과 시간.
 * - 학생 본인(students.user_id)의 id 로 seats.current_student_id 를 조회
 * - 이용 중이면 1초마다 경과 시간 갱신 (입실 시각 = seats.occupied_at)
 */
export function useLiveSeat() {
  const { user, profile } = useAuth();
  const isStudent = !!user && profile?.role === 'STUDENT';
  const [studentId, setStudentId] = useState<string | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [academyName, setAcademyName] = useState<string>('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!isStudent || !user) {
      setSeat(null);
      return;
    }
    const { data: st } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
    if (!st) return setSeat(null);
    const sid = (st as any).id as string;
    setStudentId(sid);
    const { data: mine } = await supabase.from('seats').select('*').eq('current_student_id', sid).maybeSingle();
    const s = (mine as Seat | null) ?? null;
    setSeat(s);
    if (s) {
      const { data: ac } = await supabase.from('academies').select('name').eq('id', s.academy_id).maybeSingle();
      setAcademyName((ac as any)?.name ?? '');
    }
  }, [isStudent, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 이용 중일 때만 1초 틱
  useEffect(() => {
    if (!seat) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [seat]);

  const elapsedSec = seat?.occupied_at ? Math.max(0, Math.floor((now - new Date(seat.occupied_at).getTime()) / 1000)) : 0;

  return { studentId, seat, academyName, elapsedSec, reload: load };
}
