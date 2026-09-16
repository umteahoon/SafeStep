import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { AttendanceStatus, ChatMessage, ChatRoom } from '../../types';

const MESSAGE_SELECT = '*, sender:profiles(name)';

const STATUSES: { value: AttendanceStatus; short: string; label: string; cls: string }[] = [
  { value: 'PRESENT', short: '출', label: '출석', cls: 'bg-blue-600 text-white border-blue-600' },
  { value: 'LATE', short: '지', label: '지각', cls: 'bg-amber-400 text-white border-amber-400' },
  { value: 'ABSENT', short: '결', label: '결석', cls: 'bg-red-500 text-white border-red-500' },
  { value: 'EXCUSED', short: '사', label: '사유결석', cls: 'bg-gray-500 text-white border-gray-500' },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

interface RosterStudent {
  id: string;
  name: string;
}

type Panel = null | 'participants' | 'attendance';

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, profile } = useAuth();
  const isStaff = profile?.role === 'ACADEMY_ADMIN' || profile?.role === 'TEACHER';
  const isParent = profile?.role === 'PARENT';
  const today = format(new Date(), 'yyyy-MM-dd');

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<Map<string, AttendanceStatus>>(new Map());
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [rosterFilter, setRosterFilter] = useState('');
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const markRead = useCallback(async () => {
    if (!roomId || !user) return;
    await supabase
      .from('chat_room_reads')
      .upsert(
        { user_id: user.id, room_id: roomId, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,room_id' }
      );
  }, [roomId, user]);

  const loadClassInfo = useCallback(
    async (classId: string) => {
      const [{ data: cls }, { data: enrollments }, { data: records }] = await Promise.all([
        supabase.from('classes').select('teacher:profiles(name)').eq('id', classId).single(),
        supabase.from('class_enrollments').select('students(id, name)').eq('class_id', classId),
        supabase
          .from('class_attendance_records')
          .select('student_id, status')
          .eq('class_id', classId)
          .eq('date', today),
      ]);
      setTeacherName((cls as any)?.teacher?.name ?? null);
      const students = (enrollments ?? [])
        .map((e: any) => e.students)
        .filter(Boolean) as RosterStudent[];
      setRoster(students);
      setTodayStatus(
        new Map((records ?? []).map((r) => [r.student_id, r.status as AttendanceStatus]))
      );
    },
    [today]
  );

  const load = useCallback(async () => {
    if (!roomId) return;
    setIsLoading(true);
    const [{ data: r, error: roomErr }, { data: msgs, error: msgErr }] = await Promise.all([
      supabase.from('chat_rooms').select('*').eq('id', roomId).single(),
      supabase
        .from('chat_messages')
        .select(MESSAGE_SELECT)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true }),
    ]);
    const roomData = (r as ChatRoom) ?? null;
    setRoom(roomData);
    setMessages((msgs as ChatMessage[]) ?? []);
    setError(roomErr?.message ?? msgErr?.message ?? null);
    setIsLoading(false);

    if (roomData?.type === 'CLASS' && roomData.class_id) {
      await loadClassInfo(roomData.class_id);
    }
  }, [roomId, loadClassInfo]);

  useEffect(() => {
    load();
  }, [load]);

  // 방을 열람하면 읽음 시각 갱신 (채팅 목록의 안읽음 표시용)
  useEffect(() => {
    if (!isLoading) markRead();
  }, [isLoading, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 실시간 반영: 새 메시지는 join 포함해서 다시 조회 후 append, 수정/삭제는 그대로 반영
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            return;
          }
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
            );
            return;
          }
          const { data } = await supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('id', (payload.new as ChatMessage).id)
            .single();
          if (data) {
            setMessages((prev) =>
              prev.some((m) => m.id === (data as ChatMessage).id)
                ? prev
                : [...prev, data as ChatMessage]
            );
            markRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, markRead]);

  // 출결 상태 실시간 반영 (다른 직원이 처리해도, 학부모/학생 화면도 새로고침 없이 갱신)
  useEffect(() => {
    if (room?.type !== 'CLASS' || !room.class_id) return;
    const classId = room.class_id;
    const channel = supabase
      .channel(`attendance-${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_attendance_records',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            student_id: string;
            date: string;
            status: AttendanceStatus;
          };
          if (row.date !== today) return;
          setTodayStatus((prev) => {
            const next = new Map(prev);
            if (payload.eventType === 'DELETE') next.delete(row.student_id);
            else next.set(row.student_id, row.status);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.type, room?.class_id, today]);

  // 오늘 이 반에 이미 "출석체크 시작" 알림을 보냈는지 (하루 한 번만 보내기 위함)
  const todaysCheckMessage = useMemo(
    () =>
      messages.find(
        (m) => m.type === 'ATTENDANCE_CHECK' && m.metadata?.date === today
      ),
    [messages, today]
  );

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !user || !room || !text.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      if (room.type === 'ANNOUNCEMENT' && isStaff) {
        // 공지방은 백엔드를 거쳐야 학부모에게 Web Push 알림이 함께 발송됨
        await apiFetch('/api/chat/announce', {
          method: 'POST',
          body: JSON.stringify({ roomId, content: text.trim() }),
        });
      } else {
        const { error: insErr } = await supabase.from('chat_messages').insert({
          room_id: roomId,
          sender_id: user.id,
          type: 'TEXT',
          content: text.trim(),
        });
        if (insErr) throw insErr;
      }
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 실패');
    } finally {
      setIsSending(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!roomId || !user) return;
    setIsUploading(true);
    setError(null);
    try {
      const path = `${roomId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file);
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-uploads').getPublicUrl(path);
      const { error: insErr } = await supabase.from('chat_messages').insert({
        room_id: roomId,
        sender_id: user.id,
        type: 'IMAGE',
        image_url: publicUrl,
      });
      if (insErr) throw insErr;
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('메시지를 삭제할까요?')) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    const { error: delErr } = await supabase.from('chat_messages').delete().eq('id', id);
    if (delErr) setError(delErr.message);
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditText(m.content ?? '');
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const editedAt = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingId ? { ...m, content: editText.trim(), edited_at: editedAt } : m
      )
    );
    const { error: updErr } = await supabase
      .from('chat_messages')
      .update({ content: editText.trim(), edited_at: editedAt })
      .eq('id', editingId);
    if (updErr) setError(updErr.message);
    setEditingId(null);
  };

  // 출석체크 알림은 하루에 한 번만 채팅에 남기고, 실제 체크는 항상 이 패널에서
  const openAttendancePanel = async () => {
    setPanel('attendance');
    if (!roomId || !room?.class_id || !user || todaysCheckMessage) return;
    const { error: insErr } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: user.id,
      type: 'ATTENDANCE_CHECK',
      content: '출석체크가 시작되었습니다.',
      metadata: { classId: room.class_id, date: today },
    });
    if (insErr) setError(insErr.message);
  };

  // 🔒 학생이 스스로 "출석"을 누르는 방식이 아니라, 선생님/원장이 직접 확인 후 처리합니다
  const markStatus = async (student: RosterStudent, status: AttendanceStatus) => {
    if (!room?.class_id || !user) return;
    setMarkingId(student.id);
    setError(null);
    try {
      await apiFetch('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({
          classId: room.class_id,
          studentId: student.id,
          date: today,
          status,
        }),
      });
      setTodayStatus((prev) => new Map(prev).set(student.id, status));

      // 정상 출석은 무음, 지각/결석/사유결석만 채팅에 남겨 알림처럼 보이게 함
      // (기존 Web Push 알림 정책과 동일한 원칙 — 인원이 많아도 채팅이 출석 도장으로 도배되지 않음)
      if (status !== 'PRESENT') {
        await supabase.from('chat_messages').insert({
          room_id: room.id,
          sender_id: user.id,
          type: 'ATTENDANCE_RESPONSE',
          content: `${student.name}님 ${STATUS_LABEL[status]} 처리되었습니다.`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '출결 처리 실패');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllPresent = async () => {
    for (const student of roster) {
      if (!todayStatus.has(student.id)) await markStatus(student, 'PRESENT');
    }
  };

  const visibleRoster = roster
    .filter((s) => s.name.includes(rosterFilter.trim()))
    .filter((s) => !onlyUnmarked || !todayStatus.has(s.id));

  const canPost = isStaff || (profile?.role === 'STUDENT' && room?.type === 'CLASS');

  if (isLoading) {
    return <p className="p-6 text-sm text-gray-400">불러오는 중...</p>;
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <PageHeader
        title={room?.name ?? '채팅'}
        subtitle={room?.type === 'ANNOUNCEMENT' ? '전체 공지방' : '반 채팅방'}
        backTo="/chat"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanel((p) => (p === 'participants' ? null : 'participants'))}
              className={`rounded-lg border px-3 py-2 text-sm ${
                panel === 'participants'
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              👥 참여자
            </button>
            {isStaff && room?.type === 'CLASS' && (
              <button
                onClick={() => (panel === 'attendance' ? setPanel(null) : openAttendancePanel())}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  panel === 'attendance'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                📋 출석 체크
              </button>
            )}
          </div>
        }
      />

      {panel === 'participants' && (
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl">
            {room?.type === 'CLASS' ? (
              <>
                <p className="mb-2 text-xs font-medium text-gray-400">
                  담당 강사: {teacherName ?? '미배정'} · 수강생 {roster.length}명
                </p>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {roster.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {s.name}
                      {todayStatus.has(s.id) && (
                        <span className="ml-1 text-gray-400">
                          · {STATUS_LABEL[todayStatus.get(s.id)!]}
                        </span>
                      )}
                    </span>
                  ))}
                  {roster.length === 0 && (
                    <span className="text-xs text-gray-400">수강생이 없습니다.</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400">
                이 학원 소속 원장·강사·학생·학부모 전원이 볼 수 있는 공지방입니다.
              </p>
            )}
          </div>
        </div>
      )}

      {panel === 'attendance' && isStaff && room?.type === 'CLASS' && (
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">
                오늘({today}) 처리 {todayStatus.size} / {roster.length}
              </span>
              <button
                onClick={markAllPresent}
                disabled={todayStatus.size === roster.length}
                className="text-xs font-medium text-blue-600 disabled:opacity-40"
              >
                나머지 전체 출석
              </button>
              <label className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={onlyUnmarked}
                  onChange={(e) => setOnlyUnmarked(e.target.checked)}
                />
                미체크만
              </label>
              <input
                value={rosterFilter}
                onChange={(e) => setRosterFilter(e.target.value)}
                placeholder="이름 검색"
                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-xs"
              />
            </div>

            <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
              {visibleRoster.map((s) => {
                const current = todayStatus.get(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-xs font-medium text-gray-700">{s.name}</span>
                    <div className="flex shrink-0 gap-1">
                      {STATUSES.map((st) => (
                        <button
                          key={st.value}
                          onClick={() => markStatus(s, st.value)}
                          disabled={markingId === s.id}
                          title={st.label}
                          className={`h-6 w-6 rounded-full border text-[11px] font-semibold disabled:opacity-40 ${
                            current === st.value
                              ? st.cls
                              : 'border-gray-200 text-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {st.short}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {visibleRoster.length === 0 && (
                <p className="p-3 text-center text-xs text-gray-400">해당하는 학생이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden p-4">
        {error && (
          <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              아직 메시지가 없습니다.
            </p>
          )}

          {messages.map((m, i) => {
            const isMine = m.sender_id === user?.id;
            const createdAt = new Date(m.created_at);
            const prev = messages[i - 1];
            const showDateDivider = !prev || !isSameDay(new Date(prev.created_at), createdAt);
            const timeLabel = format(createdAt, 'a h:mm', { locale: ko });

            const dateDivider = showDateDivider && (
              <div key={`${m.id}-date`} className="my-2 flex items-center justify-center">
                <span className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-500">
                  {format(createdAt, 'M월 d일 (EEE)', { locale: ko })}
                </span>
              </div>
            );

            if (m.type === 'ATTENDANCE_CHECK') {
              return (
                <div key={m.id}>
                  {dateDivider}
                  <p className="text-center text-xs text-blue-500">
                    📋 {m.sender?.name ?? '강사'}님이 출석체크를 시작했습니다 · {timeLabel}
                    {isStaff && (
                      <button
                        onClick={() => setPanel('attendance')}
                        className="ml-1 font-medium underline"
                      >
                        바로가기
                      </button>
                    )}
                  </p>
                </div>
              );
            }

            if (m.type === 'ATTENDANCE_RESPONSE') {
              return (
                <div key={m.id}>
                  {dateDivider}
                  <p className="text-center text-xs text-green-600">
                    ✅ {m.content} · {timeLabel}
                  </p>
                </div>
              );
            }

            const canDelete = isMine || isStaff;
            const isEditing = editingId === m.id;

            return (
              <div key={m.id} className="group">
                {dateDivider}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && (
                      <p className="mb-0.5 text-xs text-gray-400">{m.sender?.name ?? '알 수 없음'}</p>
                    )}
                    <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            autoFocus
                            className="rounded-lg border border-blue-400 px-3 py-1.5 text-sm"
                          />
                          <button onClick={saveEdit} className="text-xs font-medium text-blue-600">
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-gray-400"
                          >
                            취소
                          </button>
                        </div>
                      ) : m.type === 'IMAGE' ? (
                        <a href={m.image_url ?? '#'} target="_blank" rel="noreferrer">
                          <img
                            src={m.image_url ?? ''}
                            alt="첨부 이미지"
                            className="max-h-60 max-w-full rounded-xl border border-gray-200 object-cover"
                          />
                        </a>
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-2 text-sm ${
                            isMine
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 bg-white text-gray-900'
                          }`}
                        >
                          {m.content}
                          {m.edited_at && (
                            <span
                              className={`ml-1 text-[10px] ${isMine ? 'text-blue-200' : 'text-gray-400'}`}
                            >
                              (수정됨)
                            </span>
                          )}
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[10px] text-gray-400">{timeLabel}</span>
                          <div className="hidden gap-1 group-hover:flex">
                            {isMine && m.type === 'TEXT' && (
                              <button
                                onClick={() => startEdit(m)}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                수정
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => deleteMessage(m.id)}
                                className="text-[10px] text-gray-400 hover:text-red-500"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {canPost ? (
          <form onSubmit={sendText} className="flex gap-2 border-t border-gray-200 pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="이미지 첨부"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              {isUploading ? '업로드 중...' : '📎'}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메시지 입력"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isSending || !text.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              전송
            </button>
          </form>
        ) : (
          isParent && (
            <p className="border-t border-gray-200 py-3 text-center text-xs text-gray-400">
              학부모는 읽기 전용으로 참여합니다.
            </p>
          )
        )}
      </div>
    </div>
  );
}
