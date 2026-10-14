import type { UserRole } from '../types';
import type { RootStackParamList } from '../navigation/types';

/**
 * 학원 홈의 버튼(채팅방·공지방·출결)을 지금 쓸 수 있는지.
 *  - ok:      바로 이용 가능
 *  - login:   로그인이 필요
 *  - link:    학원·스터디카페 연동이 필요 (일반 회원)
 *  - foreign: 내가 소속된 곳이 아니라 이용 불가
 */
export type AcademyAccess = 'ok' | 'login' | 'link' | 'foreign';

export function academyAccess(
  role: UserRole | undefined | null,
  myAcademyId: string | null | undefined,
  academyId: string
): AcademyAccess {
  if (!role) return 'login';
  if (role === 'SUPER_ADMIN') return 'foreign';
  // 학부모는 자녀의 학원을 서버 권한(RLS)이 걸러주므로 막지 않음
  if (role === 'PARENT') return 'ok';
  if (!myAcademyId) return 'link';
  return myAcademyId === academyId ? 'ok' : 'foreign';
}

export function accessMessage(a: AcademyAccess): string {
  switch (a) {
    case 'login':
      return '로그인 후 이용할 수 있어요';
    case 'link':
      return '학원에 연동하면 이용할 수 있어요';
    case 'foreign':
      return '내가 소속된 학원만 이용할 수 있어요';
    default:
      return '';
  }
}

/** 역할별 "출결" 버튼이 여는 화면 */
export function attendanceTarget(role: UserRole | undefined | null): keyof RootStackParamList {
  if (role === 'ACADEMY_ADMIN' || role === 'TEACHER') return 'Attendance';
  if (role === 'PARENT') return 'ParentReport';
  return 'CheckIn';
}

/** 학원 홈에서 방 이름 아래에 보여줄 설명 */
export function roomHint(joined: boolean, isStaff: boolean): string {
  if (isStaff) return '탭하여 입장';
  return joined ? '참여 중 · 탭하여 입장' : '비밀번호를 입력해 입장';
}

export function attendanceDesc(role: UserRole | undefined | null): string {
  if (role === 'ACADEMY_ADMIN' || role === 'TEACHER') return '반별 출석부에서 출석 체크';
  if (role === 'PARENT') return '자녀 출결 리포트 보기';
  return '큰 버튼으로 출석하고 기록 확인';
}
