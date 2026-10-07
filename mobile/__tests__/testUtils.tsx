import React from 'react';
import { TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/lib/useAuth';

export let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return null;
}
function RoleSetter({ role, children }: { role: any; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => setPreviewRole(role), [role, setPreviewRole]);
  return <>{children}</>;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 긴 act 하나가 아니라 짧게 여러 번 (효과 → 상태 → 효과 연쇄가 단계별로 처리되도록) */
export async function pump(total = 600, step = 120) {
  for (let t = 0; t < total; t += step) {
    await act(async () => {
      await sleep(step);
    });
  }
}

export async function mount(path: string, role: any = 'GUEST', wait = 700) {
  const Screen = require(path).default;
  let tree: any;
  await act(async () => {
    tree = create(
      <AuthProvider>
        <Probe />
        <RoleSetter role={role}>
          <Screen />
        </RoleSetter>
      </AuthProvider>
    );
  });
  await pump(wait);
  return tree;
}

export function textOf(node: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
export const screenText = (tree: any) => textOf(tree.toJSON());

/** 접근성 라벨 또는 텍스트가 정확히 label 인 버튼을 우선 누르고, 없으면 label 을 포함한 가장 안쪽 버튼 */
export async function press(tree: any, label: string, wait = 480) {
  const all = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function');
  const exact = all.filter((n: any) => n.props.accessibilityLabel === label || textOf(n) === label);
  const partial = all.filter((n: any) => textOf(n).includes(label));
  const target = exact[0] ?? partial[partial.length - 1];
  if (!target) throw new Error(`"${label}" 버튼을 찾지 못함`);
  await act(async () => {
    target.props.onPress({ nativeEvent: {}, preventDefault() {} });
  });
  await pump(wait);
}

/** placeholder 로 입력창을 찾아 값을 입력 */
export async function typeInto(tree: any, placeholder: string, value: string) {
  const input = tree.root.findAllByType(TextInput).find((i: any) => i.props.placeholder === placeholder);
  if (!input) throw new Error(`"${placeholder}" 입력창을 찾지 못함`);
  await act(async () => {
    input.props.onChangeText(value);
  });
}

export function inputs(tree: any) {
  return tree.root.findAllByType(TextInput);
}

export const mounted: any[] = [];
export const track = (t: any) => (mounted.push(t), t);
export function cleanup() {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
}
