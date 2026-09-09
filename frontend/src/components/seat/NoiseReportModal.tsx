import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Seat } from '../../types';

interface NoiseReportModalProps {
  seat: Seat;
  onClose: () => void;
}

const REASONS: { value: string; label: string }[] = [
  { value: 'NOISE', label: '소음' },
  { value: 'MONOPOLY', label: '자리 독점 (장시간 미사용/짐만 방치)' },
  { value: 'OTHER', label: '기타 불편사항' },
];

export function NoiseReportModal({ seat, onClose }: NoiseReportModalProps) {
  const [reason, setReason] = useState('NOISE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setIsSubmitting(true);
    // 신고자 식별 정보는 저장하지 않음 (익명성 보장)
    await supabase.from('seat_reports').insert({
      academy_id: seat.academy_id,
      seat_number: seat.seat_number,
      reason,
    });
    setIsSubmitting(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {done ? (
          <>
            <h2 className="mb-2 text-lg font-bold text-gray-900">신고 접수 완료</h2>
            <p className="mb-6 text-sm text-gray-500">
              {seat.seat_number}번 좌석 신고가 익명으로 접수되었습니다.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gray-900 py-2.5 font-medium text-white"
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              {seat.seat_number}번 좌석 신고
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              신고자 정보는 저장되지 않는 익명 신고입니다.
            </p>

            <div className="mb-6 space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                    reason === r.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 font-medium text-gray-600"
              >
                취소
              </button>
              <button
                onClick={submit}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-red-500 py-2.5 font-medium text-white disabled:opacity-50"
              >
                {isSubmitting ? '접수 중...' : '신고하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
