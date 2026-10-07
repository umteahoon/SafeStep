import React from 'react';
import { renderAs, allText } from './helpers';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => require('./helpers').nav,
    useRoute: () => ({ params: (global as any).__routeParams ?? {} }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});

const AC = '00000000-0000-0000-0000-000000000001';
const setParams = (p: any) => ((global as any).__routeParams = p);

/** 렌더 중 console.error(React 경고/에러)가 하나도 없어야 한다 */
async function renderClean(role: any, element: React.ReactElement, wait?: number) {
  const errors: string[] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...a) => void errors.push(String(a[0]).slice(0, 400)));
  let tree;
  try {
    tree = await renderAs(role, element, wait);
  } finally {
    spy.mockRestore();
  }
  return { tree: tree!, errors, text: allText(tree!) };
}

beforeEach(() => setParams({}));

describe('커뮤니티 관련 화면', () => {
  it('스터디카페 게시판', async () => {
    setParams({ academyId: AC });
    const Screen = require('../src/screens/community/CommunityScreen').default;
    const { errors, text } = await renderClean('STUDENT', <Screen />);
    expect(errors).toEqual([]);
    expect(text).toContain('이번 주 금요일 야간 개방 안내');
    expect(text).toContain('글쓰기');
  });

  it('글 상세(비로그인)', async () => {
    setParams({ postId: 'cp-2' });
    const Screen = require('../src/screens/community/PostDetailScreen').default;
    const { errors, text } = await renderClean('GUEST', <Screen />);
    expect(errors).toEqual([]);
    expect(text).toContain('콘센트 있는 자리는 어디가 좋아요?');
    expect(text).toContain('로그인하고 댓글 남기기');
  });

  it('글 상세(로그인) — 댓글 입력창', async () => {
    setParams({ postId: 'cp-2' });
    const Screen = require('../src/screens/community/PostDetailScreen').default;
    const { errors, text } = await renderClean('STUDENT', <Screen />);
    expect(errors).toEqual([]);
    expect(text).toContain('집중석 칸마다 콘센트 있어요');
    expect(text).toContain('등록');
  });

  it('글쓰기', async () => {
    setParams({ academyId: AC });
    const Screen = require('../src/screens/community/PostWriteScreen').default;
    const { errors, text } = await renderClean('STUDENT', <Screen />);
    expect(errors).toEqual([]);
    expect(text).toContain('올리기');
  });

  it('스터디카페 상세(좌석 도면)의 커뮤니티 행', async () => {
    setParams({ academyId: AC });
    const Screen = require('../src/screens/map/SeatFloorPlanScreen').default;
    const { errors, text } = await renderClean('STUDENT', <Screen />, 900);
    expect(errors).toEqual([]);
    expect(text).toContain('스터디카페 커뮤니티');
    expect(text).toContain('이웃들의 이야기 4개');
  });

  it('홈(비로그인): 지역별로 찾기 + 스터디카페 이야기', async () => {
    const Screen = require('../src/screens/home/HomeScreen').default;
    const { errors, text } = await renderClean('GUEST', <Screen />, 1200);
    expect(errors).toEqual([]);
    expect(text).toContain('지역별로 찾기');
    expect(text).toContain('서울');
    expect(text).toContain('스터디카페 이야기');
  });

  it('홈(학생): 스터디카페 이야기', async () => {
    const Screen = require('../src/screens/home/HomeScreen').default;
    const { errors, text } = await renderClean('STUDENT', <Screen />, 1200);
    expect(errors).toEqual([]);
    expect(text).toContain('스터디카페 이야기');
  });

  it('지도: 지역 버튼', async () => {
    const Screen = require('../src/screens/map/MapScreen').default;
    const { errors, text } = await renderClean('GUEST', <Screen />, 900);
    expect(errors).toEqual([]);
    expect(text).toContain('지역');
    expect(text).toContain('잔여석 있는 곳');
  });
});
