import { dayKey } from './studyStats';
import { getJSON, setJSON } from './storage';

// 학습 플래너: 오늘 할 일 + D-day. 로컬(AsyncStorage)에 저장합니다.
const TASKS_KEY = 'safestep:plan-tasks'; // { 'yyyy-MM-dd': Task[] }
const DDAY_KEY = 'safestep:plan-ddays'; // DDay[]

export const SUBJECTS = ['수학', '영어', '국어', '과학', '사회', '기타'] as const;
export type Subject = (typeof SUBJECTS)[number];

export interface Task {
  id: string;
  title: string;
  subject: Subject;
  /** 목표 학습 시간(분). 0 이면 시간 목표 없음 */
  minutes: number;
  done: boolean;
}

export interface DDay {
  id: string;
  title: string;
  /** 'yyyy-MM-dd' */
  date: string;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type TaskMap = Record<string, Task[]>;

export async function loadTasks(): Promise<TaskMap> {
  return getJSON<TaskMap>(TASKS_KEY, {});
}
async function saveTasks(map: TaskMap) {
  await setJSON(TASKS_KEY, map);
}

export function newTask(title: string, subject: Subject, minutes: number): Task {
  return { id: uid(), title: title.trim(), subject, minutes, done: false };
}

/** 지난 날짜의 오래된 기록이 쌓이지 않도록 최근 60일만 유지 */
export function pruneTasks(map: TaskMap, today: Date, keepDays = 60): TaskMap {
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() - keepDays);
  const out: TaskMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (new Date(`${k}T00:00:00`).getTime() >= limit.getTime() && v.length > 0) out[k] = v;
  }
  return out;
}

export async function updateTasks(date: string, fn: (tasks: Task[]) => Task[]): Promise<TaskMap> {
  const map = await loadTasks();
  map[date] = fn(map[date] ?? []);
  const pruned = pruneTasks(map, new Date(`${date}T00:00:00`));
  await saveTasks(pruned);
  return pruned;
}

/** 오늘 완료/전체/시간 합계 */
export function progress(tasks: Task[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const planned = tasks.reduce((s, t) => s + t.minutes, 0);
  const finished = tasks.filter((t) => t.done).reduce((s, t) => s + t.minutes, 0);
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100), planned, finished };
}

/** 이번 주(월~일) 날짜별 완료율 */
export function weekProgress(map: TaskMap, today: Date) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  return labels.map((label, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dayKey(d);
    const p = progress(map[key] ?? []);
    return { label, key, ...p, isToday: key === dayKey(today) };
  });
}

// ── D-day ──────────────────────────────────────────
export async function loadDDays(): Promise<DDay[]> {
  const list = await getJSON<DDay[]>(DDAY_KEY, []);
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}
export async function saveDDays(list: DDay[]) {
  await setJSON(DDAY_KEY, list);
}
export function newDDay(title: string, date: string): DDay {
  return { id: uid(), title: title.trim(), date };
}

/** 남은 일수 (오늘 = 0, 지난 날짜 = 음수) */
export function daysLeft(date: string, today: Date): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.round((target - t) / 86400_000);
}

/** 'D-12' / 'D-DAY' / 'D+3' */
export function ddayLabel(left: number): string {
  if (left === 0) return 'D-DAY';
  return left > 0 ? `D-${left}` : `D+${Math.abs(left)}`;
}
