import { nav } from './helpers';
import { cleanup, mount, press, screenText, track } from './testUtils';
import { EARLY_MINUTES, checkInWindow, expectedStatus, minutesOf, windowMessage } from '../src/lib/checkIn';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => require('./helpers').nav,
    useRoute: () => ({ params: (global as any).__routeParams ?? {} }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});

const CHECKIN = '../src/screens/student/CheckInScreen';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('출석 시간 규칙', () => {
  it('수업 30분 전부터 종료까지만 열린다', () => {
    expect(minutesOf('16:00')).toBe(960);
    expect(EARLY_MINUTES).toBe(30);
    expect(checkInWindow(minutesOf('15:29'), '16:00', '18:00')).toBe('early');
    expect(checkInWindow(minutesOf('15:30'), '16:00', '18:00')).toBe('open');
    expect(checkInWindow(minutesOf('18:00'), '16:00', '18:00')).toBe('open');
    expect(checkInWindow(minutesOf('18:01'), '16:00', '18:00')).toBe('closed');
  });
  it('시작 10분 이후는 지각', () => {
    expect(expectedStatus(minutesOf('16:10'), '16:00')).toBe('PRESENT');
    expect(expectedStatus(minutesOf('16:11'), '16:00')).toBe('LATE');
  });
  it('안내 문구', () => {
    expect(windowMessage('early', '16:00:00')).toContain('16:00');
    expect(windowMessage('closed', '16:00')).toContain('끝났어요');
    expect(windowMessage('open', '16:00')).toBe('');
  });
});

describe('출석 체크 화면 (학생)', () => {
  it('큰 출석 버튼 → 누르면 "출석되었습니다", 내 출석 기록도 보인다', async () => {
    const t = track(await mount(CHECKIN, 'STUDENT'));
    const before = screenText(t);
    expect(before).toContain('출석하기');
    expect(before).toContain('내 출석 기록');
    expect(before).toContain('지각'); // 시드된 과거 기록
    expect(before).not.toContain('출석되었습니다');

    await press(t, '출석하기', 900);
    const after = screenText(t);
    expect(after).toContain('출석되었습니다');
    expect(after).not.toContain('출석하기');
  });

  it('이미 출석한 뒤 다시 열어도 "출석되었습니다"로 보인다 (하루 1회)', async () => {
    const t = track(await mount(CHECKIN, 'STUDENT'));
    expect(screenText(t)).toContain('출석되었습니다');
  });

  it('학생이 아니면 이용할 수 없다', async () => {
    const t = track(await mount(CHECKIN, 'TEACHER'));
    expect(screenText(t)).toContain('접근 권한이 없습니다');
  });
});
