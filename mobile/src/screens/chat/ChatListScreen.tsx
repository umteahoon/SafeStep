import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { TeamActions } from '../../components/TeamActions';
import { RoomCreate, genRoomCode } from '../../components/RoomCreate';
import { canUseTeams } from '../../lib/teams';
import * as Clipboard from 'expo-clipboard';
import { Banner, Empty, Icon, IconTile, Loading } from '../../components/ui';
import { confirmAsync } from '../../lib/confirm';
import { colors, shadow } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { ChatMessage, ChatRoom, ChatRoomRead, Class, Team } from '../../types';

interface MyTeamRow {
  role: 'OWNER' | 'MEMBER';
  teams: Team | null;
}

function previewText(m: ChatMessage): string {
  if (m.type === 'ATTENDANCE_CHECK') return '출석체크가 시작되었습니다.';
  if (m.type === 'ATTENDANCE_RESPONSE') return m.content ?? '';
  if (m.type === 'IMAGE') return `${m.sender?.name ? `${m.sender.name}: ` : ''}사진을 보냈습니다.`;
  const sender = m.sender?.name ? `${m.sender.name}: ` : '';
  return `${sender}${m.content ?? ''}`;
}

function previewTime(dateStr: string): string {
  const d = new Date(dateStr);
  return isToday(d) ? format(d, 'a h:mm', { locale: ko }) : format(d, 'M/d');
}

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { user, profile, isMember } = useAuth();
  const academyId = profile?.academy_id ?? null;
  const isStaff = profile?.role === 'ACADEMY_ADMIN' || profile?.role === 'TEACHER';

  const canTeam = canUseTeams(profile?.role);
  const [teams, setTeams] = useState<MyTeamRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, ChatMessage>>({});
  const [lastRead, setLastRead] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    // 직원이면 공지방/반 채팅방이 아직 없는 경우 자동으로 채워 넣음
    if (isStaff && academyId) {
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('id, class_id, type')
        .eq('academy_id', academyId);

      if (!(existing ?? []).some((r) => r.type === 'ANNOUNCEMENT')) {
        await supabase
          .from('chat_rooms')
          .insert({ academy_id: academyId, type: 'ANNOUNCEMENT', name: '전체 공지' });
      }

      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('academy_id', academyId);
      const existingClassIds = new Set((existing ?? []).filter((r) => r.class_id).map((r) => r.class_id));
      const missing = ((classes as Class[]) ?? []).filter((c) => !existingClassIds.has(c.id));
      if (missing.length > 0) {
        const rows = missing.map((c) => ({
          academy_id: academyId,
          class_id: c.id,
          type: 'CLASS' as const,
          name: c.name,
        }));
        // 반 코드와 함께 만들고, 코드 컬럼이 없는 DB에서는 코드 없이 만듦
        const withCode = await supabase.from('chat_rooms').insert(rows.map((r) => ({ ...r, join_code: genRoomCode() })));
        if (withCode.error) await supabase.from('chat_rooms').insert(rows);
      }
    }

    // 일반 회원(학원 미연동)은 학원 공지·채팅방을 볼 수 없음 — 학원에 연동하면 보임
    if (isMember) {
      setRooms([]);
      setLastMessages({});
      if (canTeam && user) {
        const { data: tm } = await supabase
          .from('team_members')
          .select('role, teams(*)')
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false });
        setTeams(((tm as unknown as MyTeamRow[]) ?? []).filter((t) => t.teams));
      }
      setIsLoading(false);
      return;
    }

    const { data, error: e } = await supabase.from('chat_rooms').select('*');
    let roomList = (data as ChatRoom[]) ?? [];
    setError(e?.message ?? null);

    // 학생·학부모는 반 코드를 입력해 참가한 반 채팅방만 보임 (공지방은 학원 전체).
    // 참가 기록 테이블이 없는 DB에서는 기존처럼 서버가 주는 목록을 그대로 사용
    if (!isStaff && user) {
      const { data: joined, error: joinErr } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', user.id);
      if (!joinErr) {
        const ids = new Set(((joined as { room_id: string }[]) ?? []).map((m) => m.room_id));
        roomList = roomList.filter((r) => r.type === 'ANNOUNCEMENT' || ids.has(r.id));
      }
    }

    if (roomList.length > 0) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles(name)')
        .in('room_id', roomList.map((r) => r.id))
        .order('created_at', { ascending: false });

      const latestByRoom: Record<string, ChatMessage> = {};
      for (const m of (msgs as ChatMessage[]) ?? []) {
        if (!latestByRoom[m.room_id]) latestByRoom[m.room_id] = m;
      }
      setLastMessages(latestByRoom);

      if (user) {
        const { data: reads } = await supabase
          .from('chat_room_reads')
          .select('room_id, last_read_at')
          .eq('user_id', user.id);
        setLastRead(
          Object.fromEntries(((reads as ChatRoomRead[]) ?? []).map((r) => [r.room_id, r.last_read_at]))
        );
      }

      // 최근 활동순 정렬 (메시지 없는 방은 뒤로, 그 안에서는 공지 먼저)
      roomList.sort((a, b) => {
        const at = latestByRoom[a.id]?.created_at;
        const bt = latestByRoom[b.id]?.created_at;
        if (at && bt) return new Date(bt).getTime() - new Date(at).getTime();
        if (at) return -1;
        if (bt) return 1;
        return a.type === b.type ? 0 : a.type === 'ANNOUNCEMENT' ? -1 : 1;
      });
    }

    setRooms(roomList);

    // 내가 참가한 팀 채팅방 (참가 코드로 들어온 방)
    if (canTeam && user) {
      const { data: tm } = await supabase
        .from('team_members')
        .select('role, teams(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });
      setTeams(((tm as unknown as MyTeamRow[]) ?? []).filter((t) => t.teams));
    }
    setIsLoading(false);
  }, [academyId, isStaff, user, canTeam, isMember]);

  const copyCode = async (room: ChatRoom) => {
    if (!room.join_code) return;
    try {
      await Clipboard.setStringAsync(room.join_code);
      flash(`반 코드 ${room.join_code}를 복사했어요`);
    } catch {
      flash('복사하지 못했어요. 코드를 길게 눌러 직접 복사해 주세요.');
    }
  };

  // 직접 만든 채팅방(반에 연결되지 않은 방)만 삭제할 수 있음 — 반에 연결된 방은 반 관리에서 함께 관리됨
  const canDelete = (room: ChatRoom) => isStaff && room.type === 'CLASS' && !room.class_id;
  const deleteRoom = async (room: ChatRoom) => {
    const ok = await confirmAsync(
      `'${room.name}' 채팅방을 삭제할까요?`,
      '대화 내용과 참가 기록이 모두 사라지고 되돌릴 수 없어요.',
      '삭제'
    );
    if (!ok) return;
    const { error: delErr } = await supabase.from('chat_rooms').delete().eq('id', room.id);
    if (delErr) {
      flash(`삭제하지 못했어요: ${delErr.message}`);
      return;
    }
    flash('채팅방을 삭제했어요');
    load();
  };

  // 방에서 돌아올 때마다 안읽음 표시를 갱신
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
    <FlatList
      data={rooms}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      style={{ backgroundColor: colors.bg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      ListHeaderComponent={
        <View>
          <Banner kind="error">{error ?? undefined}</Banner>
          {/* 코드로 참가: 반 코드(학원 발급) / 팀 코드(일반 회원 발급). 팀 만들기는 일반 회원만 */}
          {isStaff && academyId && <RoomCreate academyId={academyId} onCreated={load} />}
          {canTeam && <TeamActions canCreate={isMember} />}
          {isMember && (
            <Pressable onPress={() => navigation.navigate('StudentQr')} style={styles.linkHint}>
              <Text style={styles.linkHintText}>학원에 연동하면 학원 공지와 반 채팅방을 볼 수 있어요</Text>
              <Text style={styles.linkHintAction}>연동하기</Text>
            </Pressable>
          )}
          {teams.length > 0 && (
            <>
              <Text style={styles.section}>팀 채팅방</Text>
              <Text style={styles.sectionDesc}>일반 회원이 만든 스터디 모임방이에요. 친구에게 받은 코드로 들어와요</Text>
              {teams.map((row) => (
                <Pressable
                  key={row.teams!.id}
                  onPress={() => navigation.navigate('TeamRoom', { teamId: row.teams!.id })}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                >
                  <IconTile name="people" size={46} color={colors.indigo} bg={colors.indigoSoft} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.teams!.name}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {row.teams!.description || (row.role === 'OWNER' ? '내가 만든 채팅방' : '참가 중인 채팅방')}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
          {!isMember && rooms.length > 0 && (
            <>
              <Text style={styles.section}>공지 · 반 채팅방</Text>
              <Text style={styles.sectionDesc}>학원이 만든 방이에요. 반 코드를 입력해야 반 채팅방이 보여요</Text>
            </>
          )}
        </View>
      }
      ListEmptyComponent={teams.length === 0 ? <Empty icon="chatbubbles-outline">참여 중인 채팅방이 없습니다. 코드를 입력해 들어와 보세요.</Empty> : null}
      renderItem={({ item: room }) => {
        const last = lastMessages[room.id];
        const isUnread =
          !!last &&
          last.sender_id !== user?.id &&
          (!lastRead[room.id] || new Date(last.created_at) > new Date(lastRead[room.id]));
        return (
          <Pressable
            onPress={() => navigation.navigate('ChatRoom', { roomId: room.id })}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            <IconTile
              name={room.type === 'ANNOUNCEMENT' ? 'megaphone' : 'school'}
              size={46}
              color={room.type === 'ANNOUNCEMENT' ? colors.warnText : colors.primary}
              bg={room.type === 'ANNOUNCEMENT' ? colors.warnSoft : colors.primarySoft}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {isUnread && <View style={styles.dot} />}
                <Text style={styles.name} numberOfLines={1}>
                  {room.name}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.preview, isUnread && { color: '#374151', fontWeight: '500' }]}
              >
                {last ? previewText(last) : '아직 메시지가 없습니다.'}
              </Text>
            </View>
            {isStaff && room.type === 'CLASS' && room.join_code ? (
              <Pressable onPress={() => copyCode(room)} hitSlop={8} style={styles.codeChip} accessibilityLabel="반 코드 복사">
                <Text style={styles.codeLabel}>반 코드 · 탭하여 복사</Text>
                <Text style={styles.codeText}>{room.join_code}</Text>
              </Pressable>
            ) : (
              last && <Text style={styles.time}>{previewTime(last.created_at)}</Text>
            )}
            {canDelete(room) && (
              <Pressable onPress={() => deleteRoom(room)} hitSlop={10} style={styles.trash} accessibilityLabel="채팅방 삭제">
                <Icon name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
    {toast && (
      <View style={styles.toast} pointerEvents="none">
        <Text style={styles.toastText}>{toast}</Text>
      </View>
    )}
    </View>
  );
}

export default function ChatListScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    ...shadow,
  },
  section: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 14 },
  sectionDesc: { fontSize: 12.5, color: colors.textMuted, marginTop: 3, marginBottom: 10 },
  codeChip: { alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  codeLabel: { fontSize: 10, fontWeight: '700', color: colors.primary },
  codeText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark, letterSpacing: 1 },
  linkHint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF4FF', borderRadius: 14, padding: 14, marginBottom: 6 },
  linkHintText: { flex: 1, fontSize: 13, color: colors.primaryDark, lineHeight: 18 },
  linkHintAction: { fontSize: 13, fontWeight: '800', color: colors.primary },
  trash: { padding: 6 },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 28, backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  preview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 12, color: colors.textMuted },
});
