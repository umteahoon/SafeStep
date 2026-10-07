import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { confirmAsync } from '../../lib/confirm';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Card, Chip, Empty, Field, Input, Loading, Muted, Screen, Select, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { Class, ClassEnrollment, Student } from '../../types';

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

function Inner() {
  const navigation = useNavigation<RootNav>();
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

  const createClass = async () => {
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
    if (!(await confirmAsync('이 반을 삭제할까요?', '시간표·수강생·출석 기록도 함께 삭제됩니다.', '삭제'))) return;
    const { error: delError } = await supabase.from('classes').delete().eq('id', id);
    if (delError) return setError(delError.message);
    await load();
  };

  const toggleEnrollment = async (classId: string, studentId: string) => {
    const existing = enrollments.find((en) => en.class_id === classId && en.student_id === studentId);
    if (existing) {
      await supabase.from('class_enrollments').delete().eq('id', existing.id);
    } else {
      await supabase.from('class_enrollments').insert({ class_id: classId, student_id: studentId });
    }
    await load();
  };

  return (
    <Screen>
      <Button title="주간 시간표" icon="calendar-outline" variant="secondary" onPress={() => navigation.navigate('Schedule')} style={{ marginBottom: 12 }} />
      <Banner kind="error">{error ?? undefined}</Banner>

      <Card>
        <Field label="반 이름">
          <Input value={name} onChangeText={setName} placeholder="예: 중3 수학 A" />
        </Field>
        <Field label="담당 강사">
          <Select
            value={teacherId}
            onChange={setTeacherId}
            options={[{ value: '', label: '미지정' }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]}
            placeholder="미지정"
          />
        </Field>
        <Field label="색상">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: colors.dark,
                }}
              />
            ))}
          </View>
        </Field>
        <Button title="반 추가" onPress={createClass} disabled={!name.trim()} />
      </Card>

      <SectionTitle>반 목록</SectionTitle>
      {isLoading ? (
        <Loading />
      ) : classes.length === 0 ? (
        <Empty>등록된 반이 없습니다.</Empty>
      ) : (
        classes.map((cls) => {
          const enrolledIds = enrollments.filter((en) => en.class_id === cls.id).map((en) => en.student_id);
          return (
            <Card key={cls.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: cls.color_code }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{cls.name}</Text>
                  <Muted>
                    담당: {teachers.find((t) => t.id === cls.teacher_id)?.name ?? '미지정'} · 수강생 {enrolledIds.length}명
                  </Muted>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button
                  title={expandedId === cls.id ? '수강생 닫기' : '수강생'}
                  variant="secondary"
                  small
                  style={{ flex: 1 }}
                  onPress={() => setExpandedId(expandedId === cls.id ? null : cls.id)}
                />
                <Button title="삭제" variant="secondary" small onPress={() => removeClass(cls.id)} />
              </View>

              {expandedId === cls.id && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.graySoft, paddingTop: 12 }}>
                  {students.length === 0 ? (
                    <Muted>학생이 없습니다. 학생 관리에서 먼저 등록하세요.</Muted>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {students.map((st) => (
                        <Chip
                          key={st.id}
                          label={st.name}
                          selected={enrolledIds.includes(st.id)}
                          onPress={() => toggleEnrollment(cls.id, st.id)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

export default function ClassesScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER']}>
      <Inner />
    </RequireRole>
  );
}
