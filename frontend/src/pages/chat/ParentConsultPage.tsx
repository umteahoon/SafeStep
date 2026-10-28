import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday } from 'date-fns';
import { ArrowLeft, Search, Send, UserRound } from 'lucide-react';
import { StaffLayout } from '../../components/common/StaffLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { ChatMessage } from '../../types';

/** supabase/migration_19_parent_consult_rooms.sql 의 list_parent_consults 결과 */
interface ConsultRow {
  student_id: string;
  student_name: string;
  parent_name: string | null;
  parent_linked: boolean;
  room_id: string | null;
  last_message: string | null;
  last_at: string | null;
  unread: number;
}
type ConsultMessage = ChatMessage & { sender?: { name: string; role: string } | null };

const MESSAGE_SELECT = '*, sender:profiles(name, role)';

function timeLabel(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'M/d');
}

export default function ParentConsultPage() {
  const { user, profile } = useAuth();
  const academyId = profile?.academy_id ?? null;
  const [rows, setRows] = useState<ConsultRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ConsultRow | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    if (!academyId) return;
    const { data, error } = await supabase.rpc('list_parent_consults', { p_academy_id: academyId });
    if (error) {
      setListError(
        /function|schema cache/i.test(error.message)
          ? 'Supabase에 migration_19_parent_consult_rooms.sql 을 실행하면 학부모 상담을 사용할 수 있습니다.'
          : error.message
      );
      setRows([]);
    } else {
      setListError(null);
      setRows((data as ConsultRow[]) ?? []);
    }
    setListLoading(false);
  }, [academyId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadList();
    });
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  const markRead = useCallback(
    async (id: string) => {
      if (!user) return;
      await supabase
        .from('chat_room_reads')
        .upsert(
          { user_id: user.id, room_id: id, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,room_id' }
        );
    },
    [user]
  );

  // 학생을 고르면 상담방을 열고(없으면 생성) 메시지를 불러옴
  const openConsult = async (row: ConsultRow) => {
    setSelected(row);
    setMessages([]);
    setRoomError(null);
    setRoomId(null);
    if (!row.parent_linked) return;
    const { data: id, error } = await supabase.rpc('open_parent_room', { p_student_id: row.student_id });
    if (error || !id) {
      setRoomError(error?.message ?? '상담방을 열 수 없습니다.');
      return;
    }
    const { data: msgs, error: msgErr } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .eq('room_id', id as string)
      .order('created_at', { ascending: true });
    setRoomId(id as string);
    setMessages((msgs as ConsultMessage[]) ?? []);
    setRoomError(msgErr?.message ?? null);
    await markRead(id as string);
    setRows((prev) => prev.map((r) => (r.student_id === row.student_id ? { ...r, room_id: id as string, unread: 0 } : r)));
  };

  // 새 메시지 실시간 반영
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`consult-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('id', (payload.new as ChatMessage).id)
            .single();
          if (!data) return;
          setMessages((prev) => (prev.some((m) => m.id === (data as ConsultMessage).id) ? prev : [...prev, data as ConsultMessage]));
          void markRead(roomId);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content || !roomId || !user) return;
    setIsSending(true);
    const { error } = await supabase.from('chat_messages').insert({ room_id: roomId, sender_id: user.id, type: 'TEXT', content });
    setIsSending(false);
    if (error) {
      setRoomError(error.message);
      return;
    }
    setText('');
    setRows((prev) =>
      prev.map((r) =>
        r.room_id === roomId ? { ...r, last_message: content, last_at: new Date().toISOString() } : r
      )
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    return q ? rows.filter((r) => r.student_name.includes(q) || (r.parent_name ?? '').includes(q)) : rows;
  }, [rows, query]);

  return (
    <StaffLayout title="학부모 소통" subtitle="학생별 학부모 1:1 상담">
      <div className="flex h-[calc(100vh-11rem)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* 상담 목록 */}
        <section
          className={`w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-80 ${selected ? 'hidden' : 'flex'}`}
          aria-label="학부모 상담 목록"
        >
          <div className="border-b border-slate-100 p-3">
            <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
              <Search size={16} className="text-slate-400" aria-hidden="true" />
              <span className="sr-only">학생 또는 학부모 이름 검색</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="학생 · 학부모 이름 검색"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <p className="p-4 text-sm text-slate-400">불러오는 중...</p>
            ) : listError ? (
              <p className="m-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{listError}</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">등록된 학생이 없습니다.</p>
            ) : (
              <ul>
                {filtered.map((r) => {
                  const active = selected?.student_id === r.student_id;
                  return (
                    <li key={r.student_id}>
                      <button
                        type="button"
                        onClick={() => void openConsult(r)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${active ? 'bg-blue-50' : ''}`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <UserRound size={20} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">
                              {r.student_name} 학부모{r.parent_name ? ` · ${r.parent_name}` : ''}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">{timeLabel(r.last_at)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-slate-500">
                              {!r.parent_linked ? '보호자 앱 미연동' : r.last_message ?? '상담을 시작해 보세요'}
                            </span>
                            {r.unread > 0 && (
                              <span className="shrink-0 rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                                {r.unread}
                                <span className="sr-only">개 안읽음</span>
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 대화 */}
        <section className={`min-w-0 flex-1 flex-col ${selected ? 'flex' : 'hidden md:flex'}`} aria-label="상담 대화">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">
              왼쪽 목록에서 학생을 선택하세요.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                  aria-label="목록으로"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <p className="font-semibold text-slate-900">{selected.student_name} 학부모</p>
                  <p className="text-xs text-slate-500">
                    {selected.parent_linked ? selected.parent_name ?? '연동된 보호자' : '보호자가 아직 앱을 연동하지 않았어요'}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
                {!selected.parent_linked ? (
                  <p className="rounded-lg bg-white p-4 text-sm text-slate-500">
                    학생 관리에서 보호자에게 연동코드를 전달하면, 보호자가 앱에서 자녀를 연동한 뒤 상담할 수 있어요.
                  </p>
                ) : roomError ? (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{roomError}</p>
                ) : messages.length === 0 ? (
                  <p className="pt-10 text-center text-sm text-slate-400">아직 대화가 없습니다. 첫 메시지를 보내 보세요.</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          {!mine && <span className="text-xs text-slate-500">{m.sender?.name ?? '알 수 없음'}</span>}
                          <div
                            className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                              mine ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-white text-slate-800 shadow-sm'
                            }`}
                          >
                            {m.content}
                          </div>
                          <span className="text-[11px] text-slate-400">{format(new Date(m.created_at), 'M/d HH:mm')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {selected.parent_linked && (
                <form
                  className="flex items-center gap-2 border-t border-slate-100 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <label htmlFor="consult-input" className="sr-only">메시지</label>
                  <input
                    id="consult-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="메시지를 입력하세요."
                    disabled={!roomId}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || !roomId || isSending}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40"
                    aria-label="보내기"
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </StaffLayout>
  );
}
