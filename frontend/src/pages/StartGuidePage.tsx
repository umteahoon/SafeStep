import { Link } from 'react-router-dom';
import { PublicHeader } from '../components/common/PublicHeader';
import { useAuth } from '../hooks/useAuth';

const STEPS = [
  {
    title: '도입 문의 남기기',
    desc: '학원·카페 정보를 남겨주시면 SafeStep팀이 지점을 생성하고 8자리 등록 코드를 발급해드립니다.',
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
    desc: '태블릿에서 /kiosk 를 열어 QR로 입·퇴실을 받고, 출석부로 결석·지각 알림을 보내보세요.',
  },
];

export default function StartGuidePage() {
  const { user, profile } = useAuth();
  const isOwner = profile?.role === 'ACADEMY_ADMIN';

  let cta;
  if (!user) {
    cta = (
      <>
        <Link
          to="/register"
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          원장 계정 만들기
        </Link>
        <Link
          to="/login"
          className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
        >
          이미 계정이 있어요
        </Link>
      </>
    );
  } else if (!profile) {
    cta = <p className="text-sm text-gray-400">불러오는 중...</p>;
  } else if (isOwner) {
    cta = (
      <>
        <Link
          to={profile.academy_id ? '/dashboard' : '/owner/claim'}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          {profile.academy_id ? '내 대시보드로 이동' : '등록 코드 입력하기'}
        </Link>
        {profile.academy_id && (
          <Link
            to="/billing"
            className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            이용권 결제
          </Link>
        )}
      </>
    );
  } else {
    cta = (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
        현재 {profile.name}님은 원장 계정이 아닙니다. 학원·카페를 도입하려면 로그아웃 후 원장 계정으로
        가입해주세요.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900">무료로 시작하기</h1>
        <p className="mt-2 text-gray-500">아래 단계를 따라오시면 학원·카페 도입이 끝납니다.</p>

        <ol className="mt-8 space-y-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h2 className="font-semibold text-gray-900">{s.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-3">{cta}</div>

        <p className="mt-6 text-sm text-gray-400">
          궁금한 점이 있다면{' '}
          <Link to="/inquiry" className="font-medium text-blue-600">
            도입 문의
          </Link>
          를 남겨주세요.
        </p>
      </div>
    </div>
  );
}
