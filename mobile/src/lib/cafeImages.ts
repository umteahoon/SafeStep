import type { ImageSourcePropType } from 'react-native';

/**
 * 학원·스터디카페 예시 이미지 (Unsplash 무료 사진, assets/places).
 * 지점 데이터에 이미지 필드가 아직 없어서, 미리보기 지점마다 서로 다른 사진을 배정해 둡니다.
 * 실제 매장 사진은 DB에 image_urls 가 생기면 그 값을 우선 사용하도록 교체하세요.
 */
const ACADEMY_IMAGES: ImageSourcePropType[] = [
  require('../../assets/places/academy-01.jpg'),
  require('../../assets/places/academy-02.jpg'),
  require('../../assets/places/academy-03.jpg'),
  require('../../assets/places/academy-04.jpg'),
  require('../../assets/places/academy-05.jpg'),
  require('../../assets/places/academy-06.jpg'),
  require('../../assets/places/academy-07.jpg'),
  require('../../assets/places/academy-08.jpg'),
  require('../../assets/places/academy-09.jpg'),
  require('../../assets/places/academy-10.jpg'),
  require('../../assets/places/academy-11.jpg'),
  require('../../assets/places/academy-12.jpg'),
  require('../../assets/places/academy-13.jpg'),
  require('../../assets/places/academy-14.jpg'),
  require('../../assets/places/academy-15.jpg'),
  require('../../assets/places/academy-16.jpg'),
  require('../../assets/places/academy-17.jpg'),
  require('../../assets/places/academy-18.jpg'),
  require('../../assets/places/academy-19.jpg'),
  require('../../assets/places/academy-20.jpg'),
  require('../../assets/places/academy-21.jpg'),
  require('../../assets/places/academy-22.jpg'),
  require('../../assets/places/academy-23.jpg'),
  require('../../assets/places/academy-24.jpg'),
  require('../../assets/places/academy-25.jpg'),
  require('../../assets/places/academy-26.jpg'),
  require('../../assets/places/academy-27.jpg'),
  require('../../assets/places/academy-28.jpg'),
];
const CAFE_IMAGES: ImageSourcePropType[] = [
  require('../../assets/places/cafe-01.jpg'),
  require('../../assets/places/cafe-02.jpg'),
  require('../../assets/places/cafe-03.jpg'),
  require('../../assets/places/cafe-04.jpg'),
  require('../../assets/places/cafe-05.jpg'),
  require('../../assets/places/cafe-06.jpg'),
  require('../../assets/places/cafe-07.jpg'),
  require('../../assets/places/cafe-08.jpg'),
  require('../../assets/places/cafe-09.jpg'),
  require('../../assets/places/cafe-10.jpg'),
  require('../../assets/places/cafe-11.jpg'),
  require('../../assets/places/cafe-12.jpg'),
  require('../../assets/places/cafe-13.jpg'),
  require('../../assets/places/cafe-14.jpg'),
  require('../../assets/places/cafe-15.jpg'),
  require('../../assets/places/cafe-16.jpg'),
  require('../../assets/places/cafe-17.jpg'),
  require('../../assets/places/cafe-18.jpg'),
  require('../../assets/places/cafe-19.jpg'),
  require('../../assets/places/cafe-20.jpg'),
  require('../../assets/places/cafe-21.jpg'),
  require('../../assets/places/cafe-22.jpg'),
  require('../../assets/places/cafe-23.jpg'),
  require('../../assets/places/cafe-24.jpg'),
  require('../../assets/places/cafe-25.jpg'),
  require('../../assets/places/cafe-26.jpg'),
  require('../../assets/places/cafe-27.jpg'),
  require('../../assets/places/cafe-28.jpg'),
  require('../../assets/places/cafe-29.jpg'),
  require('../../assets/places/cafe-30.jpg'),
  require('../../assets/places/cafe-31.jpg'),
  require('../../assets/places/cafe-32.jpg'),
];

// 미리보기 지점별 고정 배정 (앞쪽 사진부터 서로 겹치지 않게)
const ACADEMY_IDS = ['00000000-0000-0000-0000-000000000001', 'a-12', 'a-16', 'a-22', 'a-5', 'a-14', 'a-18', 'a-23', 'a-2', 'a-15', 'a-21', 'a-11', 'a-13', 'a-19', 'a-7', 'a-17', 'a-9', 'a-20'];
const CAFE_IDS = ['a-3', 'a-4', 'a-6', 'a-8', 'a-10', 'a-24', 'a-25', 'a-26', 'a-27', 'a-28', 'a-29', 'a-30', 'a-31', 'a-32', 'a-33', 'a-34', 'a-35', 'a-36', 'a-37', 'a-38', 'a-39', 'a-40'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 지점의 대표 이미지가 풀에서 몇 번째인지 (알려진 지점은 고정, 그 외는 id 해시) */
function indexFor(id: string, kind: 'ACADEMY' | 'STUDY_CAFE'): number {
  const ids = kind === 'ACADEMY' ? ACADEMY_IDS : CAFE_IDS;
  const pos = ids.indexOf(id);
  if (pos >= 0) return pos;
  const size = kind === 'ACADEMY' ? ACADEMY_IMAGES.length : CAFE_IMAGES.length;
  return hash(id) % size;
}

function kindOf(id: string, hint?: string | null): 'ACADEMY' | 'STUDY_CAFE' {
  if (hint === 'ACADEMY') return 'ACADEMY';
  if (hint === 'STUDY_CAFE') return 'STUDY_CAFE';
  return ACADEMY_IDS.includes(id) ? 'ACADEMY' : 'STUDY_CAFE';
}

export function cafeImage(id: string): ImageSourcePropType {
  return placeImage(id, ACADEMY_IDS.includes(id) ? 'ACADEMY' : 'STUDY_CAFE');
}

export function academyImage(id: string): ImageSourcePropType {
  return placeImage(id, 'ACADEMY');
}

/** 지점 종류에 맞는 대표 이미지: 학원은 교실·수업 사진, 스터디카페는 카페·열람실 사진 */
export function placeImage(id: string, kind?: string | null): ImageSourcePropType {
  const k = kindOf(id, kind);
  const pool = k === 'ACADEMY' ? ACADEMY_IMAGES : CAFE_IMAGES;
  return pool[indexFor(id, k)];
}

/** 상세 화면 사진 모음: 대표 사진 + 같은 종류의 다른 사진 3장 (지점마다 조합이 다름) */
export function placeGallery(id: string, kind?: string | null): ImageSourcePropType[] {
  const k = kindOf(id, kind);
  const pool = k === 'ACADEMY' ? ACADEMY_IMAGES : CAFE_IMAGES;
  const start = indexFor(id, k);
  const step = 5 + (hash(id) % 4); // 5~8칸씩 건너뛰어 지점마다 다른 구성
  return [0, 1, 2, 3].map((n) => pool[(start + n * step) % pool.length]);
}
