import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useFavorites } from '../../lib/favorites';
import { cafeImage } from '../../lib/cafeImages';
import { congestion, distanceKm, formatDistance } from '../../lib/geo';
import { groupRegions } from '../../lib/region';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, Icon, Screen } from '../../components/ui';
import { CommunityTeaser } from '../../components/CommunityTeaser';
import { CafeCard, FeaturedCarousel, HScroll, QuickGrid, SectionHeader, StatusDot } from '../../components/home';
import { colors, radius } from '../../theme';
import type { RootNav, TabParamList } from '../../navigation/types';

export interface GuestCafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  empty: number;
  total: number;
}

type Preset = NonNullable<TabParamList['MapTab']>['preset'];

/**
 * 비로그인·일반 회원 홈 — "스터디카페를 고르는 화면".
 * 사진이 주인공이고, 이용자 기능만 노출. 일반 회원에게는 로그인 안내 대신 "학원·스터디카페 연동" 안내를 보여줍니다.
 */
export default function GuestHome({
  cafes,
  refreshing,
  onRefresh,
  memberName,
}: {
  cafes: GuestCafe[];
  refreshing: boolean;
  onRefresh: () => void;
  /** 값이 있으면 일반 회원(로그인했지만 학원 명부에 연동 안 됨) 모드 */
  memberName?: string;
}) {
  const navigation = useNavigation<RootNav>();
  const { isFavorite, toggleFavorite, favorites } = useFavorites();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  // 내 위치 (거리 표시·내 주변 정렬용). 거부하면 거리 없이 표시
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const p = await Location.getCurrentPositionAsync({});
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      } catch {
        /* 위치를 못 가져와도 계속 */
      }
    })();
  }, []);

  const goMap = (preset?: Preset) =>
    navigation.navigate('Main', { screen: 'MapTab', params: preset ? { preset, ts: Date.now() } : undefined });
  const goRegion = (sido: string) =>
    navigation.navigate('Main', { screen: 'MapTab', params: { region: { sido }, ts: Date.now() } });
  const openCafe = (id: string) => navigation.navigate('SeatFloorPlan', { academyId: id });

  const withDist = useMemo(
    () => cafes.map((c) => ({ ...c, km: pos ? distanceKm(pos, c.lat, c.lng) : (null as number | null) })),
    [cafes, pos]
  );
  const nearby = useMemo(
    () => (pos ? [...withDist].sort((a, b) => (a.km ?? 0) - (b.km ?? 0)) : withDist).slice(0, 8),
    [withDist, pos]
  );
  const roomy = useMemo(
    () =>
      withDist
        .filter((c) => c.empty > 0 && congestion(c.empty, c.total).ratio >= 0.5)
        .sort((a, b) => b.empty / b.total - a.empty / a.total)
        .slice(0, 8),
    [withDist]
  );
  const crowded = useMemo(
    () =>
      withDist
        .filter((c) => congestion(c.empty, c.total).ratio < 0.2)
        .sort((a, b) => a.empty / a.total - b.empty / b.total)
        .slice(0, 6),
    [withDist]
  );
  // 지역별 묶음 (주소에서 시/도·구/시를 뽑아 그룹화)
  const regions = useMemo(
    () => groupRegions(cafes.map((c) => ({ id: c.id, address: c.address, empty: c.empty, total: c.total }))),
    [cafes]
  );
  // 즐겨찾기한 스터디카페
  const favoriteCafes = useMemo(() => withDist.filter((c) => favorites.includes(c.id)), [withDist, favorites]);
  // 추천: 자리가 많이 남은 곳 3곳
  const featured = useMemo(
    () => [...withDist].filter((c) => c.empty > 0).sort((a, b) => b.empty / b.total - a.empty / a.total).slice(0, 3),
    [withDist]
  );

  const card = (c: (typeof withDist)[number]) => (
    <CafeCard
      key={c.id}
      id={c.id}
      name={c.name}
      address={c.address}
      distance={c.km != null ? formatDistance(c.km) : undefined}
      empty={c.empty}
      total={c.total}
      fav={isFavorite(c.id)}
      onToggleFav={() => toggleFavorite(c.id)}
      onPress={() => openCafe(c.id)}
    />
  );

  return (
    <Screen
      edges={['top', 'left', 'right']}
      backgroundColor={colors.white}
      contentStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>SafeStep</Text>
          <Text style={styles.title}>
            {memberName ? `${memberName}님,\n어떤 스터디카페를 찾으세요?` : '어떤 스터디카페를\n찾으세요?'}
          </Text>
        </View>
        {memberName ? (
          <Pressable onPress={() => navigation.navigate('Main', { screen: 'MeTab' })} hitSlop={8}>
            <Avatar name={memberName} size={40} />
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginPill} hitSlop={6}>
            <Text style={styles.loginText}>로그인</Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={() => goMap()} style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <Text style={styles.searchText}>지점명 또는 주소로 스터디카페 찾기</Text>
      </Pressable>

      {featured.length > 0 && (
        <FeaturedCarousel
          items={featured.map((c) => ({
            id: c.id,
            title: c.name,
            sub: `${c.km != null ? `${formatDistance(c.km)} · ` : ''}${c.address}`,
            empty: c.empty,
            total: c.total,
            onPress: () => openCafe(c.id),
          }))}
        />
      )}

      <View style={{ height: 14 }} />
      <QuickGrid
        items={[
          { label: '내 주변', icon: 'mc:crosshairs-gps', color: '#2563EB', onPress: () => goMap('near') },
          { label: '자리 있는 곳', icon: 'mc:seat', color: '#12A150', onPress: () => goMap('available') },
          { label: '한산한 순', icon: 'mc:gauge-low', color: '#0E9384', onPress: () => goMap('quiet') },
          { label: '즐겨찾기', icon: 'mc:heart', color: '#E11D48', onPress: () => goMap('fav') },
        ]}
      />

      {/* 안내 띠: 비로그인 = 로그인 안내 / 일반 회원 = 학원·스터디카페 연동 안내 */}
      {memberName ? (
        <Pressable onPress={() => navigation.navigate('StudentQr')} style={styles.loginStrip}>
          <Icon name="mc:link-variant" size={22} color={colors.primary} />
          <Text style={styles.stripText}>다니는 학원·스터디카페에서 받은 코드로 연동하면 이용권, 출결, 채팅을 쓸 수 있어요</Text>
          <Icon name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      ) : (
        <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginStrip}>
          <Icon name="mc:ticket-account" size={22} color={colors.primary} />
          <Text style={styles.stripText}>로그인하면 이용권 구매, 출결, 채팅을 쓸 수 있어요</Text>
          <Icon name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      )}

      {favoriteCafes.length > 0 && (
        <>
          <SectionHeader title="내 즐겨찾기" />
          <HScroll>{favoriteCafes.map(card)}</HScroll>
        </>
      )}

      {regions.length > 0 && (
        <>
          <SectionHeader title="지역별로 찾기" />
          <HScroll>
            {regions.map((g) => (
              <Pressable key={g.sido} onPress={() => goRegion(g.sido)} style={styles.regionCard}>
                <Image source={cafeImage(g.topCafeId)} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']} style={styles.regionScrim} />
                <View style={styles.regionBody}>
                  <Text style={styles.regionName}>{g.sido}</Text>
                  <Text style={styles.regionSub}>스터디카페 {g.count}곳</Text>
                </View>
              </Pressable>
            ))}
          </HScroll>
        </>
      )}

      <SectionHeader title="내 주변 스터디카페" action="전체 보기" onAction={() => goMap('near')} />
      <HScroll>{nearby.map(card)}</HScroll>

      {roomy.length > 0 && (
        <>
          <SectionHeader title="지금 한산한 곳" action="더보기" onAction={() => goMap('quiet')} />
          <HScroll>{roomy.map(card)}</HScroll>
        </>
      )}

      {crowded.length > 0 && (
        <>
          <SectionHeader title="곧 만석이에요" />
          {crowded.map((c, i) => {
            const st = congestion(c.empty, c.total);
            return (
              <Pressable
                key={c.id}
                onPress={() => openCafe(c.id)}
                style={[styles.crowdRow, i < crowded.length - 1 && styles.crowdBorder]}
              >
                <Image source={cafeImage(c.id)} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.crowdName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <StatusDot empty={c.empty} total={c.total} />
                </View>
                <Text style={[styles.crowdSeats, { color: st.color }]}>
                  {c.empty}/{c.total}석
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      <CommunityTeaser />

      {/* 운영자용 안내: 맨 아래 작게 */}
      {!memberName && (
      <View style={styles.operator}>
        <Icon name="mc:storefront-outline" size={16} color={colors.textMuted} />
        <Text style={styles.operatorText}>스터디카페를 운영하시나요?</Text>
        <Text style={styles.operatorLink} onPress={() => navigation.navigate('StartGuide')}>
          시작 가이드
        </Text>
        <Text style={styles.operatorText}>·</Text>
        <Text style={styles.operatorLink} onPress={() => navigation.navigate('Inquiry')}>
          도입 문의
        </Text>
      </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4, paddingBottom: 18, gap: 12 },
  brand: { fontSize: 13, color: colors.primary, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginTop: 6, lineHeight: 35 },
  loginPill: { backgroundColor: '#F3F5F8', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  loginText: { fontSize: 13, fontWeight: '700', color: colors.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F5F8', borderRadius: radius.md, height: 50, paddingHorizontal: 16, marginBottom: 16 },
  searchText: { fontSize: 14, color: colors.textMuted },
  loginStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEF4FF', borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 14, marginTop: 10 },
  stripText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primaryDark, lineHeight: 18 },
  regionCard: { width: 150, height: 176, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.dark },
  regionScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
  regionBody: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  regionName: { fontSize: 24, fontWeight: '800', color: colors.white, letterSpacing: -0.6 },
  regionSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  crowdRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  crowdBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.graySoft },
  crowdName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 1 },
  crowdSeats: { fontSize: 14, fontWeight: '800' },
  operator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 36, paddingVertical: 12 },
  operatorText: { fontSize: 12, color: colors.textMuted },
  operatorLink: { fontSize: 12, color: colors.textSub, fontWeight: '700', textDecorationLine: 'underline' },
});
