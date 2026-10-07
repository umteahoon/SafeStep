import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PREVIEW_MODE } from './preview';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!PREVIEW_MODE && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SafeStep] Supabase 환경변수가 설정되지 않았습니다. mobile/.env 파일을 확인하세요.'
  );
}

// 웹(frontend/src/lib/supabase.ts)과 같은 Supabase 프로젝트를 가리킵니다.
// 세션은 AsyncStorage에 저장되어 앱을 껐다 켜도 로그인 상태가 유지됩니다.
// 미리보기 모드에서는 실제 클라이언트를 만들지 않습니다 (환경변수가 비어 있어도 크래시하지 않도록)
const realClient: SupabaseClient | null = PREVIEW_MODE
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

// 미리보기 모드에서는 서버 대신 메모리 가짜 서버를 사용합니다 (lib/mockSupabase.ts)
export const supabase: SupabaseClient = PREVIEW_MODE
  ? (mockSupabase as unknown as SupabaseClient)
  : (realClient as SupabaseClient);
