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

/** 실제 RootNavigator(하단 탭 + 스택)를 렌더 */
async function mountApp(role: any) {
  const errors: string[] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...a) => void errors.push(String(a[0]).slice(0, 500)));
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
  await act(async () => {
    await sleep(900);
  });
  mounted.push(tree);
  return { tree, errors, spy };
}

const mounted: any[] = [];
afterEach(() => {
  // 다음 테스트와 NavigationContainer 가 겹치지 않도록 화면을 내림
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
});

/** 요소 아래에 있는 모든 문자열을 모음 (순환 구조 없이) */
function textOf(node: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out.join(' ');
}

const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

/** 텍스트(또는 접근성 라벨)가 정확히 label 인 버튼을 우선 누르고, 없으면 label 을 포함한 가장 안쪽 버튼을 누름 */
async function press(tree: any, label: string) {
  const all = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function');
  const exact = all.filter((n: any) => norm(textOf(n)) === label || String(n.props.accessibilityLabel ?? '').startsWith(label));
  const partial = all.filter((n: any) => norm(textOf(n)).includes(label));
  const target = exact[0] ?? partial[0]; // 화면 순서상 가장 먼저(바깥쪽) 나오는 버튼
  if (!target) throw new Error(`"${label}" 버튼을 찾지 못함`);
  await act(async () => {
    target.props.onPress({ nativeEvent: {}, preventDefault() {} });
    await sleep(900);
  });
}

describe('실제 내비게이션에서 학원 탭 → 학원 홈', () => {
  const run = async (role: any, steps: (ctx: any) => Promise<void>) => {
    const ctx = await mountApp(role);
    try {
      await steps(ctx);
    } finally {
      ctx.spy.mockRestore();
    }
    if (ctx.errors.length) console.log('ERRORS:', ctx.errors);
    expect(ctx.errors).toEqual([]);
    return ctx;
  };

  it('비로그인: 하단 "학원" 탭에 등록된 학원이 모두 보이고, 누르면 채팅방·공지방·출결 버튼이 한 화면에 보인다', async () => {
    await run('GUEST', async ({ tree }) => {
      await press(tree, '학원, tab');
      await act(async () => {
        await sleep(1500); // 학원 목록 로딩 대기
      });
      const list = allText(tree);
      expect(list).toContain('이룸수학학원 강남점');
      expect(list).toContain('공부의정석 스터디카페 홍대점');
      await press(tree, '이룸수학학원 강남점');
      await act(async () => {
        await sleep(800);
      });
      const home = allText(tree);
      for (const label of ['채팅방', '공지방', '출결']) expect(home).toContain(label);
    });
  }, 20000);

  it('학생: 내 학원 홈에서 세 버튼이 모두 보인다', async () => {
    await run('STUDENT', async ({ tree }) => {
      await press(tree, '학원, tab');
      await act(async () => {
        await sleep(1500);
      });
      expect(allText(tree)).toContain('내 학원');
      await press(tree, '이룸수학학원 강남점');
      await act(async () => {
        await sleep(800);
      });
      const home = allText(tree);
      for (const label of ['채팅방', '공지방', '출결']) expect(home).toContain(label);
    });
  }, 20000);
});
