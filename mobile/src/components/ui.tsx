import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme';

type IonName = React.ComponentProps<typeof Ionicons>['name'];
type McName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
/** Ionicons 이름 또는 'mc:이름'(MaterialCommunityIcons — 더 다양한 도메인 아이콘) */
export type IconName = IonName | `mc:${McName}`;

export function Icon({ name, size = 20, color = colors.textSub, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  if (name.startsWith('mc:')) {
    return <MaterialCommunityIcons name={name.slice(3) as McName} size={size} color={color} style={style} />;
  }
  return <Ionicons name={name as IonName} size={size} color={color} style={style} />;
}

// ── 화면 ─────────────────────────────────────────────

interface ScreenProps {
  children: ReactNode;
  /** 스크롤 가능한 본문 (기본 true). 채팅처럼 직접 레이아웃할 땐 false */
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<any>;
  /** 기본은 연한 회색 배경. 홈처럼 사진 중심 화면은 흰색 */
  backgroundColor?: string;
  /** 키보드가 올라올 때 화면을 줄여 입력창을 보이게 함(기본 true). 하단 탭 화면에서 하단 입력창이 없다면 false — 탭 높이만큼 과하게 줄어드는 것을 방지 */
  keyboardAvoiding?: boolean;
}

export function Screen({ children, scroll = true, edges = ['left', 'right'], contentStyle, refreshControl, backgroundColor, keyboardAvoiding = true }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.screen, backgroundColor ? { backgroundColor } : null]} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardAvoiding && Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** 탭 화면 상단의 큰 제목 헤더 */
export function LargeHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.largeHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.largeTitle}>{title}</Text>
        {subtitle && <Text style={styles.largeSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Loading({ text = '불러오는 중...' }: { text?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.mutedText}>{text}</Text>
    </View>
  );
}

// ── 카드 / 텍스트 ─────────────────────────────────────

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[styles.mutedText, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Empty({ children, icon = 'file-tray-outline' }: { children: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

// ── 배너 ─────────────────────────────────────────────

type BannerKind = 'error' | 'success' | 'info' | 'warn';
const BANNER: Record<BannerKind, { bg: string; fg: string; icon: IconName }> = {
  error: { bg: colors.dangerSoft, fg: colors.dangerText, icon: 'alert-circle' },
  success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' },
  info: { bg: colors.primarySoft, fg: colors.primary, icon: 'information-circle' },
  warn: { bg: colors.warnSoft, fg: colors.warnText, icon: 'warning' },
};

export function Banner({ kind, children }: { kind: BannerKind; children?: ReactNode }) {
  if (!children) return null;
  const c = BANNER[kind];
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <Icon name={c.icon} size={18} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={[styles.bannerText, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

// ── 버튼 ─────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dark' | 'indigo' | 'warn' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        isDisabled && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && <Icon name={icon} size={small ? 15 : 18} color={v.fg} />}
          <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  indigo: { bg: colors.indigo, fg: colors.white, border: colors.indigo },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
  dark: { bg: colors.dark, fg: colors.white, border: colors.dark },
  warn: { bg: colors.warn, fg: colors.white, border: colors.warn },
  secondary: { bg: colors.white, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.textSub, border: 'transparent' },
};

// ── 입력 ─────────────────────────────────────────────

export function Input(props: Omit<TextInputProps, 'style'> & { style?: StyleProp<TextStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        focused && { borderColor: colors.primary, backgroundColor: colors.white },
        props.multiline && { minHeight: 90, textAlignVertical: 'top' },
        props.style,
      ]}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

// ── 뱃지 / 칩 ────────────────────────────────────────

export function Badge({ text, bg = colors.primarySoft, fg = colors.primary }: { text: string; bg?: string; fg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { borderColor: accent, backgroundColor: color ? accent : colors.primarySoft }]}
    >
      <Text style={[styles.chipText, selected && { color: color ? colors.white : colors.primary, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── 아바타 / 아이콘 타일 / 리스트 ─────────────────────

export function Avatar({ name, size = 52, color = colors.primary }: { name: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.white, fontSize: size * 0.4, fontWeight: '700' }}>{name.trim().slice(0, 1) || '?'}</Text>
    </View>
  );
}

export function IconTile({ name, color = colors.primary, bg = colors.primarySoft, size = 38 }: { name: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}

/** 설정 앱처럼 둥근 카드 안에 행들이 이어지는 그룹 */
export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={styles.listGroup}>{children}</View>;
}

export function ListRow({
  icon,
  iconColor,
  iconBg,
  title,
  desc,
  onPress,
  last,
  right,
}: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  desc?: string;
  onPress?: () => void;
  last?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, !last && styles.listRowBorder, pressed && { backgroundColor: colors.graySoft }]}
    >
      {icon && <IconTile name={icon} color={iconColor} bg={iconBg} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {desc && <Text style={styles.listDesc}>{desc}</Text>}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

// ── 셀렉트 (바텀시트 스타일 모달) ─────────────────────

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = '선택',
}: {
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable style={[styles.input, styles.selectBox]} onPress={() => setOpen(true)}>
        <Text style={{ color: current ? colors.text : colors.textMuted, fontSize: 15 }}>{current?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              ListEmptyComponent={<Empty>선택할 항목이 없습니다.</Empty>}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.sheetItem}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, item.value === value && { color: colors.primary, fontWeight: '700' }]}>{item.label}</Text>
                  {item.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── 모달 ─────────────────────────────────────────────

export function ModalCard({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 통계 / 행 ────────────────────────────────────────

export function Stat({ label, value, icon, tint = colors.primary }: { label: string; value: string; icon?: IconName; tint?: string }) {
  return (
    <View style={[styles.card, styles.stat]}>
      {icon && (
        <View style={{ marginBottom: 10 }}>
          <IconTile name={icon} color={tint} bg={tint + '1A'} size={34} />
        </View>
      )}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Stepper({ value, onPrev, onNext }: { value: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onPrev} style={styles.stepperBtn} hitSlop={6}>
        <Ionicons name="chevron-back" size={18} color={colors.textSub} />
      </Pressable>
      <Text style={styles.stepperText}>{value}</Text>
      <Pressable onPress={onNext} style={styles.stepperBtn} hitSlop={6}>
        <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
      </Pressable>
    </View>
  );
}

/** 월 이동 스텝퍼 (웹의 <input type="month"> 대체). value: 'yyyy-MM' */
export function MonthStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const shift = (delta: number) => {
    const [y, m] = value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  return <Stepper value={value} onPrev={() => shift(-1)} onNext={() => shift(1)} />;
}

/** 일 이동 스텝퍼 (웹의 <input type="date"> 대체). value: 'yyyy-MM-dd' */
export function DayStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const shift = (delta: number) => {
    const [y, m, d] = value.split('-').map(Number);
    const next = new Date(y, m - 1, d + delta);
    onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
  };
  return <Stepper value={value} onPrev={() => shift(-1)} onNext={() => shift(1)} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: 16, paddingBottom: 48 },
  largeHeader: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  largeTitle: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  largeSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  loading: { padding: 28, alignItems: 'center', gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 12,
    ...shadow,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4, letterSpacing: -0.4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  mutedText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.graySoft, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSub, marginBottom: 7 },
  banner: { borderRadius: radius.md, padding: 13, marginBottom: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  bannerText: { fontSize: 13, lineHeight: 19, flex: 1, fontWeight: '500' },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 50,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.sm },
  buttonText: { fontSize: 15, fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: '#F8F9FB',
    color: colors.text,
  },
  selectBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  chipText: { fontSize: 13, color: colors.textSub, fontWeight: '500' },
  segmented: { flexDirection: 'row', backgroundColor: '#E6E9EF', borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  listGroup: { backgroundColor: colors.card, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden', ...shadow },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 16 },
  listRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  listDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 22 },
  sheet: { backgroundColor: colors.white, borderRadius: radius.lg, maxHeight: '70%', overflow: 'hidden' },
  sheetItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetItemText: { fontSize: 15, color: colors.text },
  modalCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 22 },
  stat: { flex: 1, minWidth: '45%', marginBottom: 0 },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4, letterSpacing: -0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    ...shadow,
  },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  stepperText: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 104, textAlign: 'center' },
});
