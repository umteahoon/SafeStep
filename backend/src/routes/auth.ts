import { randomBytes } from 'crypto';
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { publicAuthLimiter } from '../lib/security';

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
  // 강사는 학원 없이 가입한 뒤, 원장에게 받은 초대 코드(/api/teacher-invite/join)로 학원에 합류합니다.
  // academyId 를 직접 넘기는 기존 방식은 호환을 위해 남겨두며, 이 경우 원장 승인(PENDING)이 필요합니다.
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
    academy_id: role === 'TEACHER' ? academyId ?? null : null,
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
router.post('/login-log', publicAuthLimiter, async (req, res) => {
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
const DEMO_EMAILS: Record<'admin' | 'teacher' | 'parent', string> = {
  admin: 'demo-admin@safestep.local',
  teacher: 'demo-teacher@safestep.local',
  parent: 'demo-parent@safestep.local',
};

// 학부모 데모에서 자녀로 보여줄 데모 학원 학생 (보호자가 비어 있을 때만 연결)
const DEMO_PARENT_CHILDREN = ['홍길동', '김서연', '박지훈'];

// 학부모 데모 계정이 없으면 만들고, 데모 학원 학생 몇 명의 보호자로 연결합니다.
// 비밀번호는 아무도 모르는 임의값 — 로그인은 demo-login 의 1회용 토큰으로만 합니다.
async function ensureDemoParent(): Promise<void> {
  const { data: admin } = await supabaseAdmin
    .from('profiles').select('academy_id').eq('email', DEMO_EMAILS.admin).maybeSingle();
  if (!admin?.academy_id) return;

  let { data: parent } = await supabaseAdmin
    .from('profiles').select('id').eq('email', DEMO_EMAILS.parent).maybeSingle();
  if (!parent) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAILS.parent,
      password: randomBytes(24).toString('base64url'),
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error('demo parent create failed');
    await supabaseAdmin.from('profiles').upsert({
      id: created.user.id,
      email: DEMO_EMAILS.parent,
      name: '데모 학부모',
      role: 'PARENT',
      approval_status: 'APPROVED',
    });
    parent = { id: created.user.id };
  }

  await supabaseAdmin
    .from('students')
    .update({ parent_user_id: parent.id })
    .eq('academy_id', admin.academy_id)
    .in('name', DEMO_PARENT_CHILDREN)
    .is('parent_user_id', null);
}

// POST /api/auth/demo-login  { role: 'admin' | 'teacher' | 'parent' }
// 비밀번호를 프론트에 절대 노출하지 않기 위해, 백엔드(service role)가 매직링크용
// 1회용 토큰만 발급하고 프론트는 그 토큰으로 supabase.auth.verifyOtp()를 호출합니다.
// role만 받고 이메일은 서버가 고정값으로 매핑합니다 — 임의 이메일을 받으면 이 API가
// "아무 계정이나 로그인시키는 API"가 되어버리므로 절대 클라이언트 입력을 이메일에 쓰지 않습니다.
// GET /api/auth/demo-status — 랜딩 페이지가 원장/강사 데모 버튼을 보여줄지 판단 (운영 시 DEMO_LOGIN_ENABLED=false)
// 데모 원장 계정이 정지(ban)되어 있어도 꺼진 것으로 봄 — 환경변수를 못 바꾼 상태에서도 버튼이 실패하지 않게. 1분 캐시
let demoStatusCache: { at: number; enabled: boolean } | null = null;
async function isDemoAccountUsable(): Promise<boolean> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', DEMO_EMAILS.admin).maybeSingle();
  if (!profile) return false;
  const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  const bannedUntil = (data.user as { banned_until?: string } | null)?.banned_until;
  return !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
}
router.get('/demo-status', async (_req, res) => {
  if (process.env.DEMO_LOGIN_ENABLED === 'false') return res.json({ enabled: false });
  if (!demoStatusCache || Date.now() - demoStatusCache.at > 60_000) {
    const enabled = await isDemoAccountUsable().catch(() => false);
    demoStatusCache = { at: Date.now(), enabled };
  }
  res.json({ enabled: demoStatusCache.enabled });
});

router.post('/demo-login', publicAuthLimiter, async (req, res) => {
  if (process.env.DEMO_LOGIN_ENABLED === 'false') {
    return res.status(404).json({ error: '데모 로그인이 비활성화되어 있습니다.' });
  }

  const role: unknown = (req.body ?? {}).role;
  if (role !== 'admin' && role !== 'teacher' && role !== 'parent') {
    return res.status(400).json({ error: 'role은 admin, teacher, parent 중 하나여야 합니다.' });
  }
  if (role === 'parent') {
    try {
      await ensureDemoParent();
    } catch {
      return res.status(500).json({ error: '학부모 데모 계정 준비에 실패했습니다.' });
    }
  }
  // 체험 학원 데이터를 하루 1번 기준 상태로 되돌림 (migration_21 — 20시간 안에 이미 했으면 DB 함수가 바로 끝냄).
  // 함수가 아직 없거나 실패해도 체험 접속은 막지 않음
  await supabaseAdmin.rpc('reset_demo_academy').then(
    () => undefined,
    () => undefined
  );

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
