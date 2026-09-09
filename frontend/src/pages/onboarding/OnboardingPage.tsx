import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { refreshProfile, signOut } from '../../hooks/useAuth';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [totalSeats, setTotalSeats] = useState(20);
  const [latitude, setLatitude] = useState('37.5665');
  const [longitude, setLongitude] = useState('126.9780');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch('/api/academy/onboard', {
        method: 'POST',
        body: JSON.stringify({
          name,
          address,
          totalSeats,
          latitude: Number(latitude),
          longitude: Number(longitude),
        }),
      });
      await refreshProfile();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '학원 생성에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-gray-900">학원 정보 등록</h1>
        <p className="mb-6 mt-1 text-sm text-gray-400">
          원장님의 학원/스터디카페를 만들면 좌석이 자동으로 생성됩니다.
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          학원 이름
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: SafeStep 강남점"
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
        <input
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="서울 강남구 테헤란로 123"
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          총 좌석 수
        </label>
        <input
          type="number"
          min={1}
          max={200}
          required
          value={totalSeats}
          onChange={(e) => setTotalSeats(Number(e.target.value))}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              위도
            </label>
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              경도
            </label>
            <input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <p className="mb-4 -mt-2 text-xs text-gray-400">
          지도 위치입니다. 모르면 그대로 두고 나중에 수정하세요.
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '생성 중...' : '학원 만들기'}
        </button>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="mt-3 w-full text-center text-sm text-gray-400"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
