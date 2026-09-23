import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { PageHeader } from '../../components/common/PageHeader';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Student } from '../../types';

export default function StudentQrPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const loadStudent = () => {
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
  };

  useEffect(loadStudent, [user]);

  const linkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setIsLinking(true);
    try {
      await apiFetch('/api/student-link/link', {
        method: 'POST',
        body: JSON.stringify({ linkCode }),
      });
      setLinkCode('');
      loadStudent();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : '연동에 실패했습니다.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="내 출결 QR" subtitle="키오스크에 스캔하세요" />

      <div className="mx-auto max-w-sm p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : !student ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="mb-4 text-sm text-gray-500">
              아직 학원 명부와 연동되지 않았습니다. 학원에서 발급받은 6자리 연동코드를
              입력해주세요.
            </p>
            <form onSubmit={linkStudent}>
              <input
                required
                inputMode="numeric"
                maxLength={6}
                value={linkCode}
                onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-indigo-500"
              />
              {linkError && (
                <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">
                  {linkError}
                </p>
              )}
              <button
                type="submit"
                disabled={isLinking || linkCode.length < 6}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLinking ? '연동 중...' : '연동하기'}
              </button>
            </form>
          </div>
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

        {student && (
          <Link
            to="/student/passes"
            className="mt-4 block rounded-xl border border-gray-200 bg-white p-4 text-center text-sm font-medium text-indigo-600 hover:border-indigo-300"
          >
            이용권 관리 →
          </Link>
        )}
      </div>
    </div>
  );
}
