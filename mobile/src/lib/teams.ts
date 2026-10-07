import type { UserRole } from '../types';

/** 팀·채팅 기능을 쓸 수 있는 역할 (학원 소속 원장·강사·학생) */
export const TEAM_ROLES: UserRole[] = ['ACADEMY_ADMIN', 'TEACHER', 'STUDENT'];

export function canUseTeams(role: UserRole | undefined | null): boolean {
  return !!role && TEAM_ROLES.includes(role);
}

/** 슈퍼관리자를 제외한 전체 역할이 채팅 사용 가능 (학부모는 읽기 전용) */
export function canUseChat(role: UserRole | undefined | null): boolean {
  return !!role && role !== 'SUPER_ADMIN';
}

/** 앱 딥링크(safestep://teams/join/CODE) 형태의 초대 링크 */
export function inviteLink(code: string): string {
  return `safestep://teams/join/${code}`;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: '슈퍼 관리자',
  ACADEMY_ADMIN: '학원 원장',
  TEACHER: '강사',
  STUDENT: '학생',
  PARENT: '학부모',
};

/**
 * 스터디카페 탐색(지도·좌석 도면)과 커뮤니티를 볼 수 없는 역할.
 * 학원 원장·강사·학부모는 운영/자녀 관리가 목적이라 이용자용 탐색·커뮤니티 화면을 노출하지 않습니다.
 */
export const EXPLORE_BLOCKED: UserRole[] = ['ACADEMY_ADMIN', 'TEACHER', 'PARENT'];

/** 비로그인(undefined)·일반 회원·학생·슈퍼관리자는 볼 수 있음 */
export function canExplore(role: UserRole | undefined | null): boolean {
  return !role || !EXPLORE_BLOCKED.includes(role);
}
