import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockReset = jest.fn();
const mockGoBack = jest.fn();
let mockParams: any = undefined;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

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
