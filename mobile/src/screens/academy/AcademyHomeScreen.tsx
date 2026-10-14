import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { academyAccess, accessMessage, attendanceDesc, attendanceTarget, roomHint } from '../../lib/academyHub';
import { RoomCreate } from '../../components/RoomCreate';
import { Banner, Button, Empty, Icon, IconTile, Input, Loading, ModalCard, Screen, SectionTitle } from '../../components/ui';
import { colors, shadow } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { Academy } from '../../types';

interface RoomRow {
  id: string;
  name: string;
  type: 'CLASS' | 'ANNOUNCEMENT';
  joined: boolean;
}

/**
 * 학원 홈 — 한 화면에 출결(큰 버튼) · 공지방 · 채팅방 목록을 모아 보여줌.
 *  - 출결: 매일 쓰는 기능이라 맨 위에 크게. 학생은 출석 버튼 화면, 강사·원장은 출석부, 학부모는 리포트
 *  - 채팅방: 학원이 만든 방이 모두 보이고, 학생은 강사가 정한 비밀번호를 입력해야 입장
 *  - 내가 소속된 학원이 아니면 버튼은 보이되 눌렀을 때 이유를 안내
 */
export default function AcademyHomeScreen() {
  const navigation = useNavigation<RootNav>();
  const { academyId } = useRoute<RouteProp<RootStackParamList, 'AcademyHome'>>().params;
  const { user, profile, academyId: myAcademyId } = useAuth();
  const role = user ? profile?.role : undefined;
  const isStaff = role === 'ACADEMY_ADMIN' || role === 'TEACHER';
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // 비밀번호 입력 시트
  const [target, setTarget] = useState<RoomRow | null>(null);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const access = academyAccess(role, myAcademyId, academyId);
  const locked = access !== 'ok';

  useEffect(() => {
    let alive = true;
    supabase
      .from('academies')
      .select('*')
      .eq('id', academyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const a = data as Academy | null;
        setAcademy(a);
        setLoading(false);
        if (a) navigation.setOptions({ title: a.name });
      });
    return () => {
      alive = false;
    };
  }, [academyId, navigation]);

  const loadRooms = useCallback(async () => {
    if (access !== 'ok') return setRooms([]);
    // 직원은 공지방이 아직 없으면 바로 만들어 줌 (채팅 목록과 같은 동작)
    if (isStaff) {
      const { data: ann } = await supabase.from('chat_rooms').select('id').eq('academy_id', academyId).eq('type', 'ANNOUNCEMENT').limit(1).maybeSingle();
      if (!ann) await supabase.from('chat_rooms').insert({ academy_id: academyId, type: 'ANNOUNCEMENT', name: '전체 공지' });
    }
    const { data } = await supabase.rpc('list_academy_chat_rooms', { p_academy_id: academyId });
    setRooms(((data as RoomRow[]) ?? []).map((r) => ({ id: r.id, name: r.name, type: r.type, joined: !!r.joined })));
  }, [access, academyId, isStaff]);

  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms])
  );

  const guard = (go: () => void) => () => {
    setNotice(null);
    if (access === 'login') {
      navigation.navigate('Login', { next: { name: 'AcademyHome', params: { academyId } } });
      return;
    }
    if (access === 'link') {
      navigation.navigate('StudentQr');
      return;
    }
    if (locked) {
      setNotice(accessMessage(access));
      return;
    }
    go();
  };

  const openRoom = (r: RoomRow) =>
    guard(() => {
      if (r.joined || isStaff) navigation.navigate('ChatRoom', { roomId: r.id });
      else {
        setPassword('');
        setPwError(null);
        setTarget(r);
      }
    })();

  const submitPassword = async () => {
    if (!target) return;
    setJoining(true);
    setPwError(null);
    const { data, error } = await supabase.rpc('join_chat_room', { p_room_id: target.id, p_password: password.trim() });
    setJoining(false);
    if (error || !data) {
      setPwError(error?.message ?? '비밀번호가 맞지 않아요.');
      return;
    }
    const roomId = data as string;
    setTarget(null);
    loadRooms();
    navigation.navigate('ChatRoom', { roomId });
  };

  if (loading) return <Loading />;

  const announce = rooms.find((r) => r.type === 'ANNOUNCEMENT');
  const classRooms = rooms.filter((r) => r.type === 'CLASS');

  return (
    <Screen contentStyle={{ padding: 20, gap: 14 }}>
      <View style={styles.head}>
        <Text style={styles.name}>{academy?.name ?? '학원'}</Text>
        {!!academy?.address && (
          <View style={styles.addrRow}>
            <Icon name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.addr}>{academy.address}</Text>
          </View>
        )}
      </View>

      {locked && access !== 'login' && <Banner kind="info">{accessMessage(access)}</Banner>}
      <Banner kind="warn">{notice ?? undefined}</Banner>

      {/* 출결 — 가장 자주 쓰므로 맨 위에 크게 */}
      <Pressable
        onPress={guard(() => navigation.navigate(attendanceTarget(role) as any))}
        accessibilityLabel="출결"
        style={({ pressed }) => [styles.attend, locked && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
      >
        <Icon name="checkmark-done-circle" size={44} color={colors.white} />
        <View style={{ flex: 1 }}>
          <Text style={styles.attendTitle}>출결</Text>
          <Text style={styles.attendDesc}>{attendanceDesc(role)}</Text>
        </View>
        <Icon name={locked ? 'lock-closed-outline' : 'chevron-forward'} size={22} color={colors.white} />
      </Pressable>

      {/* 공지방 */}
      <Pressable
        onPress={() => (announce ? openRoom(announce) : guard(() => setNotice('공지방이 아직 만들어지지 않았어요'))())}
        accessibilityLabel="공지방"
        style={({ pressed }) => [styles.row, locked && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}
      >
        <IconTile name="megaphone" size={46} color={colors.warnText} bg={colors.warnSoft} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>공지방</Text>
          <Text style={styles.rowDesc}>학원 전체 공지를 확인해요</Text>
        </View>
        <Icon name={locked ? 'lock-closed-outline' : 'chevron-forward'} size={18} color={colors.textMuted} />
      </Pressable>

      {/* 채팅방 목록 */}
      <SectionTitle>채팅방</SectionTitle>
      {locked ? (
        <Pressable
          onPress={guard(() => undefined)}
          accessibilityLabel="채팅방"
          style={({ pressed }) => [styles.row, { opacity: 0.55 }, pressed && { opacity: 0.8 }]}
        >
          <IconTile name="chatbubbles" size={46} color={colors.primary} bg={colors.primarySoft} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>채팅방</Text>
            <Text style={styles.rowDesc}>소속 학원의 반별 채팅방</Text>
          </View>
          <Icon name="lock-closed-outline" size={18} color={colors.textMuted} />
        </Pressable>
      ) : classRooms.length === 0 ? (
        <Empty icon="chatbubbles-outline">{isStaff ? '아직 만든 채팅방이 없어요. 아래에서 만들어 보세요' : '아직 만들어진 채팅방이 없어요'}</Empty>
      ) : (
        classRooms.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => openRoom(r)}
            accessibilityLabel={`채팅방 ${r.name}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <IconTile name="chatbubbles" size={46} color={colors.primary} bg={colors.primarySoft} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.rowDesc}>{roomHint(r.joined, isStaff)}</Text>
            </View>
            <Icon name={r.joined || isStaff ? 'chevron-forward' : 'lock-closed'} size={18} color={colors.textMuted} />
          </Pressable>
        ))
      )}

      {/* 강사·원장: 비밀번호를 정해 채팅방 만들기 */}
      {isStaff && !locked && <RoomCreate academyId={academyId} onCreated={loadRooms} />}

      <ModalCard visible={!!target} onClose={() => setTarget(null)}>
        <Text style={styles.modalTitle}>{target?.name}</Text>
        <Text style={styles.modalDesc}>강사님께 받은 비밀번호를 입력해 주세요</Text>
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          autoCapitalize="characters"
          autoCorrect={false}
          style={{ marginTop: 12 }}
        />
        <Banner kind="error">{pwError ?? undefined}</Banner>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button title="취소" variant="secondary" onPress={() => setTarget(null)} style={{ flex: 1 }} />
          <Button title="입장하기" onPress={submitPassword} loading={joining} disabled={!password.trim()} style={{ flex: 1 }} />
        </View>
      </ModalCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 6, paddingBottom: 6 },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addr: { fontSize: 13, color: colors.textMuted },
  attend: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primary, borderRadius: 24, paddingVertical: 26, paddingHorizontal: 20, ...shadow },
  attendTitle: { fontSize: 24, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  attendDesc: { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 18, padding: 14, ...shadow },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowDesc: { fontSize: 12.5, color: colors.textSub, marginTop: 2 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalDesc: { fontSize: 13, color: colors.textSub, marginTop: 4 },
});
