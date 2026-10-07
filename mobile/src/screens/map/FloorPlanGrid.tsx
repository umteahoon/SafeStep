import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Empty, Icon, Loading } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { colors } from '../../theme';
import type { AcademyLandmark, Seat } from '../../types';

interface Props {
  academyId: string;
  onSelectSeat?: (seat: Seat) => void;
}

interface ZoneMeta {
  label: string;
  note?: string;
  order: number;
}

// zone_type → 표시 정보 (웹 FloorPlanGrid 와 동일)
const ZONE_META: Record<string, ZoneMeta> = {
  FOCUS: { label: '포커스존 · 1인 칸막이석', note: '정숙 구역', order: 1 },
  OPEN: { label: '자유존 · 오픈석', note: '가벼운 대화 가능', order: 2 },
  LAPTOP: { label: '카페존(노트북)', note: '타이핑 허용', order: 3 },
  DESK: { label: '컴퓨터책상', note: 'PC 이용석', order: 4 },
  ROOM_A: { label: '스터디룸 A', note: '4인 · 예약제', order: 5 },
  ROOM_B: { label: '스터디룸 B', note: '4인 · 예약제', order: 6 },
};
const metaFor = (zone: string): ZoneMeta => ZONE_META[zone] ?? { label: zone, order: 99 };

const STATUS_COLOR: Record<Seat['status'], { bg: string; border: string; fg: string }> = {
  EMPTY: { bg: colors.white, border: colors.borderStrong, fg: colors.textSub },
  OCCUPIED: { bg: '#3B82F6', border: '#3B82F6', fg: colors.white },
  AWAY: { bg: '#FBBF24', border: '#FBBF24', fg: colors.white },
};

// 존별 좌석 크기: 1인 집중석은 칸막이(위쪽 두꺼운 테두리)
const SIZE: Record<string, { w: number; h: number; r: number; topBorder?: number }> = {
  FOCUS: { w: 40, h: 52, r: 6, topBorder: 4 },
  OPEN: { w: 40, h: 40, r: 8 },
  LAPTOP: { w: 52, h: 40, r: 8 },
  DESK: { w: 40, h: 40, r: 6 },
  ROOM: { w: 38, h: 38, r: 19 },
};
const sizeFor = (zone: string) => SIZE[zone.startsWith('ROOM') ? 'ROOM' : zone] ?? SIZE.OPEN;
const GAP = 8;

function SeatCell({ seat, onPress }: { seat: Seat; onPress?: (s: Seat) => void }) {
  const sz = sizeFor(seat.zone_type);
  const c = STATUS_COLOR[seat.status];
  return (
    <Pressable
      onPress={() => onPress?.(seat)}
      style={{
        width: sz.w,
        height: sz.h,
        borderRadius: sz.r,
        backgroundColor: c.bg,
        borderColor: c.border,
        borderWidth: 1,
        borderTopWidth: sz.topBorder ?? 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600' }}>{seat.seat_number}</Text>
    </Pressable>
  );
}

/** 좌표 격자를 절대 위치로 그립니다. cellW/cellH 는 격자 한 칸의 크기 */
function Grid({
  seats,
  landmarks = [],
  onSelectSeat,
}: {
  seats: Seat[];
  landmarks?: AcademyLandmark[];
  onSelectSeat?: (s: Seat) => void;
}) {
  const xs = [...seats.map((s) => s.grid_x), ...landmarks.map((l) => l.grid_x)];
  const ys = [...seats.map((s) => s.grid_y), ...landmarks.map((l) => l.grid_y)];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const cols = Math.max(...xs) - minX + 1;
  const rows = Math.max(...ys) - minY + 1;
  const cellW = 56 + GAP;
  const cellH = 56 + GAP;

  return (
    <View style={{ width: cols * cellW, height: rows * cellH }}>
      {seats.map((s) => (
        <View
          key={s.id}
          style={{
            position: 'absolute',
            left: (s.grid_x - minX) * cellW,
            top: (s.grid_y - minY) * cellH,
          }}
        >
          <SeatCell seat={s} onPress={onSelectSeat} />
        </View>
      ))}
      {landmarks.map((l) => (
        <View
          key={l.id}
          style={[
            styles.landmark,
            { left: (l.grid_x - minX) * cellW, top: (l.grid_y - minY) * cellH + 12 },
          ]}
        >
          <Text style={styles.landmarkText}>
            {l.icon} {l.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ZoneBox({
  zone,
  seats,
  onSelectSeat,
}: {
  zone: string;
  seats: Seat[];
  onSelectSeat?: (s: Seat) => void;
}) {
  const meta = metaFor(zone);
  const isRoom = zone.startsWith('ROOM');
  const emptyCount = seats.filter((s) => s.status === 'EMPTY').length;
  const half = Math.ceil(seats.length / 2);

  return (
    <View style={styles.zone}>
      <View style={styles.zoneHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.zoneTitle}>{meta.label}</Text>
          {meta.note && <Text style={styles.zoneNote}>{meta.note}</Text>}
        </View>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: emptyCount > 0 ? colors.primarySoft : colors.graySoft },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: emptyCount > 0 ? colors.primary : colors.textMuted }}>
            {emptyCount}석
          </Text>
        </View>
      </View>

      {isRoom ? (
        // 스터디룸: 가운데 테이블 + 둘레 좌석
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {seats.slice(0, half).map((s) => (
              <SeatCell key={s.id} seat={s} onPress={onSelectSeat} />
            ))}
          </View>
          <View style={styles.table}>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>TABLE</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {seats.slice(half).map((s) => (
              <SeatCell key={s.id} seat={s} onPress={onSelectSeat} />
            ))}
          </View>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Grid seats={seats} onSelectSeat={onSelectSeat} />
        </ScrollView>
      )}
    </View>
  );
}

export function FloorPlanGrid({ academyId, onSelectSeat }: Props) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [landmarks, setLandmarks] = useState<AcademyLandmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 랜드마크가 하나라도 있으면 실제 매장 배치를 재현한 "자유 배치" 모드
  useEffect(() => {
    supabase
      .from('academy_landmarks')
      .select('*')
      .eq('academy_id', academyId)
      .then(({ data }) => setLandmarks((data as AcademyLandmark[]) ?? []));
  }, [academyId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from('seats')
        .select('*')
        .eq('academy_id', academyId)
        .order('seat_number');
      if (mounted) {
        setSeats((data as Seat[]) ?? []);
        setIsLoading(false);
      }
    }
    load();

    // 좌석 상태 실시간 반영 (입/퇴실, 외출/복귀 즉시 화면 갱신)
    const channel = supabase
      .channel(`seats-${academyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats', filter: `academy_id=eq.${academyId}` },
        (payload) => {
          setSeats((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((s) => s.id !== (payload.old as Seat).id);
            }
            const updated = payload.new as Seat;
            return prev.some((s) => s.id === updated.id)
              ? prev.map((s) => (s.id === updated.id ? updated : s))
              : [...prev, updated];
          });
        }
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [academyId]);

  const zones = useMemo(() => {
    const byZone = new Map<string, Seat[]>();
    for (const seat of seats) {
      const key = seat.zone_type || 'OPEN';
      if (!byZone.has(key)) byZone.set(key, []);
      byZone.get(key)!.push(seat);
    }
    return [...byZone.entries()]
      .map(([zone, zoneSeats]) => ({ zone, seats: zoneSeats }))
      .sort((a, b) => metaFor(a.zone).order - metaFor(b.zone).order);
  }, [seats]);

  const emptyCount = seats.filter((s) => s.status === 'EMPTY').length;

  if (isLoading) return <Loading text="좌석 정보를 불러오는 중..." />;
  if (seats.length === 0) return <Empty>아직 좌석 도면이 등록되지 않았습니다.</Empty>;

  return (
    <View>
      {/* 범례 + 요약 */}
      <View style={styles.legend}>
        <Legend color={colors.white} border={colors.borderStrong} label="빈자리" />
        <Legend color="#3B82F6" label="사용중" />
        <Legend color="#FBBF24" label="외출중" />
        <Text style={styles.summary}>
          잔여 {emptyCount} / {seats.length}석
        </Text>
      </View>

      {landmarks.length > 0 ? (
        // 자유 배치 모드: 실제 매장 사진 기준 절대 좌표로 좌석·통로·시설 재현
        <View style={styles.canvas}>
          <ScrollView horizontal>
            <Grid seats={seats} landmarks={landmarks} onSelectSeat={onSelectSeat} />
          </ScrollView>
        </View>
      ) : (
        <>
          <View style={styles.entrance}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="enter-outline" size={15} color={colors.textSub} />
              <Text style={styles.entranceText}>입구</Text>
            </View>
            <Text style={styles.entranceText}>프론트데스크 · 키오스크</Text>
          </View>
          {zones.map(({ zone, seats: zoneSeats }) => (
            <ZoneBox key={zone} zone={zone} seats={zoneSeats} onSelectSeat={onSelectSeat} />
          ))}
          <View style={styles.amenities}>
            {([
              ['water-outline', '정수기'],
              ['man-outline', '화장실'],
              ['lock-closed-outline', '사물함'],
              ['cafe-outline', '휴게실'],
            ] as [IconName, string][]).map(([icon, t]) => (
              <View key={t} style={styles.amenity}>
                <Icon name={icon} size={14} color={colors.textMuted} />
                <Text style={styles.amenityText}>{t}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={styles.hint}>좌석을 누르면 소음·자리 독점을 익명으로 신고할 수 있습니다.</Text>
    </View>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          backgroundColor: color,
          borderWidth: border ? 1 : 0,
          borderColor: border,
        }}
      />
      <Text style={{ fontSize: 12, color: colors.textSub }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  summary: { marginLeft: 'auto', fontSize: 13, fontWeight: '600', color: colors.text },
  canvas: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  entrance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  entranceText: { fontSize: 12, fontWeight: '500', color: colors.textSub },
  zone: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  zoneHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  zoneTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  zoneNote: { fontSize: 12, color: colors.textMuted },
  countBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  table: {
    width: '75%',
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landmark: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  landmarkText: { fontSize: 11, fontWeight: '500', color: colors.textSub },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  amenityText: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 12 },
});
