import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Student } from '../../types';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function StudentManagementPage() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState(randomCode());
  const [parentPhone, setParentPhone] = useState('');

  const load = useCallback(async () => {
    if (!academyId) return;
    setIsLoading(true);
    const { data, error: e } = await supabase
      .from('students')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });
    setStudents((data as Student[]) ?? []);
    setError(e?.message ?? null);
    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyId) return;
    setError(null);
    const { error: insErr } = await supabase.from('students').insert({
      academy_id: academyId,
      name: name.trim(),
      attendance_code: code.trim(),
      parent_phone: parentPhone.trim() || '000-0000-0000',
    });
    if (insErr) {
      setError(
        insErr.message.includes('unique') || insErr.code === '23505'
          ? '이미 사용 중인 출결코드입니다. 다른 코드를 쓰세요.'
          : insErr.message
      );
      return;
    }
    setName('');
    setParentPhone('');
    setCode(randomCode());
    await load();
  };

  const removeStudent = async (id: string) => {
    if (!confirm('학생을 삭제하면 반 배정·출석 기록도 함께 삭제됩니다. 계속할까요?'))
      return;
    const { error: delErr } = await supabase.from('students').delete().eq('id', id);
    if (delErr) return setError(delErr.message);
    await load();
  };

  const toggleStatus = async (s: Student) => {
    const next = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await supabase.from('students').update({ status: next }).eq('id', s.id);
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="학생 관리"
        subtitle="학생 등록 · 출결코드 · 보호자 연동코드"
        backTo="/dashboard"
      />

      <div className="mx-auto max-w-3xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        <form
          onSubmit={addStudent}
          className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">이름</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">출결코드(6자리)</label>
            <div className="flex gap-1">
              <input
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-widest"
              />
              <button
                type="button"
                onClick={() => setCode(randomCode())}
                className="rounded-lg border border-gray-300 px-2 text-xs text-gray-500"
              >
                랜덤
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">보호자 연락처</label>
            <input
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            학생 추가
          </button>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
            학생 {students.length}명
          </h2>
          {isLoading ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : students.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">등록된 학생이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr>
                  <th className="px-4 py-2">이름</th>
                  <th className="px-4 py-2">출결코드</th>
                  <th className="px-4 py-2">보호자 연동코드</th>
                  <th className="px-4 py-2">보호자 연락처</th>
                  <th className="px-4 py-2">상태</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-2 font-mono text-gray-700">
                      {s.attendance_code}
                    </td>
                    <td className="px-4 py-2 font-mono text-blue-600">
                      {s.link_code}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{s.parent_phone}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleStatus(s)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {s.status === 'ACTIVE' ? '활동' : '중지'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeStudent(s.id)}
                        className="text-xs text-red-500"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          · 출결코드: 키오스크 핀 입력용 (학생에게 전달) · 보호자 연동코드: 학부모 앱에서 자녀 연동 시 입력
        </p>
      </div>
    </div>
  );
}
