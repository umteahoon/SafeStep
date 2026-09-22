import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { homeForRole } from '../LandingPage';
import type { Team } from '../../types';

type Panel = 'create' | 'join' | null;

interface MyTeamRow {
  role: 'OWNER' | 'MEMBER';
  teams: Team | null;
}

export default function TeamsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const [teams, setTeams] = useState<MyTeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // ?action=create|join 으로 진입하면 해당 패널을 바로 엽니다.
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create' || action === 'join') {
      setPanel(action);
      setError(null);
    }
  }, [searchParams]);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    const { data, error: loadError } = await supabase
      .from('team_members')
      .select('role, teams(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
    if (loadError) {
      setError(
        '팀 목록을 불러오지 못했습니다. (DB 마이그레이션 supabase/migration_teams_chat.sql 적용 여부를 확인하세요)'
      );
    } else {
      setTeams((data as unknown as MyTeamRow[]) ?? []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const openPanel = (next: Panel) => {
    setPanel(next);
    setError(null);
    setSearchParams(next ? { action: next } : {}, { replace: true });
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('create_team', {
      p_name: name,
      p_description: description || null,
    });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 생성에 실패했습니다.');
      return;
    }
    navigate(`/teams/${(data as Team).id}`);
  };

  const joinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    const { data, error: rpcError } = await supabase.rpc('join_team_by_code', {
      p_code: code,
    });
    setIsBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? '팀 참가에 실패했습니다.');
      return;
    }
    navigate(`/teams/${data as string}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="팀"
        subtitle="같은 학원 사람들과 팀을 만들고 채팅하세요"
        backTo={profile ? homeForRole(profile.role) : '/'}
      />

      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => openPanel('create')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              panel === 'create'
                ? 'bg-indigo-700 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            팀 만들기
          </button>
          <button
            onClick={() => openPanel('join')}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              panel === 'join'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            팀 참가
          </button>
        </div>

        {panel === 'create' && (
          <form
            onSubmit={createTeam}
            className="mb-6 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <h2 className="mb-1 font-semibold text-gray-900">새 팀 만들기</h2>
            <p className="mb-4 text-sm text-gray-400">
              만들면 알파벳+숫자 조합의 참가 코드가 자동으로 발급됩니다.
            </p>
            <label className="mb-1 block text-sm font-medium text-gray-700">팀 이름</label>
            <input
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="예: 중3 수학 스터디"
            />
            <label className="mb-1 block text-sm font-medium text-gray-700">
              설명 (선택)
            </label>
            <input
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="팀 소개"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isBusy ? '만드는 중...' : '팀 만들기'}
            </button>
          </form>
        )}

        {panel === 'join' && (
          <form
            onSubmit={joinTeam}
            className="mb-6 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <h2 className="mb-1 font-semibold text-gray-900">참가 코드로 팀 참가</h2>
            <p className="mb-4 text-sm text-gray-400">
              팀장에게 받은 8자리 코드를 입력하세요. 초대 링크를 받았다면 링크를 바로 여세요.
            </p>
            <input
              required
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-lg uppercase tracking-[0.3em] outline-none focus:border-indigo-500"
              placeholder="AB12CD34"
            />
            <button
              type="submit"
              disabled={isBusy || code.trim().length < 8}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isBusy ? '참가 중...' : '참가하기'}
            </button>
          </form>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <h2 className="mb-3 text-sm font-semibold text-gray-500">내 팀</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : teams.filter((t) => t.teams).length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            아직 참가한 팀이 없습니다. 팀을 만들거나 참가 코드로 들어와보세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {teams.map(
              (row) =>
                row.teams && (
                  <li key={row.teams.id}>
                    <Link
                      to={`/teams/${row.teams.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-400"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {row.teams.name}
                        </p>
                        {row.teams.description && (
                          <p className="truncate text-sm text-gray-400">
                            {row.teams.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.role === 'OWNER'
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {row.role === 'OWNER' ? '팀장' : '멤버'}
                      </span>
                    </Link>
                  </li>
                )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
