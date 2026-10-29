import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, GraduationCap, Heart, MapPin, Monitor, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

// 로그인 없이 각 역할 화면을 바로 체험하는 데모 버튼 (랜딩 · 로그인 페이지 공용).
// 원장/강사/학부모는 백엔드 POST /api/auth/demo-login 이 1회용 토큰을 발급하므로
// 비밀번호는 프론트 어디에도 존재하지 않습니다. 계정은 SafeStep 강남점 예시 데이터에 연결되어 있습니다.
type DemoRole = 'admin' | 'teacher' | 'parent';

const ACCOUNT_DEMOS: { role: DemoRole; label: string; desc: string; redirect: string; icon: LucideIcon }[] = [
  { role: 'admin', label: '원장', desc: '대시보드 · 학생 · 공지', redirect: '/dashboard', icon: Building2 },
  { role: 'teacher', label: '강사', desc: '반별 출석부 · 소통', redirect: '/attendance', icon: GraduationCap },
  { role: 'parent', label: '학부모', desc: '자녀 리포트 · 상담', redirect: '/parent/report', icon: Heart },
];

const OPEN_DEMOS: { to: string; label: string; desc: string; icon: LucideIcon }[] = [
  { to: '/map', label: '이용자', desc: '지도 · 빈자리 찾기', icon: MapPin },
  { to: '/kiosk?demo=1', label: '키오스크', desc: 'QR · 핀코드 입실', icon: Monitor },
];

const cardClass =
  'flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50';

function DemoCard({ icon: Icon, label, desc, loading }: { icon: LucideIcon; label: string; desc: string; loading?: boolean }) {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{loading ? '접속 중...' : `${label} 체험`}</span>
        <span className="block truncate text-xs text-gray-500">{desc}</span>
      </span>
    </>
  );
}

export function DemoButtons({ columns = 'sm:grid-cols-2 lg:grid-cols-5' }: { columns?: string }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 서버에서 데모 로그인이 꺼져 있으면(DEMO_LOGIN_ENABLED=false) 계정 데모는 숨기고 이용자 · 키오스크만 보여줌
  const [accountDemoEnabled, setAccountDemoEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    apiFetch<{ enabled: boolean }>('/api/auth/demo-status', { auth: false })
      .then((r) => mounted && setAccountDemoEnabled(!!r.enabled))
      .catch(() => mounted && setAccountDemoEnabled(false));
    return () => {
      mounted = false;
    };
  }, []);

  const tryDemo = async (role: DemoRole, redirect: string) => {
    const isAlreadyDemo = profile?.email?.startsWith('demo-');
    if (user && !isAlreadyDemo) {
      const ok = window.confirm('현재 로그인된 계정에서 로그아웃하고 데모 계정으로 전환합니다. 계속할까요?');
      if (!ok) return;
    }
    setError(null);
    setLoading(role);
    try {
      const { tokenHash } = await apiFetch<{ email: string; tokenHash: string }>('/api/auth/demo-login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ role }),
      });
      // generateLink가 주는 값은 해시된 토큰이므로 token이 아니라 token_hash로 검증해야 함
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (otpError) throw otpError;
      navigate(redirect);
    } catch {
      setError('데모 접속에 실패했습니다. 서버가 깨어나는 중일 수 있으니 잠시 후 다시 눌러주세요.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <div className={`grid grid-cols-1 gap-2 ${columns}`}>
        {OPEN_DEMOS.map((d) => (
          <Link key={d.to} to={d.to} className={cardClass}>
            <DemoCard icon={d.icon} label={d.label} desc={d.desc} />
          </Link>
        ))}
        {accountDemoEnabled &&
          ACCOUNT_DEMOS.map((d) => (
            <button
              key={d.role}
              type="button"
              onClick={() => tryDemo(d.role, d.redirect)}
              disabled={loading !== null}
              className={cardClass}
            >
              <DemoCard icon={d.icon} label={d.label} desc={d.desc} loading={loading === d.role} />
            </button>
          ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {accountDemoEnabled && (
        <p className="mt-2 text-xs text-gray-400">
          원장 · 강사 · 학부모 체험은 예시 학원 데이터를 여러 사람이 함께 쓰는 공용 계정입니다. 가입 없이 바로 들어가집니다.
        </p>
      )}
    </div>
  );
}
