import { useEffect, useReducer } from 'react';
import { getJSON, setJSON } from './storage';

const FAV_KEY = 'safestep:favorites';
const RECENT_KEY = 'safestep:recent-cafes';
const MAX_RECENT = 10;

// 화면 간 공유되는 모듈 단위 스토어 (홈/지도/도면에서 같은 상태를 봄)
let favorites: string[] = [];
let recent: string[] = [];
let loaded = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  favorites = await getJSON<string[]>(FAV_KEY, []);
  recent = await getJSON<string[]>(RECENT_KEY, []);
  notify();
}

export function useFavorites() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    subs.add(force);
    ensureLoaded();
    return () => {
      subs.delete(force);
    };
  }, []);

  return {
    favorites,
    recent,
    isFavorite: (id: string) => favorites.includes(id),
    toggleFavorite: (id: string) => {
      favorites = favorites.includes(id) ? favorites.filter((f) => f !== id) : [id, ...favorites];
      setJSON(FAV_KEY, favorites);
      notify();
    },
    addRecent: (id: string) => {
      recent = [id, ...recent.filter((r) => r !== id)].slice(0, MAX_RECENT);
      setJSON(RECENT_KEY, recent);
      notify();
    },
  };
}
