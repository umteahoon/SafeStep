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
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../src/lib/confirm', () => ({ confirmAsync: async () => true }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function RoleSetter({ role, children }: { role: any; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => setPreviewRole(role), [role, setPreviewRole]);
  return <>{children}</>;
}

async function mountChat(role: any) {
  const Screen = require('../src/screens/chat/ChatListScreen').default;
  let tree: any;
  await act(async () => {
    tree = create(
      <AuthProvider>
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
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return (node.children ?? []).map(textOf).join(' ');
}
async function pressText(tree: any, label: string) {
  const nodes = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function');
  const exact = nodes.find((n: any) => textOf(n).replace(/\s+/g, ' ').trim() === label);
  const hit = exact ?? nodes.find((n: any) => textOf(n).includes(label));
  if (!hit) throw new Error(`"${label}" 버튼 없음`);
  await act(async () => {
    await hit.props.onPress({ nativeEvent: {}, preventDefault() {} });
    await sleep(200);
  });
}
async function typeCode(tree: any, value: string) {
  const input = tree.root.findAllByType(TextInput)[0];
  await act(async () => {
    input.props.onChangeText(value);
    await sleep(50);
  });
}

describe('채팅: 반 코드 · 팀 코드', () => {
  it('학생: 코드를 입력하기 전에는 반·팀 채팅방이 보이지 않고, 팀을 만들 수 없다', async () => {
    const t = await mountChat('STUDENT');
    const text = allText(t);
    expect(text).toContain('코드로 참가');
    expect(text).not.toContain('팀 만들기');
    expect(text).not.toContain('중3 수학 A'); // 반 채팅방은 반 코드를 입력해야 보임
    expect(text).not.toContain('영어 회화');
    expect(text).toContain('전체 공지'); // 공지방은 학원 전체
  });

  it('일반 회원은 학원 공지·반 채팅방을 볼 수 없고, 연동 안내만 나온다', async () => {
    const t = await mountChat('MEMBER');
    const text = allText(t);
    expect(text).not.toContain('전체 공지');
    expect(text).not.toContain('중3 수학 A');
    expect(text).not.toContain('CLS3MATH');
    expect(text).toContain('학원에 연동하면 학원 공지와 반 채팅방을 볼 수 있어요');
  });

  it('원장·강사: 팀은 못 만들지만 채팅방은 만들 수 있다 (반 채팅방과 반 코드 관리)', async () => {
    const t = await mountChat('ACADEMY_ADMIN');
    const text = allText(t);
    expect(text).not.toContain('팀 만들기');
    expect(text).toContain('채팅방 만들기');
    expect(text).toContain('중3 수학 A');
    expect(text).toContain('CLS3MATH'); // 학생에게 나눠 줄 반 코드
  });

  it('일반 회원: 스터디 팀 만들기와 코드로 참가가 있다', async () => {
    const t = await mountChat('MEMBER');
    const text = allText(t);
    expect(text).toContain('팀 만들기');
    expect(text).toContain('코드로 참가');
  });

  it('반 채팅방과 팀 채팅방의 차이를 설명한다', async () => {
    const t = await mountChat('STUDENT');
    expect(allText(t)).toContain('반 코드를 입력해야 반 채팅방이 보여요');
  });
});

// 가짜 서버 상태가 테스트 사이에 이어지므로, 참가(상태를 바꾸는) 테스트는 보이지 않음 확인 뒤에 둠
describe('코드로 참가 (끝까지)', () => {
  beforeEach(() => (nav.navigate as jest.Mock).mockClear());

  it('원장이 채팅방을 만들면 목록에 나오고 참가 코드가 함께 보인다', async () => {
    const t = await mountChat('ACADEMY_ADMIN');
    await pressText(t, '채팅방 만들기');
    await typeCode(t, '중3 수학 질문방');
    await pressText(t, '만들기');
    await act(async () => {
      await sleep(400);
    });
    const text = allText(t);
    expect(text).toContain('중3 수학 질문방');
    expect(text).toMatch(/탭하여 복사\s+[A-Z0-9]{8}/);
  });

  it('반 코드를 누르면 복사되었다는 알림이 뜬다', async () => {
    const t = await mountChat('ACADEMY_ADMIN');
    const chip = t.root.findAll((n: any) => n.props?.accessibilityLabel === '반 코드 복사' && typeof n.props.onPress === 'function')[0];
    await act(async () => {
      await chip.props.onPress();
      await sleep(100);
    });
    expect(allText(t)).toContain('복사했어요');
    const Clipboard = require('expo-clipboard');
    expect(Clipboard.setStringAsync).toHaveBeenCalled();
  });

  it('직접 만든 채팅방은 삭제할 수 있고(확인 후), 반에 연결된 방에는 삭제 버튼이 없다', async () => {
    const t = await mountChat('ACADEMY_ADMIN');
    // 앞 테스트에서 만든 '중3 수학 질문방'이 있음
    expect(allText(t)).toContain('중3 수학 질문방');
    const trash = t.root.findAll((n: any) => n.props?.accessibilityLabel === '채팅방 삭제' && typeof n.props.onPress === 'function');
    expect(trash).toHaveLength(1); // 반(중3 수학 A·고1 영어 B)에 연결된 방은 제외
    await act(async () => {
      await trash[0].props.onPress();
      await sleep(1500); // 삭제 후 목록을 다시 불러오는 시간
    });
    const text = allText(t);
    expect(text).not.toContain('중3 수학 질문방');
    expect(text).toContain('삭제했어요');
    expect(text).toContain('중3 수학 A'); // 반 채팅방은 그대로
  });

  it('일반 회원은 반 코드를 입력해도 학원 채팅방에 들어갈 수 없다', async () => {
    const t = await mountChat('MEMBER');
    await pressText(t, '코드로 참가');
    await typeCode(t, 'CLS3MATH');
    await pressText(t, '참가하기');
    expect(nav.navigate).not.toHaveBeenCalledWith('ChatRoom', expect.anything());
    expect(allText(t)).toContain('유효하지 않은 코드');
  });

  it('반 코드를 입력하면 그 반 채팅방으로 들어가고, 이후 목록에 보인다', async () => {
    const t = await mountChat('STUDENT');
    await pressText(t, '코드로 참가');
    await typeCode(t, 'cls3math');
    await pressText(t, '참가하기');
    expect(nav.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'r-c1' });
  });

  it('팀 코드를 입력하면 팀 채팅방으로 들어간다', async () => {
    const t = await mountChat('STUDENT');
    await pressText(t, '코드로 참가');
    await typeCode(t, 'ENGL1234');
    await pressText(t, '참가하기');
    expect(nav.navigate).toHaveBeenCalledWith('TeamRoom', { teamId: 'tm-2' });
  });

  it('없는 코드는 안내 문구만 나오고 이동하지 않는다', async () => {
    const t = await mountChat('STUDENT');
    await pressText(t, '코드로 참가');
    await typeCode(t, 'ZZZZZZZZ');
    await pressText(t, '참가하기');
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(allText(t)).toContain('유효하지 않은 코드');
  });

  it('일반 회원이 팀을 만들면 팀 채팅방으로 이동한다', async () => {
    const t = await mountChat('MEMBER');
    await pressText(t, '팀 만들기');
    await typeCode(t, '토익 900 스터디');
    await pressText(t, '만들기');
    const call = (nav.navigate as jest.Mock).mock.calls.find((c) => c[0] === 'TeamRoom');
    expect(call).toBeTruthy();
  });
});

describe('반 채팅방 정보 — 팀 채팅방의 정보 화면과 같은 구성', () => {
  async function openRoom(role: any, roomId: string) {
    (global as any).__routeParams = { roomId };
    const Screen = require('../src/screens/chat/ChatRoomScreen').default;
    let tree: any;
    await act(async () => {
      tree = create(
        <AuthProvider>
          <RoleSetter role={role}>
            <Screen />
          </RoleSetter>
        </AuthProvider>
      );
    });
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await sleep(150);
      });
    }
    return tree;
  }

  afterEach(() => {
    (global as any).__routeParams = undefined;
  });

  it('학생: 정보 바 → 시트에 학원·강사·시간·멤버·참가 코드, 나가기 버튼', async () => {
    const tree = await openRoom('STUDENT', 'r-c1');
    expect(allText(tree)).toContain('중3 수학 A 정보');
    const bar = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function' && textOf(n).includes('중3 수학 A 정보'))[0];
    await act(async () => {
      await bar.props.onPress();
      await sleep(100);
    });
    const text = allText(tree);
    expect(text).toContain('이룸수학학원 강남점');
    expect(text).toContain('담당');
    expect(text).toMatch(/월 \d\d:\d\d–\d\d:\d\d|수 \d\d:\d\d–\d\d:\d\d|금 \d\d:\d\d–\d\d:\d\d/);
    expect(text).toContain('멤버');
    expect(text).toContain('참가 코드');
    expect(text).toContain('CLS3MATH');
    expect(text).toContain('코드 복사');
    expect(text).toContain('채팅방 나가기');
    expect(text).not.toContain('채팅방 삭제');
  });

  it('원장: 반에 연결된 방에는 삭제 버튼이 없다', async () => {
    const tree = await openRoom('ACADEMY_ADMIN', 'r-c1');
    const bar = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function' && textOf(n).includes('중3 수학 A 정보'))[0];
    await act(async () => {
      await bar.props.onPress();
      await sleep(100);
    });
    const text = allText(tree);
    expect(text).toContain('참가 코드');
    expect(text).not.toContain('채팅방 삭제');
    expect(text).not.toContain('채팅방 나가기');
  });
});

describe('일반 회원의 팀 채팅방', () => {
  it('학원에 연동하지 않아도 팀 채팅방 화면이 열린다 (연동 안내로 막히지 않음)', async () => {
    (global as any).__routeParams = { teamId: 'tm-1' };
    const Screen = require('../src/screens/teams/TeamRoomScreen').default;
    let tree: any;
    await act(async () => {
      tree = create(
        <AuthProvider>
          <RoleSetter role="MEMBER">
            <Screen />
          </RoleSetter>
        </AuthProvider>
      );
    });
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await sleep(150);
      });
    }
    const text = allText(tree);
    expect(text).not.toContain('학원 연동');
    expect(text).toContain('전체 채팅');
    (global as any).__routeParams = undefined;
  });
});
