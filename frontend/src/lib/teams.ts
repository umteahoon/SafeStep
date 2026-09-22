import type { UserRole } from '../types';

/** 팀·채팅 기능을 쓸 수 있는 역할 (학원 소속 원장·강사·학생) */
export const TEAM_ROLES: UserRole[] = ['ACADEMY_ADMIN', 'TEACHER', 'STUDENT'];

export function canUseTeams(role: UserRole | undefined | null): boolean {
  return !!role && TEAM_ROLES.includes(role);
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/teams/join/${code}`;
}

/** 로그인 후 돌아갈 경로: 같은 사이트 내부 경로만 허용 */
export function safeNextPath(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
