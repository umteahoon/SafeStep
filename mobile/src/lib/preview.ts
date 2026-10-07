// 미리보기 모드 공통 상수 (useAuth / mockSupabase 가 함께 사용)
export const PREVIEW_MODE = process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';
export const PREVIEW_USER_ID = '00000000-0000-0000-0000-000000000000';
export const PREVIEW_ACADEMY_ID = '00000000-0000-0000-0000-000000000001';
/** 미리보기의 "일반 회원"(학생으로 가입했지만 학원 명부에 연동되지 않은 계정) */
export const PREVIEW_MEMBER_ID = '00000000-0000-0000-0000-0000000000aa';
