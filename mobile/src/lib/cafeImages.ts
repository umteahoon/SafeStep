import type { ImageSourcePropType } from 'react-native';

/**
 * 스터디카페 예시 이미지 (Unsplash 무료 사진, assets/cafes).
 * 지점 데이터에 이미지 필드가 아직 없어서, 지점 id 로 항상 같은 사진이 고르게 배정되도록 합니다.
 * 실제 매장 사진은 DB에 image_url 이 생기면 그 값을 우선 사용하도록 교체하세요.
 */
const IMAGES: ImageSourcePropType[] = [
  require('../../assets/cafes/cafe1.jpg'),
  require('../../assets/cafes/cafe2.jpg'),
  require('../../assets/cafes/cafe3.jpg'),
  require('../../assets/cafes/cafe4.jpg'),
  require('../../assets/cafes/cafe5.jpg'),
  require('../../assets/cafes/cafe6.jpg'),
  require('../../assets/cafes/cafe7.jpg'),
  require('../../assets/cafes/cafe8.jpg'),
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function cafeImage(id: string): ImageSourcePropType {
  return IMAGES[hash(id) % IMAGES.length];
}
