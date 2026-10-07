import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { inviteLink } from '../../lib/teams';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Input, Loading, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { Team, TeamChatMessage, TeamChatRoom, TeamMember } from '../../types';

const ROLE_LABEL: Record<string, string> = { ACADEMY_ADMIN: '원장', TEACHER: '강사', STUDENT: '학생' };

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { teamId } = useRoute<RouteProp<RootStackParamList, 'TeamRoom'>>().params;
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
  const [infoOpen, setInfoOpen] = useState(false);
  const listRef = useRef<FlatList<TeamChatMessage>>(null);

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.member_id, m.member_name]));
    return (id: string) => map.get(id) ?? '알 수 없음';
  }, [members]);

  const isOwner = members.some((m) => m.member_id === myId && m.team_role === 'OWNER');

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.rpc('list_team_members', { p_team: teamId });
    setMembers((data as TeamMember[]) ?? []);
  }, [teamId]);

  const loadRooms = useCallback(async () => {
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
    let cancelled = false;
    (async () => {
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
      if (cancelled) return;
      if (!teamData) {
        setError('팀을 찾을 수 없거나 참가하지 않은 팀입니다.');
        setIsLoading(false);
        return;
      }
      setTeam(teamData as Team);
      navigation.setOptions({ title: (teamData as Team).name });
      await loadMembers();
      const list = await loadRooms();
      if (cancelled) return;
      setActiveRoomId((prev) => prev ?? list.find((r) => r.type === 'TEAM')?.id ?? null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, loadMembers, loadRooms, navigation]);

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

  // 새 멤버가 보낸 메시지가 도착했는데 이름을 모르면 멤버 목록을 다시 불러옵니다.
  useEffect(() => {
    if (messages.some((m) => !members.some((mm) => mm.member_id === m.sender_id))) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // 헤더 우측: 팀 정보(멤버·초대·관리)
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Text style={{ fontSize: 15, color: colors.indigo, fontWeight: '600' }} onPress={() => setInfoOpen(true)}>
          팀 정보
        </Text>
      ),
    });
  }, [navigation]);

  const teamRoom = rooms.find((r) => r.type === 'TEAM');
  const directRooms = rooms.filter((r) => r.type === 'DIRECT');
  const otherOf = (r: TeamChatRoom) => (r.user_a === myId ? r.user_b : r.user_a) ?? '';
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  const openDirect = async (otherId: string) => {
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
    setInfoOpen(false);
  };

  const send = async () => {
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
      await Clipboard.setStringAsync(text);
      flash(`${label}를 복사했습니다.`);
    } catch {
      flash('복사에 실패했습니다.');
    }
  };

  const confirm = (title: string, onOk: () => void, okText = '확인') =>
    Alert.alert(title, undefined, [
      { text: '취소', style: 'cancel' },
      { text: okText, style: 'destructive', onPress: onOk },
    ]);

  const leaveTeam = () =>
    confirm(
      '이 팀에서 나갈까요?',
      async () => {
        const { error: leaveError } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', myId);
        if (leaveError) return setError('팀 나가기에 실패했습니다.');
        navigation.goBack();
      },
      '나가기'
    );

  const kickMember = (userId: string, name: string) =>
    confirm(
      `${name}님을 팀에서 내보낼까요?`,
      async () => {
        setError(null);
        const { error: kickError } = await supabase.rpc('kick_team_member', { p_team: teamId, p_user: userId });
        if (kickError) return setError(kickError.message ?? '멤버를 내보내지 못했습니다.');
        if (activeRoom?.type === 'DIRECT' && otherOf(activeRoom) === userId) {
          setActiveRoomId(teamRoom?.id ?? null);
        }
        await loadMembers();
        await loadRooms();
        flash(`${name}님을 내보냈습니다.`);
      },
      '추방'
    );

  const deleteTeam = () =>
    confirm(
      '이 팀을 삭제할까요? 모든 채팅 기록이 함께 사라지며 되돌릴 수 없습니다.',
      async () => {
        setError(null);
        const { error: deleteError } = await supabase.rpc('delete_team', { p_team: teamId });
        if (deleteError) return setError(deleteError.message ?? '팀 삭제에 실패했습니다.');
        navigation.goBack();
      },
      '삭제'
    );

  const regenerateCode = () =>
    confirm(
      '참가 코드를 재발급할까요? 기존 코드는 즉시 사용할 수 없게 됩니다.',
      async () => {
        setError(null);
        const { data, error: regenError } = await supabase.rpc('regenerate_team_code', { p_team: teamId });
        if (regenError || !data) return setError(regenError?.message ?? '참가 코드 재발급에 실패했습니다.');
        setTeam((prev) => (prev ? { ...prev, join_code: data as string } : prev));
        flash('참가 코드를 재발급했습니다.');
      },
      '재발급'
    );

  if (isLoading) return <Loading />;

  if (!team) {
    return (
      <Screen>
        <Banner kind="error">{error ?? '팀을 찾을 수 없습니다.'}</Banner>
        <Button title="내 팀 목록으로" icon="chevron-back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      {/* 채널 / 개인 채팅 전환 */}
      <View style={styles.channels}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
          {teamRoom && (
            <Pressable
              onPress={() => setActiveRoomId(teamRoom.id)}
              style={[styles.channel, activeRoomId === teamRoom.id && styles.channelActive]}
            >
              <Text style={[styles.channelText, activeRoomId === teamRoom.id && styles.channelTextActive]}># 전체 채팅</Text>
            </Pressable>
          )}
          {directRooms.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setActiveRoomId(r.id)}
              style={[styles.channel, activeRoomId === r.id && styles.channelActive]}
            >
              <Text style={[styles.channelText, activeRoomId === r.id && styles.channelTextActive]}>
                {memberName(otherOf(r))}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {notice && <Text style={styles.notice}>{notice}</Text>}
      <Banner kind="error">{error ?? undefined}</Banner>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>첫 메시지를 보내 대화를 시작해보세요.</Text>}
        renderItem={({ item: m, index: i }) => {
          const mine = m.sender_id === myId;
          const prev = messages[i - 1];
          const newDay = !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
          const grouped =
            !newDay &&
            prev?.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
          return (
            <View>
              {newDay && <Text style={styles.day}>{formatDay(m.created_at)}</Text>}
              <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: grouped ? 2 : 10 }}>
                <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {!grouped && !mine && <Text style={styles.sender}>{memberName(m.sender_id)}</Text>}
                  <View style={{ flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      <Text style={{ fontSize: 15, color: mine ? colors.white : colors.text }}>{m.content}</Text>
                    </View>
                    <Text style={styles.time}>{formatTime(m.created_at)}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="메시지 입력"
          maxLength={2000}
          multiline
          style={{ flex: 1, paddingVertical: 9, maxHeight: 110 }}
        />
        <Button title="전송" variant="indigo" small onPress={send} loading={isSending} disabled={!draft.trim() || !activeRoomId} />
      </View>

      {/* 팀 정보: 멤버(1:1 채팅 시작) · 초대 · 관리 */}
      <Modal visible={infoOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInfoOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {team.name}
              </Text>
              {team.description && <Text style={styles.meta}>{team.description}</Text>}
            </View>
            <Text style={styles.sheetClose} onPress={() => setInfoOpen(false)}>
              닫기
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Banner kind="error">{error ?? undefined}</Banner>
            {notice && <Banner kind="success">{notice}</Banner>}

            <Text style={styles.sectionLabel}>멤버 {members.length}명 · 눌러서 1:1 채팅</Text>
            {members.map((m) => (
              <View key={m.member_id} style={styles.memberRow}>
                <Pressable
                  disabled={m.member_id === myId}
                  onPress={() => openDirect(m.member_id)}
                  style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 15, color: colors.text }}>
                    {m.member_name}
                    {m.member_id === myId && <Text style={{ color: colors.textMuted, fontSize: 12 }}> (나)</Text>}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {m.team_role === 'OWNER' ? '팀장' : (ROLE_LABEL[m.account_role] ?? '')}
                  </Text>
                </Pressable>
                {isOwner && m.member_id !== myId && (
                  <Text style={styles.kick} onPress={() => kickMember(m.member_id, m.member_name)}>
                    추방
                  </Text>
                )}
              </View>
            ))}
            {members.length <= 1 && <Text style={styles.meta}>아직 나 혼자예요. 아래 코드나 링크로 초대해보세요.</Text>}

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>참가 코드</Text>
            <Text style={styles.code}>{team.join_code}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Button title="코드 복사" variant="secondary" small style={{ flex: 1 }} onPress={() => copy(team.join_code, '참가 코드')} />
              <Button title="링크 복사" variant="secondary" small style={{ flex: 1 }} onPress={() => copy(inviteLink(team.join_code), '초대 링크')} />
            </View>
            <Button
              title="초대 공유하기"
              variant="indigo"
              onPress={() =>
                Share.share({
                  message: `SafeStep 팀 "${team.name}" 초대\n참가 코드: ${team.join_code}\n${inviteLink(team.join_code)}`,
                })
              }
            />
            {isOwner && (
              <Button title="참가 코드 재발급" variant="secondary" onPress={regenerateCode} style={{ marginTop: 8 }} />
            )}

            <View style={{ marginTop: 24 }}>
              {isOwner ? (
                <Button title="팀 삭제" variant="danger" onPress={deleteTeam} />
              ) : (
                <Button title="팀 나가기" variant="secondary" onPress={leaveTeam} />
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

export default function TeamRoomScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  channels: { paddingVertical: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  channel: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  channelActive: { backgroundColor: colors.indigoSoft, borderColor: colors.indigo },
  channelText: { fontSize: 13, color: colors.textSub },
  channelTextActive: { color: colors.indigo, fontWeight: '700' },
  notice: { textAlign: 'center', fontSize: 12, color: colors.indigo, paddingVertical: 4 },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingVertical: 40 },
  day: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginVertical: 10 },
  sender: { fontSize: 12, fontWeight: '500', color: colors.textSub, marginBottom: 2 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, flexShrink: 1 },
  bubbleMine: { backgroundColor: colors.indigo, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  time: { fontSize: 10, color: colors.textMuted },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetClose: { fontSize: 15, color: colors.indigo, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.graySoft },
  kick: { fontSize: 13, color: colors.danger, paddingHorizontal: 8, paddingVertical: 12 },
  code: { fontFamily: 'Courier', fontSize: 26, fontWeight: '700', letterSpacing: 5, color: colors.text, marginBottom: 12 },
});
