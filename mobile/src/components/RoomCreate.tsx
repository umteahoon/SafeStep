import { useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Banner, Button, Card, Field, Input, Muted } from './ui';
import { colors } from '../theme';

// 헷갈리는 문자(0/O, 1/I)를 뺀 참가 코드 글자
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const genRoomCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/**
 * 원장·강사용 "채팅방 만들기". 강사가 비밀번호를 정해 만들면, 학생은 그 비밀번호를 입력해 들어옵니다.
 * (반 코드 컬럼이 아직 없는 DB에서는 코드 없이 방만 만들어집니다.)
 */
export function RoomCreate({ academyId, onCreated }: { academyId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    const pw = password.trim();
    if (pw && (pw.length < 4 || pw.length > 20)) {
      setError('비밀번호는 4~20자로 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    const base = { academy_id: academyId, class_id: null, type: 'CLASS' as const, name: name.trim() };
    let res = await supabase.from('chat_rooms').insert({ ...base, join_code: pw || genRoomCode() });
    if (res.error && /join_code|column/i.test(res.error.message)) {
      // join_code 컬럼이 없는 DB: 비밀번호 없이 방만 생성
      res = await supabase.from('chat_rooms').insert(base);
    }
    setBusy(false);
    if (res.error) {
      setError(/duplicate|unique/i.test(res.error.message) ? '이미 쓰고 있는 비밀번호예요. 다른 비밀번호를 입력해 주세요.' : res.error.message);
      return;
    }
    setName('');
    setPassword('');
    setOpen(false);
    onCreated();
  };

  return (
    <View style={{ marginBottom: 6 }}>
      <Button
        title={open ? '닫기' : '채팅방 만들기'}
        variant={open ? 'secondary' : 'indigo'}
        onPress={() => {
          setOpen((v) => !v);
          setError(null);
        }}
      />
      {open && (
        <View style={{ marginTop: 10 }}>
          <Card>
            <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>새 채팅방</Text>
            <Muted style={{ marginBottom: 14, marginTop: 2 }}>
              비밀번호를 정해 두면, 비밀번호를 알려 준 학생만 이 채팅방에 들어올 수 있어요.
            </Muted>
            <Field label="채팅방 이름">
              <Input value={name} onChangeText={setName} maxLength={40} placeholder="예: 중3 수학 질문방" />
            </Field>
            <Field label="비밀번호 (4~20자, 비우면 자동 생성)">
              <Input value={password} onChangeText={setPassword} maxLength={20} autoCapitalize="characters" autoCorrect={false} placeholder="예: MATH2026" />
            </Field>
            <Button title="만들기" variant="indigo" onPress={create} loading={busy} disabled={!name.trim()} />
          </Card>
        </View>
      )}
      <Banner kind="error">{error ?? undefined}</Banner>
    </View>
  );
}
