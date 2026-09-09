import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Student } from '../../types';

export default function StudentQrPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setStudent((data as Student) ?? null);
        setIsLoading(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="내 출결 QR" subtitle="키오스크에 스캔하세요" />

      <div className="mx-auto max-w-sm p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : !student ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
            아직 학원에 학생으로 등록되지 않았습니다. 학원에 문의해주세요.
          </p>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <div className="mx-auto mb-4 w-fit rounded-xl bg-white p-4 shadow-sm">
              <QRCodeCanvas value={student.qr_token} size={220} />
            </div>
            <p className="text-lg font-bold text-gray-900">{student.name}</p>
            <p className="mt-1 text-sm text-gray-400">
              핀코드 입력 시:{' '}
              <span className="font-mono text-gray-700">
                {student.attendance_code}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
