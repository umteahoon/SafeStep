import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Icon } from './ui';
import type { IconName } from './ui';
import { colors } from '../theme';

/** 로그인/가입용 입력창: 왼쪽 아이콘, 포커스 시 파란 테두리, 비밀번호 보기 토글, 유효하면 체크 표시 */
export const AuthField = forwardRef<
  TextInput,
  Omit<TextInputProps, 'style'> & {
    label?: string;
    icon: IconName;
    /** true 면 비밀번호 입력 + 눈 아이콘 토글 */
    password?: boolean;
    error?: string | null;
    valid?: boolean;
    hint?: string;
  }
>(function AuthField({ label, icon, password, error, valid, hint, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.box, focused && styles.boxFocus, !!error && styles.boxError]}>
        <Icon name={icon} size={20} color={focused ? colors.primary : colors.textMuted} />
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          {...rest}
          secureTextEntry={password && !visible}
          autoCapitalize={rest.autoCapitalize ?? 'none'}
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={styles.input}
        />
        {password ? (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 보기'}>
            <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : valid ? (
          <Icon name="checkmark-circle" size={20} color={colors.success} />
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

/** 화면 위에 올리는 동그란 뒤로가기 버튼 */
export function BackCircle({ onPress, light }: { onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel="뒤로" style={[styles.back, light && styles.backLight]}>
      <Icon name="chevron-back" size={22} color={light ? colors.white : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginBottom: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F3F5F8',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxFocus: { backgroundColor: colors.white, borderColor: colors.primary },
  boxError: { borderColor: colors.danger, backgroundColor: '#FFF7F7' },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  error: { fontSize: 12.5, color: colors.dangerText, marginTop: 7, marginLeft: 4, fontWeight: '500' },
  hint: { fontSize: 12.5, color: colors.textMuted, marginTop: 7, marginLeft: 4 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F5F8', alignItems: 'center', justifyContent: 'center' },
  backLight: { backgroundColor: 'rgba(0,0,0,0.3)' },
});
