import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicHeader } from '../components/common/PublicHeader';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const BUSINESS_TYPES = ['학원', '스터디카페', '학원 + 스터디카페', '기타'];

export default function InquiryPage() {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: insertError } = await supabase.from('inquiries').insert({
      name: name.trim(),
      contact: contact.trim(),
      business_name: businessName.trim() || null,
      business_type: businessType,
      message: message.trim() || null,
    });
    setIsSubmitting(false);
    if (insertError) {
      setError('문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setIsDone(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900">학원·카페 도입 문의</h1>
        <p className="mt-2 text-gray-500">
          SafeStep 도입이 궁금하시다면 아래 양식을 남겨주세요. 확인 후 연락드립니다.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            {isDone ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
                <p className="text-lg font-bold text-green-700">문의가 접수되었습니다</p>
                <p className="mt-2 text-sm text-green-600">남겨주신 연락처로 곧 안내드리겠습니다.</p>
                <Link
                  to="/start"
                  className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  바로 시작하는 방법 보기
                </Link>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="rounded-2xl border border-gray-200 bg-white p-6"
              >
                {user && profile && (
                  <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                    {profile.name}님으로 로그인되어 있습니다. 이미 계정이 있다면 문의 없이{' '}
                    <Link to="/start" className="font-medium underline">
                      바로 시작
                    </Link>
                    할 수 있어요.
                  </p>
                )}

                <label className="mb-1 block text-sm font-medium text-gray-700">담당자 이름</label>
                <input
                  required
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  연락처 (전화번호 또는 이메일)
                </label>
                <input
                  required
                  maxLength={100}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />

                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      학원/카페 이름
                    </label>
                    <input
                      maxLength={100}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">운영 형태</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                    >
                      {BUSINESS_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="mb-1 block text-sm font-medium text-gray-700">문의 내용</label>
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="좌석 수, 원생 수, 궁금한 점 등을 자유롭게 적어주세요."
                />

                {error && (
                  <p className="mb-4 text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? '접수 중...' : '문의 남기기'}
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-4 md:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">이용 요금</h2>
              <p className="mt-2 text-2xl font-extrabold text-blue-600">
                월 10,000원
              </p>
              <p className="mt-1 text-sm text-gray-500">가입 후 14일 무료 체험 · 토스페이먼츠 결제</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">포함 기능</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
                <li>· 반·시간표·출석부 & 결석 알림</li>
                <li>· QR 키오스크 입·퇴실 / 좌석 도면</li>
                <li>· 학부모 리포트 / 사전 결석 신청</li>
                <li>· 강사 승인, 엑셀 데이터 추출</li>
              </ul>
            </div>
            <Link
              to="/start"
              className="block rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              문의 없이 바로 시작하려면 →
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
