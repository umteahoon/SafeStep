import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

/**
 * 팀/채팅처럼 학원 소속이 필요한 화면 앞단에서, 학생(STUDENT) 역할인데 아직
 * 학원 명부와 연동(students.user_id)되지 않은 계정은 /student/qr(연동 화면)로 보냅니다.
 * 다른 역할(원장/강사/학부모)은 그대로 통과합니다.
 */
export function RequireStudentLink() {
  const { user, profile } = useAuth();
  const [isLinked, setIsLinked] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== 'STUDENT') {
      setIsLinked(true);
      return;
    }
    let cancelled = false;
    setIsLinked(null);
    supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsLinked(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  if (isLinked === null) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        확인 중...
      </div>
    );
  }

  if (!isLinked) {
    return <Navigate to="/student/qr" replace />;
  }

  return <Outlet />;
}
