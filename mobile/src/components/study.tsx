import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { formatClock, formatMinutes } from '../lib/studyStats';
import { colors, radius, shadow } from '../theme';
import type { Seat } from '../types';

// ── 지금 이용 중 카드 ─────────────────────────────────
export function LiveSeatCard({
  seat,
  academyName,
  elapsedSec,
  onPress,
}: {
  seat: Seat;
  academyName: string;
  elapsedSec: number;
  onPress?: () => void;
}) {
  const away = seat.status === 'AWAY';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.live, pressed && { opacity: 0.9 }]}>
      <View style={styles.liveDeco} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.liveDot, { backgroundColor: away ? colors.warn : '#4ADE80' }]} />
        <Text style={styles.liveLabel}>{away ? '외출 중' : '지금 이용 중'}</Text>
        {academyName ? <Text style={styles.liveSub}> · {academyName}</Text> : null}
      </View>
      <Text style={styles.liveClock}>{formatClock(elapsedSec)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="location" size={14} color="rgba(255,255,255,0.8)" />
        <Text style={styles.liveSeat}>{seat.seat_number}번 좌석</Text>
        {onPress && (
          <View style={styles.liveBtn}>
            <Text style={styles.liveBtnText}>외출 · 퇴실</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── 주간 막대 그래프 ──────────────────────────────────
export function WeekChart({ bars }: { bars: { label: string; minutes: number; isToday: boolean; isFuture: boolean }[] }) {
  const max = Math.max(60, ...bars.map((b) => b.minutes));
  const H = 110;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: H + 22 }}>
        {bars.map((b) => {
          const h = b.minutes > 0 ? Math.max(6, (b.minutes / max) * H) : 4;
          return (
            <View key={b.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {b.minutes > 0 && <Text style={styles.barValue}>{b.minutes >= 60 ? `${(b.minutes / 60).toFixed(1)}h` : `${b.minutes}m`}</Text>}
              <View
                style={{
                  width: 22,
                  height: h,
                  borderRadius: 8,
                  backgroundColor: b.isToday ? colors.primary : b.minutes > 0 ? '#9DB8F5' : colors.graySoft,
                  opacity: b.isFuture ? 0.4 : 1,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {bars.map((b) => (
          <Text key={b.label} style={[styles.barLabel, b.isToday && { color: colors.primary, fontWeight: '800' }]}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── 주간 목표 카드 ────────────────────────────────────
export function GoalCard({
  weekMinutes,
  goalHours,
  onChange,
}: {
  weekMinutes: number;
  goalHours: number;
  onChange: (h: number) => void;
}) {
  const pct = Math.min(100, Math.round((weekMinutes / (goalHours * 60)) * 100));
  const done = weekMinutes >= goalHours * 60;
  return (
    <View style={styles.goal}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.goalTitle}>이번 주 목표</Text>
          <Text style={styles.goalSub}>
            {formatMinutes(weekMinutes)} / {goalHours}시간
          </Text>
        </View>
        <View style={styles.goalStepper}>
          <Pressable onPress={() => onChange(Math.max(1, goalHours - 1))} hitSlop={8} style={styles.stepBtn}>
            <Icon name="remove" size={18} color={colors.textSub} />
          </Pressable>
          <Text style={styles.goalHours}>{goalHours}h</Text>
          <Pressable onPress={() => onChange(Math.min(100, goalHours + 1))} hitSlop={8} style={styles.stepBtn}>
            <Icon name="add" size={18} color={colors.textSub} />
          </Pressable>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: done ? colors.success : colors.primary }]} />
      </View>
      <Text style={[styles.goalPct, done && { color: colors.success }]}>{done ? '목표 달성!' : `${pct}% 달성`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  live: { backgroundColor: '#1D4ED8', borderRadius: radius.lg, padding: 20, overflow: 'hidden', gap: 8, marginBottom: 12, ...shadow },
  liveDeco: { position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  liveLabel: { color: colors.white, fontSize: 13, fontWeight: '800' },
  liveSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  liveClock: { color: colors.white, fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  liveSeat: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', flex: 1 },
  liveBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  liveBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  barValue: { fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
  barLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  goal: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, ...shadow },
  goalTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  goalSub: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  goalStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.graySoft, borderRadius: radius.md },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  goalHours: { fontSize: 15, fontWeight: '800', color: colors.text, minWidth: 36, textAlign: 'center' },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.graySoft, marginTop: 16, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  goalPct: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 8, textAlign: 'right' },
});
