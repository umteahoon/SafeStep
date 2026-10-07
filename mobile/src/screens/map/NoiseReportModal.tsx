import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Banner, Button, ModalCard, Muted, Title } from '../../components/ui';
import { colors } from '../../theme';
import type { Seat } from '../../types';

const REASONS: { value: string; label: string }[] = [
  { value: 'NOISE', label: '소음' },
  { value: 'MONOPOLY', label: '자리 독점 (장시간 미사용/짐만 방치)' },
  { value: 'OTHER', label: '기타 불편사항' },
];

export function NoiseReportModal({ seat, onClose }: { seat: Seat | null; onClose: () => void }) {
  const [reason, setReason] = useState('NOISE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setDone(false);
    setError(null);
    setReason('NOISE');
    onClose();
  };

  const submit = async () => {
    if (!seat) return;
    setIsSubmitting(true);
    setError(null);
    // 신고자 식별 정보는 저장하지 않음 (익명성 보장)
    const { error: insErr } = await supabase.from('seat_reports').insert({
      academy_id: seat.academy_id,
      seat_number: seat.seat_number,
      reason,
    });
    setIsSubmitting(false);
    if (insErr) setError('신고 접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
    else setDone(true);
  };

  return (
    <ModalCard visible={!!seat} onClose={close}>
      {seat &&
        (done ? (
          <>
            <Title>신고 접수 완료</Title>
            <Muted style={{ marginBottom: 20 }}>{seat.seat_number}번 좌석 신고가 익명으로 접수되었습니다.</Muted>
            <Button title="닫기" variant="dark" onPress={close} />
          </>
        ) : (
          <>
            <Title>{seat.seat_number}번 좌석 신고</Title>
            <Muted style={{ marginBottom: 14 }}>신고자 정보는 저장되지 않는 익명 신고입니다.</Muted>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {REASONS.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  style={{
                    borderWidth: 1,
                    borderColor: reason === r.value ? colors.primary : colors.border,
                    backgroundColor: reason === r.value ? colors.primarySoft : colors.white,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, color: colors.text }}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Banner kind="error">{error}</Banner>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="취소" variant="secondary" onPress={close} style={{ flex: 1 }} />
              <Button title="신고하기" variant="danger" onPress={submit} loading={isSubmitting} style={{ flex: 1 }} />
            </View>
          </>
        ))}
    </ModalCard>
  );
}
