import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { confirmAsync } from '../../lib/confirm';
import { RequireRole } from '../../components/Guard';
import { Badge, Banner, Button, Card, Empty, Field, Input, Loading, Muted, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';
import type { Student } from '../../types';

const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

function Inner() {
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

  const addStudent = async () => {
    if (!academyId || !name.trim()) return;
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
    if (!(await confirmAsync('학생을 삭제할까요?', '반 배정·출석 기록도 함께 삭제됩니다.', '삭제'))) return;
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
    <Screen>
      <Banner kind="error">{error ?? undefined}</Banner>

      <Card>
        <Field label="이름">
          <Input value={name} onChangeText={setName} />
        </Field>
        <Field label="출결코드 (6자리)">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              style={{ flex: 1, letterSpacing: 3 }}
            />
            <Button title="랜덤" variant="secondary" small onPress={() => setCode(randomCode())} />
          </View>
        </Field>
        <Field label="보호자 연락처">
          <Input value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" placeholder="010-0000-0000" />
        </Field>
        <Button title="학생 추가" onPress={addStudent} disabled={!name.trim() || code.length < 4} />
      </Card>

      <SectionTitle>학생 {students.length}명</SectionTitle>
      {isLoading ? (
        <Loading />
      ) : students.length === 0 ? (
        <Empty>등록된 학생이 없습니다.</Empty>
      ) : (
        students.map((s) => (
          <Card key={s.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{s.name}</Text>
              <Badge
                text={s.user_id ? '계정 연동됨' : '미연동'}
                bg={s.user_id ? colors.indigoSoft : colors.graySoft}
                fg={s.user_id ? colors.indigo : colors.textMuted}
              />
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => toggleStatus(s)}>
                <Badge
                  text={s.status === 'ACTIVE' ? '활동' : '중지'}
                  bg={s.status === 'ACTIVE' ? colors.successSoft : colors.graySoft}
                  fg={s.status === 'ACTIVE' ? colors.success : colors.textMuted}
                />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSub }}>
              출결코드 <Text style={{ fontFamily: 'Courier', color: colors.text }}>{s.attendance_code}</Text>
              {'  '}연동코드 <Text style={{ fontFamily: 'Courier', color: colors.primary }}>{s.link_code}</Text>
            </Text>
            <Muted>보호자 {s.parent_phone}</Muted>
            <Text style={{ color: colors.danger, fontSize: 13, marginTop: 8, alignSelf: 'flex-end' }} onPress={() => removeStudent(s.id)}>
              삭제
            </Text>
          </Card>
        ))
      )}

      <Muted style={{ lineHeight: 18, marginTop: 4 }}>
        · 출결코드: 키오스크 핀 입력용 (학생에게 전달){'\n'}· 연동코드: 학생 본인 계정 연동 또는 학부모 앱에서 자녀
        연동 시 입력 (동일 코드)
      </Muted>
    </Screen>
  );
}

export default function StudentsScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER']}>
      <Inner />
    </RequireRole>
  );
}
