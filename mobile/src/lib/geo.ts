/** 두 좌표 사이 거리(km, 하버사인) */
export function distanceKm(a: { lat: number; lng: number }, lat: number, lng: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - a.lat);
  const dLng = toRad(lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

/** 혼잡도 단계: 잔여석 비율 기준 */
export function congestion(empty: number, total: number): { label: string; color: string; ratio: number } {
  const ratio = total > 0 ? empty / total : 0;
  if (empty === 0) return { label: '만석', color: '#98A2B3', ratio };
  if (ratio < 0.2) return { label: '혼잡', color: '#F43F5E', ratio };
  if (ratio < 0.5) return { label: '보통', color: '#F59E0B', ratio };
  return { label: '여유', color: '#12A150', ratio };
}
