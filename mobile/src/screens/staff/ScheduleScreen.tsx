import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Chip, Icon, Empty, Field, Input, Loading, Muted, Screen, Select, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';
import type { Class, ClassSchedule } from '../../types';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function Inner() {
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
    const { data: cls } = await supabase
      .from('classes')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at');
    const classList = (cls as Class[]) ?? [];
    setClasses(classList);
    setClassId((cur) => cur || classList[0]?.id || '');

    if (classList.length) {
      const { data: sch, error: schErr } = await supabase
        .from('class_schedules')
        .select('*')
        .in('class_id', classList.map((c) => c.id));
      setSchedules((sch as ClassSchedule[]) ?? []);
      setError(schErr?.message ?? null);
    } else {
      setSchedules([]);
    }
    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const addSlot = async () => {
    if (!classId) return;
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      setError('시간은 24시간 형식 HH:MM 으로 입력해주세요. (예: 16:00)');
      return;
    }
    if (endTime <= startTime) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    setError(null);
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

  if (isLoading) return <Loading />;

  return (
    <Screen>
      <Banner kind="error">{error ?? undefined}</Banner>

      {classes.length === 0 ? (
        <Empty>먼저 반 관리에서 반을 생성해주세요.</Empty>
      ) : (
        <>
          <Card>
            <Field label="반">
              <Select value={classId} onChange={setClassId} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="요일">
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => (
                  <Chip key={d} label={d} selected={day === i} onPress={() => setDay(i)} />
                ))}
              </View>
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="시작 (HH:MM)">
                  <Input value={startTime} onChangeText={setStartTime} keyboardType="numbers-and-punctuation" maxLength={5} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="종료 (HH:MM)">
                  <Input value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" maxLength={5} />
                </Field>
              </View>
            </View>
            <Button title="추가" onPress={addSlot} />
          </Card>

          {DAYS.map((d, i) => {
            const slots = schedules
              .filter((s) => s.day_of_week === i)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));
            return (
              <View key={d}>
                <SectionTitle>{d}요일</SectionTitle>
                {slots.length === 0 ? (
                  <Muted style={{ marginBottom: 8 }}>수업 없음</Muted>
                ) : (
                  slots.map((s) => {
                    const cls = classById(s.class_id);
                    return (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: cls?.color_code ?? '#3B82F6',
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View>
                          <Text style={{ color: colors.white, fontWeight: '600', fontSize: 14 }}>{cls?.name}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                            {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          </Text>
                        </View>
                        <Pressable onPress={() => removeSlot(s.id)} hitSlop={10}>
                          <Icon name="close" size={22} color={colors.white} />
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

export default function ScheduleScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER']}>
      <Inner />
    </RequireRole>
  );
}
