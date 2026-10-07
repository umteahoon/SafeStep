-- ============================================================
-- SafeStep - 보안 점검 후속 조치
-- 선행 조건: schema.sql + migration_03_chat.sql 적용 후 실행하세요
-- (3번 정책이 migration_03의 is_chat_room_participant() 함수를 사용합니다).
-- 여러 번 실행해도 에러가 나지 않도록 작성되어 있습니다.
--
-- 1) 원장이 academies 행을 직접 고쳐 구독 상태/만료일을 임의로 바꾸지 못하도록 차단
--    (구독은 결제 승인 백엔드(service role)만 갱신)
-- 2) 문의 폼의 브라우저 직접 INSERT 정책 제거 → 문의는 백엔드 /api/inquiries 로만 저장
-- 3) 채팅 이미지 버킷을 비공개로 전환하고, 같은 채팅방 참여자만 읽을 수 있게 제한
-- ============================================================

-- 1) 구독 관련 컬럼은 authenticated 사용자가 변경 불가
CREATE OR REPLACE FUNCTION protect_academy_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
       NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
    OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
  ) THEN
    RAISE EXCEPTION '구독 상태는 결제를 통해서만 변경할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_academy_subscription ON academies;
CREATE TRIGGER trg_protect_academy_subscription
  BEFORE UPDATE ON academies
  FOR EACH ROW
  EXECUTE FUNCTION protect_academy_subscription_columns();

-- 2) 문의는 백엔드를 거쳐서만 저장 (anon/authenticated 직접 INSERT 제거)
DROP POLICY IF EXISTS "Inquiries Public Create" ON inquiries;

-- 3) 채팅 이미지: 비공개 버킷 + 채팅방 참여자만 조회 (서명된 URL로만 접근)
UPDATE storage.buckets SET public = false WHERE id = 'chat-uploads';

DROP POLICY IF EXISTS "Chat Uploads Public Read" ON storage.objects;

DROP POLICY IF EXISTS "Chat Uploads Participant Read" ON storage.objects;
CREATE POLICY "Chat Uploads Participant Read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'chat-uploads'
        AND is_chat_room_participant((storage.foldername(name))[1]::uuid)
    );
