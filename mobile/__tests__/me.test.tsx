import { nav } from './helpers';
import { cleanup, mount, press, screenText, track } from './testUtils';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => require('./helpers').nav,
    useRoute: () => ({ params: (global as any).__routeParams ?? {} }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});

const ME = '../src/screens/common/MeScreen';
const HUB = '../src/screens/community/CommunityHubScreen';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  (global as any).__routeParams = {};
});

describe('내 정보 — 비로그인', () => {
  it('로그인 유도 카드 + 둘러보기/운영자 메뉴, 활동 요약·로그아웃은 없음', async () => {
    const t = track(await mount(ME, 'GUEST'));
    const text = screenText(t);
    expect(text).toContain('로그인하고 시작해보세요');
    expect(text).toContain('스터디카페 찾기');
    expect(text).toContain('커뮤니티');
    expect(text).toContain('스터디카페를 운영하시나요?');
    expect(text).not.toContain('로그아웃');
    expect(text).not.toContain('새 알림');
  });

  it('로그인 / 회원가입 버튼', async () => {
    const t = track(await mount(ME, 'GUEST'));
    await press(t, '로그인');
    expect(nav.navigate).toHaveBeenCalledWith('Login');
    await press(t, '회원가입');
    expect(nav.navigate).toHaveBeenCalledWith('Register');
  });
});

describe('내 정보 — 로그인', () => {
  it('일반 회원: 프로필(배지) + 활동 요약 + 연동하기, 소통·내 활동 메뉴는 없음', async () => {
    const t = track(await mount(ME, 'MEMBER'));
    const text = screenText(t);
    expect(text).toContain('일반회원');
    expect(text).toContain('일반 회원');
    expect(text).toContain('즐겨찾기');
    expect(text).toContain('내 글');
    expect(text).toContain('새 알림');
    expect(text).toContain('학원·스터디카페 연동하기');
    expect(text).not.toContain('공지방 · 반 채팅방');
    expect(text).toContain('로그아웃');
    expect(text).toContain('SafeStep Mobile');
  });

  it('연동된 학생: 내 활동 + 소통(채팅·팀)', async () => {
    const t = track(await mount(ME, 'STUDENT'));
    const text = screenText(t);
    for (const item of ['내 출결 QR', '이용권', '이용 내역', '내 시간표', '집중 타이머', '채팅', '팀']) expect(text).toContain(item);
    expect(text).not.toContain('학원·스터디카페 연동하기');
  });

  it('원장: 관리 메뉴', async () => {
    const t = track(await mount(ME, 'ACADEMY_ADMIN'));
    const text = screenText(t);
    for (const item of ['원장 대시보드', '학생 관리', '강사 관리', '출석부', '신고 관제', '이용권 결제']) expect(text).toContain(item);
  });

  it('슈퍼관리자: 활동 요약(즐겨찾기·내 글) 없음, 플랫폼 관리 메뉴', async () => {
    const t = track(await mount(ME, 'SUPER_ADMIN'));
    const text = screenText(t);
    expect(text).toContain('플랫폼 관리');
    expect(text).toContain('접속 로그');
    expect(text).not.toContain('새 알림');
  });

  it('내 글 수가 활동 요약에 반영된다', async () => {
    const { createPost } = require('../src/lib/community');
    await createPost({ academyId: 'a-3', authorId: '00000000-0000-0000-0000-000000000000', category: 'FREE', title: '내 글 1', content: '본문' });
    await createPost({ academyId: 'a-3', authorId: '00000000-0000-0000-0000-000000000000', category: 'FREE', title: '내 글 2', content: '본문' });
    const t = track(await mount(ME, 'STUDENT'));
    expect(screenText(t)).toMatch(/2\s*내 글/);
  });

  it('활동 요약을 누르면 해당 화면으로 (즐겨찾기 → 지도, 내 글 → 커뮤니티 내 글, 새 알림 → 알림)', async () => {
    const t = track(await mount(ME, 'STUDENT'));
    await press(t, '즐겨찾기');
    expect(nav.navigate).toHaveBeenCalledWith('Main', { screen: 'MapTab', params: expect.objectContaining({ preset: 'fav' }) });
    await press(t, '내 글');
    expect(nav.navigate).toHaveBeenCalledWith('Main', { screen: 'CommunityTab', params: expect.objectContaining({ mine: true }) });
    await press(t, '새 알림');
    expect(nav.navigate).toHaveBeenCalledWith('Notifications');
  });

  it('메뉴 항목을 누르면 해당 화면으로', async () => {
    const t = track(await mount(ME, 'STUDENT'));
    await press(t, '이용권');
    expect(nav.navigate).toHaveBeenCalledWith('StudentPasses');
    await press(t, '공지방 · 반 채팅방'); // 채팅 행(설명 문구로 찾음 — 팀 행 설명에도 "채팅"이 들어 있어서)
    expect(nav.navigate).toHaveBeenCalledWith('Chats');
  });
});

describe('커뮤니티 — 내 정보의 "내 글"에서 열면 내 글만', () => {
  it('mine 파라미터 → 모든 게시판에서 내 글만 보인다', async () => {
    (global as any).__routeParams = { mine: true, ts: 1 };
    const t = track(await mount(HUB, 'STUDENT'));
    const text = screenText(t);
    expect(text).toContain('전체 스터디카페');
    // 앞 테스트에서 만든 내 글 2개만 보이고, 다른 사람 글은 보이지 않는다
    expect(text).toContain('내 글 1');
    expect(text).toContain('내 글 2');
    expect(text).not.toContain('이번 주 금요일 야간 개방 안내');
    expect(text).not.toContain('홍대점 스터디룸 후기');
  });
});
