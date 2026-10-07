import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/lib/useAuth';
import { allText } from './helpers';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function RoleSetter({ role, children }: { role: any; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => setPreviewRole(role), [role, setPreviewRole]);
  return <>{children}</>;
}

async function mountApp(role: any) {
  const RootNavigator = require('../src/navigation/RootNavigator').default;
  let tree: any;
  await act(async () => {
    tree = create(
      <AuthProvider>
        <RoleSetter role={role}>
          <RootNavigator />
        </RoleSetter>
      </AuthProvider>
    );
  });
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await sleep(120);
    });
  }
  return tree;
}

/** 하단 탭 버튼들의 라벨. React Navigation 은 탭에 "홈, tab, 1 of 4" 형태의 접근성 라벨을 붙임 */
function tabLabels(tree: any): string[] {
  const nodes = tree.root.findAll((n: any) => typeof n.props?.accessibilityLabel === 'string' && /, tab, \d+ of \d+/.test(n.props.accessibilityLabel));
  const labels = nodes.map((n: any) => String(n.props.accessibilityLabel).split(',')[0].trim());
  return [...new Set<string>(labels)];
}

let mounted: any[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
});

describe('역할별 하단 탭 (실제 RootNavigator)', () => {
  it('일반 회원: 홈 · 스터디카페 · 커뮤니티 · 내 정보 (내 공부·채팅 없음)', async () => {
    const t = await mountApp('MEMBER');
    mounted.push(t);
    expect(tabLabels(t)).toEqual(['홈', '스터디카페', '커뮤니티', '내 정보']);
  });

  it('연동된 학생: 홈 · 지도 · 커뮤니티 · 내 공부 · 내 정보', async () => {
    const t = await mountApp('STUDENT');
    mounted.push(t);
    expect(tabLabels(t)).toEqual(['홈', '지도', '커뮤니티', '내 공부', '내 정보']);
  });

  it('비로그인: 홈 · 스터디카페 · 커뮤니티 · 내 정보', async () => {
    const t = await mountApp('GUEST');
    mounted.push(t);
    expect(tabLabels(t)).toEqual(['홈', '스터디카페', '커뮤니티', '내 정보']);
  });

  it('원장·강사·학부모: 지도·커뮤니티 탭이 보이지 않는다 (홈 · 채팅 · 내 정보)', async () => {
    for (const role of ['ACADEMY_ADMIN', 'TEACHER', 'PARENT']) {
      const t = await mountApp(role);
      mounted.push(t);
      expect(tabLabels(t)).toEqual(['홈', '채팅', '내 정보']);
      act(() => t.unmount());
      mounted.pop();
    }
  });

  it('슈퍼관리자: 홈 · 지도 · 커뮤니티 · 내 정보', async () => {
    const t = await mountApp('SUPER_ADMIN');
    mounted.push(t);
    expect(tabLabels(t)).toEqual(['홈', '지도', '커뮤니티', '내 정보']);
  });
});
