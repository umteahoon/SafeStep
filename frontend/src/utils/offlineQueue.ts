import { apiFetch } from '../lib/api';

/**
 * 키오스크 오프라인 대응용 큐.
 *
 * 입실/자리이동처럼 "이 좌석이 지금 비어있는가"를 실시간으로 확인해야 하는
 * 동시성 민감 액션은 절대 큐에 넣지 않습니다 — 오프라인 중 쌓아뒀다가 나중에
 * 한꺼번에 보내면 그 사이 다른 학생이 같은 좌석에 배정되는 등 데이터 정합성
 * 문제가 생길 수 있습니다.
 *
 * 반대로 외출/퇴실/복귀는 이미 그 학생에게 배정된 좌석만 바꾸는 동작이라
 * 나중에 재생해도 다른 학생과 충돌할 위험이 없어 큐잉이 안전합니다.
 */
interface QueuedRequest {
  id: string;
  path: string;
  body: unknown;
  label: string;
  queuedAt: number;
}

const STORAGE_KEY = 'safestep:kiosk-offline-queue';

function readQueue(): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* 저장 실패해도 앱은 계속 동작 */
  }
}

export function enqueueKioskAction(path: string, body: unknown, label: string) {
  const queue = readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path,
    body,
    label,
    queuedAt: Date.now(),
  });
  writeQueue(queue);
}

export function queuedActionCount(): number {
  return readQueue().length;
}

/** 재연결 시 큐에 쌓인 요청을 순서대로 재전송. 실패하면 남은 큐는 그대로 두고 중단합니다. */
export async function flushKioskQueue(): Promise<{ sent: number; remaining: number }> {
  let queue = readQueue();
  let sent = 0;
  while (queue.length > 0 && navigator.onLine) {
    const [next, ...rest] = queue;
    try {
      await apiFetch(next.path, {
        method: 'POST',
        auth: false,
        body: JSON.stringify(next.body),
      });
      queue = rest;
      writeQueue(queue);
      sent += 1;
    } catch {
      break; // 네트워크가 다시 끊겼거나 서버 오류 — 다음 online 이벤트에서 재시도
    }
  }
  return { sent, remaining: queue.length };
}
