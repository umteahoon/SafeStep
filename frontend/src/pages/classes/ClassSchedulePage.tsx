import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Class, ClassSchedule } from '../../types';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function ClassSchedulePage() {
  const { profile } = useAuth();
  const academyId = profile?.academy_id ?? null;

  const [classes, setClasses] = useState<Class[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [classId, setClassId] = useState('');
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('18:00');

  const load = useCallback(async () => {
    if (!academyId) return;
    setIsLoading(true);
    const { data: cls } = await supabase
      .from('classes')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at');
    const classList = (cls as Class[]) ?? [];
    setClasses(classList);
    if (classList.length && !classId) setClassId(classList[0].id);

    if (classList.length) {
      const { data: sch, error: schErr } = await supabase
        .from('class_schedules')
        .select('*')
        .in(
          'class_id',
          classList.map((c) => c.id)
        );
      setSchedules((sch as ClassSchedule[]) ?? []);
      setError(schErr?.message ?? null);
    } else {
      setSchedules([]);
    }
    setIsLoading(false);
  }, [academyId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    if (endTime <= startTime) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    const { error: insErr } = await supabase.from('class_schedules').insert({
      class_id: classId,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
    });
    if (insErr) return setError(insErr.message);
    await load();
  };

  const removeSlot = async (id: string) => {
    await supabase.from('class_schedules').delete().eq('id', id);
    await load();
  };

  const classById = (id: string) => classes.find((c) => c.id === id);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="주간 시간표"
        subtitle="반별 수업 시간 배정"
        backTo="/classes"
      />

      <div className="mx-auto max-w-4xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {classes.length === 0 ? (
          <p className="text-sm text-gray-400">
            먼저 <span className="font-medium">반 관리</span>에서 반을 생성해주세요.
          </p>
        ) : (
          <>
            <form
              onSubmit={addSlot}
              className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div>
                <label className="mb-1 block text-xs text-gray-400">반</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">요일</label>
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">시작</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">종료</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                추가
              </button>
            </form>

            {isLoading ? (
              <p className="text-sm text-gray-400">불러오는 중...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                {DAYS.map((d, i) => (
                  <div
                    key={d}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <p className="mb-2 text-center text-sm font-semibold text-gray-700">
                      {d}
                    </p>
                    <div className="space-y-2">
                      {schedules
                        .filter((s) => s.day_of_week === i)
                        .sort((a, b) => a.start_time.localeCompare(b.start_time))
                        .map((s) => {
                          const cls = classById(s.class_id);
                          return (
                            <div
                              key={s.id}
                              className="rounded-lg p-2 text-xs text-white"
                              style={{ backgroundColor: cls?.color_code ?? '#3B82F6' }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{cls?.name}</span>
                                <button
                                  onClick={() => removeSlot(s.id)}
                                  className="text-white/80 hover:text-white"
                                >
                                  ×
                                </button>
                              </div>
                              <span>
                                {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
