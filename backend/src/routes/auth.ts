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

export default router;
