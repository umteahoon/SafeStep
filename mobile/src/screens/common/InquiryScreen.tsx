import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { Banner, Button, Card, Field, Input, Muted, Screen, Select, Title } from '../../components/ui';
import type { RootNav } from '../../navigation/types';

const BUSINESS_TYPES = ['학원', '스터디카페', '학원 + 스터디카페', '기타'].map((t) => ({
  value: t,
  label: t,
}));

export default function InquiryScreen() {
  const navigation = useNavigation<RootNav>();
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0].value);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !contact.trim()) {
      setError('담당자 이름과 연락처를 입력해주세요.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          business_name: businessName.trim() || null,
          business_type: businessType,
          message: message.trim() || null,
        }),
      });
      setIsDone(true);
    } catch {
      setError('문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Title style={{ color: '#15803D' }}>문의가 접수되었습니다</Title>
          <Muted style={{ textAlign: 'center', marginBottom: 20 }}>
            남겨주신 연락처로 곧 안내드리겠습니다.
          </Muted>
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <Button title="바로 시작하는 방법 보기" onPress={() => navigation.replace('StartGuide')} />
            {user && (
              <Button
                title="내 문의 내역 보기"
                variant="secondary"
                onPress={() => navigation.replace('MyInquiries')}
              />
            )}
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>학원·스터디카페 도입 문의</Title>
      <Muted style={{ marginBottom: 16 }}>
        SafeStep 도입이 궁금하시다면 아래 양식을 남겨주세요. 확인 후 연락드립니다.
      </Muted>

      {user && profile && (
        <Banner kind="info">
          {profile.name}님으로 로그인되어 있습니다. 이전에 남긴 문의는 내 정보 → 내 문의 내역에서
          확인하세요.
        </Banner>
      )}

      <Card>
        <Field label="담당자 이름">
          <Input value={name} onChangeText={setName} maxLength={50} />
        </Field>
        <Field label="연락처 (전화번호 또는 이메일)">
          <Input value={contact} onChangeText={setContact} maxLength={100} autoCapitalize="none" />
        </Field>
        <Field label="학원/스터디카페 이름">
          <Input value={businessName} onChangeText={setBusinessName} maxLength={100} />
        </Field>
        <Field label="운영 형태">
          <Select value={businessType} options={BUSINESS_TYPES} onChange={setBusinessType} />
        </Field>
        <Field label="문의 내용">
          <Input
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            placeholder="좌석 수, 원생 수, 궁금한 점 등을 자유롭게 적어주세요."
          />
        </Field>
        <Banner kind="error">{error}</Banner>
        <Button title="문의 남기기" onPress={submit} loading={isSubmitting} />
      </Card>

      <Card>
        <Title style={{ fontSize: 16 }}>이용 요금</Title>
        <Title style={{ color: '#2563EB' }}>월 10,000원</Title>
        <Muted>가입 후 14일 무료 체험 · 토스페이먼츠 결제</Muted>
      </Card>
      <Card>
        <Title style={{ fontSize: 16 }}>포함 기능</Title>
        <Muted>· 반·시간표·출석부 & 결석 알림</Muted>
        <Muted>· QR 키오스크 입·퇴실 / 좌석 도면</Muted>
        <Muted>· 학부모 리포트 / 사전 결석 신청</Muted>
        <Muted>· 강사 승인, 엑셀 데이터 추출</Muted>
      </Card>
    </Screen>
  );
}
