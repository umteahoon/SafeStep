import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cafeImage } from '../../lib/cafeImages';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { BlockRoles } from '../../components/Guard';
import { EXPLORE_BLOCKED } from '../../lib/teams';
import { useAuth } from '../../lib/useAuth';
import { useFavorites } from '../../lib/favorites';
import { Button, Icon, Screen } from '../../components/ui';
import { colors } from '../../theme';
import { FloorPlanGrid } from './FloorPlanGrid';
import { NoiseReportModal } from './NoiseReportModal';
import type { RootNav, RootStackParamList } from '../../navigation/types';
import type { Academy, Seat } from '../../types';

function SeatFloorPlanScreenInner() {
  const navigation = useNavigation<RootNav>();
  const { academyId } = useRoute<RouteProp<RootStackParamList, 'SeatFloorPlan'>>().params;
  const { user, profile, isMember } = useAuth();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [reportSeat, setReportSeat] = useState<Seat | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);
  const { isFavorite, toggleFavorite, addRecent } = useFavorites();

  // 최근 본 스터디카페에 기록
  useEffect(() => {
    addRecent(academyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  useEffect(() => {
    supabase
      .from('community_posts')
      .select('id')
      .eq('academy_id', academyId)
      .then(({ data }) => setPostCount(((data as any[]) ?? []).length));
  }, [academyId]);

  useEffect(() => {
    supabase
      .from('academies')
      .select('*')
      .eq('id', academyId)
      .single()
      .then(({ data }) => {
        const a = data as Academy | null;
        setAcademy(a);
        if (a) navigation.setOptions({ title: a.name });
      });
  }, [academyId, navigation]);

  return (
    <Screen>
      {/* 상단 사진 헤더 */}
      <View style={styles.hero}>
        <Image source={cafeImage(academyId)} style={styles.heroImg} resizeMode="cover" />
        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.7)']} style={styles.heroScrim} />
        <Pressable onPress={() => toggleFavorite(academyId)} hitSlop={10} style={styles.heroHeart}>
          <Icon name={isFavorite(academyId) ? 'heart' : 'heart-outline'} size={22} color={isFavorite(academyId) ? '#F43F5E' : '#FFFFFF'} />
        </Pressable>
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {academy?.name ?? '좌석 도면'}
          </Text>
          {academy && (
            <Text style={styles.heroSub} numberOfLines={1}>
              {academy.address}
            </Text>
          )}
        </View>
      </View>
      <View style={{ height: 16 }} />

      {/* 이 스터디카페의 커뮤니티 */}
      <Pressable onPress={() => navigation.navigate('Community', { academyId })} style={styles.community}>
        <Icon name="mc:forum" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.communityTitle}>스터디카페 커뮤니티</Text>
          <Text style={styles.communitySub}>
            {postCount ? `이웃들의 이야기 ${postCount}개` : '후기, 질문, 스터디 모집을 나눠보세요'}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <View style={{ gap: 8, marginBottom: 16 }}>
        <Button
          title="키오스크로 입/퇴실하기"
          onPress={() => navigation.navigate('Kiosk', { academyId })}
        />
        {/* 이용권 구매: 비로그인이면 로그인 후 이용권 화면으로 돌아옴 (학생 계정 전용) */}
        {(!user || profile?.role === 'STUDENT') && (
          <Button
            title="이용권 구매하기"
            icon="ticket-outline"
            variant="secondary"
            onPress={() =>
              user
                ? navigation.navigate('StudentPasses')
                : navigation.navigate('Login', { next: { name: 'StudentPasses' } })
            }
          />
        )}
        {profile?.role === 'STUDENT' && !isMember && (
          <Button
            title="QR 없이 바로 출석 체크인"
            icon="qr-code-outline"
            variant="secondary"
            onPress={() => navigation.navigate('Kiosk', { academyId, self: true })}
          />
        )}
      </View>

      <FloorPlanGrid academyId={academyId} onSelectSeat={setReportSeat} />
      <NoiseReportModal seat={reportSeat} onClose={() => setReportSeat(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: -16, marginTop: -16, height: 230, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', backgroundColor: '#0F172A' },
  heroImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  heroHeart: { position: 'absolute', top: 14, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  heroBody: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  community: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F3F7FF', borderRadius: 20, padding: 16, marginBottom: 16 },
  communityTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  communitySub: { fontSize: 12, color: colors.textSub, marginTop: 3 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 4 },
});

export default function SeatFloorPlanScreen() {
  return (
    <BlockRoles roles={EXPLORE_BLOCKED}>
      <SeatFloorPlanScreenInner />
    </BlockRoles>
  );
}
