import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Empty, IconTile, Loading } from '../../components/ui';
import { colors, shadow } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { ChatMessage, ChatRoom, ChatRoomRead, Class } from '../../types';

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
  const { user, profile } = useAuth();
  const academyId = profile?.academy_id ?? null;
  const isStaff = profile?.role === 'ACADEMY_ADMIN' || profile?.role === 'TEACHER';

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
        await supabase.from('chat_rooms').insert(
          missing.map((c) => ({
            academy_id: academyId,
            class_id: c.id,
            type: 'CLASS' as const,
            name: c.name,
          }))
        );
      }
    }

    const { data, error: e } = await supabase.from('chat_rooms').select('*');
    const roomList = (data as ChatRoom[]) ?? [];
    setError(e?.message ?? null);

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
    setIsLoading(false);
  }, [academyId, isStaff, user]);

  // 방에서 돌아올 때마다 안읽음 표시를 갱신
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) return <Loading />;

  return (
    <FlatList
      data={rooms}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      style={{ backgroundColor: colors.bg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      ListHeaderComponent={<Banner kind="error">{error ?? undefined}</Banner>}
      ListEmptyComponent={<Empty icon="chatbubbles-outline">참여 중인 채팅방이 없습니다.</Empty>}
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
            {last && <Text style={styles.time}>{previewTime(last.created_at)}</Text>}
          </Pressable>
        );
      }}
    />
  );
}

export default function ChatListScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']} requireStudentLink>
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  preview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 12, color: colors.textMuted },
});
