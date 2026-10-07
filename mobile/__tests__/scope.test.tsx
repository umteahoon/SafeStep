import { buildScopeSections, inScope, scopeLabel, writeTarget } from '../src/lib/communityScope';

const cafes = [
  { id: 'a', name: 'SafeStep 강남점', address: '서울 강남구 테헤란로' },
  { id: 'b', name: 'SafeStep 홍대점', address: '서울특별시 마포구 와우산로' },
  { id: 'c', name: 'SafeStep 해운대점', address: '부산광역시 해운대구 해운대로' },
  { id: 'd', name: 'SafeStep 판교점', address: '경기 성남시 분당구' },
];
const ctx = { cafes, myAcademyId: 'a', favorites: ['c', 'd'] };

describe('커뮤니티 범위(scope)', () => {
  it('라벨', () => {
    expect(scopeLabel({ kind: 'all' }, ctx)).toBe('전체 스터디카페');
    expect(scopeLabel({ kind: 'mine' }, ctx)).toBe('내 스터디카페');
    expect(scopeLabel({ kind: 'fav' }, ctx)).toBe('즐겨찾기');
    expect(scopeLabel({ kind: 'region', sido: '서울' }, ctx)).toBe('서울 전체');
    expect(scopeLabel({ kind: 'region', sido: '서울', sigungu: '마포구' }, ctx)).toBe('서울 · 마포구');
    expect(scopeLabel({ kind: 'cafe', id: 'b' }, ctx)).toBe('홍대점');
    expect(scopeLabel({ kind: 'cafe', id: 'zzz' }, ctx)).toBe('스터디카페');
  });

  it('범위 필터', () => {
    expect(['a', 'b', 'c', 'd'].filter((id) => inScope(id, { kind: 'all' }, ctx))).toEqual(['a', 'b', 'c', 'd']);
    expect(['a', 'b', 'c', 'd'].filter((id) => inScope(id, { kind: 'mine' }, ctx))).toEqual(['a']);
    expect(['a', 'b', 'c', 'd'].filter((id) => inScope(id, { kind: 'fav' }, ctx))).toEqual(['c', 'd']);
    expect(['a', 'b', 'c', 'd'].filter((id) => inScope(id, { kind: 'cafe', id: 'b' }, ctx))).toEqual(['b']);
    expect(['a', 'b', 'c', 'd'].filter((id) => inScope(id, { kind: 'region', sido: '서울' }, ctx))).toEqual(['a', 'b']);
    expect(['a', 'b', 'c', 'd'].filter((id) => inScope(id, { kind: 'region', sido: '서울', sigungu: '마포구' }, ctx))).toEqual(['b']);
  });

  it('소속이 없으면 "내 스터디카페"는 아무 글도 없음', () => {
    expect(inScope('a', { kind: 'mine' }, { ...ctx, myAcademyId: null })).toBe(false);
  });

  it('글쓰기 대상', () => {
    expect(writeTarget({ kind: 'cafe', id: 'c' }, 'a')).toBe('c');
    expect(writeTarget({ kind: 'all' }, 'a')).toBe('a');
    expect(writeTarget({ kind: 'region', sido: '부산' }, 'a')).toBe('a');
    expect(writeTarget({ kind: 'all' }, null)).toBeNull();
  });

  it('시트 섹션: 시/도별로 묶고(표기 달라도 합쳐짐) 글 많은 순', () => {
    const counts = { a: 1, b: 5, c: 2, d: 0 };
    const s = buildScopeSections(cafes, counts);
    expect(s[0].sido).toBe('서울');
    expect(s[0].cafeCount).toBe(2);
    expect(s[0].postCount).toBe(6);
    expect(s[0].cafes.map((c) => c.name)).toEqual(['SafeStep 홍대점', 'SafeStep 강남점']); // 글 많은 순
    expect(s[0].cafes[0].sigungu).toBe('마포구');
  });

  it('시트 검색: 이름·주소로 걸러지고 빈 섹션은 사라짐', () => {
    const s = buildScopeSections(cafes, {}, '해운대');
    expect(s).toHaveLength(1);
    expect(s[0].sido).toBe('부산');
    expect(buildScopeSections(cafes, {}, '없는곳')).toEqual([]);
    expect(buildScopeSections(cafes, {}, '마포구')[0].cafes[0].id).toBe('b'); // 주소로 검색
  });
});
