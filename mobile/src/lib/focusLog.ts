import { dayKey } from './studyStats';
import { getJSON, setJSON } from './storage';

// 집중 타이머로 쌓은 시간(분)과 주간 목표를 로컬에 저장
const FOCUS_KEY = 'safestep:focus-minutes'; // { 'yyyy-MM-dd': minutes }
const GOAL_KEY = 'safestep:weekly-goal-hours';

export async function getFocusDaily(): Promise<Record<string, number>> {
  return getJSON<Record<string, number>>(FOCUS_KEY, {});
}

export async function addFocusMinutes(minutes: number, when = new Date()) {
  const daily = await getFocusDaily();
  const k = dayKey(when);
  daily[k] = (daily[k] ?? 0) + minutes;
  await setJSON(FOCUS_KEY, daily);
  return daily;
}

export async function getWeeklyGoal(): Promise<number> {
  return getJSON<number>(GOAL_KEY, 20);
}

export async function setWeeklyGoal(hours: number) {
  await setJSON(GOAL_KEY, hours);
}
