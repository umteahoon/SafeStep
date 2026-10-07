import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from './api';

/**
 * 키오스크 오프라인 대응용 큐 (웹 frontend/src/utils/offlineQueue.ts 와 같은 정책).
 *
 * 입실/자리이동은 "이 좌석이 지금 비어있는가"를 실시간으로 확인해야 하는 동시성 민감
 * 액션이라 절대 큐에 넣지 않습니다. 외출/퇴실/복귀는 이미 그 학생에게 배정된 좌석만
 * 바꾸는 동작이라 나중에 재생해도 안전합니다.
 */
interface QueuedRequest {
  id: string;
  path: string;
  body: unknown;
  label: string;
  queuedAt: number;
}

const STORAGE_KEY = 'safestep:kiosk-offline-queue';

async function readQueue(): Promise<QueuedRequest[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedRequest[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* 저장 실패해도 앱은 계속 동작 */
  }
}

export async function enqueueKioskAction(path: string, body: unknown, label: string) {
  const queue = await readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path,
    body,
    label,
    queuedAt: Date.now(),
  });
  await writeQueue(queue);
}

export async function queuedActionCount(): Promise<number> {
  return (await readQueue()).length;
}

/** 재연결 시 큐에 쌓인 요청을 순서대로 재전송. 실패하면 남은 큐는 그대로 두고 중단합니다. */
export async function flushKioskQueue(): Promise<{ sent: number; remaining: number }> {
  let queue = await readQueue();
  let sent = 0;
  while (queue.length > 0) {
    const state = await NetInfo.fetch();
    if (!state.isConnected) break;
    const [next, ...rest] = queue;
    try {
      await apiFetch(next.path, {
        method: 'POST',
        auth: false,
        body: JSON.stringify(next.body),
      });
      queue = rest;
      await writeQueue(queue);
      sent += 1;
    } catch {
      break; // 네트워크가 다시 끊겼거나 서버 오류 — 다음 연결 시 재시도
    }
  }
  return { sent, remaining: queue.length };
}
