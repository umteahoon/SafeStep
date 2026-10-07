import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useFavorites } from '../../lib/favorites';
import { EXPLORE_BLOCKED } from '../../lib/teams';
import { BlockRoles } from '../../components/Guard';
import { distanceKm, formatDistance } from '../../lib/geo';
import { cafeImage } from '../../lib/cafeImages';
import { groupRegions, inRegion } from '../../lib/region';
import { RegionSheet } from '../../components/RegionSheet';
import type { RegionValue } from '../../components/RegionSheet';
import { Badge, Chip, Empty, Icon, Loading } from '../../components/ui';
import { colors, shadow } from '../../theme';
import type { RootNav, TabParamList } from '../../navigation/types';
import type { Academy } from '../../types';

interface AcademyWithSeats extends Academy {
  emptySeats: number;
}


type SortMode = 'default' | 'near' | 'most';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청 (위치 권한 거부 시 기본값)
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID as string | undefined;
// 네이버 클라우드 콘솔의 "Web 서비스 URL"에 등록된 주소와 같아야 지도가 로드됩니다.
const NAVER_WEB_URL = (process.env.EXPO_PUBLIC_NAVER_MAP_WEB_URL as string | undefined) ?? 'http://localhost';

function buildMapHtml(clientId: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}"></script>
</head><body><div id="map"></div>
<script>
  var map, markers = [], info = null;
  function post(msg){ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function init(c){
    if(!window.naver || !window.naver.maps){ post({type:'error', message:'네이버 지도 클라이언트 ID 또는 Web 서비스 URL 설정을 확인하세요.'}); return; }
    map = new naver.maps.Map('map', { center: new naver.maps.LatLng(c.lat, c.lng), zoom: 14 });
    post({type:'ready'});
  }
  function setMarkers(list){
    if(!map) return;
    markers.forEach(function(m){ m.setMap(null); }); markers = [];
    list.forEach(function(a){
      var marker = new naver.maps.Marker({ position: new naver.maps.LatLng(a.latitude, a.longitude), map: map, title: a.name });
      var iw = new naver.maps.InfoWindow({ content: '<div style="padding:8px 12px;font-size:13px;"><strong>'+a.name+'</strong><br/>잔여석 '+a.emptySeats+'석</div>' });
      naver.maps.Event.addListener(marker, 'click', function(){
        if(info) info.close(); iw.open(map, marker); info = iw; post({type:'select', id:a.id});
      });
      markers.push(marker);
    });
  }
  function focusOn(lat, lng){ if(!map) return; map.panTo(new naver.maps.LatLng(lat, lng)); map.setZoom(16); }
  function onMsg(e){
    try { var m = JSON.parse(e.data);
      if(m.type==='init') init(m.center);
      if(m.type==='markers') setMarkers(m.list);
      if(m.type==='focus') focusOn(m.lat, m.lng);
    } catch(err){}
  }
  document.addEventListener('message', onMsg); window.addEventListener('message', onMsg);
  post({type:'loaded'});
</script></body></html>`;
}

function MapScreenInner() {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<RouteProp<TabParamList, 'MapTab'>>();
  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(
    NAVER_CLIENT_ID ? null : 'EXPO_PUBLIC_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다. (목록만 표시됩니다)'
  );
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [webLoaded, setWebLoaded] = useState(false);

  const [academies, setAcademies] = useState<AcademyWithSeats[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [region, setRegion] = useState<RegionValue>({ sido: null, sigungu: null });
  const [regionOpen, setRegionOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>('default');
  const [hasLocation, setHasLocation] = useState(false);

  // 홈 바로가기에서 넘어온 빠른 필터 적용 (ts 가 바뀔 때마다 재적용)
  const preset = route.params?.preset;
  const presetTs = route.params?.ts;
  const presetRegion = route.params?.region;
  // 홈의 "지역별로 찾기"에서 넘어온 지역 적용
  useEffect(() => {
    if (!presetRegion) return;
    setRegion({ sido: presetRegion.sido, sigungu: presetRegion.sigungu ?? null });
    setOnlyAvailable(false);
    setOnlyFav(false);
    setSort('default');
    setSearchQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetRegion?.sido, presetRegion?.sigungu, presetTs]);

  useEffect(() => {
    if (!preset) return;
    setOnlyAvailable(preset === 'available');
    setOnlyFav(preset === 'fav');
    setSort(preset === 'near' ? 'near' : preset === 'quiet' ? 'most' : 'default');
    setSearchQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, presetTs]);

  // 사용자 위치 (권한 거부 시 기본 좌표 유지)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHasLocation(true);
      } catch {
        /* 위치를 못 가져와도 기본 좌표로 계속 */
      }
    })();
  }, []);

  // 학원/스터디카페 + 잔여석 로드, 좌석 상태 실시간 반영
  useEffect(() => {
    async function load() {
      const { data: academyRows, error: academyError } = await supabase.from('academies').select('*');
      if (academyError || !academyRows) {
        setIsLoadingList(false);
        return;
      }
      const { data: seatRows } = await supabase.from('seats').select('academy_id, status');
      const withSeats: AcademyWithSeats[] = academyRows.map((a: Academy) => ({
        ...a,
        emptySeats:
          seatRows?.filter((s) => s.academy_id === a.id && s.status === 'EMPTY').length ?? 0,
      }));
      setAcademies(withSeats);
      setIsLoadingList(false);
    }
    load();

    const channel = supabase
      .channel('seats-map-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const send = (msg: object) => webRef.current?.postMessage(JSON.stringify(msg));

  // WebView 로드 완료 → 지도 초기화
  useEffect(() => {
    if (webLoaded) send({ type: 'init', center });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webLoaded]);

  // 지도 준비 후/학원 목록 변경 시 마커 갱신
  useEffect(() => {
    if (mapReady) send({ type: 'markers', list: academies });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, academies]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = academies.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q)
    );
    if (onlyAvailable) list = list.filter((a) => a.emptySeats > 0);
    if (onlyFav) list = list.filter((a) => isFavorite(a.id));
    if (region.sido) list = list.filter((a) => inRegion(a.address, region.sido, region.sigungu));
    if (sort === 'near') {
      list = [...list].sort(
        (a, b) => distanceKm(center, a.latitude, a.longitude) - distanceKm(center, b.latitude, b.longitude)
      );
    }
    if (sort === 'most') list = [...list].sort((a, b) => b.emptySeats - a.emptySeats);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academies, searchQuery, onlyAvailable, onlyFav, region, sort, center, isFavorite]);

  const regions = useMemo(
    () => groupRegions(academies.map((a) => ({ id: a.id, address: a.address, empty: a.emptySeats, total: a.total_seats }))),
    [academies]
  );
  const activeSido = regions.find((g) => g.sido === region.sido);
  const regionLabel = region.sido ? (region.sigungu ? `${region.sido} · ${region.sigungu}` : region.sido) : '지역';

  // 지역을 고르면 그 지역의 첫 지점으로 지도를 이동
  const applyRegion = (v: RegionValue) => {
    setRegion(v);
    setRegionOpen(false);
    const first = academies.find((a) => inRegion(a.address, v.sido, v.sigungu));
    if (v.sido && first) focusAcademy(first);
  };

  const focusAcademy = (a: AcademyWithSeats) => {
    setSelectedId(a.id);
    send({ type: 'focus', lat: a.latitude, lng: a.longitude });
  };

  const html = useMemo(() => (NAVER_CLIENT_ID ? buildMapHtml(NAVER_CLIENT_ID) : ''), []);

  return (
    <View style={styles.container}>
      {NAVER_CLIENT_ID ? (
        <View style={styles.mapBox}>
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html, baseUrl: NAVER_WEB_URL }}
            javaScriptEnabled
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'loaded') setWebLoaded(true);
                if (msg.type === 'ready') setMapReady(true);
                if (msg.type === 'error') setMapError(msg.message);
                if (msg.type === 'select') setSelectedId(msg.id);
              } catch {
                /* 무시 */
              }
            }}
            onError={() => setMapError('지도를 불러오지 못했습니다.')}
          />
          {!mapReady && !mapError && (
            <View style={styles.mapOverlay}>
              <Loading text="지도를 불러오는 중..." />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapPlaceholderIcon}>
            <Icon name="map" size={30} color={colors.primary} />
          </View>
          <Text style={styles.mapPlaceholderText}>
            네이버 지도 키를 설정하면 이곳에 지도가 표시됩니다
          </Text>
        </View>
      )}

      {/* 지도 위에 떠 있는 검색창 */}
      <SafeAreaView edges={['top']} style={styles.searchWrap} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="지점명 또는 주소로 검색"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => filtered[0] && focusAcademy(filtered[0])}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
      {mapError && NAVER_CLIENT_ID && <Text style={styles.mapError}>{mapError}</Text>}

      {/* 하단 시트: 지점 목록 */}
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.listHeader}>
          <Text style={styles.heading}>주변 스터디카페 · 학원</Text>
          <Text style={styles.sub}>실시간 잔여석을 확인하세요</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            <Pressable onPress={() => setRegionOpen(true)} style={[styles.regionChip, !!region.sido && styles.regionChipOn]}>
              <Icon name="location-outline" size={14} color={region.sido ? colors.white : colors.textSub} />
              <Text style={[styles.regionText, !!region.sido && { color: colors.white }]}>{regionLabel}</Text>
              <Icon name="chevron-down" size={14} color={region.sido ? colors.white : colors.textSub} />
            </Pressable>
            <Chip label="잔여석 있는 곳" selected={onlyAvailable} onPress={() => setOnlyAvailable((v) => !v)} />
            <Chip label="즐겨찾기" selected={onlyFav} onPress={() => setOnlyFav((v) => !v)} />
            <Chip label="가까운 순" selected={sort === 'near'} onPress={() => setSort((s) => (s === 'near' ? 'default' : 'near'))} />
            <Chip label="자리 많은 순" selected={sort === 'most'} onPress={() => setSort((s) => (s === 'most' ? 'default' : 'most'))} />
          </ScrollView>
          {/* 시/도를 고르면 그 안의 구/시로 한 단계 더 좁혀 들어가는 칩 */}
          {activeSido && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              <Chip label={`${region.sido} 전체`} selected={!region.sigungu} onPress={() => applyRegion({ sido: region.sido, sigungu: null })} />
              {activeSido.districts.map((d) => (
                <Chip
                  key={d.name}
                  label={`${d.name} ${d.count}`}
                  selected={region.sigungu === d.name}
                  onPress={() => applyRegion({ sido: region.sido, sigungu: d.name })}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {isLoadingList ? (
          <Loading />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Empty icon="location-outline">
                {academies.length === 0
                  ? '등록된 지점이 없습니다.'
                  : onlyFav && !searchQuery
                    ? '즐겨찾기한 지점이 없어요. 하트를 눌러 추가해보세요.'
                    : onlyAvailable && !searchQuery
                    ? '지금 잔여석이 있는 지점이 없습니다.'
                    : '조건에 맞는 지점이 없습니다.'}
              </Empty>
            }
            renderItem={({ item: a }) => (
              <Pressable
                onPress={() => navigation.navigate('SeatFloorPlan', { academyId: a.id })}
                style={({ pressed }) => [
                  styles.item,
                  selectedId === a.id && { borderColor: colors.primary },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Image source={cafeImage(a.id)} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.itemAddr} numberOfLines={1}>
                    {hasLocation ? `${formatDistance(distanceKm(center, a.latitude, a.longitude))} · ` : ''}
                    {a.address}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <Badge
                      text={`잔여 ${a.emptySeats} / ${a.total_seats}석`}
                      bg={a.emptySeats > 0 ? colors.primarySoft : colors.graySoft}
                      fg={a.emptySeats > 0 ? colors.primary : colors.textMuted}
                    />
                    {NAVER_CLIENT_ID && (
                      <Pressable onPress={() => focusAcademy(a)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Icon name="locate" size={14} color={colors.primary} />
                        <Text style={styles.itemHint}>지도에서 보기</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                <Pressable onPress={() => toggleFavorite(a.id)} hitSlop={10}>
                  <Icon name={isFavorite(a.id) ? 'heart' : 'heart-outline'} size={22} color={isFavorite(a.id) ? '#F43F5E' : colors.textMuted} />
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </View>
      <RegionSheet visible={regionOpen} groups={regions} value={region} onSelect={applyRegion} onClose={() => setRegionOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapBox: { height: '46%', backgroundColor: colors.graySoft },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', backgroundColor: colors.graySoft },
  mapPlaceholder: { height: '34%', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40, gap: 10 },
  mapPlaceholderIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholderText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  searchWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  mapError: { position: 'absolute', top: 96, left: 16, right: 16, fontSize: 12, color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 8, borderRadius: 10, textAlign: 'center', overflow: 'hidden' },
  sheet: {
    flex: 1,
    marginTop: -22,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    ...shadow,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: 8 },
  listHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 0 },
  heading: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
    ...shadow,
  },
  regionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  regionChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  regionText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  thumb: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.graySoft },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemAddr: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  itemHint: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});

export default function MapScreen() {
  return (
    <BlockRoles roles={EXPLORE_BLOCKED}>
      <MapScreenInner />
    </BlockRoles>
  );
}
