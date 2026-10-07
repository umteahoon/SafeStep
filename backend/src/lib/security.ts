import { Response } from 'express';
import rateLimit from 'express-rate-limit';

// 키오스크 PIN 무차별 대입 방지: 실패한 시도만 집계 (IP당 10분에 실패 10회)
// 성공한 조회는 세지 않아서, 같은 공인 IP(카페 와이파이)를 쓰는 정상 손님은 막히지 않습니다.
export const kioskPinFailLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'PIN 입력 실패가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// QR 토큰은 UUID라 무차별 대입이 사실상 불가능하므로 넉넉하게 (IP당 분당 120회)
export const kioskQrLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// 로그인 기록·데모 로그인 등 비로그인 공개 API (IP당 분당 20회)
export const publicAuthLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// 도입 문의 등 스팸성 쓰기 (IP당 10분에 5회)
export const inquiryLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '문의는 잠시 후 다시 남겨주세요.' },
});

// 외부 장소검색(네이버) 프록시 — 무료 할당량 보호용 (IP당 분당 20회)
export const placeSearchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// DB/외부 오류의 원문은 로그에만 남기고, 클라이언트에는 일반 문구만 보냅니다.
export function sendServerError(
  res: Response,
  context: string,
  error: { message: string } | unknown
) {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, message);
  return res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
}
