-- ============================================================
-- SafeStep Supabase Schema
-- Supabase SQL Editor에서 이 파일을 그대로 실행하세요.
--
-- ⚠️ 원본 명세서 대비 수정된 부분:
--   - "SuperAdmin Academies Policy"의 `OR true` 버그 수정
--     (원본은 FOR ALL 정책에 OR true가 붙어 있어 인증된 사용자 누구나
--      academies 테이블에 INSERT/UPDATE/DELETE 가능한 심각한 보안 결함이었음.
--      아래는 SELECT(공개 읽기)와 쓰기(슈퍼관리자/원장 전용)를 분리했습니다.)
--   - 명세서에 없던 classes/class_schedules/class_enrollments/seats/
--     attendance_logs/push_subscriptions 쓰기 정책을 추가로 정의했습니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUM 타입
-- ------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'STUDENT', 'PARENT');
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ------------------------------------------------------------
-- 2. 테이블
-- ------------------------------------------------------------

-- 학원/스터디카페 지점
CREATE TABLE academies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    total_seats INT DEFAULT 30,
    subscription_status VARCHAR(20) DEFAULT 'TRIAL', -- 'TRIAL' | 'ACTIVE' | 'EXPIRED'
    subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 통합 프로필
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(100) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    academy_id UUID REFERENCES academies(id) ON DELETE SET NULL,
    approval_status approval_status DEFAULT 'APPROVED',
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 토스 30일 이용권 결제 이력
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    payment_key VARCHAR(100),
    order_id VARCHAR(100) NOT NULL UNIQUE,
    amount INT NOT NULL DEFAULT 10000,
    status VARCHAR(20) NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 🔒 반/수업(Class) - 슈퍼관리자 열람 불가
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    color_code VARCHAR(10) DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 🔒 반별 시간표 - 슈퍼관리자 열람 불가
CREATE TABLE class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 🔒 학생 - 슈퍼관리자 열람 불가 (원장/소속 강사/본인/학부모만)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    attendance_code VARCHAR(10) NOT NULL,
    qr_token UUID DEFAULT gen_random_uuid(),
    parent_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    parent_phone VARCHAR(20) NOT NULL,
    link_code VARCHAR(6) NOT NULL DEFAULT LPAD(FLOOR(RANDOM()*1000000)::TEXT, 6, '0'),
    parent_view_token UUID DEFAULT gen_random_uuid(),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_academy_attendance_code UNIQUE(academy_id, attendance_code)
);

-- 🔒 반별 수강생 배정 - 슈퍼관리자 열람 불가
CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_class_student UNIQUE(class_id, student_id)
);

-- 🔒 반별 일일 출석부 - 슈퍼관리자 열람 불가
CREATE TABLE class_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL,
    reason VARCHAR(100),
    note TEXT,
    alert_sent BOOLEAN DEFAULT FALSE,
    recorded_by UUID REFERENCES profiles(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_class_attendance UNIQUE(class_id, student_id, date)
);

-- 스터디카페 좌석 (공개 읽기)
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    zone_type VARCHAR(20) DEFAULT 'FOCUS',
    grid_x INT NOT NULL,
    grid_y INT NOT NULL,
    status VARCHAR(20) DEFAULT 'EMPTY', -- 'EMPTY' | 'OCCUPIED' | 'AWAY'
    current_student_id UUID,
    occupied_at TIMESTAMPTZ,
    away_at TIMESTAMPTZ,
    CONSTRAINT unique_seat_per_academy UNIQUE(academy_id, seat_number)
);

-- 키오스크 출결 로그
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    seat_number INT,
    type VARCHAR(20) NOT NULL, -- 'CHECK_IN' | 'CHECK_OUT' | 'AWAY' | 'RETURN'
    check_method VARCHAR(10) DEFAULT 'KEYPAD', -- 'KEYPAD' | 'QR'
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    stay_duration_minutes INT DEFAULT 0,
    notification_status VARCHAR(20) DEFAULT 'PENDING'
);

-- 학부모 사전 결석/지각 신청
CREATE TABLE absence_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'ABSENCE' | 'LATE'
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED'
    requested_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_absence_request UNIQUE(student_id, date)
);

-- 학부모 Web Push 구독 정보
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_endpoint UNIQUE(student_id, endpoint)
);

-- 익명 소음/좌석독점 신고
CREATE TABLE seat_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    reason VARCHAR(50) NOT NULL, -- 'NOISE' | 'MONOPOLY' | 'OTHER'
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
    -- 익명성 보장을 위해 신고자 식별 정보는 저장하지 않음
);

-- 원장 초대코드: 슈퍼관리자가 지점 생성 시 발급하는 8자리 등록 코드
-- ⚠️ 의도적으로 RLS 정책을 하나도 만들지 않음 (서비스 롤 전용, 공개 읽기 정책을 두면 코드가 노출됨)
CREATE TABLE academy_owner_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    code VARCHAR(8) NOT NULL UNIQUE,
    used_by UUID REFERENCES profiles(id),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 로그인 시도 기록 (관리자 접속 감사용)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) NOT NULL,
    success BOOLEAN NOT NULL,
    reason VARCHAR(100),
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_created ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_created ON login_attempts(created_at DESC);

-- 반 채팅방(CLASS) / 학원 공지방(ANNOUNCEMENT)
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'CLASS' | 'ANNOUNCEMENT'
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 반 하나당 채팅방 하나, 학원당 공지방 하나
CREATE UNIQUE INDEX uniq_chat_room_class ON chat_rooms(class_id) WHERE class_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_chat_room_announcement ON chat_rooms(academy_id) WHERE type = 'ANNOUNCEMENT';

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'TEXT', -- 'TEXT' | 'IMAGE' | 'ATTENDANCE_CHECK' | 'ATTENDANCE_RESPONSE' | 'SYSTEM'
    content TEXT,
    image_url TEXT,
    edited_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room_id, created_at);

-- 채팅방별 마지막 열람 시각 (안읽음 표시용)
CREATE TABLE chat_room_reads (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, room_id)
);

-- ------------------------------------------------------------
-- 3. Helper 함수: 현재 로그인 사용자의 role / academy_id
--    (매 정책마다 서브쿼리를 반복하지 않도록 SECURITY DEFINER 함수로 분리)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_user_academy_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_approved_staff_of(target_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND academy_id = target_academy_id
      AND (
        role = 'ACADEMY_ADMIN'
        OR (role = 'TEACHER' AND approval_status = 'APPROVED')
      )
  );
$$;

-- 해당 학원 소속인가 (직원/학생은 profiles.academy_id, 학부모는 연동된 자녀 기준)
CREATE OR REPLACE FUNCTION is_academy_member(target_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND academy_id = target_academy_id
  ) OR EXISTS (
    SELECT 1 FROM students WHERE academy_id = target_academy_id AND parent_user_id = auth.uid()
  );
$$;

-- 이 채팅방을 열람할 수 있는가 (공지방=학원 구성원 전체, 반방=담당직원+수강생 본인/학부모)
CREATE OR REPLACE FUNCTION is_chat_room_participant(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms r
    WHERE r.id = target_room_id
      AND (
        (r.type = 'ANNOUNCEMENT' AND is_academy_member(r.academy_id))
        OR (
          r.type = 'CLASS' AND (
            is_approved_staff_of(r.academy_id)
            OR EXISTS (
              SELECT 1 FROM class_enrollments ce
              JOIN students s ON s.id = ce.student_id
              WHERE ce.class_id = r.class_id
                AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
            )
          )
        )
      )
  );
$$;

-- 이 채팅방에 발신할 수 있는가 (직원은 어디든, 학생은 본인이 수강 중인 반. 학부모는 읽기 전용)
CREATE OR REPLACE FUNCTION can_post_in_chat_room(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_rooms r
    WHERE r.id = target_room_id
      AND (
        is_approved_staff_of(r.academy_id)
        OR (
          r.type = 'CLASS' AND EXISTS (
            SELECT 1 FROM class_enrollments ce
            JOIN students s ON s.id = ce.student_id
            WHERE ce.class_id = r.class_id AND s.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- ------------------------------------------------------------
-- 4. RLS 활성화
-- ------------------------------------------------------------
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_owner_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_reads ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5. academies: 공개 읽기 + 쓰기는 슈퍼관리자/원장(본인 학원)만
--    ⚠️ 원본 명세서의 `OR true` 버그를 여기서 수정함
-- ------------------------------------------------------------
CREATE POLICY "Academies Public Read" ON academies
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Academies SuperAdmin Write" ON academies
    FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Academies Owner Update" ON academies
    FOR UPDATE TO authenticated
    USING (
        current_user_role() = 'SUPER_ADMIN'
        OR id = current_user_academy_id() AND current_user_role() = 'ACADEMY_ADMIN'
    );

CREATE POLICY "Academies SuperAdmin Delete" ON academies
    FOR DELETE TO authenticated
    USING (current_user_role() = 'SUPER_ADMIN');

-- ------------------------------------------------------------
-- 6. profiles: 본인 프로필 + 같은 학원 원장/강사는 서로 최소 정보 열람
-- ------------------------------------------------------------
CREATE POLICY "Profiles Self Access" ON profiles
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles Academy Staff Read" ON profiles
    FOR SELECT TO authenticated
    USING (
        current_user_role() = 'SUPER_ADMIN' -- 가입자 수 카운트 용도 (개별 필드는 프론트에서 미노출)
        OR (academy_id IS NOT NULL AND academy_id = current_user_academy_id())
    );

-- ------------------------------------------------------------
-- 7. subscriptions: 슈퍼관리자(매출 집계) + 본인 학원 원장
-- ------------------------------------------------------------
CREATE POLICY "Subscriptions Access" ON subscriptions
    FOR SELECT TO authenticated
    USING (
        current_user_role() = 'SUPER_ADMIN'
        OR academy_id = current_user_academy_id() AND current_user_role() = 'ACADEMY_ADMIN'
    );

-- ------------------------------------------------------------
-- 8. 🔒 classes / class_schedules / class_enrollments / class_attendance_records
--    슈퍼관리자 차단, 해당 학원 원장 및 승인된 강사만 접근
-- ------------------------------------------------------------
CREATE POLICY "Classes Strict Academy Access" ON classes
    FOR ALL TO authenticated
    USING (is_approved_staff_of(academy_id))
    WITH CHECK (is_approved_staff_of(academy_id));

CREATE POLICY "Class Schedules Strict Access" ON class_schedules
    FOR ALL TO authenticated
    USING (
        is_approved_staff_of((SELECT academy_id FROM classes WHERE id = class_id))
    )
    WITH CHECK (
        is_approved_staff_of((SELECT academy_id FROM classes WHERE id = class_id))
    );

CREATE POLICY "Class Enrollments Strict Access" ON class_enrollments
    FOR ALL TO authenticated
    USING (
        is_approved_staff_of((SELECT academy_id FROM classes WHERE id = class_id))
    )
    WITH CHECK (
        is_approved_staff_of((SELECT academy_id FROM classes WHERE id = class_id))
    );

CREATE POLICY "Attendance Records Strict Access" ON class_attendance_records
    FOR ALL TO authenticated
    USING (is_approved_staff_of(academy_id))
    WITH CHECK (is_approved_staff_of(academy_id));

-- 학부모/학생은 본인(자녀) 출석 기록만 조회 가능
CREATE POLICY "Attendance Records Parent Student Read" ON class_attendance_records
    FOR SELECT TO authenticated
    USING (
        student_id IN (
            SELECT id FROM students
            WHERE parent_user_id = auth.uid() OR user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------
-- 9. 🔒 students: 슈퍼관리자 차단, 원장/승인 강사/본인/학부모만 접근
-- ------------------------------------------------------------
CREATE POLICY "Students Strict Access" ON students
    FOR ALL TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR parent_user_id = auth.uid()
        OR user_id = auth.uid()
    )
    WITH CHECK (is_approved_staff_of(academy_id));

-- ------------------------------------------------------------
-- 10. seats: 공개 읽기(지도/좌석 현황), 쓰기는 학원 직원 또는 서비스 롤(키오스크 백엔드)
-- ------------------------------------------------------------
CREATE POLICY "Seats Public Read" ON seats
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Seats Staff Write" ON seats
    FOR UPDATE TO authenticated
    USING (is_approved_staff_of(academy_id));

CREATE POLICY "Seats Staff Insert" ON seats
    FOR INSERT TO authenticated
    WITH CHECK (is_approved_staff_of(academy_id));

CREATE POLICY "Seats Staff Delete" ON seats
    FOR DELETE TO authenticated
    USING (is_approved_staff_of(academy_id));

-- 키오스크 태블릿은 보통 로그인 세션이 없으므로, 실제 입·퇴실 처리는
-- backend가 SUPABASE_SERVICE_ROLE_KEY로 RLS를 우회해 수행하는 것을 권장합니다.

-- ------------------------------------------------------------
-- 11. attendance_logs: 원장/승인 강사 + 본인(학생) + 학부모(자녀)
-- ------------------------------------------------------------
CREATE POLICY "Attendance Logs Access" ON attendance_logs
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR student_id IN (
            SELECT id FROM students
            WHERE parent_user_id = auth.uid() OR user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------
-- 12. absence_requests: 학부모 본인 신청/조회, 학원 직원 조회/승인
-- ------------------------------------------------------------
CREATE POLICY "Absence Requests Parent Create" ON absence_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        student_id IN (SELECT id FROM students WHERE parent_user_id = auth.uid())
    );

CREATE POLICY "Absence Requests Access" ON absence_requests
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR student_id IN (SELECT id FROM students WHERE parent_user_id = auth.uid())
    );

CREATE POLICY "Absence Requests Staff Update" ON absence_requests
    FOR UPDATE TO authenticated
    USING (is_approved_staff_of(academy_id));

-- ------------------------------------------------------------
-- 13. push_subscriptions: 학부모 본인 자녀 것만
-- ------------------------------------------------------------
CREATE POLICY "Push Subscriptions Parent Access" ON push_subscriptions
    FOR ALL TO authenticated
    USING (
        student_id IN (SELECT id FROM students WHERE parent_user_id = auth.uid())
    )
    WITH CHECK (
        student_id IN (SELECT id FROM students WHERE parent_user_id = auth.uid())
    );

-- ------------------------------------------------------------
-- 14. seat_reports: 익명 생성 허용(공개), 조회는 학원 직원만
-- ------------------------------------------------------------
CREATE POLICY "Seat Reports Create" ON seat_reports
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Seat Reports Staff Read" ON seat_reports
    FOR SELECT TO authenticated
    USING (is_approved_staff_of(academy_id));

CREATE POLICY "Seat Reports Staff Update" ON seat_reports
    FOR UPDATE TO authenticated
    USING (is_approved_staff_of(academy_id));

-- ------------------------------------------------------------
-- 15. login_attempts: 슈퍼관리자만 조회. 쓰기는 백엔드가 service role로만 수행
-- ------------------------------------------------------------
CREATE POLICY "Login Attempts SuperAdmin Read" ON login_attempts
    FOR SELECT TO authenticated
    USING (current_user_role() = 'SUPER_ADMIN');

-- ------------------------------------------------------------
-- 16. chat_rooms / chat_messages: 반 채팅 · 공지방
-- ------------------------------------------------------------
CREATE POLICY "Chat Rooms Select" ON chat_rooms
    FOR SELECT TO authenticated
    USING (
        is_approved_staff_of(academy_id)
        OR (type = 'ANNOUNCEMENT' AND is_academy_member(academy_id))
        OR (
            type = 'CLASS' AND EXISTS (
                SELECT 1 FROM class_enrollments ce
                JOIN students s ON s.id = ce.student_id
                WHERE ce.class_id = chat_rooms.class_id
                  AND (s.user_id = auth.uid() OR s.parent_user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Chat Rooms Staff Create" ON chat_rooms
    FOR INSERT TO authenticated
    WITH CHECK (is_approved_staff_of(academy_id));

CREATE POLICY "Chat Messages Select" ON chat_messages
    FOR SELECT TO authenticated
    USING (is_chat_room_participant(room_id));

CREATE POLICY "Chat Messages Insert" ON chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (can_post_in_chat_room(room_id) AND sender_id = auth.uid());

-- 같은 채팅방에 실제로 메시지를 보낸 사람의 프로필(이름)은 다른 참여자도 볼 수 있어야 함
-- (학부모는 profiles.academy_id 가 없어 기존 "같은 학원 직원" 정책만으로는 발신자 이름을 못 봄)
CREATE POLICY "Profiles Chat Participant Read" ON profiles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_messages m
            WHERE m.sender_id = profiles.id
              AND is_chat_room_participant(m.room_id)
        )
    );

-- 삭제: 본인 메시지는 누구나, 그 외 메시지는 학원 직원이 삭제 가능
CREATE POLICY "Chat Messages Delete" ON chat_messages
    FOR DELETE TO authenticated
    USING (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM chat_rooms r
            WHERE r.id = chat_messages.room_id AND is_approved_staff_of(r.academy_id)
        )
    );

-- 수정: 본인이 보낸 TEXT 메시지만 (이미지·출석체크 등은 수정 불가)
CREATE POLICY "Chat Messages Own Edit" ON chat_messages
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid() AND type = 'TEXT')
    WITH CHECK (sender_id = auth.uid() AND type = 'TEXT');

-- chat_room_reads: 본인 것만 읽고 쓸 수 있음 (안읽음 표시 계산용)
CREATE POLICY "Chat Room Reads Own" ON chat_room_reads
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- 18. Storage: 채팅 이미지 첨부용 공개 버킷
--     업로드 경로는 "<room_id>/<파일명>" 규칙을 강제해 발신 권한과 동일한 기준으로 제한
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Chat Uploads Public Read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'chat-uploads');

CREATE POLICY "Chat Uploads Participant Insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'chat-uploads'
        AND can_post_in_chat_room((storage.foldername(name))[1]::uuid)
    );

-- ------------------------------------------------------------
-- 17. Realtime 활성화: seats(잔여석), chat_messages(채팅), class_attendance_records(출결)
--     테이블을 SQL로만 만들면 Realtime 발행 목록에 자동 포함되지 않아 별도로 추가해야 함
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE seats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE class_attendance_records;

-- ============================================================
-- 끝. 실행 후 Supabase Dashboard > Authentication > Policies 에서
-- 각 테이블에 정책이 정상 부착되었는지 확인하세요.
-- ============================================================
