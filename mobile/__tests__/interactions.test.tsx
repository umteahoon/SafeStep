import React from 'react';
import { Alert, TextInput } from 'react-native';
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
function RoleSetter({ role, children }: { role: any; children: React.ReactNode }) {
  const { setPreviewRole } = useAuth();
  React.useEffect(() => setPreviewRole(role), [role, setPreviewRole]);
  return <>{children}</>;
}

async function mount(path: string, role: any, params: any = {}) {
  (global as any).__routeParams = params;
  const Screen = require(path).default;
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
  // 짧게 여러 번 대기 (효과 → 상태 → 효과 연쇄가 단계별로 처리되도록). 학생은 연동 조회가 한 번 더 필요
  for (let i = 0; i < 8; i++) {
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
  return out.join(' ');
}

const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

/** 텍스트가 정확히 label 인 버튼을 우선 누르고, 없으면 label 이 포함된 가장 안쪽 버튼을 누름 */
async function press(tree: any, label: string) {
  const all = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function');
  const exact = all.filter((n: any) => n.props.accessibilityLabel === label || norm(textOf(n)) === label);
  const partial = all.filter((n: any) => norm(textOf(n)).includes(label));
  const target = exact[0] ?? partial[partial.length - 1];
  if (!target) throw new Error(`"${label}" 버튼을 찾지 못함`);
  await act(async () => {
    target.props.onPress({ nativeEvent: {}, preventDefault() {} });
    await sleep(500);
  });
}

async function type(tree: any, index: number, value: string) {
  const inputs = tree.root.findAllByType(TextInput);
  await act(async () => {
    inputs[index].props.onChangeText(value);
    await sleep(100);
  });
}

let mounted: any[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.clearAllMocks();
});
const track = (t: any) => (mounted.push(t), t);

describe('커뮤니티 탭 동작', () => {
  const HUB = '../src/screens/community/CommunityHubScreen';

  it('제목이 게시판 선택 버튼: 비로그인 기본은 "전체 스터디카페"', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    expect(allText(t)).toContain('전체 스터디카페');
    expect(allText(t)).toContain('이번 주 금요일 야간 개방 안내');
    expect(allText(t)).toContain('잠실점 오늘 많이 붐비네요');
  });

  it('내 스터디카페가 있으면 처음엔 그 게시판(내 스터디카페)을 보여준다', async () => {
    const t = track(await mount(HUB, 'STUDENT'));
    const text = allText(t);
    expect(text).toContain('내 스터디카페');
    expect(text).toContain('이번 주 금요일 야간 개방 안내'); // 강남점(내 소속)
    expect(text).not.toContain('잠실점 오늘 많이 붐비네요');
  });

  it('글쓰기: 소속이 있는 학생 → 바로 내 스터디카페 글쓰기 화면', async () => {
    const t = track(await mount(HUB, 'STUDENT'));
    await press(t, '글쓰기');
    expect(nav.navigate).toHaveBeenCalledWith('PostWrite', { academyId: AC });
  });

  it('글쓰기: 소속이 없으면(비로그인) 글을 남길 스터디카페를 먼저 고르고, 비로그인이면 로그인으로', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '글쓰기');
    const text = allText(t);
    expect(text).toContain('글을 남길 스터디카페');
    await press(t, '홍대점');
    expect(nav.navigate).toHaveBeenCalledWith('Login', { next: { name: 'PostWrite', params: { academyId: 'a-3' } } });
  });

  it('글쓰기: 소속 없는 슈퍼관리자도 스터디카페를 고르면 글쓰기 화면으로', async () => {
    const t = track(await mount(HUB, 'SUPER_ADMIN'));
    await press(t, '글쓰기');
    await press(t, '홍대점');
    expect(nav.navigate).toHaveBeenCalledWith('PostWrite', { academyId: 'a-3' });
  });

  it('게시판 선택 시트: 한 번에 "서울 아래 스터디카페"를 고른다 (지역 → 스터디카페 2단계 아님)', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '게시판 선택');
    const sheet = allText(t);
    expect(sheet).toContain('게시판 선택');
    expect(sheet).toContain('전체 스터디카페');
    expect(sheet).toContain('서울'); // 시/도 섹션 (펼쳐져 있음)
    expect(sheet).toContain('잠실점'); // 서울 섹션 안에 바로 스터디카페가 보임
    await press(t, '잠실점');
    const text = allText(t);
    expect(text).toContain('잠실점 오늘 많이 붐비네요');
    expect(text).not.toContain('이번 주 금요일 야간 개방 안내');
  });

  it('게시판 선택 시트: 지역 전체("서울 전체")를 고르면 서울 글만', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '게시판 선택');
    await press(t, '서울 전체');
    const text = allText(t);
    expect(text).toContain('서울 전체');
    expect(text).toContain('홍대점 스터디룸 후기');
    expect(text).not.toContain('판교점 코딩테스트 스터디');
  });

  it('게시판 선택 시트: 접힌 지역(부산)을 펼쳐서 스터디카페 선택, 글이 없으면 안내', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '게시판 선택');
    await press(t, '부산 스터디카페');
    await press(t, '해운대점');
    expect(allText(t)).toContain('해운대점에 아직 글이 없어요');
  });

  it('게시판 선택 시트: 검색하면 모든 지역에서 바로 찾는다', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '게시판 선택');
    const inputs = t.root.findAllByType(TextInput);
    await act(async () => {
      inputs[inputs.length - 1].props.onChangeText('판교');
      await sleep(100);
    });
    const text = allText(t);
    expect(text).toContain('판교점');
    expect(text).not.toContain('해운대점');
  });

  it('즐겨찾기 게시판(즐겨찾기한 곳이 없으면 시트에 항목 없음)', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '게시판 선택');
    expect(allText(t)).not.toContain('즐겨찾기');
  });

  it('분류 탭(고정): 후기만', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '후기');
    const text = allText(t);
    expect(text).toContain('집중석 한 달 써본 후기');
    expect(text).not.toContain('평일 저녁 토익 스터디 구해요');
  });

  it('검색은 아이콘을 눌러야 열리고, 입력하면 걸러진다', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    expect(t.root.findAllByType(TextInput)).toHaveLength(0); // 처음엔 접혀 있음
    await press(t, '검색');
    await type(t, 0, '토익');
    const text = allText(t);
    expect(text).toContain('평일 저녁 토익 스터디 구해요');
    expect(text).not.toContain('콘센트 있는 자리는 어디가 좋아요?');
  });

  it('정렬 토글: 최신순 → 인기순(좋아요 많은 글이 먼저)', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    const before = allText(t);
    expect(before.indexOf('잠실점 오늘 많이 붐비네요')).toBeLessThan(before.indexOf('이번 주 금요일 야간 개방 안내')); // 최신순
    await press(t, '최신순');
    const after = allText(t);
    expect(after).toContain('인기순');
    expect(after.indexOf('이번 주 금요일 야간 개방 안내')).toBeLessThan(after.indexOf('잠실점 오늘 많이 붐비네요')); // 좋아요 4
  });

  it('글을 누르면 글 상세로 이동', async () => {
    const t = track(await mount(HUB, 'GUEST'));
    await press(t, '홍대점 스터디룸 후기');
    expect(nav.navigate).toHaveBeenCalledWith('PostDetail', { postId: 'cp-5' });
  });
});

describe('글 상세 동작', () => {
  it('좋아요 토글', async () => {
    const t = track(await mount('../src/screens/community/PostDetailScreen', 'STUDENT', { postId: 'cp-2' }));
    expect(norm(allText(t))).toContain('좋아요 1');
    await press(t, '좋아요');
    expect(norm(allText(t))).toContain('좋아요 2');
    await press(t, '좋아요');
    expect(norm(allText(t))).toContain('좋아요 1');
  });

  it('비로그인이 좋아요를 누르면 로그인으로', async () => {
    const t = track(await mount('../src/screens/community/PostDetailScreen', 'GUEST', { postId: 'cp-2' }));
    await press(t, '좋아요');
    expect(nav.navigate).toHaveBeenCalledWith('Login', expect.anything());
  });

  it('댓글 등록', async () => {
    const t = track(await mount('../src/screens/community/PostDetailScreen', 'STUDENT', { postId: 'cp-4' }));
    await type(t, 0, '저도 참여하고 싶어요!');
    await press(t, '등록');
    await act(async () => {
      await sleep(400);
    });
    expect(allText(t)).toContain('저도 참여하고 싶어요!');
    expect(norm(allText(t))).toContain('댓글 2');
  });
});

describe('글쓰기 동작', () => {
  it('제목·내용을 입력하고 올리기 → 글이 등록되고 이전 화면으로', async () => {
    const t = track(await mount('../src/screens/community/PostWriteScreen', 'STUDENT', { academyId: AC }));
    await type(t, 0, '테스트 제목');
    await type(t, 1, '테스트 본문입니다');
    await press(t, '올리기');
    await act(async () => {
      await sleep(400);
    });
    expect(nav.goBack).toHaveBeenCalled();
    const { fetchPosts } = require('../src/lib/community');
    const posts = await fetchPosts(AC, null);
    expect(posts.some((p: any) => p.title === '테스트 제목')).toBe(true);
  });
});
