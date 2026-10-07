import { Router } from 'express';
import { placeSearchLimiter, sendServerError } from '../lib/security';

const router = Router();

interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');

// GET /api/places/search?query=스터디카페
// DB에 등록되지 않은 실제 주변 업체를 지도에 같이 보여주기 위한 네이버 지역검색 프록시.
// 2026-09 네이버가 검색 API를 developers.naver.com에서 NCP 콘솔의 "NAVER API HUB"로
// 이관하면서 인증 방식도 NCP API Gateway 키(X-NCP-APIGW-API-KEY-ID/-KEY)로 바뀌었습니다
// (기존 X-Naver-Client-Id/-Secret 방식 아님). Client Secret이 필요해 브라우저에서 직접
// 호출할 수 없고, CORS도 막혀 있어 서버를 거칩니다.
// mapx/mapy는 그대로 내려보내고, 좌표계 해석은 프론트가 네이버 지도 SDK로 처리합니다.
router.get('/search', placeSearchLimiter, async (req, res) => {
  const query = String(req.query.query ?? '').trim().slice(0, 100);
  if (!query) return res.status(400).json({ error: '검색어를 입력해주세요.' });

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: '외부 장소검색이 아직 설정되지 않았습니다.' });
  }

  try {
    const url = `https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(query)}&display=10`;
    const naverRes = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    });
    if (!naverRes.ok) {
      return res.status(502).json({ error: '외부 장소검색 조회에 실패했습니다.' });
    }
    const data = (await naverRes.json()) as { items?: NaverLocalItem[] };
    const places = (data.items ?? []).map((item) => ({
      name: stripTags(item.title),
      category: item.category,
      telephone: item.telephone || null,
      address: item.roadAddress || item.address,
      mapx: item.mapx,
      mapy: item.mapy,
    }));
    res.json({ data: places });
  } catch (error) {
    sendServerError(res, 'places', error);
  }
});

export default router;
