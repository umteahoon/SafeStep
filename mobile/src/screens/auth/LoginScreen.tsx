import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { PREVIEW_MODE, useAuth } from '../../lib/useAuth';
import { cafeImage } from '../../lib/cafeImages';
import { getJSON, setJSON } from '../../lib/storage';
import { AuthField, BackCircle } from '../../components/auth';
import { Button, Icon } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';

const LAST_EMAIL_KEY = 'safestep:last-email';

// 로그인 성공/실패를 기록합니다. 실패해도 로그인 흐름을 막지 않습니다.
function logLoginAttempt(email: string, success: boolean, reason?: string) {
  apiFetch('/api/auth/login-log', {
    auth: false,
    method: 'POST',
    body: JSON.stringify({ email, success, reason }),
  }).catch(() => {});
}

/**
 * 로그인 — 위쪽에 사진 브랜드 영역, 아래에 둥근 시트가 겹쳐 올라오는 구성.
 * 아이콘이 붙은 입력창, 비밀번호 보기, 큰 버튼, "로그인 없이 둘러보기".
 */
export default function LoginScreen() {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const insets = useSafeAreaInsets();
  const next = route.params?.next;
  const { setPreviewRole } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // 마지막으로 로그인한 이메일을 미리 채워줌
  useEffect(() => {
    getJSON<string>(LAST_EMAIL_KEY, '').then((v) => v && setEmail((cur) => cur || v));
  }, []);

  const goAfterLogin = () => {
    if (next) {
      navigation.reset({
        index: 1,
        routes: [{ name: 'Main' }, { name: next.name, params: next.params } as any],
      });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    // 웹(frontend)과 동일한 Supabase Auth 프로젝트라 웹에서 만든 계정으로 그대로 로그인됩니다.
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (signInError || !data.user) {
      logLoginAttempt(email.trim(), false, signInError?.message ?? 'INVALID_CREDENTIALS');
      setError('이메일 또는 비밀번호가 올바르지 않아요.');
      return;
    }
    logLoginAttempt(email.trim(), true);
    setJSON(LAST_EMAIL_KEY, email.trim());
    goAfterLogin();
  };

  const browse = () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 브랜드 영역 */}
        <View style={styles.hero}>
          <Image source={cafeImage('a-3')} style={styles.heroImg} resizeMode="cover" />
          <LinearGradient colors={['rgba(15,23,42,0.35)', 'rgba(15,23,42,0.78)']} style={styles.heroScrim} />
          {navigation.canGoBack() && (
            <View style={[styles.heroBack, { top: insets.top + 8 }]}>
              <BackCircle light onPress={() => navigation.goBack()} />
            </View>
          )}
          <View style={[styles.brand, { paddingTop: insets.top }]}>
            <View style={styles.logo}>
              <Icon name="shield-checkmark" size={28} color={colors.white} />
            </View>
            <Text style={styles.brandName}>SafeStep</Text>
            <Text style={styles.tagline}>스터디카페와 학원을 한곳에서</Text>
          </View>
        </View>

        {/* 폼 시트 */}
        <View style={styles.sheet}>
          <Text style={styles.title}>다시 만나서 반가워요</Text>
          <Text style={styles.sub}>이메일로 로그인해주세요</Text>

          <View style={{ height: 22 }} />
          <AuthField
            icon="mail-outline"
            placeholder="이메일"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <AuthField
            ref={passwordRef}
            icon="lock-closed-outline"
            placeholder="비밀번호"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            password
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={error}
          />

          <Button title="로그인" onPress={handleSubmit} loading={isSubmitting} disabled={!canSubmit} style={styles.cta} />

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>아직 계정이 없으신가요?</Text>
            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
              <Text style={styles.signupLink}>회원가입</Text>
            </Pressable>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.line} />
          </View>

          <Button title="로그인 없이 둘러보기" variant="secondary" icon="compass-outline" onPress={browse} />

          {PREVIEW_MODE && (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>미리보기 모드 · 바로 로그인</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {([
                  ['MEMBER', '일반 회원'],
                  ['STUDENT', '학생'],
                  ['ACADEMY_ADMIN', '원장'],
                ] as const).map(([role, label]) => (
                  <Pressable
                    key={role}
                    onPress={() => {
                      setPreviewRole(role);
                      goAfterLogin();
                    }}
                    style={styles.previewChip}
                  >
                    <Text style={styles.previewChipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 270, backgroundColor: colors.dark },
  heroImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroBack: { position: 'absolute', left: 16, zIndex: 2 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  logo: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandName: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.8 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  sheet: { flex: 1, marginTop: -30, backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 36 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  cta: { height: 56, borderRadius: 16, marginTop: 8 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 },
  signupText: { fontSize: 14, color: colors.textSub },
  signupLink: { fontSize: 14, fontWeight: '800', color: colors.primary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  dividerText: { fontSize: 12, color: colors.textMuted },
  preview: { marginTop: 26, padding: 14, borderRadius: 16, backgroundColor: colors.warnSoft, gap: 10 },
  previewTitle: { fontSize: 12, fontWeight: '800', color: colors.warnText },
  previewChip: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  previewChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
});
