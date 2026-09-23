import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { inviteLink } from '../../lib/teams';
import type { TeamChatMessage, TeamChatRoom, Team, TeamMember } from '../../types';

const ROLE_LABEL: Record<string, string> = {
  ACADEMY_ADMIN: '원장',
  TEACHER: '강사',
  STUDENT: '학생',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export default function TeamRoomPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id ?? '';

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rooms, setRooms] = useState<TeamChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.member_id, m.member_name]));
    return (id: string) => map.get(id) ?? '알 수 없음';
  }, [members]);

  const isOwner = members.some((m) => m.member_id === myId && m.team_role === 'OWNER');

  const loadMembers = useCallback(async () => {
    if (!teamId) return;
    const { data } = await supabase.rpc('list_team_members', { p_team: teamId });
    setMembers((data as TeamMember[]) ?? []);
  }, [teamId]);

  const loadRooms = useCallback(async () => {
    if (!teamId) return [];
    const { data } = await supabase
      .from('team_chat_rooms')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at');
    const list = (data as TeamChatRoom[]) ?? [];
    setRooms(list);
    return list;
  }, [teamId]);

  // 팀 + 멤버 + 채팅방 초기 로드 (기본 선택: 단체방)
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    (async () => {
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();
      if (cancelled) return;
      if (!teamData) {
        setError('팀을 찾을 수 없거나 참가하지 않은 팀입니다.');
        setIsLoading(false);
        return;
      }
      setTeam(teamData as Team);
      await loadMembers();
      const list = await loadRooms();
      if (cancelled) return;
      setActiveRoomId((prev) => prev ?? list.find((r) => r.type === 'TEAM')?.id ?? null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, loadMembers, loadRooms]);

  // 선택된 방의 메시지 로드 + 실시간 구독
  useEffect(() => {
    if (!activeRoomId) return;
    let cancelled = false;
    setMessages([]);

    supabase
      .from('team_chat_messages')
      .select('*')
      .eq('room_id', activeRoomId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (cancelled) return;
        const list = ((data as TeamChatMessage[]) ?? []).reverse();
        setMessages((prev) => {
          const seen = new Set(list.map((m) => m.id));
          return [...list, ...prev.filter((m) => !seen.has(m.id))];
        });
      });

    const channel = supabase
      .channel(`team-chat-room-${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `room_id=eq.${activeRoomId}`,
        },
        (payload) => {
          const msg = payload.new as TeamChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeRoomId]);

  // 다른 멤버가 나에게 개인 채팅을 걸면 방 목록에 나타나도록 주기적으로 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      loadRooms();
      loadMembers();
    }, 15_000);
    return () => clearInterval(timer);
  }, [loadRooms, loadMembers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 새 멤버가 보낸 메시지가 도착했는데 이름을 모르면 멤버 목록을 다시 불러옵니다.
  useEffect(() => {
    if (messages.some((m) => !members.some((mm) => mm.member_id === m.sender_id))) {
      loadMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const teamRoom = rooms.find((r) => r.type === 'TEAM');
  const directRooms = rooms.filter((r) => r.type === 'DIRECT');
  const otherOf = (r: TeamChatRoom) => (r.user_a === myId ? r.user_b : r.user_a) ?? '';
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const activeTitle = !activeRoom
    ? ''
    : activeRoom.type === 'TEAM'
      ? `# ${team?.name ?? '전체 채팅'}`
      : memberName(otherOf(activeRoom));

  const openDirect = async (otherId: string) => {
    if (!teamId) return;
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('start_direct_chat', {
      p_team: teamId,
      p_other: otherId,
    });
    if (rpcError || !data) {
      setError(rpcError?.message ?? '개인 채팅을 시작하지 못했습니다.');
      return;
    }
    await loadRooms();
    setActiveRoomId(data as string);
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || !activeRoomId || !myId || isSending) return;
    setIsSending(true);
    setError(null);
    const { data, error: sendError } = await supabase
      .from('team_chat_messages')
      .insert({ room_id: activeRoomId, sender_id: myId, content })
      .select()
      .single();
    setIsSending(false);
    if (sendError) {
      setError('메시지를 보내지 못했습니다.');
      return;
    }
    setDraft('');
    const msg = data as TeamChatMessage;
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2000);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(`${label}를 복사했습니다.`);
    } catch {
      flash('복사에 실패했습니다. 직접 선택해서 복사해주세요.');
    }
  };

  const leaveTeam = async () => {
    if (!teamId || !window.confirm('이 팀에서 나갈까요?')) return;
    const { error: leaveError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', myId);
    if (leaveError) {
      setError('팀 나가기에 실패했습니다.');
      return;
    }
    navigate('/teams');
  };

  const kickMember = async (userId: string, name: string) => {
    if (!teamId || !window.confirm(`${name}님을 팀에서 내보낼까요?`)) return;
    setError(null);
    const { error: kickError } = await supabase.rpc('kick_team_member', {
      p_team: teamId,
      p_user: userId,
    });
    if (kickError) {
      setError(kickError.message ?? '멤버를 내보내지 못했습니다.');
      return;
    }
    if (activeRoom?.type === 'DIRECT' && otherOf(activeRoom) === userId) {
      setActiveRoomId(teamRoom?.id ?? null);
    }
    await loadMembers();
    await loadRooms();
    flash(`${name}님을 내보냈습니다.`);
  };

  const deleteTeam = async () => {
    if (!teamId) return;
    if (!window.confirm('이 팀을 삭제할까요? 모든 채팅 기록이 함께 사라지며 되돌릴 수 없습니다.')) return;
    setError(null);
    const { error: deleteError } = await supabase.rpc('delete_team', { p_team: teamId });
    if (deleteError) {
      setError(deleteError.message ?? '팀 삭제에 실패했습니다.');
      return;
    }
    navigate('/teams');
  };

  const regenerateCode = async () => {
    if (!teamId || !window.confirm('참가 코드를 재발급할까요? 기존 코드는 즉시 사용할 수 없게 됩니다.')) return;
    setError(null);
    const { data, error: regenError } = await supabase.rpc('regenerate_team_code', {
      p_team: teamId,
    });
    if (regenError || !data) {
      setError(regenError?.message ?? '참가 코드 재발급에 실패했습니다.');
      return;
    }
    setTeam((prev) => (prev ? { ...prev, join_code: data as string } : prev));
    flash('참가 코드를 재발급했습니다.');
  };

  if (isLoading) {
    return <p className="p-6 text-sm text-gray-400">불러오는 중...</p>;
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-sm text-red-500">{error ?? '팀을 찾을 수 없습니다.'}</p>
        <Link to="/teams" className="text-sm font-medium text-indigo-600">
          ← 내 팀 목록
        </Link>
      </div>
    );
  }

  const otherMembers = members.filter((m) => m.member_id !== myId);

  return (
    <div className="flex h-screen flex-col bg-gray-50 md:flex-row">
      {/* 좌측: 채널 / 개인 채팅 / 멤버 (Teams 스타일) */}
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col overflow-y-auto border-b border-gray-200 bg-white md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="border-b border-gray-100 p-4">
          <Link to="/teams" className="text-xs text-gray-400 hover:text-gray-600">
            ← 내 팀
          </Link>
          <h1 className="mt-1 truncate text-lg font-bold text-gray-900">{team.name}</h1>
          {team.description && (
            <p className="truncate text-xs text-gray-400">{team.description}</p>
          )}
        </div>

        <div className="p-3">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            채널
          </p>
          {teamRoom && (
            <button
              onClick={() => setActiveRoomId(teamRoom.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                activeRoomId === teamRoom.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              # 전체 채팅
            </button>
          )}
        </div>

        {directRooms.length > 0 && (
          <div className="px-3 pb-3">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              개인 채팅
            </p>
            {directRooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRoomId(r.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                  activeRoomId === r.id
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {memberName(otherOf(r))}
              </button>
            ))}
          </div>
        )}

        <div className="px-3 pb-3">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            멤버 {members.length}명 · 눌러서 1:1 채팅
          </p>
          <ul>
            {members.map((m) => (
              <li key={m.member_id} className="flex items-center">
                <button
                  disabled={m.member_id === myId}
                  onClick={() => openDirect(m.member_id)}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="truncate">
                    {m.member_name}
                    {m.member_id === myId && (
                      <span className="ml-1 text-xs text-gray-400">(나)</span>
                    )}
                  </span>
                  <span className="ml-2 shrink-0 text-[11px] text-gray-400">
                    {m.team_role === 'OWNER' ? '팀장' : ROLE_LABEL[m.account_role] ?? ''}
                  </span>
                </button>
                {isOwner && m.member_id !== myId && (
                  <button
                    onClick={() => kickMember(m.member_id, m.member_name)}
                    className="shrink-0 px-2 py-2 text-xs text-gray-400 hover:text-red-500"
                    title="팀에서 내보내기"
                  >
                    추방
                  </button>
                )}
              </li>
            ))}
            {otherMembers.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400">
                아직 나 혼자예요. 아래 코드나 링크로 초대해보세요.
              </li>
            )}
          </ul>
        </div>

        {/* 초대 */}
        <div className="mt-auto border-t border-gray-100 p-4">
          <p className="mb-1 text-xs font-semibold text-gray-400">참가 코드</p>
          <p className="mb-2 font-mono text-xl font-bold tracking-[0.25em] text-gray-900">
            {team.join_code}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => copy(team.join_code, '참가 코드')}
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              코드 복사
            </button>
            <button
              onClick={() => copy(inviteLink(team.join_code), '초대 링크')}
              className="flex-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              초대 링크 복사
            </button>
          </div>
          {isOwner && (
            <button
              onClick={regenerateCode}
              className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              참가 코드 재발급
            </button>
          )}
          {isOwner ? (
            <button
              onClick={deleteTeam}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-red-500"
            >
              팀 삭제
            </button>
          ) : (
            <button
              onClick={leaveTeam}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-red-500"
            >
              팀 나가기
            </button>
          )}
        </div>
      </aside>

      {/* 우측: 대화 */}
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <h2 className="truncate font-semibold text-gray-900">{activeTitle}</h2>
          {notice && <span className="text-xs text-indigo-600">{notice}</span>}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">
              첫 메시지를 보내 대화를 시작해보세요.
            </p>
          )}
          {messages.map((m, i) => {
            const mine = m.sender_id === myId;
            const prev = messages[i - 1];
            const newDay = !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
            const grouped =
              !newDay &&
              prev?.sender_id === m.sender_id &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-3 text-center text-xs text-gray-400">
                    {formatDay(m.created_at)}
                  </p>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-3'}`}>
                  <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!grouped && !mine && (
                      <span className="mb-0.5 text-xs font-medium text-gray-500">
                        {memberName(m.sender_id)}
                      </span>
                    )}
                    <div className="flex items-end gap-1.5">
                      {mine && (
                        <span className="text-[10px] text-gray-400">{formatTime(m.created_at)}</span>
                      )}
                      <p
                        className={`whitespace-pre-wrap wrap-break-word rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'rounded-br-md bg-indigo-600 text-white'
                            : 'rounded-bl-md border border-gray-200 bg-white text-gray-900'
                        }`}
                      >
                        {m.content}
                      </p>
                      {!mine && (
                        <span className="text-[10px] text-gray-400">{formatTime(m.created_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
            className="max-h-32 min-h-10.5 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isSending || !activeRoomId}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            전송
          </button>
        </form>
      </main>
    </div>
  );
}
