import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/lib/useAuth';
import { allText } from './helpers';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => require('./helpers').nav,
    useRoute: () => ({ params: (global as any).__routeParams ?? {} }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function RoleSetter({ role, children }: { role: any; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => setPreviewRole(role), [role, setPreviewRole]);
  return <>{children}</>;
}

// 모든 역할로 커뮤니티 관련 화면을 열어 예외/경고가 없는지 확인
const ROLES = ['GUEST', 'MEMBER', 'STUDENT', 'ACADEMY_ADMIN', 'TEACHER', 'PARENT', 'SUPER_ADMIN'] as const;
const SCREENS: [string, string, any][] = [
  ['커뮤니티 탭', '../src/screens/community/CommunityHubScreen', {}],
  ['스터디카페 게시판', '../src/screens/community/CommunityScreen', { academyId: '00000000-0000-0000-0000-000000000001' }],
  ['글 상세', '../src/screens/community/PostDetailScreen', { postId: 'cp-2' }],
  ['글쓰기', '../src/screens/community/PostWriteScreen', { academyId: '00000000-0000-0000-0000-000000000001' }],
  ['홈', '../src/screens/home/HomeScreen', {}],
  ['내 정보', '../src/screens/common/MeScreen', {}],
];

describe.each(ROLES)('역할: %s', (role) => {
  it.each(SCREENS)('%s', async (_name, path, params) => {
    (global as any).__routeParams = params;
    const errors: string[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...a) => {
      const m = String(a[0]);
      if (!m.includes('not wrapped in act')) errors.push(m.slice(0, 300));
    });
    const Screen = require(path).default;
    let tree: any;
    try {
      await act(async () => {
        tree = create(
          <AuthProvider>
            <RoleSetter role={role}>
              <Screen />
            </RoleSetter>
          </AuthProvider>
        );
      });
      await act(async () => {
        await sleep(700);
      });
      expect(allText(tree).length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
      if (tree) act(() => tree.unmount());
    }
    expect(errors).toEqual([]);
  });
});
