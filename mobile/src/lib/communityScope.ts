// 커뮤니티에서 "어느 게시판을 볼지"(범위) 선택 로직 — 순수 함수
import { inRegion, parseRegion, UNKNOWN_REGION } from './region';

export type Scope =
  | { kind: 'all' }
  | { kind: 'mine' }
  | { kind: 'fav' }
  | { kind: 'region'; sido: string; sigungu?: string | null }
  | { kind: 'cafe'; id: string };

export interface ScopeCafe {
  id: string;
  name: string;
  address: string;
}

export interface ScopeContext {
  cafes: ScopeCafe[];
  myAcademyId?: string | null;
  favorites: string[];
}

const shortName = (n: string) => n.replace('SafeStep ', '');

/** 제목 드롭다운에 표시할 라벨 */
export function scopeLabel(scope: Scope, ctx: Pick<ScopeContext, 'cafes'>): string {
  switch (scope.kind) {
    case 'all':
      return '전체 스터디카페';
    case 'mine':
      return '내 스터디카페';
    case 'fav':
      return '즐겨찾기';
    case 'region':
      return scope.sigungu ? `${scope.sido} · ${scope.sigungu}` : `${scope.sido} 전체`;
    case 'cafe': {
      const c = ctx.cafes.find((x) => x.id === scope.id);
      return c ? shortName(c.name) : '스터디카페';
    }
  }
}

/** 게시글(소속 스터디카페 id)이 선택한 범위에 속하는지 */
export function inScope(academyId: string, scope: Scope, ctx: ScopeContext): boolean {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'mine':
      return !!ctx.myAcademyId && academyId === ctx.myAcademyId;
    case 'fav':
      return ctx.favorites.includes(academyId);
    case 'cafe':
      return academyId === scope.id;
    case 'region': {
      const c = ctx.cafes.find((x) => x.id === academyId);
      return !!c && inRegion(c.address, scope.sido, scope.sigungu ?? null);
    }
  }
}

/** 글쓰기 대상 스터디카페: 범위가 특정 지점/내 소속이면 그곳, 아니면 내 소속, 없으면 null(직접 고르게 함) */
export function writeTarget(scope: Scope, myAcademyId?: string | null): string | null {
  if (scope.kind === 'cafe') return scope.id;
  return myAcademyId ?? null;
}

export interface ScopeSectionCafe extends ScopeCafe {
  sigungu: string;
  count: number;
}
export interface ScopeSection {
  sido: string;
  cafeCount: number;
  postCount: number;
  cafes: ScopeSectionCafe[];
}

/** 선택 시트의 시/도별 섹션. query 가 있으면 이름·주소가 맞는 스터디카페만 */
export function buildScopeSections(cafes: ScopeCafe[], counts: Record<string, number>, query = ''): ScopeSection[] {
  const q = query.trim().toLowerCase();
  const map = new Map<string, ScopeSectionCafe[]>();
  for (const c of cafes) {
    if (q && !c.name.toLowerCase().includes(q) && !c.address.toLowerCase().includes(q)) continue;
    const r = parseRegion(c.address);
    if (!map.has(r.sido)) map.set(r.sido, []);
    map.get(r.sido)!.push({ ...c, sigungu: r.sigungu, count: counts[c.id] ?? 0 });
  }
  const rank = (s: string, n: number) => (s === UNKNOWN_REGION ? -1 : n);
  return [...map.entries()]
    .map(([sido, list]) => ({
      sido,
      cafeCount: list.length,
      postCount: list.reduce((s, c) => s + c.count, 0),
      cafes: [...list].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')),
    }))
    .sort((a, b) => rank(b.sido, b.cafeCount) - rank(a.sido, a.cafeCount) || a.sido.localeCompare(b.sido, 'ko'));
}
