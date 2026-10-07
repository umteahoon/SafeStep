import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, IconTile } from './ui';
import type { IconName } from './ui';
import { cafeImage } from '../lib/cafeImages';
import { congestion } from '../lib/geo';
import { colors, radius } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

// ── 섹션 헤더 ────────────────────────────────────────
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── 바로가기 그리드 (4열, 카드 없이 담백하게) ──────────
export interface QuickItem {
  label: string;
  icon: IconName;
  /** 아이콘 색 */
  color: string;
  /** (하위 호환) 사용하지 않음 — 타일 배경은 항상 중립 톤 */
  bg?: string;
  onPress: () => void;
  badge?: number;
}

export function QuickGrid({ items }: { items: QuickItem[] }) {
  return (
    <View style={styles.quickWrap}>
      {items.map((it) => (
        <Pressable key={it.label} onPress={it.onPress} style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.55 }]}>
          <View style={styles.quickTile}>
            <Icon name={it.icon} size={26} color={it.color} />
            {!!it.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{it.badge > 9 ? '9+' : it.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.quickLabel} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── 가로 스크롤 ──────────────────────────────────────
export function HScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
      style={{ marginHorizontal: -20 }}
      decelerationRate="fast"
    >
      {children}
    </ScrollView>
  );
}

// ── 상태 점 + 라벨 ───────────────────────────────────
export function StatusDot({ empty, total, light }: { empty: number; total: number; light?: boolean }) {
  const st = congestion(empty, total);
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: st.color }]} />
      <Text style={[styles.statusText, light && { color: colors.white }]}>
        {st.label}
        {empty > 0 ? ` · ${empty}석 남음` : ''}
      </Text>
    </View>
  );
}

// ── 스터디카페 카드: 사진이 위, 정보는 아래 (여백 중심) ──
export function CafeCard({
  id,
  name,
  address,
  empty,
  total,
  onPress,
  fav,
  onToggleFav,
  distance,
  width = 232,
}: {
  id: string;
  name: string;
  address: string;
  empty: number;
  total: number;
  onPress: () => void;
  fav?: boolean;
  onToggleFav?: () => void;
  distance?: string;
  width?: number;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width }, pressed && { opacity: 0.85 }]}>
      <View style={styles.photoWrap}>
        <Image source={cafeImage(id)} style={styles.photo} resizeMode="cover" />
        {empty === 0 && <View style={styles.photoDim} />}
        {onToggleFav && (
          <Pressable onPress={onToggleFav} hitSlop={10} style={styles.heart}>
            <Icon name={fav ? 'heart' : 'heart-outline'} size={19} color={fav ? '#F43F5E' : colors.white} />
          </Pressable>
        )}
      </View>
      <Text style={styles.cafeName} numberOfLines={1}>
        {name}
      </Text>
      <StatusDot empty={empty} total={total} />
      <Text style={styles.cafeAddr} numberOfLines={1}>
        {distance ? `${distance} · ` : ''}
        {address}
      </Text>
    </Pressable>
  );
}

// ── 큰 추천 카드 캐러셀 (사진 + 그라데이션) ─────────────
export interface FeaturedItem {
  id: string;
  title: string;
  sub: string;
  empty: number;
  total: number;
  onPress: () => void;
}

export function FeaturedCarousel({ items }: { items: FeaturedItem[] }) {
  const [index, setIndex] = useState(0);
  const width = SCREEN_W - 40;
  const ref = useRef<ScrollView>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / (width + 12)));
  };
  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        snapToInterval={width + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        style={{ marginHorizontal: -20 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {items.map((f) => (
          <Pressable key={f.id} onPress={f.onPress} style={[styles.featured, { width }]}>
            <Image source={cafeImage(f.id)} style={FILL as any} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.featuredScrim} />
            <View style={styles.featuredBody}>
              <StatusDot empty={f.empty} total={f.total} light />
              <Text style={styles.featuredTitle} numberOfLines={1}>
                {f.title}
              </Text>
              <Text style={styles.featuredSub} numberOfLines={1}>
                {f.sub}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((f, i) => (
            <View key={f.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── 플랫 카드: 그림자 없이 연한 면으로만 구분 ──────────
export function FlatCard({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: any }) {
  const body = [styles.flat, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.8 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={body}>{children}</View>;
}

// ── 통계 타일 (플랫) ──────────────────────────────────
export function MiniStat({ icon, label, value, tint = colors.primary, onPress }: { icon: IconName; label: string; value: string; tint?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.miniStat}>
      <IconTile name={icon} color={tint} bg={tint + '14'} size={32} />
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </Pressable>
  );
}

// ── 타임라인 행 (오늘의 수업 등) ───────────────────────
export function TimelineRow({ time, title, sub, color, last }: { time: string; title: string; sub?: string; color: string; last?: boolean }) {
  return (
    <View style={[styles.tlRow, !last && styles.tlBorder]}>
      <Text style={styles.tlTime}>{time}</Text>
      <View style={[styles.tlBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.tlTitle}>{title}</Text>
        {sub && <Text style={styles.tlSub}>{sub}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 32, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sectionAction: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  quickItem: { width: '25%', alignItems: 'center', paddingVertical: 10, gap: 8 },
  quickTile: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#F3F5F8', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12.5, fontWeight: '600', color: '#374151' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  photoWrap: { width: '100%', aspectRatio: 1.45, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.graySoft, marginBottom: 12 },
  photo: { width: '100%', height: '100%' },
  photoDim: { ...FILL, backgroundColor: 'rgba(15,23,42,0.35)' },
  heart: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },
  cafeName: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  cafeAddr: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  featured: { height: 210, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.dark },
  featuredScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  featuredBody: { position: 'absolute', left: 20, right: 20, bottom: 18 },
  featuredTitle: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.5, marginTop: 6 },
  featuredSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotActive: { width: 16, backgroundColor: colors.text },
  flat: { backgroundColor: '#F7F8FA', borderRadius: radius.lg, padding: 18 },
  miniStat: { flex: 1, minWidth: '45%', backgroundColor: '#F7F8FA', borderRadius: radius.lg, padding: 16, gap: 4 },
  miniValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8, letterSpacing: -0.5 },
  miniLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  tlBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tlTime: { width: 52, fontSize: 13, fontWeight: '700', color: colors.textSub },
  tlBar: { width: 3, height: 32, borderRadius: 2 },
  tlTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tlSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
});
