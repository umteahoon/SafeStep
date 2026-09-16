// ============================================================
// SafeStep - 원장/강사 데모 계정 + 데모 반 생성 스크립트
//
// 랜딩 페이지의 "원장 데모 체험하기" / "강사 데모 체험하기" 버튼이
// 로그인할 대상 계정을 만듭니다. schema.sql + seed.sql 을 먼저 적용한
// 프로젝트에서, 아래처럼 backend/.env 값을 그대로 사용해 실행하세요.
//
//   cd backend
//   node ../supabase/seed_demo_accounts.mjs
//
// 여러 번 실행해도 안전합니다 (이미 있으면 건너뜁니다).
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function loadBackendEnv() {
  const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'backend',
    '.env'
  );
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // backend/.env 가 없으면 이미 설정된 환경변수를 그대로 사용
  }
}

loadBackendEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (backend/.env 확인).');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(pathAndQuery, init) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`REST ${pathAndQuery} 실패: ${JSON.stringify(data)}`);
  return data;
}

async function createAuthUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (/already.*registered|exists/i.test(data?.msg ?? data?.message ?? '')) {
      return null; // 이미 있음 — 아래에서 조회
    }
    throw new Error(`계정 생성 실패(${email}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

async function findAuthUserIdByEmail(email) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers }
  );
  const data = await res.json();
  const users = data.users ?? data;
  const found = Array.isArray(users) ? users.find((u) => u.email === email) : null;
  return found?.id ?? null;
}

async function ensureAuthUser(email, password) {
  const created = await createAuthUser(email, password);
  if (created) return created;
  const existing = await findAuthUserIdByEmail(email);
  if (!existing) throw new Error(`계정을 찾을 수 없습니다: ${email}`);
  return existing;
}

async function upsertProfile(profile) {
  await rest('profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(profile),
  });
}

async function main() {
  const [academy] = await rest(
    `academies?name=eq.${encodeURIComponent('SafeStep 강남점')}&select=id`
  );
  if (!academy) {
    throw new Error('SafeStep 강남점 학원을 찾을 수 없습니다. 먼저 seed.sql을 실행해주세요.');
  }
  const academyId = academy.id;

  const adminId = await ensureAuthUser('demo-admin@safestep.local', 'safestepdemo');
  await upsertProfile({
    id: adminId,
    email: 'demo-admin@safestep.local',
    name: '데모 원장',
    role: 'ACADEMY_ADMIN',
    academy_id: academyId,
    approval_status: 'APPROVED',
  });
  console.log('demo-admin@safestep.local (원장) 준비 완료:', adminId);

  const teacherId = await ensureAuthUser('demo-teacher@safestep.local', 'safestepdemo');
  await upsertProfile({
    id: teacherId,
    email: 'demo-teacher@safestep.local',
    name: '데모 강사',
    role: 'TEACHER',
    academy_id: academyId,
    approval_status: 'APPROVED',
  });
  console.log('demo-teacher@safestep.local (강사) 준비 완료:', teacherId);

  let [demoClass] = await rest(
    `classes?academy_id=eq.${academyId}&name=eq.${encodeURIComponent('중3 수학 데모반')}&select=id`
  );
  if (!demoClass) {
    [demoClass] = await rest('classes', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        academy_id: academyId,
        teacher_id: teacherId,
        name: '중3 수학 데모반',
        color_code: '#3B82F6',
      }),
    });

    await rest('class_schedules', {
      method: 'POST',
      body: JSON.stringify([
        { class_id: demoClass.id, day_of_week: 1, start_time: '16:00', end_time: '18:00' },
        { class_id: demoClass.id, day_of_week: 3, start_time: '16:00', end_time: '18:00' },
      ]),
    });

    const [student] = await rest(
      `students?academy_id=eq.${academyId}&name=eq.${encodeURIComponent('홍길동')}&select=id`
    );
    if (student) {
      await rest('class_enrollments', {
        method: 'POST',
        body: JSON.stringify({ class_id: demoClass.id, student_id: student.id }),
      });
    }
    console.log('중3 수학 데모반 생성 완료:', demoClass.id);
  } else {
    console.log('중3 수학 데모반 이미 존재:', demoClass.id);
  }

  console.log('\n완료! 랜딩 페이지의 "원장/강사 데모 체험하기" 버튼이 정상 동작합니다.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
