import { signOut } from '../../hooks/useAuth';

export default function TeacherPendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">원장 승인 대기 중입니다.</h1>
        <p className="mt-2 text-sm text-gray-400">
          원장이 승인하면 이용할 수 있어요. 승인 후 다시 로그인해주세요.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
