import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import { PREVIEW_MODE, useAuth } from '../../lib/useAuth';
import { AuthField, BackCircle } from '../../components/auth';
import { Banner, Button, Icon, Select } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { colors, radius } from '../../theme';
import type { RootNav } from '../../navigation/types';
import type { UserRole } from '../../types';

// 슈퍼관리자는 셀프 회원가입 대상에서 제외 (플랫폼 운영자가 직접 DB에서 부여)
type SignupRole = Exclude<UserRole, 'SUPER_ADMIN'>;
/** 일반 회원은 별도 역할이 아니라 "학생으로 가입하되 학원 명부에는 아직 연동 안 한 계정"입니다 (서버에는 STUDENT 로 전달) */
type SignupChoice = SignupRole | 'MEMBER';

const CHOICES: { value: SignupChoice; title: string; desc: string; icon: IconName }[] = [
  { value: 'MEMBER', title: '일반 회원', desc: '스터디카페를 찾고 커뮤니티를 이용해요', icon: 'mc:coffee-outline' },
  { value: 'STUDENT', title: '학생', desc: '다니는 학원·스터디카페에서 연동코드를 받았어요', icon: 'mc:school-outline' },
  { value: 'PARENT', title: '학부모', desc: '자녀의 출결과 학습 리포트를 확인해요', icon: 'mc:account-child-outline' },
  { value: 'TEACHER', title: '강사', desc: '원장 승인 후 반·출결을 관리해요', icon: 'mc:account-tie-outline' },
  { value: 'ACADEMY_ADMIN', title: '원장', desc: '학원·스터디카페를 운영해요', icon: 'mc:storefront-outline' },
];

const STEPS = [
  { title: '어떤 분이세요?', sub: '가입 유형을 선택해주세요' },
  { title: '로그인 정보를\n입력해주세요', sub: '이메일과 비밀번호로 로그인해요' },
  { title: '마지막으로\n프로필을 알려주세요', sub: '이름은 커뮤니티와 채팅에 표시돼요' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * 회원가입 — 한 화면에 폼을 몰아넣지 않고 질문을 3단계로 나눔(유형 → 로그인 정보 → 프로필).
 * 상단 진행 표시, 단계마다 바로 검증, 하단 고정 버튼.
 */
export default function RegisterScreen() {
  const navigation = useNavigation<RootNav>();
  const insets = useSafeAreaInsets();
  const { setPreviewRole } = useAuth();

  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<SignupChoice>('MEMBER');
  const role: SignupRole = choice === 'MEMBER' ? 'STUDENT' : choice;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [academyId, setAcademyId] = useState('');
  const [academies, setAcademies] = useState<{ value: string; label: string }[]>([]);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pwRef = useRef<TextInput>(null);
  const pw2Ref = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const needsAcademy = role === 'TEACHER';

  useEffect(() => {
    if (!needsAcademy) return;
    supabase
      .from('academies')
      .select('id, name')
      .order('name')
      .then(({ data }) =>
        setAcademies(((data as { id: string; name: string }[]) ?? []).map((a) => ({ value: a.id, label: a.name })))
      );
  }, [needsAcademy]);

  // 단계별 검증 메시지 (null 이면 통과)
  const emailError = !EMAIL_RE.test(email.trim()) ? '올바른 이메일 형식이 아니에요' : null;
  const pwError = password.length < 6 ? '6자 이상 입력해주세요' : null;
  const pw2Error = password2 !== password ? '비밀번호가 서로 달라요' : null;
  const nameError = !name.trim() ? '이름을 입력해주세요' : null;
  const academyError = needsAcademy && !academyId ? '소속 학원을 선택해주세요' : null;

  const stepValid = step === 0 ? true : step === 1 ? !emailError && !pwError && !pw2Error : !nameError && !academyError;

  const goBack = () => {
    setTouched(false);
    setError(null);
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // 백엔드가 이메일 인증 없이 계정+프로필을 즉시 생성
      await apiFetch('/api/auth/register', {
        auth: false,
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          phone,
          role,
          academyId: needsAcademy ? academyId : null,
        }),
      });
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : '회원가입에 실패했어요.');
      return;
    }

    // 미리보기 모드는 실제 로그인이 없으므로 가입한 유형으로 바로 전환
    if (PREVIEW_MODE) {
      setIsSubmitting(false);
      setPreviewRole(choice);
    } else {
      // 바로 로그인
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setIsSubmitting(false);
      if (signInError) {
        navigation.replace('Login');
        return;
      }
    }

    if (role === 'ACADEMY_ADMIN') {
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'OwnerClaim' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
    }
  };

  const onNext = () => {
    setError(null);
    if (!stepValid) {
      setTouched(true);
      return;
    }
    setTouched(false);
    if (step < 2) setStep(step + 1);
    else submit();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 상단: 뒤로가기 + 진행 표시 */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <BackCircle onPress={goBack} />
        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.bar, i <= step && styles.barOn]} />
          ))}
        </View>
        <Text style={styles.stepText}>{`${step + 1}/3`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{STEPS[step].title}</Text>
        <Text style={styles.sub}>{STEPS[step].sub}</Text>
        <View style={{ height: 26 }} />

        {step === 0 && (
          <View style={{ gap: 12 }}>
            {CHOICES.map((c) => {
              const on = choice === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setChoice(c.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.card, on && styles.cardOn]}
                >
                  <View style={[styles.cardIcon, on && { backgroundColor: colors.primary }]}>
                    <Icon name={c.icon} size={24} color={on ? colors.white : colors.textSub} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, on && { color: colors.primary }]}>{c.title}</Text>
                    <Text style={styles.cardDesc}>{c.desc}</Text>
                  </View>
                  <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.primary : colors.borderStrong} />
                </Pressable>
              );
            })}
          </View>
        )}

        {step === 1 && (
          <>
            <AuthField
              label="이메일"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
              blurOnSubmit={false}
              valid={!emailError}
              error={touched ? emailError : null}
            />
            <AuthField
              ref={pwRef}
              label="비밀번호"
              icon="lock-closed-outline"
              placeholder="6자 이상"
              value={password}
              onChangeText={setPassword}
              password
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => pw2Ref.current?.focus()}
              blurOnSubmit={false}
              error={touched ? pwError : null}
              hint={!touched && password.length > 0 && password.length < 6 ? '6자 이상 입력해주세요' : undefined}
            />
            <AuthField
              ref={pw2Ref}
              label="비밀번호 확인"
              icon="lock-closed-outline"
              placeholder="한 번 더 입력"
              value={password2}
              onChangeText={setPassword2}
              password
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={onNext}
              error={touched ? pw2Error : null}
            />
          </>
        )}

        {step === 2 && (
          <>
            <AuthField
              label="이름"
              icon="person-outline"
              placeholder="홍길동"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              blurOnSubmit={false}
              error={touched ? nameError : null}
            />
            <AuthField
              ref={phoneRef}
              label="연락처 (선택)"
              icon="call-outline"
              placeholder="010-0000-0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
            {needsAcademy && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>소속 학원 (원장 승인 필요)</Text>
                <Select value={academyId} options={academies} onChange={setAcademyId} placeholder="학원 선택" />
                {touched && academyError ? <Text style={styles.fieldError}>{academyError}</Text> : null}
              </View>
            )}
            <Banner kind="error">{error ?? undefined}</Banner>
            <Text style={styles.terms}>가입하면 서비스 이용약관과 개인정보 처리방침에 동의하게 돼요.</Text>
          </>
        )}
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          title={step < 2 ? '다음' : '가입하기'}
          onPress={onNext}
          loading={isSubmitting}
          style={[styles.cta, !stepValid && styles.ctaInactive]}
        />
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>이미 계정이 있으신가요?</Text>
          <Pressable onPress={() => navigation.replace('Login')} hitSlop={8}>
            <Text style={styles.loginLink}>로그인</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 6 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E8EBF0' },
  barOn: { backgroundColor: colors.primary },
  stepText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, width: 30, textAlign: 'right' },
  body: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8, lineHeight: 36 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: '#F7F8FA', borderWidth: 1.5, borderColor: 'transparent' },
  cardOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  cardIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardDesc: { fontSize: 12.5, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginBottom: 8 },
  fieldError: { fontSize: 12.5, color: colors.dangerText, marginTop: 7, marginLeft: 4 },
  terms: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 6 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.white },
  cta: { height: 56, borderRadius: 16 },
  ctaInactive: { backgroundColor: '#B6C4E8', borderColor: '#B6C4E8' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  loginText: { fontSize: 13, color: colors.textSub },
  loginLink: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
