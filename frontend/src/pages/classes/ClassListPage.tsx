import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Class, ClassEnrollment, Student } from '../../types';

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function ClassListPage() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [teacherId, setTeacherId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!academyId) return;
    setIsLoading(true);
    const [c, s, e, t] = await Promise.all([
      supabase.from('classes').select('*').eq('academy_id', academyId).order('created_at'),
      supabase.from('students').select('*').eq('academy_id', academyId).order('name'),
      supabase.from('class_enrollments').select('*'),
      supabase
        .from('profiles')
        .select('id, name')
        .eq('academy_id', academyId)
        .in('role', ['ACADEMY_ADMIN', 'TEACHER'])
        .eq('approval_status', 'APPROVED'),
    ]);
    setClasses((c.data as Class[]) ?? []);
    setStudents((s.data as Student[]) ?? []);
    setEnrollments((e.data as ClassEnrollment[]) ?? []);
    setTeachers((t.data as { id: string; name: string }[]) ?? []);
    setError(c.error?.message ?? s.error?.message ?? e.error?.message ?? null);
    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const createClass = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!academyId || !name.trim()) return;
    const { error: insertError } = await supabase.from('classes').insert({
      academy_id: academyId,
      name: name.trim(),
      color_code: color,
      teacher_id: teacherId || null,
    });
    if (insertError) return setError(insertError.message);
    setName('');
    setTeacherId('');
    await load();
  };

  const removeClass = async (id: string) => {
    if (!confirm('이 반을 삭제하면 시간표·수강생·출석 기록도 함께 삭제됩니다. 계속할까요?'))
      return;
    const { error: delError } = await supabase.from('classes').delete().eq('id', id);
    if (delError) return setError(delError.message);
    await load();
  };

  const toggleEnrollment = async (classId: string, studentId: string) => {
    const existing = enrollments.find(
      (en) => en.class_id === classId && en.student_id === studentId
    );
    if (existing) {
      await supabase.from('class_enrollments').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('class_enrollments')
        .insert({ class_id: classId, student_id: studentId });
    }
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="반 관리"
        subtitle="반 생성 · 수강생 배정"
        backTo="/dashboard"
        right={
          <Link
            to="/classes/schedule"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            주간 시간표
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        <form
          onSubmit={createClass}
          className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">반 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="예: 중3 수학 A"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">담당 강사</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">미지정</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">색상</label>
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-full ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-900' : ''
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            반 추가
          </button>
        </form>

        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 반이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {classes.map((cls) => {
              const enrolledIds = enrollments
                .filter((en) => en.class_id === cls.id)
                .map((en) => en.student_id);
              return (
                <li
                  key={cls.id}
                  className="rounded-xl border border-gray-200 bg-white"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: cls.color_code }}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{cls.name}</p>
                        <p className="text-xs text-gray-400">
                          담당:{' '}
                          {teachers.find((t) => t.id === cls.teacher_id)?.name ??
                            '미지정'}{' '}
                          · 수강생 {enrolledIds.length}명
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === cls.id ? null : cls.id)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                      >
                        수강생
                      </button>
                      <button
                        onClick={() => removeClass(cls.id)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-red-500"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {expandedId === cls.id && (
                    <div className="border-t border-gray-100 p-4">
                      {students.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          학생이 없습니다. 학생은 키오스크/회원가입으로 등록됩니다.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {students.map((st) => {
                            const on = enrolledIds.includes(st.id);
                            return (
                              <button
                                key={st.id}
                                onClick={() => toggleEnrollment(cls.id, st.id)}
                                className={`rounded-full border px-3 py-1 text-sm ${
                                  on
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-500'
                                }`}
                              >
                                {st.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
