import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { ChatMessage, ChatRoom, ChatRoomRead, Class } from '../../types';

const TYPE_LABEL: Record<ChatRoom['type'], string> = {
  ANNOUNCEMENT: '공지',
  CLASS: '반',
};

function previewText(m: ChatMessage): string {
  if (m.type === 'ATTENDANCE_CHECK') return '📋 출석체크가 시작되었습니다.';
  if (m.type === 'ATTENDANCE_RESPONSE') return `✅ ${m.content ?? ''}`;
  const sender = m.sender?.name ? `${m.sender.name}: ` : '';
  return `${sender}${m.content ?? ''}`;
}

function previewTime(dateStr: string): string {
  const d = new Date(dateStr);
  return isToday(d) ? format(d, 'a h:mm', { locale: ko }) : format(d, 'M/d');
}

export default function ChatListPage() {
  const { user, profile } = useAuth();
  const academyId = profile?.academy_id ?? null;
  const isStaff = profile?.role === 'ACADEMY_ADMIN' || profile?.role === 'TEACHER';

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, ChatMessage>>({});
  const [lastRead, setLastRead] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // 직원이면 공지방/반 채팅방이 아직 없는 경우 자동으로 채워 넣음
    if (isStaff && academyId) {
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('id, class_id, type')
        .eq('academy_id', academyId);

      const hasAnnouncement = (existing ?? []).some((r) => r.type === 'ANNOUNCEMENT');
      if (!hasAnnouncement) {
        await supabase.from('chat_rooms').insert({
          academy_id: academyId,
          type: 'ANNOUNCEMENT',
          name: '전체 공지',
        });
      }

      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('academy_id', academyId);
      const existingClassIds = new Set(
        (existing ?? []).filter((r) => r.class_id).map((r) => r.class_id)
      );
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
        .in(
          'room_id',
          roomList.map((r) => r.id)
        )
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
          Object.fromEntries(
            ((reads as ChatRoomRead[]) ?? []).map((r) => [r.room_id, r.last_read_at])
          )
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="채팅" subtitle="공지방 · 반 채팅방" />

      <div className="mx-auto max-w-2xl p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-gray-400">참여 중인 채팅방이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => {
              const last = lastMessages[room.id];
              const isUnread =
                !!last &&
                last.sender_id !== user?.id &&
                (!lastRead[room.id] || new Date(last.created_at) > new Date(lastRead[room.id]));
              return (
                <li key={room.id}>
                  <Link
                    to={`/chat/${room.id}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-400"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        room.type === 'ANNOUNCEMENT'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {TYPE_LABEL[room.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-medium text-gray-900">
                        {isUnread && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                        {room.name}
                      </p>
                      <p
                        className={`truncate text-sm ${isUnread ? 'font-medium text-gray-700' : 'text-gray-400'}`}
                      >
                        {last ? previewText(last) : '아직 메시지가 없습니다.'}
                      </p>
                    </div>
                    {last && (
                      <span className="shrink-0 text-xs text-gray-400">
                        {previewTime(last.created_at)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
