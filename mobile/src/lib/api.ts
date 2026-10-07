import { supabase } from './supabase';
import { PREVIEW_MODE } from './preview';
import { mockApi } from './mockSupabase';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? '';

interface ApiOptions extends RequestInit {
  auth?: boolean; // 기본 true: Authorization 헤더에 supabase access token 첨부
}

/** 웹의 frontend/src/lib/api.ts 와 같은 패턴. 경로는 `/api/...` 로 시작합니다. */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  // 미리보기 모드: 일부 엔드포인트는 메모리 가짜 서버가 응답
  if (PREVIEW_MODE) {
    const mocked = mockApi(path, (rest.method ?? 'GET').toUpperCase(), rest.body ? JSON.parse(rest.body as string) : {});
    if (mocked !== undefined) return mocked as T;
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      finalHeaders.Authorization = `Bearer ${session.access_token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error ?? `요청 실패 (${res.status})`);
  }

  return json as T;
}

export { API_BASE_URL };
