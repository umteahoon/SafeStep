import { nav } from './helpers';
import { cleanup, mount, press, screenText, track, typeInto } from './testUtils';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => require('./helpers').nav,
    useRoute: () => ({ params: (global as any).__routeParams ?? {} }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});

const LIST = '../src/screens/academy/AcademyListScreen';
const HOME = '../src/screens/academy/AcademyHomeScreen';
const AC = '00000000-0000-0000-0000-000000000001';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  (global as any).__routeParams = {};
});

describe('학원 탭', () => {
  it('등록된 학원이 모두 보이고 내 학원이 표시된다', async () => {
    const t = track(await mount(LIST, 'STUDENT'));
    const text = screenText(t);
    expect(text).toContain('이룸수학학원 강남점');
    expect(text).toContain('공부의정석 스터디카페 홍대점'); // 학원·스터디카페 모두 포함
    expect(text).toContain('내 학원');
  });

  it('학원을 누르면 학원 홈으로 이동', async () => {
    const t = track(await mount(LIST, 'GUEST'));
    await press(t, '공부의정석 스터디카페 홍대점');
    expect(nav.navigate).toHaveBeenCalledWith('AcademyHome', { academyId: 'a-3' });
  });
});

describe('학원 홈', () => {
  const open = (role: any, academyId = AC) => {
    (global as any).__routeParams = { academyId };
    return mount(HOME, role);
  };

  it('출결 · 공지방 · 채팅방(목록)이 한 화면에 보이고, 출결이 맨 위에 있다', async () => {
    const t = track(await open('STUDENT'));
    const text = screenText(t);
    for (const label of ['출결', '공지방', '채팅방']) expect(text).toContain(label);
    expect(text.indexOf('출결')).toBeLessThan(text.indexOf('공지방'));
    expect(text).toContain('중3 수학 A'); // 학원이 만든 채팅방이 목록으로 보임
    expect(text).toContain('고1 영어 B');
  });

  it('학생: 출결 → 출석 체크 화면, 공지방 → 공지 채팅방', async () => {
    const t = track(await open('STUDENT'));
    await press(t, '출결');
    expect(nav.navigate).toHaveBeenCalledWith('CheckIn');
    await press(t, '공지방');
    expect(nav.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'r-ann' });
  });

  it('학생: 아직 안 들어간 채팅방은 잠겨 있고, 틀린 비밀번호는 거절, 맞으면 입장', async () => {
    const t = track(await open('STUDENT'));
    expect(screenText(t)).toContain('비밀번호를 입력해 입장');
    await press(t, '채팅방 중3 수학 A');
    expect(nav.navigate).not.toHaveBeenCalledWith('ChatRoom', { roomId: 'r-c1' });
    expect(screenText(t)).toContain('강사님께 받은 비밀번호');

    await typeInto(t, '비밀번호', 'WRONGPW1');
    await press(t, '입장하기');
    expect(screenText(t)).toContain('비밀번호가 맞지 않아요');
    expect(nav.navigate).not.toHaveBeenCalledWith('ChatRoom', { roomId: 'r-c1' });

    await typeInto(t, '비밀번호', 'cls3math'); // 대소문자 무시
    await press(t, '입장하기');
    expect(nav.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'r-c1' });
  });

  it('강사: 비밀번호 없이 바로 입장, 출결 → 반별 출석부, 채팅방 만들기 버튼', async () => {
    const t = track(await open('TEACHER'));
    expect(screenText(t)).toContain('채팅방 만들기');
    await press(t, '채팅방 중3 수학 A');
    expect(nav.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'r-c1' });
    await press(t, '출결');
    expect(nav.navigate).toHaveBeenCalledWith('Attendance');
  });

  it('강사: 비밀번호를 직접 정해 채팅방을 만든다 (4자 미만은 거절)', async () => {
    const t = track(await open('TEACHER'));
    await press(t, '채팅방 만들기');
    await typeInto(t, '예: 중3 수학 질문방', '심화반');
    await typeInto(t, '예: MATH2026', 'ab');
    await press(t, '만들기');
    expect(screenText(t)).toContain('비밀번호는 4~20자');
    await typeInto(t, '예: MATH2026', 'MYPASS99');
    await press(t, '만들기');
    const { supabase } = require('../src/lib/supabase');
    const { data } = await supabase.from('chat_rooms').select('*').eq('name', '심화반');
    expect(data?.[0]?.join_code).toBe('MYPASS99');
  });

  it('학부모: 출결 → 자녀 출결 리포트', async () => {
    const t = track(await open('PARENT'));
    await press(t, '출결');
    expect(nav.navigate).toHaveBeenCalledWith('ParentReport');
  });

  it('내 학원이 아니면 눌러도 이동하지 않고 안내만 보인다', async () => {
    const t = track(await open('STUDENT', 'a-2'));
    await press(t, '공지방');
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(screenText(t)).toContain('내가 소속된 학원만 이용할 수 있어요');
  });

  it('비로그인: 누르면 로그인으로 이동', async () => {
    const t = track(await open('GUEST'));
    await press(t, '출결');
    expect(nav.navigate).toHaveBeenCalledWith('Login', { next: { name: 'AcademyHome', params: { academyId: AC } } });
  });
});
