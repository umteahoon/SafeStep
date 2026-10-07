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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('커뮤니티 화면 렌더링', () => {
  it('커뮤니티 탭(Hub)이 에러 없이 렌더되고 글 목록이 보인다', async () => {
    const errors: any[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a));
    const Hub = require('../src/screens/community/CommunityHubScreen').default;
    const tree = await renderAs('STUDENT', <Hub />); // 원장·강사·학부모는 커뮤니티를 볼 수 없으므로 학생으로
    const text = allText(tree);
    spy.mockRestore();
    if (errors.length) console.log('console.error:', errors.map((e) => String(e[0]).slice(0, 300)));
    expect(errors).toHaveLength(0);
    expect(text).toContain('글쓰기');
    expect(text).toContain('내 스터디카페'); // 소속이 있으면 처음엔 내 게시판
    expect(text).toContain('이번 주 금요일 야간 개방 안내');
  });
});
