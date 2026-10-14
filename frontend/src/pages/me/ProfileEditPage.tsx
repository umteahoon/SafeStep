import { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth, refreshProfile } from '../../hooks/useAuth';
import { homeForRole } from '../../lib/navigation';

// 모바일 앱 screens/common/ProfileEditScreen.tsx와 동일 — 이름·연락처만 수정,
// 이메일·역할·소속은 여기서 바꾸지 않습니다.
export default function ProfileEditPage() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setError(null);
    setDone(false);
    if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq('id', user.id);
    setBusy(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    await refreshProfile();
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="내 정보 수정" subtitle="이름 · 연락처" backTo={profile ? homeForRole(profile.role) : '/'} />

      <div className="mx-auto max-w-md p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">저장했습니다.</p>
        )}

        <label className="block text-sm font-medium text-gray-700">이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="이름"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <label className="mt-4 block text-sm font-medium text-gray-700">연락처 (선택)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, ''))}
          maxLength={13}
          placeholder="010-0000-0000"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />

        <p className="mt-4 text-sm text-gray-400">
          이메일과 소속은 여기서 바꿀 수 없어요. 소속 변경은 학원에 문의해 주세요.
        </p>

        <button
          onClick={save}
          disabled={!name.trim() || busy}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {busy ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
