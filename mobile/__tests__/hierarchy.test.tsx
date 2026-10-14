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

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('원장 → 강사 → 학생 초대', () => {
  it('원장: 학원 이름·주소를 입력해 직접 학원을 만들면 강사 관리로 이동한다', async () => {
    const t = track(await mount('../src/screens/owner/OwnerClaimScreen', 'ACADEMY_ADMIN'));
    expect(screenText(t)).toContain('내 학원 만들기');
    await typeInto(t, '학원 이름 (예: 이룸수학학원)', '새봄영어학원');
    await typeInto(t, '주소', '서울 송파구 올림픽로 1');
    await press(t, '학원 만들기');
    expect(nav.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Main' }, { name: 'Teachers' }] });
    const { supabase } = require('../src/lib/supabase');
    const { data } = await supabase.from('academies').select('*').eq('name', '새봄영어학원');
    expect(data?.length).toBe(1);
  });

  it('원장: 강사 초대 코드가 보이고 재발급할 수 있다', async () => {
    const t = track(await mount('../src/screens/owner/TeachersScreen', 'ACADEMY_ADMIN'));
    const text = screenText(t);
    expect(text).toContain('강사 초대 코드');
    expect(text).toContain('TCHR2024');
    expect(text).toContain('재발급');
  });

  it('강사: 초대 코드를 입력하면 학원에 합류한다 (틀리면 오류)', async () => {
    const t = track(await mount('../src/screens/auth/TeacherJoinScreen', 'TEACHER'));
    expect(screenText(t)).toContain('학원에 합류하기');
    await typeInto(t, '예: 7F3KQ9ZT', 'WRONG123');
    await press(t, '합류하기');
    expect(screenText(t)).toContain('유효하지 않은 초대 코드');
    expect(nav.reset).not.toHaveBeenCalled();

    await typeInto(t, '예: 7F3KQ9ZT', 'tchr2024');
    await press(t, '합류하기');
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });

  it('강사 계정이 아니면 합류 화면을 쓸 수 없다', async () => {
    const t = track(await mount('../src/screens/auth/TeacherJoinScreen', 'STUDENT'));
    expect(screenText(t)).toContain('강사 계정 전용');
  });
});
