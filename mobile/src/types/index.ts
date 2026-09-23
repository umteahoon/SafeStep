// frontend/src/types/index.ts 와 동일한 DB 스키마를 가리킵니다.
// 웹/앱이 같은 Supabase 프로젝트(테이블·RLS)를 쓰므로 모델이 어긋나지 않게
// 필드를 바꿀 때는 두 파일을 함께 수정하세요.

export type UserRole = 'SUPER_ADMIN' | 'ACADEMY_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  academy_id: string | null;
  approval_status: ApprovalStatus;
  phone: string | null;
  created_at: string;
}
