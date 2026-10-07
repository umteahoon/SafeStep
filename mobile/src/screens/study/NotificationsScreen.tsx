import { useCallback, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useNotifications } from '../../lib/notifications';
import { RequireRole } from '../../components/Guard';
import { Button, Empty, IconTile, Loading, Screen } from '../../components/ui';
import { colors, radius, shadow } from '../../theme';
import type { RootNav } from '../../navigation/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

function Inner() {
  const navigation = useNavigation<RootNav>();
  const { items, loading, markAllSeen, seenAt } = useNotifications();
  // 화면을 연 시점의 "읽은 시각"을 기억해 새 알림에만 점을 표시
  const openedSeen = useRef<number | null>(null);
  if (openedSeen.current === null && !loading) openedSeen.current = seenAt;

  // 화면을 떠날 때 모두 읽음 처리
  useFocusEffect(
    useCallback(() => {
      return () => markAllSeen();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (loading) return <Loading />;

  return (
    <Screen>
      {items.length === 0 ? (
        <Empty icon="notifications-off-outline">새로운 알림이 없어요</Empty>
      ) : (
        <>
          <View style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
            <Button title="모두 읽음" variant="ghost" small onPress={markAllSeen} />
          </View>
          {items.map((n) => {
            const unread = new Date(n.at).getTime() > (openedSeen.current ?? 0);
            return (
              <Pressable
                key={n.id}
                disabled={!n.to}
                onPress={() => n.to && navigation.navigate(n.to as any)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    gap: 12,
                    backgroundColor: unread ? '#F5F9FF' : colors.white,
                    borderRadius: radius.lg,
                    padding: 14,
                    marginBottom: 10,
                    ...shadow,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <IconTile name={n.icon} color={n.tint} bg={n.bg} size={42} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, flexShrink: 1 }} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {unread && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger }} />}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSub, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>
                    {n.desc}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>{timeAgo(n.at)}</Text>
                </View>
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}

export default function NotificationsScreen() {
  return (
    <RequireRole roles={['STUDENT', 'ACADEMY_ADMIN', 'TEACHER', 'PARENT']}>
      <Inner />
    </RequireRole>
  );
}
