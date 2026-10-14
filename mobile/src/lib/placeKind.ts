export type PlaceKind = 'ACADEMY' | 'STUDY_CAFE';

/**
 * 지점을 학원 / 스터디카페로 나눕니다.
 * DB에 종류(kind) 값이 하나도 없으면 구분할 수 없으므로 두 목록 모두 전체를 돌려줍니다(기존 동작 유지).
 */
export function splitByKind<T extends { kind?: PlaceKind | string | null }>(places: T[]) {
  const hasKind = places.some((p) => !!p.kind);
  if (!hasKind) return { academies: places, cafes: places };
  return {
    academies: places.filter((p) => p.kind === 'ACADEMY'),
    cafes: places.filter((p) => p.kind !== 'ACADEMY'),
  };
}

/** 학원 과목 분류 — 학원 찾기에서 수학/영어/코딩 등으로 골라 볼 수 있게 */
export type AcademyCategory = 'MATH' | 'ENGLISH' | 'KOREAN' | 'SCIENCE' | 'CODING' | 'GENERAL';

export const CATEGORIES: { key: AcademyCategory; label: string }[] = [
  { key: 'MATH', label: '수학' },
  { key: 'ENGLISH', label: '영어' },
  { key: 'KOREAN', label: '국어·논술' },
  { key: 'SCIENCE', label: '과학' },
  { key: 'CODING', label: '코딩' },
  { key: 'GENERAL', label: '종합' },
];

export function categoryLabel(key?: string | null): string | null {
  return CATEGORIES.find((c) => c.key === key)?.label ?? null;
}
