// 주소 문자열에서 지역(시/도 · 시/군/구)을 뽑아 지역별로 묶는 유틸 (순수 함수)
// 지점 데이터에 지역 필드가 없어 주소 앞부분으로 판별합니다. 표기가 달라도("서울특별시"/"서울시"/"서울")
// 같은 지역으로 묶이도록 시/도 이름을 표준형으로 맞춥니다.

const SIDO_ALIASES: Record<string, string> = {
  서울특별시: '서울', 서울시: '서울', 서울: '서울',
  부산광역시: '부산', 부산시: '부산', 부산: '부산',
  대구광역시: '대구', 대구시: '대구', 대구: '대구',
  인천광역시: '인천', 인천시: '인천', 인천: '인천',
  광주광역시: '광주', 광주시: '광주', 광주: '광주',
  대전광역시: '대전', 대전시: '대전', 대전: '대전',
  울산광역시: '울산', 울산시: '울산', 울산: '울산',
  세종특별자치시: '세종', 세종시: '세종', 세종: '세종',
  경기도: '경기', 경기: '경기',
  강원특별자치도: '강원', 강원도: '강원', 강원: '강원',
  충청북도: '충북', 충북: '충북',
  충청남도: '충남', 충남: '충남',
  전북특별자치도: '전북', 전라북도: '전북', 전북: '전북',
  전라남도: '전남', 전남: '전남',
  경상북도: '경북', 경북: '경북',
  경상남도: '경남', 경남: '경남',
  제주특별자치도: '제주', 제주도: '제주', 제주: '제주',
};

export const UNKNOWN_REGION = '기타';

export interface Region {
  sido: string;
  sigungu: string;
}

export function parseRegion(address: string | null | undefined): Region {
  const tokens = String(address ?? '').trim().split(/\s+/).filter(Boolean);
  const sido = SIDO_ALIASES[tokens[0] ?? ''];
  if (!sido) return { sido: UNKNOWN_REGION, sigungu: UNKNOWN_REGION };
  return { sido, sigungu: tokens[1] ?? UNKNOWN_REGION };
}

export interface RegionCafe {
  id: string;
  address: string;
  empty: number;
  total: number;
}

export interface DistrictGroup {
  name: string;
  count: number;
  empty: number;
  cafeIds: string[];
}

export interface SidoGroup {
  sido: string;
  count: number;
  empty: number;
  total: number;
  /** 대표 이미지용: 이 지역에서 자리가 가장 많이 남은 지점 */
  topCafeId: string;
  districts: DistrictGroup[];
}

/** 지역별 그룹: 지점이 많은 시/도 순, 그 안에서도 지점이 많은 구/시 순 ('기타'는 맨 뒤) */
export function groupRegions(cafes: RegionCafe[]): SidoGroup[] {
  const map = new Map<string, { cafes: RegionCafe[]; districts: Map<string, RegionCafe[]> }>();
  for (const c of cafes) {
    const r = parseRegion(c.address);
    if (!map.has(r.sido)) map.set(r.sido, { cafes: [], districts: new Map() });
    const g = map.get(r.sido)!;
    g.cafes.push(c);
    if (!g.districts.has(r.sigungu)) g.districts.set(r.sigungu, []);
    g.districts.get(r.sigungu)!.push(c);
  }
  const rank = (name: string, count: number) => (name === UNKNOWN_REGION ? -1 : count);
  return [...map.entries()]
    .map(([sido, g]) => ({
      sido,
      count: g.cafes.length,
      empty: g.cafes.reduce((s, c) => s + c.empty, 0),
      total: g.cafes.reduce((s, c) => s + c.total, 0),
      topCafeId: [...g.cafes].sort((a, b) => b.empty - a.empty)[0].id,
      districts: [...g.districts.entries()]
        .map(([name, list]) => ({
          name,
          count: list.length,
          empty: list.reduce((s, c) => s + c.empty, 0),
          cafeIds: list.map((c) => c.id),
        }))
        .sort((a, b) => rank(b.name, b.count) - rank(a.name, a.count) || a.name.localeCompare(b.name, 'ko')),
    }))
    .sort((a, b) => rank(b.sido, b.count) - rank(a.sido, a.count) || a.sido.localeCompare(b.sido, 'ko'));
}

/** 선택한 지역에 속하는지 */
export function inRegion(address: string, sido: string | null, sigungu: string | null): boolean {
  if (!sido) return true;
  const r = parseRegion(address);
  return r.sido === sido && (!sigungu || r.sigungu === sigungu);
}
