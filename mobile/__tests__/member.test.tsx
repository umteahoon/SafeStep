import React from 'react';
import { TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/lib/useAuth';
import { allText, nav } from './helpers';

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** useAuth 의 값을 밖에서 읽기 위한 프로브 */
let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return null;
}
function RoleSetter({ role, children }: { role: any; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => setPreviewRole(role), [role, setPreviewRole]);
  return <>{children}</>;
}

async function mount(path: string, role: any) {
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
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await sleep(120);
    });
  }
  return tree;
}

function textOf(node: any): string {
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
async function press(tree: any, label: string) {
  const all = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function');
  const exact = all.filter((n: any) => n.props.accessibilityLabel === label || textOf(n) === label);
  const partial = all.filter((n: any) => textOf(n).includes(label));
  const target = exact[0] ?? partial[partial.length - 1];
  if (!target) throw new Error(`"${label}" 버튼을 찾지 못함`);
  await act(async () => {
    target.props.onPress({ nativeEvent: {}, preventDefault() {} });
  });
  for (let i = 0; i < 5; i++) await act(async () => { await sleep(120); });
}

let mounted: any[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.clearAllMocks();
  (global as any).__routeParams = {};
});
const track = (t: any) => (mounted.push(t), t);

describe('일반 회원 (학생 계정 + 학원 명부 미연동)', () => {
  it('인증 상태: 일반 회원은 로그인했지만 소속·연동이 없다', async () => {
    track(await mount('../src/screens/common/MeScreen', 'MEMBER'));
    expect(auth.user).not.toBeNull();
    expect(auth.profile?.role).toBe('STUDENT');
    expect(auth.isMember).toBe(true);
    expect(auth.studentLinked).toBe(false);
    expect(auth.academyId).toBeNull();
  });

  it('연동된 학생은 소속 스터디카페가 students 행에서 온다(프로필이 아니라)', async () => {
    track(await mount('../src/screens/common/MeScreen', 'STUDENT'));
    expect(auth.isMember).toBe(false);
    expect(auth.studentLinked).toBe(true);
    expect(auth.student?.academy_id).toBe(AC);
    expect(auth.academyId).toBe(AC);
  });

  it('원장·비로그인은 일반 회원이 아니다', async () => {
    track(await mount('../src/screens/common/MeScreen', 'ACADEMY_ADMIN'));
    expect(auth.isMember).toBe(false);
    expect(auth.studentLinked).toBe(false);
    track(await mount('../src/screens/common/MeScreen', 'GUEST'));
    expect(auth.user).toBeNull();
    expect(auth.isMember).toBe(false);
  });

  it('홈: 이름 인사 + 연동 안내(로그인 안내·운영자 링크 없음)', async () => {
    const t = track(await mount('../src/screens/home/HomeScreen', 'MEMBER'));
    const text = allText(t);
    expect(text).toContain('일반회원님');
    expect(text).toContain('연동하면 이용권, 출결, 채팅을 쓸 수 있어요');
    expect(text).not.toContain('로그인하면 이용권 구매');
    expect(text).not.toContain('스터디카페를 운영하시나요?');
    expect(text).toContain('지역별로 찾기');
    expect(text).not.toContain('내 이용권'); // 학생 전용 섹션
    expect(text).not.toContain('오늘의 수업');
  });

  it('홈의 연동 안내를 누르면 연동 화면으로', async () => {
    const t = track(await mount('../src/screens/home/HomeScreen', 'MEMBER'));
    await press(t, '연동하면 이용권');
    expect(nav.navigate).toHaveBeenCalledWith('StudentQr');
  });

  it('내 정보: "일반 회원" 배지와 연동 메뉴, 채팅·팀(소통) 메뉴는 없음', async () => {
    const t = track(await mount('../src/screens/common/MeScreen', 'MEMBER'));
    const text = allText(t);
    expect(text).toContain('일반 회원');
    expect(text).toContain('학원·스터디카페 연동하기');
    expect(text).not.toContain('공지방 · 반 채팅방');
    expect(text).not.toContain('내 출결 QR');
  });

  it('연동 화면: 코드 입력 폼과 안내 문구', async () => {
    const t = track(await mount('../src/screens/student/StudentQrScreen', 'MEMBER'));
    const text = allText(t);
    expect(text).toContain('학원·스터디카페 연동');
    expect(text).toContain('다니는 곳에서 발급받은 6자리 연동코드');
  });

  it('잘못된 코드 → 오류 문구, 일반 회원 상태 유지', async () => {
    const t = track(await mount('../src/screens/student/StudentQrScreen', 'MEMBER'));
    await act(async () => {
      t.root.findAllByType(TextInput)[0].props.onChangeText('999999');
      await sleep(100);
    });
    await press(t, '연동하기');
    expect(allText(t)).toContain('일치하는 학생이 없습니다.');
    expect(auth.isMember).toBe(true);
  });

  it('이미 다른 계정과 연동된 코드 → 거절', async () => {
    const t = track(await mount('../src/screens/student/StudentQrScreen', 'MEMBER'));
    await act(async () => {
      t.root.findAllByType(TextInput)[0].props.onChangeText('111222'); // 김민지(다른 계정과 연동됨)
      await sleep(100);
    });
    await press(t, '연동하기');
    expect(allText(t)).toContain('이미 다른 계정과 연동된 학생입니다.');
    expect(auth.isMember).toBe(true);
  });

  it('올바른 코드(777888)를 입력하면 일반 회원 → 학생으로 전환되고 소속 스터디카페가 생긴다', async () => {
    const t = track(await mount('../src/screens/student/StudentQrScreen', 'MEMBER'));
    expect(auth.isMember).toBe(true);
    await act(async () => {
      t.root.findAllByType(TextInput)[0].props.onChangeText('777888'); // 정우진(미연동 학생)
      await sleep(100);
    });
    await press(t, '연동하기');
    for (let i = 0; i < 5; i++) await act(async () => { await sleep(120); });
    expect(auth.isMember).toBe(false);
    expect(auth.studentLinked).toBe(true);
    expect(auth.student?.id).toBe('st-4');
    expect(auth.academyId).toBe(AC); // 프로필의 academy_id 는 null 이지만 students 행에서 얻음
    expect(auth.profile?.academy_id).toBeNull();
    // 연동된 뒤 화면은 내 출결 QR 로 바뀜
    expect(allText(t)).toContain('내 출결 QR');
    // 가짜 DB 를 원상복구(다음 테스트가 "연동 안 된 회원"으로 시작하도록)
    const { supabase } = require('../src/lib/supabase');
    await supabase.from('students').update({ user_id: null }).eq('id', 'st-4');
  });

  it('커뮤니티: 일반 회원은 처음에 "전체 스터디카페", 연동 후엔 "내 스터디카페"', async () => {
    const hub = track(await mount('../src/screens/community/CommunityHubScreen', 'MEMBER'));
    expect(allText(hub)).toContain('전체 스터디카페');
    expect(allText(hub)).toContain('잠실점 오늘 많이 붐비네요');
  });

  it('일반 회원도 커뮤니티 글쓰기는 가능 (스터디카페를 고른 뒤)', async () => {
    const hub = track(await mount('../src/screens/community/CommunityHubScreen', 'MEMBER'));
    await press(hub, '글쓰기');
    expect(allText(hub)).toContain('글을 남길 스터디카페');
    await press(hub, '홍대점');
    expect(nav.navigate).toHaveBeenCalledWith('PostWrite', { academyId: 'a-3' });
  });

  it('가입 1단계에 "일반 회원" 유형 카드가 있다', async () => {
    const t = track(await mount('../src/screens/auth/RegisterScreen', 'GUEST'));
    expect(allText(t)).toContain('어떤 분이세요?');
    expect(allText(t)).toContain('스터디카페를 찾고 커뮤니티를 이용해요');
  });
});
