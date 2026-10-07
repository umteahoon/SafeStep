import { nav } from './helpers';
import { cleanup, mount, screenText, track } from './testUtils';

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
const BLOCKED = ['ACADEMY_ADMIN', 'TEACHER', 'PARENT'] as const;
const ALLOWED = ['GUEST', 'MEMBER', 'STUDENT', 'SUPER_ADMIN'] as const;

const SCREENS: [string, string, any][] = [
  ['커뮤니티 탭', '../src/screens/community/CommunityHubScreen', {}],
  ['스터디카페 게시판', '../src/screens/community/CommunityScreen', { academyId: AC }],
  ['글 상세', '../src/screens/community/PostDetailScreen', { postId: 'cp-2' }],
  ['지도', '../src/screens/map/MapScreen', {}],
  ['좌석 도면', '../src/screens/map/SeatFloorPlanScreen', { academyId: AC }],
];

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  (global as any).__routeParams = {};
});

describe.each(BLOCKED)('원장·강사·학부모(%s)는 지도·커뮤니티를 볼 수 없다', (role) => {
  it.each(SCREENS)('%s: 직접 열어도 차단되고 내용이 보이지 않음', async (_n, path, params) => {
    (global as any).__routeParams = params;
    const t = track(await mount(path, role));
    const text = screenText(t);
    expect(text).toContain('이용할 수 없는 화면이에요');
    expect(text).not.toContain('글쓰기');
    expect(text).not.toContain('이번 주 금요일 야간 개방 안내');
    expect(text).not.toContain('잔여석 있는 곳');
  });

  it('글쓰기 화면도 차단', async () => {
    (global as any).__routeParams = { academyId: AC };
    const t = track(await mount('../src/screens/community/PostWriteScreen', role));
    expect(screenText(t)).toContain('접근 권한이 없습니다');
    expect(screenText(t)).not.toContain('올바르게');
  });

  it('홈에 스터디카페·커뮤니티로 가는 바로가기·섹션이 없다', async () => {
    const t = track(await mount('../src/screens/home/HomeScreen', role));
    const text = screenText(t);
    expect(text).not.toContain('스터디카페');
    expect(text).not.toContain('스터디카페 이야기');
    expect(text).not.toContain('지역별로 찾기');
  });

  it('내 정보에 즐겨찾기·내 글 요약과 지도·커뮤니티 메뉴가 없다', async () => {
    const t = track(await mount('../src/screens/common/MeScreen', role));
    const text = screenText(t);
    expect(text).not.toContain('즐겨찾기');
    expect(text).not.toMatch(/내 글/);
    expect(text).not.toContain('스터디카페 찾기');
    expect(text).not.toContain('커뮤니티');
  });
});

describe.each(ALLOWED)('비로그인·일반 회원·학생·슈퍼관리자(%s)는 계속 볼 수 있다', (role) => {
  it.each(SCREENS.slice(0, 2))('%s', async (_n, path, params) => {
    (global as any).__routeParams = params;
    const t = track(await mount(path, role));
    expect(screenText(t)).not.toContain('이용할 수 없는 화면이에요');
    expect(screenText(t)).toContain('글쓰기');
  });
});

describe('역할 판별 함수', () => {
  it('canExplore', () => {
    const { canExplore } = require('../src/lib/teams');
    expect(canExplore(undefined)).toBe(true);
    expect(canExplore(null)).toBe(true);
    expect(canExplore('STUDENT')).toBe(true);
    expect(canExplore('SUPER_ADMIN')).toBe(true);
    expect(canExplore('ACADEMY_ADMIN')).toBe(false);
    expect(canExplore('TEACHER')).toBe(false);
    expect(canExplore('PARENT')).toBe(false);
  });
});
