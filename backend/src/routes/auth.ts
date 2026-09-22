import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

const SELF_SIGNUP_ROLES = ['STUDENT', 'PARENT', 'TEACHER', 'ACADEMY_ADMIN'];

// POST /api/auth/register  { email, password, name, phone?, role, academyId? }
// 이메일 인증 없이 계정 + 프로필을 즉시 생성합니다.
// (Supabase 의 Confirm email 설정과 무관하게 바로 로그인 가능)
router.post('/register', async (req, res) => {
  const { email, password, name, phone, role, academyId } = req.body ?? {};

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }
  if (!SELF_SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({ error: '허용되지 않은 가입 유형입니다.' });
  }
  if (role === 'TEACHER' && !academyId) {
    return res.status(400).json({ error: '강사는 소속 학원을 선택해야 합니다.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  }

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    const msg = createError?.message ?? '';
    return res.status(400).json({
      error: /already|registered|exists/i.test(msg)
        ? '이미 가입된 이메일입니다.'
        : msg || '계정 생성에 실패했습니다.',
    });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    email,
    name,
    phone: phone ?? null,
    role,
    academy_id: role === 'TEACHER' ? academyId : null,
    approval_status: role === 'TEACHER' ? 'PENDING' : 'APPROVED',
  });

  if (profileError) {
    // 프로필 생성 실패 시 방금 만든 계정 롤백
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return res.status(500).json({ error: `프로필 생성 실패: ${profileError.message}` });
  }

  res.json({ success: true });
});

// POST /api/auth/login-log  { email, success, reason? }
// 프론트가 supabase.auth.signInWithPassword() 직후 결과와 무관하게 호출합니다.
// 슈퍼 관리자 대시보드의 "접속 로그"에서 반복 실패 등 의심스러운 시도를 확인할 수 있습니다.
router.post('/login-log', async (req, res) => {
  const { email, success, reason } = req.body ?? {};

  if (!email || typeof success !== 'boolean') {
    return res.status(400).json({ error: 'email과 success가 필요합니다.' });
  }

  await supabaseAdmin.from('login_attempts').insert({
    email: String(email).slice(0, 150),
    success,
    reason: reason ? String(reason).slice(0, 100) : null,
    ip_address: req.ip ?? null,
    user_agent: req.headers['user-agent']?.slice(0, 500) ?? null,
  });

  // 로그 실패 여부가 로그인 자체를 막으면 안 되므로 항상 200으로 응답
  res.json({ success: true });
});

// 랜딩 페이지 "원장/강사 데모 체험하기" 버튼이 사용할 고정 데모 계정.
// supabase/seed_demo_accounts.mjs 가 생성하는 계정과 반드시 동일해야 합니다.
const DEMO_EMAILS: Record<'admin' | 'teacher', string> = {
  admin: 'demo-admin@safestep.local',
  teacher: 'demo-teacher@safestep.local',
};

// POST /api/auth/demo-login  { role: 'admin' | 'teacher' }
// 비밀번호를 프론트에 절대 노출하지 않기 위해, 백엔드(service role)가 매직링크용
// 1회용 토큰만 발급하고 프론트는 그 토큰으로 supabase.auth.verifyOtp()를 호출합니다.
// role만 받고 이메일은 서버가 고정값으로 매핑합니다 — 임의 이메일을 받으면 이 API가
// "아무 계정이나 로그인시키는 API"가 되어버리므로 절대 클라이언트 입력을 이메일에 쓰지 않습니다.
router.post('/demo-login', async (req, res) => {
  if (process.env.DEMO_LOGIN_ENABLED === 'false') {
    return res.status(404).json({ error: '데모 로그인이 비활성화되어 있습니다.' });
  }

  const role: unknown = (req.body ?? {}).role;
  if (role !== 'admin' && role !== 'teacher') {
    return res.status(400).json({ error: 'role은 admin 또는 teacher여야 합니다.' });
  }

  const email = DEMO_EMAILS[role];
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    return res.status(500).json({ error: '데모 로그인 링크 생성에 실패했습니다.' });
  }

  res.json({ email, tokenHash: data.properties.hashed_token });
});

export default router;
