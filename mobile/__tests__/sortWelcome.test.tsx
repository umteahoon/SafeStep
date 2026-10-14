import React from 'react';
import { act, create } from 'react-test-renderer';
import { sortPosts, SORT_OPTIONS } from '../src/lib/community';
import type { PostWithStats } from '../src/lib/community';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockReset = jest.fn();
const mockGoBack = jest.fn();
let mockParams: any = undefined;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

const post = (id: string, created: string, views: number, likes = 0, comments = 0) =>
  ({ id, created_at: created, view_count: views, likeCount: likes, commentCount: comments }) as unknown as PostWithStats;

describe('커뮤니티 정렬', () => {
  const list = [
    post('a', '2026-10-10T00:00:00Z', 5, 1, 0),
    post('b', '2026-10-12T00:00:00Z', 90, 0, 0),
    post('c', '2026-10-11T00:00:00Z', 40, 3, 2),
  ];
  const ids = (m: Parameters<typeof sortPosts>[1]) => sortPosts(list, m).map((p) => p.id);

  it('최신순 / 오래된순', () => {
    expect(ids('latest')).toEqual(['b', 'c', 'a']);
    expect(ids('oldest')).toEqual(['a', 'c', 'b']);
  });
  it('조회순 / 인기순', () => {
    expect(ids('views')).toEqual(['b', 'c', 'a']);
    expect(ids('hot')).toEqual(['c', 'a', 'b']);
  });
  it('조회수가 없으면 0으로 취급', () => {
    const sorted = sortPosts([{ ...post('x', '2026-10-01T00:00:00Z', 0), view_count: undefined } as any, post('y', '2026-10-02T00:00:00Z', 1)], 'views');
    expect(sorted.map((p) => p.id)).toEqual(['y', 'x']);
  });
  it('메뉴 항목 4개', () => {
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual(['최신순', '인기순', '조회순', '오래된순']);
  });
});

describe('앱 소개(처음 화면)', () => {
  const textOf = (node: any): string => {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    return (node.children ?? []).map(textOf).join(' ');
  };
  const press = async (tree: any, label: string) => {
    const nodes = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function');
    const hit = nodes.find((n: any) => textOf(n).includes(label));
    if (!hit) throw new Error(label + ' 없음');
    await act(async () => {
      await hit.props.onPress();
    });
  };
  const text = (tree: any) => JSON.stringify(tree.toJSON());

  beforeEach(() => {
    mockReset.mockClear();
    mockGoBack.mockClear();
    mockParams = undefined;
  });

  it('3장짜리 소개가 있고, 건너뛰면 메인으로', async () => {
    const Welcome = require('../src/screens/common/WelcomeScreen').default;
    let tree: any;
    await act(async () => {
      tree = create(<Welcome />);
    });
    const t = text(tree);
    expect(t).toContain('학원과 스터디카페를');
    expect(t).toContain('출결과 시간표를');
    expect(t).toContain('학부모도 원장님도');
    await press(tree, '건너뛰기');
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });

  it('다시 보기(replay)에서는 끝내면 이전 화면으로 돌아감', async () => {
    mockParams = { replay: true };
    const Welcome = require('../src/screens/common/WelcomeScreen').default;
    let tree: any;
    await act(async () => {
      tree = create(<Welcome />);
    });
    await press(tree, '건너뛰기');
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('소개 화면 표시 조건', () => {
  it('테스트 환경에서는 항상 건너뜀, 저장 플래그와 반복 확인 설정', async () => {
    const { shouldShowWelcome, markWelcomeDone, resetWelcome } = require('../src/lib/welcome');
    expect(await shouldShowWelcome()).toBe(false); // NODE_ENV=test
    const env = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    try {
      await resetWelcome();
      expect(await shouldShowWelcome()).toBe(true); // 처음 실행
      await markWelcomeDone();
      expect(await shouldShowWelcome()).toBe(false); // 이후 실행
      process.env.EXPO_PUBLIC_ALWAYS_WELCOME = '1';
      expect(await shouldShowWelcome()).toBe(true); // 반복 확인 모드
    } finally {
      delete process.env.EXPO_PUBLIC_ALWAYS_WELCOME;
      (process.env as any).NODE_ENV = env;
    }
  });
});
