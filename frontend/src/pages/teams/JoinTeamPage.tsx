import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { canUseTeams } from '../../lib/teams';

interface Preview {
  team_id: string;
  team_name: string;
  description: string | null;
  member_count: number;
  same_academy: boolean;
  already_member: boolean;
}

/** 초대 링크(/teams/join/:code) 진입 화면. 비로그인이면 로그인 후 이 화면으로 돌아옵니다. */
export default function JoinTeamPage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const nextPath = `/teams/join/${code}`;
  const eligible = canUseTeams(profile?.role);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !eligible) {
      setIsChecking(false);
      return;
    }
    supabase.rpc('team_preview_by_code', { p_code: code }).then(({ data, error: rpcError }) => {
      if (rpcError) setError(rpcError.message);
      setPreview(((data as Preview[]) ?? [])[0] ?? null);
      setIsChecking(false);
    });
  }, [authLoading, user, eligible, code]);

  const join = async () => {
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('join_team_by_code', { p_code: code });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 참가에 실패했습니다.');
      return;
    }
    navigate(`/teams/${data as string}`, { replace: true });
  };

  let body;
  if (authLoading || isChecking) {
    body = <p className="text-sm text-gray-400">확인 중...</p>;
  } else if (!user) {
    body = (
      <>
        <p className="mb-4 text-sm text-gray-500">
          팀에 참가하려면 먼저 로그인해주세요. 로그인하면 이 초대로 돌아옵니다.
        </p>
        <Link
          to={`/login?next=${encodeURIComponent(nextPath)}`}
          className="block rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-700"
        >
          로그인하고 참가하기
        </Link>
        <p className="mt-3 text-center text-xs text-gray-400">
          계정이 없다면{' '}
          <Link to="/register" className="font-medium text-indigo-600">
            회원가입
          </Link>
        </p>
      </>
    );
  } else if (!eligible) {
    body = (
      <p className="text-sm text-red-500">
        팀 기능은 학원에 소속된 원장·강사·학생만 사용할 수 있습니다.
      </p>
    );
  } else if (!preview) {
    body = (
      <p className="text-sm text-red-500">
        {error ?? '유효하지 않은 초대 코드입니다. 코드를 다시 확인해주세요.'}
      </p>
    );
  } else {
    body = (
      <>
        <h2 className="text-xl font-bold text-gray-900">{preview.team_name}</h2>
        {preview.description && (
          <p className="mt-1 text-sm text-gray-500">{preview.description}</p>
        )}
        <p className="mt-2 text-sm text-gray-400">멤버 {preview.member_count}명</p>

        {preview.already_member ? (
          <Link
            to={`/teams/${preview.team_id}`}
            className="mt-5 block rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-700"
          >
            이미 참가한 팀 — 채팅방 열기
          </Link>
        ) : !preview.same_academy ? (
          <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            같은 학원에 소속된 사람만 참가할 수 있는 팀입니다.
          </p>
        ) : (
          <button
            onClick={join}
            disabled={isBusy}
            className="mt-5 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isBusy ? '참가 중...' : '팀 참가하기'}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-1 text-xs font-semibold text-indigo-600">SafeStep 팀 초대</p>
        <p className="mb-4 font-mono text-sm tracking-[0.25em] text-gray-400">{code.toUpperCase()}</p>
        {body}
        <Link to="/" className="mt-6 block text-center text-xs text-gray-400 hover:text-gray-600">
          홈으로
        </Link>
      </div>
    </div>
  );
}
