import { getJSON, setJSON } from './storage';

const KEY = 'safestep:welcome-done';

/**
 * 앱을 처음 열 때만 소개 화면을 보여줍니다.
 *  - 테스트(jest)에서는 항상 건너뜀 (NODE_ENV=test)
 *  - EXPO_PUBLIC_ALWAYS_WELCOME=1 이면 실행할 때마다 보여줌 (소개 화면 반복 확인용)
 *  - 내 정보 > "앱 소개 다시 보기"로 언제든 다시 볼 수 있음
 */
export async function shouldShowWelcome(): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.EXPO_PUBLIC_ALWAYS_WELCOME === '1') return true;
  return !(await getJSON<boolean>(KEY, false));
}

export async function markWelcomeDone() {
  await setJSON(KEY, true);
}

/** 처음 실행 상태로 되돌림 (다음 실행 때 소개 화면이 다시 나옴) */
export async function resetWelcome() {
  await setJSON(KEY, false);
}
