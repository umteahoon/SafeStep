import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SafeStep] Supabase 환경변수가 설정되지 않았습니다. mobile/.env 파일을 확인하세요.'
  );
}

// 웹(frontend/src/lib/supabase.ts)과 같은 Supabase 프로젝트를 가리킵니다.
// 세션은 AsyncStorage에 저장되어 앱을 껐다 켜도 로그인 상태가 유지됩니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
