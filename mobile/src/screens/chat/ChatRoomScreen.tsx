import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { RequireRole } from '../../components/Guard';
import { Banner, Button, Icon, Input, Loading, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { AttendanceStatus, ChatMessage, ChatRoom } from '../../types';

const MESSAGE_SELECT = '*, sender:profiles(name)';

const STATUSES: { value: AttendanceStatus; short: string; label: string; color: string }[] = [
  { value: 'PRESENT', short: '출', label: '출석', color: colors.primary },
  { value: 'LATE', short: '지', label: '지각', color: '#FBBF24' },
  { value: 'ABSENT', short: '결', label: '결석', color: colors.danger },
  { value: 'EXCUSED', short: '사', label: '사유결석', color: colors.gray },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

interface RosterStudent {
  id: string;
  name: string;
}

// 채팅 이미지는 비공개 버킷에 있어서 같은 채팅방 참여자에게만 서명된 임시 URL을 발급합니다.
// 예전 메시지에 저장된 공개 URL도 경로를 꺼내서 같은 방식으로 처리합니다.
function ChatImage({ value, onOpen }: { value: string | null; onOpen: (url: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    const raw = value.startsWith('http') ? (value.split('/object/public/chat-uploads/')[1] ?? null) : value;
    if (!raw) return;
    let cancelled = false;
    supabase.storage
      .from('chat-uploads')
      .createSignedUrl(decodeURIComponent(raw), 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data) setSrc(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) return <View style={styles.imagePlaceholder} />;
  return (
    <Pressable onPress={() => onOpen(src)}>
      <Image source={{ uri: src }} style={styles.image} resizeMode="cover" />
    </Pressable>
  );
}

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { roomId } = useRoute<RouteProp<RootStackParamList, 'ChatRoom'>>().params;
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
  const [panel, setPanel] = useState<null | 'participants' | 'attendance'>(null);
  const [rosterFilter, setRosterFilter] = useState('');
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const markRead = useCallback(async () => {
    if (!user) return;
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
      setRoster(
        (enrollments ?? []).map((e: any) => e.students).filter(Boolean) as RosterStudent[]
      );
      setTodayStatus(new Map((records ?? []).map((r) => [r.student_id, r.status as AttendanceStatus])));
    },
    [today]
  );

  const load = useCallback(async () => {
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
    if (roomData) {
      navigation.setOptions({ title: roomData.name });
    }
    if (roomData?.type === 'CLASS' && roomData.class_id) await loadClassInfo(roomData.class_id);
  }, [roomId, loadClassInfo, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  // 방을 열람하면 읽음 시각 갱신 (채팅 목록의 안읽음 표시용)
  useEffect(() => {
    if (!isLoading) markRead();
  }, [isLoading, markRead]);

  // 메시지 실시간 반영: 새 메시지는 join 포함해서 다시 조회 후 append, 수정/삭제는 그대로 반영
  useEffect(() => {
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
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
            return;
          }
          const { data } = await supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('id', (payload.new as ChatMessage).id)
            .single();
          if (data) {
            setMessages((prev) =>
              prev.some((m) => m.id === (data as ChatMessage).id) ? prev : [...prev, data as ChatMessage]
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
    () => messages.find((m) => m.type === 'ATTENDANCE_CHECK' && m.metadata?.date === today),
    [messages, today]
  );

  const sendText = async () => {
    if (!user || !room || !text.trim()) return;
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

  const pickAndUploadImage = async () => {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];

    setIsUploading(true);
    setError(null);
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${roomId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-uploads')
        .upload(path, decode(asset.base64!), { contentType: asset.mimeType ?? `image/${ext}` });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('chat_messages').insert({
        room_id: roomId,
        sender_id: user.id,
        type: 'IMAGE',
        image_url: path,
      });
      if (insErr) throw insErr;
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteMessage = (id: string) => {
    Alert.alert('메시지를 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setMessages((prev) => prev.filter((m) => m.id !== id));
          const { error: delErr } = await supabase.from('chat_messages').delete().eq('id', id);
          if (delErr) setError(delErr.message);
        },
      },
    ]);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const editedAt = new Date().toISOString();
    const id = editingId;
    const content = editText.trim();
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, edited_at: editedAt } : m)));
    setEditingId(null);
    const { error: updErr } = await supabase
      .from('chat_messages')
      .update({ content, edited_at: editedAt })
      .eq('id', id);
    if (updErr) setError(updErr.message);
  };

  // 메시지 길게 누르기 → 수정(본인 TEXT) / 삭제(본인 또는 직원)
  const onLongPress = (m: ChatMessage) => {
    const isMine = m.sender_id === user?.id;
    const buttons: any[] = [];
    if (isMine && m.type === 'TEXT') {
      buttons.push({
        text: '수정',
        onPress: () => {
          setEditingId(m.id);
          setEditText(m.content ?? '');
        },
      });
    }
    if (isMine || isStaff) {
      buttons.push({ text: '삭제', style: 'destructive', onPress: () => deleteMessage(m.id) });
    }
    if (buttons.length === 0) return;
    buttons.push({ text: '취소', style: 'cancel' });
    Alert.alert('메시지', undefined, buttons);
  };

  // 출석체크 알림은 하루에 한 번만 채팅에 남기고, 실제 체크는 항상 이 패널에서
  const openAttendancePanel = async () => {
    setPanel('attendance');
    if (!room?.class_id || !user || todaysCheckMessage) return;
    const { error: insErr } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: user.id,
      type: 'ATTENDANCE_CHECK',
      content: '출석체크가 시작되었습니다.',
      metadata: { classId: room.class_id, date: today },
    });
    if (insErr) setError(insErr.message);
  };

  // 학생이 스스로 "출석"을 누르는 방식이 아니라, 선생님/원장이 직접 확인 후 처리합니다
  const markStatus = async (student: RosterStudent, status: AttendanceStatus) => {
    if (!room?.class_id || !user) return;
    setMarkingId(student.id);
    setError(null);
    try {
      await apiFetch('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({ classId: room.class_id, studentId: student.id, date: today, status }),
      });
      setTodayStatus((prev) => new Map(prev).set(student.id, status));

      // 정상 출석은 무음, 지각/결석/사유결석만 채팅에 남겨 알림처럼 보이게 함
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

  // 헤더 우측 버튼 (참여자 / 출석 체크)
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Pressable onPress={() => setPanel('participants')} hitSlop={8}>
            <Icon name="people-outline" size={24} color={colors.text} />
          </Pressable>
          {isStaff && room?.type === 'CLASS' && (
            <Pressable onPress={openAttendancePanel} hitSlop={8}>
              <Icon name="clipboard-outline" size={23} color={colors.primary} />
            </Pressable>
          )}
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isStaff, room?.type, todaysCheckMessage, room?.class_id]);

  const visibleRoster = roster
    .filter((s) => s.name.includes(rosterFilter.trim()))
    .filter((s) => !onlyUnmarked || !todayStatus.has(s.id));

  const canPost = isStaff || (profile?.role === 'STUDENT' && room?.type === 'CLASS');

  if (isLoading) return <Loading />;

  return (
    <Screen scroll={false}>
      <Banner kind="error">{error ?? undefined}</Banner>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>아직 메시지가 없습니다.</Text>}
        renderItem={({ item: m, index: i }) => {
          const isMine = m.sender_id === user?.id;
          const createdAt = new Date(m.created_at);
          const prev = messages[i - 1];
          const showDate = !prev || !isSameDay(new Date(prev.created_at), createdAt);
          const timeLabel = format(createdAt, 'a h:mm', { locale: ko });

          const dateDivider = showDate && (
            <View style={styles.dateWrap}>
              <Text style={styles.dateText}>{format(createdAt, 'M월 d일 (EEE)', { locale: ko })}</Text>
            </View>
          );

          if (m.type === 'ATTENDANCE_CHECK') {
            return (
              <View>
                {dateDivider}
                <Text style={[styles.system, { color: colors.primary }]}>
                  {m.sender?.name ?? '강사'}님이 출석체크를 시작했습니다 · {timeLabel}
                  {isStaff && (
                    <Text style={{ fontWeight: '600', textDecorationLine: 'underline' }} onPress={() => setPanel('attendance')}>
                      {'  '}바로가기
                    </Text>
                  )}
                </Text>
              </View>
            );
          }
          if (m.type === 'ATTENDANCE_RESPONSE') {
            return (
              <View>
                {dateDivider}
                <Text style={[styles.system, { color: colors.success }]}>
                  {m.content} · {timeLabel}
                </Text>
              </View>
            );
          }

          const isEditing = editingId === m.id;
          return (
            <View>
              {dateDivider}
              <View style={[styles.msgRow, isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <View style={{ maxWidth: '78%', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {!isMine && <Text style={styles.sender}>{m.sender?.name ?? '알 수 없음'}</Text>}
                  <View style={{ flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                    {isEditing ? (
                      <View style={{ gap: 6, minWidth: 200 }}>
                        <Input value={editText} onChangeText={setEditText} autoFocus onSubmitEditing={saveEdit} />
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                          <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={saveEdit}>
                            저장
                          </Text>
                          <Text style={{ color: colors.textMuted }} onPress={() => setEditingId(null)}>
                            취소
                          </Text>
                        </View>
                      </View>
                    ) : m.type === 'IMAGE' ? (
                      <Pressable onLongPress={() => onLongPress(m)}>
                        <ChatImage value={m.image_url} onOpen={setViewerUrl} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onLongPress={() => onLongPress(m)}
                        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
                      >
                        <Text style={{ fontSize: 15, color: isMine ? colors.white : colors.text }}>
                          {m.content}
                          {m.edited_at && (
                            <Text style={{ fontSize: 10, color: isMine ? '#BFDBFE' : colors.textMuted }}> (수정됨)</Text>
                          )}
                        </Text>
                      </Pressable>
                    )}
                    {!isEditing && <Text style={styles.time}>{timeLabel}</Text>}
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      {canPost ? (
        <View style={styles.inputBar}>
          <Pressable onPress={pickAndUploadImage} disabled={isUploading} style={styles.attachBtn}>
            <Icon name={isUploading ? 'hourglass-outline' : 'image-outline'} size={22} color={colors.textSub} />
          </Pressable>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="메시지 입력"
            style={{ flex: 1, paddingVertical: 9 }}
            multiline
          />
          <Button title="전송" icon="send" onPress={sendText} loading={isSending} disabled={!text.trim()} small />
        </View>
      ) : (
        isParent && <Text style={styles.readonly}>학부모는 읽기 전용으로 참여합니다.</Text>
      )}

      {/* 참여자 패널 */}
      <Modal visible={panel === 'participants'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPanel(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>참여자</Text>
            <Text style={styles.sheetClose} onPress={() => setPanel(null)}>
              닫기
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {room?.type === 'CLASS' ? (
              <>
                <Text style={styles.meta}>
                  담당 강사: {teacherName ?? '미배정'} · 수강생 {roster.length}명
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {roster.map((s) => (
                    <View key={s.id} style={styles.pill}>
                      <Text style={{ fontSize: 13, color: '#374151' }}>
                        {s.name}
                        {todayStatus.has(s.id) && (
                          <Text style={{ color: colors.textMuted }}> · {STATUS_LABEL[todayStatus.get(s.id)!]}</Text>
                        )}
                      </Text>
                    </View>
                  ))}
                  {roster.length === 0 && <Text style={styles.meta}>수강생이 없습니다.</Text>}
                </View>
              </>
            ) : (
              <Text style={styles.meta}>이 학원 소속 원장·강사·학생·학부모 전원이 볼 수 있는 공지방입니다.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 출석 체크 패널 */}
      <Modal
        visible={panel === 'attendance' && isStaff && room?.type === 'CLASS'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPanel(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>출석 체크</Text>
            <Text style={styles.sheetClose} onPress={() => setPanel(null)}>
              닫기
            </Text>
          </View>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Text style={styles.meta}>
              오늘({today}) 처리 {todayStatus.size} / {roster.length}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Input
                value={rosterFilter}
                onChangeText={setRosterFilter}
                placeholder="이름 검색"
                style={{ flex: 1, paddingVertical: 8 }}
              />
              <Text style={{ fontSize: 13, color: colors.textSub }}>미체크만</Text>
              <Switch value={onlyUnmarked} onValueChange={setOnlyUnmarked} />
            </View>
            <Button
              title="나머지 전체 출석"
              variant="secondary"
              small
              onPress={markAllPresent}
              disabled={todayStatus.size === roster.length}
            />
          </View>
          <FlatList
            data={visibleRoster}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={<Text style={styles.empty}>해당하는 학생이 없습니다.</Text>}
            renderItem={({ item: s }) => {
              const current = todayStatus.get(s.id);
              return (
                <View style={styles.rosterRow}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, flex: 1 }} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {STATUSES.map((st) => (
                      <Pressable
                        key={st.value}
                        onPress={() => markStatus(s, st.value)}
                        disabled={markingId === s.id}
                        style={[
                          styles.statusBtn,
                          current === st.value && { backgroundColor: st.color, borderColor: st.color },
                          markingId === s.id && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: current === st.value ? colors.white : colors.textMuted }}>
                          {st.short}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            }}
          />
          <Text style={[styles.meta, { padding: 16, paddingTop: 0 }]}>출 출석 · 지 지각 · 결 결석 · 사 사유결석</Text>
        </SafeAreaView>
      </Modal>

      {/* 이미지 확대 */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewerUrl(null)}>
          {viewerUrl && <Image source={{ uri: viewerUrl }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </Screen>
  );
}

export default function ChatRoomScreen() {
  return (
    <RequireRole roles={['ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']} requireStudentLink>
      <Inner />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingVertical: 32 },
  dateWrap: { alignItems: 'center', marginVertical: 8 },
  dateText: {
    fontSize: 12,
    color: colors.textSub,
    backgroundColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  system: { textAlign: 'center', fontSize: 12, marginVertical: 4 },
  msgRow: { flexDirection: 'row', marginVertical: 3 },
  sender: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  time: { fontSize: 10, color: colors.textMuted },
  image: { width: 200, height: 200, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  imagePlaceholder: { width: 200, height: 120, borderRadius: 14, backgroundColor: colors.graySoft },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.graySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonly: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetClose: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  pill: { backgroundColor: colors.graySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.graySoft,
  },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
});
