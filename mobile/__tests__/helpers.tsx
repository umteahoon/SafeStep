import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/lib/useAuth';
import type { PreviewRole } from '../src/lib/useAuth';

export const nav = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  canGoBack: jest.fn(() => true),
};

/** 화면을 미리보기 모드(가짜 서버 + 가짜 로그인)로 렌더하고 비동기 로딩이 끝날 때까지 기다림 */
export async function pump(total = 600, step = 120) {
  for (let t = 0; t < total; t += step) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, step));
    });
  }
}

export async function renderScreen(element: React.ReactElement, wait = 600): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  // 1) 렌더 + 마운트 효과(데이터 로딩 시작)를 먼저 flush
  await act(async () => {
    tree = create(<AuthProvider>{element}</AuthProvider>);
  });
  // 2) 비동기 로딩이 끝날 때까지 대기 — 긴 act 하나가 아니라 짧게 여러 번(효과→상태→효과 연쇄가 단계별로 처리되도록)
  await pump(wait);
  return tree;
}

/** 미리보기 역할을 지정해서 렌더 (GUEST = 비로그인) */
function RoleSetter({ role, children }: { role: PreviewRole; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => {
    setPreviewRole(role);
  }, [role, setPreviewRole]);
  return <>{children}</>;
}

export async function renderAs(role: PreviewRole, element: React.ReactElement, wait = 700): Promise<ReactTestRenderer> {
  return renderScreen(<RoleSetter role={role}>{element}</RoleSetter>, wait);
}

/** 렌더 결과에서 모든 텍스트를 이어붙임 */
export function allText(tree: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === 'string') return void out.push(n);
    (n.children ?? []).forEach(walk);
  };
  const json = tree.toJSON();
  (Array.isArray(json) ? json : [json]).forEach(walk);
  return out.join(' ');
}
