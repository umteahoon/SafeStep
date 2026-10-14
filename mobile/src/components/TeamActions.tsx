import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { PREVIEW_MODE } from '../lib/useAuth';
import { Banner, Button, Card, Field, Input, Muted } from './ui';
import { colors } from '../theme';
import type { RootNav } from '../navigation/types';
import type { Team } from '../types';

type Panel = 'create' | 'join' | null;

/**
 * 채팅 목록 상단의 "참가 코드" / "팀 만들기" 버튼과 입력 패널.
 *  - 반 채팅방: 학원이 만들고, 학생이 반 코드를 입력해 들어옴
 *  - 팀 채팅방: 일반 회원이 스터디 모임으로 만들고 코드를 나눠 줌 (원장·강사·학생은 만들 수 없음)
 */
export function TeamActions({ canCreate }: { canCreate: boolean }) {
  // 팀을 만들 수 있는 사람 = 일반 회원(학원 미연동). 이들은 반 코드로 학원 채팅방에 들어올 수 없음
  const classCodeAllowed = !canCreate;
  const navigation = useNavigation<RootNav>();
  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const openPanel = (next: Panel) => {
    setPanel((p) => (p === next ? null : next));
    setError(null);
  };

  const createTeam = async () => {
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('create_team', {
      p_name: name.trim(),
      p_description: description.trim() || null,
    });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 채팅방을 만들지 못했습니다.');
      return;
    }
    setName('');
    setDescription('');
    setPanel(null);
    navigation.navigate('TeamRoom', { teamId: (data as Team).id });
  };

  const joinTeam = async () => {
    setError(null);
    setIsBusy(true);
    // 1) 반 채팅방 코드(학원이 발급) → 2) 팀 코드(일반 회원이 발급) 순서로 확인
    const room = classCodeAllowed ? await supabase.rpc('join_chat_room_by_code', { p_code: code }) : { data: null, error: null };
    if (!room.error && room.data) {
      setIsBusy(false);
      setCode('');
      setPanel(null);
      navigation.navigate('ChatRoom', { roomId: room.data as string });
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('join_team_by_code', { p_code: code });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(
        classCodeAllowed
          ? '유효하지 않은 코드예요. 코드를 다시 확인해 주세요.'
          : '유효하지 않은 코드예요. (반 코드는 학원에 연동한 뒤에 쓸 수 있어요)'
      );
      return;
    }
    setCode('');
    setPanel(null);
    navigation.navigate('TeamRoom', { teamId: data as string });
  };

  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button title="코드로 참가" variant={canCreate ? 'secondary' : 'indigo'} onPress={() => openPanel('join')} style={{ flex: 1 }} />
        {canCreate && <Button title="팀 만들기" variant="indigo" onPress={() => openPanel('create')} style={{ flex: 1 }} />}
      </View>

      {!panel && (
        <Muted style={{ marginBottom: 6 }}>
          반 채팅방은 학원에서 받은 반 코드, 팀 채팅방은 모임을 만든 친구에게 받은 코드를 입력해야 목록에 나타나요.
        </Muted>
      )}

      {panel === 'join' && (
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>참가 코드 입력</Text>
          <Muted style={{ marginBottom: 14, marginTop: 2 }}>
            학원에서 받은 반 코드 또는 친구에게 받은 팀 코드(8자리)를 입력하세요. 초대 링크를 받았다면 링크를 바로 여세요.
          </Muted>
          <Input
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AB12CD34"
            style={{ fontSize: 20, letterSpacing: 4, marginBottom: 14 }}
          />
          {PREVIEW_MODE && (
            <Muted style={{ marginBottom: 12 }}>
              미리보기용 코드 — 반: CLS3MATH (중3 수학 A) · CLS1ENGB (고1 영어 B) / 팀: ENGL1234 (영어 회화) · MATH2024 (수학 스터디)
            </Muted>
          )}
          <Button title="참가하기" variant="indigo" onPress={joinTeam} loading={isBusy} disabled={code.trim().length < 8} />
        </Card>
      )}

      {canCreate && panel === 'create' && (
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>스터디 팀 만들기</Text>
          <Muted style={{ marginBottom: 14, marginTop: 2 }}>
            만들면 참가 코드가 발급돼요. 같이 공부할 친구들에게 코드를 알려 주세요.
          </Muted>
          <Field label="팀 이름">
            <Input value={name} onChangeText={setName} maxLength={50} placeholder="예: 토익 900 스터디" />
          </Field>
          <Field label="설명 (선택)">
            <Input value={description} onChangeText={setDescription} maxLength={200} placeholder="채팅방 소개" />
          </Field>
          <Button title="만들기" variant="indigo" onPress={createTeam} loading={isBusy} disabled={!name.trim()} />
        </Card>
      )}

      <Banner kind="error">{error ?? undefined}</Banner>
    </View>
  );
}
