import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!url || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SafeStep] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.'
  );
}

// ⚠️ service role 키는 RLS를 우회합니다. 반드시 백엔드에서만 사용하고
// 컨트롤러 단에서 역할(role) 검증을 직접 수행해야 합니다.
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
