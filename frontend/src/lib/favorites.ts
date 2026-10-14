import { useEffect, useReducer } from 'react';
import { getJSON, setJSON } from './storage';

// 모바일 앱 src/lib/favorites.ts와 동일한 동작 — localStorage는 동기 API라 로드를 기다릴 필요가 없습니다.
const FAV_KEY = 'safestep:favorites';

// 화면 간 공유되는 모듈 단위 스토어
let favorites: string[] = getJSON<string[]>(FAV_KEY, []);
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function useFavorites() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    subs.add(force);
    return () => {
      subs.delete(force);
    };
  }, []);

  return {
    favorites,
    isFavorite: (id: string) => favorites.includes(id),
    toggleFavorite: (id: string) => {
      favorites = favorites.includes(id) ? favorites.filter((f) => f !== id) : [id, ...favorites];
      setJSON(FAV_KEY, favorites);
      notify();
    },
  };
}
