import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../lib/useAuth';
import { Banner, Button, Card, Loading, Muted, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { RootNav } from '../../navigation/types';

const STEPS = [
  {
    title: '도입 문의 남기기',
    desc: '학원·스터디카페 정보를 남겨주시면 SafeStep팀이 지점을 생성하고 8자리 등록 코드를 발급해드립니다.',
  },
  {
    title: '원장 계정 만들기',
    desc: '회원가입에서 "학원 원장" 유형을 선택해 계정을 만듭니다. 이메일 인증 없이 바로 시작할 수 있어요.',
  },
  {
    title: '등록 코드로 학원 연결',
    desc: '전달받은 8자리 등록 코드를 입력하면 계정이 학원에 연결되고 좌석이 존별로 자동 배치됩니다.',
  },
  {
    title: '강사·학생 등록',
    desc: '강사는 가입 시 학원을 선택하고 원장의 승인을 받습니다. 학생과 반·시간표는 대시보드에서 등록하세요.',
  },
  {
    title: '키오스크·출결 시작',
    desc: '키오스크 탭에서 QR로 입·퇴실을 받고, 출석부로 결석·지각 알림을 보내보세요.',
  },
];

export default function StartGuideScreen() {
  const navigation = useNavigation<RootNav>();
  const { user, profile } = useAuth();
  const isOwner = profile?.role === 'ACADEMY_ADMIN';

  let cta;
  if (!user) {
    cta = (
      <>
        <Button title="원장 계정 만들기" onPress={() => navigation.navigate('Register')} />
        <Button title="이미 계정이 있어요" variant="secondary" onPress={() => navigation.navigate('Login')} />
      </>
    );
  } else if (!profile) {
    cta = <Loading />;
  } else if (isOwner) {
    cta = (
      <>
        <Button
          title={profile.academy_id ? '내 대시보드로 이동' : '등록 코드 입력하기'}
          onPress={() => navigation.navigate(profile.academy_id ? 'Dashboard' : 'OwnerClaim')}
        />
        {profile.academy_id && (
          <Button title="이용권 결제" variant="secondary" onPress={() => navigation.navigate('Billing')} />
        )}
      </>
    );
  } else {
    cta = (
      <Banner kind="warn">
        현재 {profile.name}님은 원장 계정이 아닙니다. 학원·스터디카페를 도입하려면 로그아웃 후 원장
        계정으로 가입해주세요.
      </Banner>
    );
  }

  return (
    <Screen>
      <Title>무료로 시작하기</Title>
      <Muted style={{ marginBottom: 16 }}>아래 단계를 따라오시면 학원·스터디카페 도입이 끝납니다.</Muted>

      {STEPS.map((s, i) => (
        <Card key={s.title} style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 15, color: colors.text }}>{s.title}</Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: colors.textSub, lineHeight: 19 }}>
              {s.desc}
            </Text>
          </View>
        </Card>
      ))}

      <View style={{ gap: 8, marginTop: 8 }}>{cta}</View>

      <Text style={{ marginTop: 16, fontSize: 13, color: colors.textMuted }}>
        궁금한 점이 있다면{' '}
        <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => navigation.navigate('Inquiry')}>
          도입 문의
        </Text>
        를 남겨주세요.
      </Text>
    </Screen>
  );
}
