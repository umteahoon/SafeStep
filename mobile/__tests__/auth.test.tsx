import { nav } from './helpers';
import { act } from 'react-test-renderer';
import { auth, cleanup, inputs, mount, press, pump, screenText, track, typeInto } from './testUtils';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => require('./helpers').nav,
    useRoute: () => ({ params: (global as any).__routeParams ?? {} }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});

const LOGIN = '../src/screens/auth/LoginScreen';
const REGISTER = '../src/screens/auth/RegisterScreen';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  (global as any).__routeParams = {};
});

describe('로그인 화면', () => {
  it('브랜드 영역 + 폼 + 회원가입/둘러보기 진입점', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    const text = screenText(t);
    expect(text).toContain('SafeStep');
    expect(text).toContain('다시 만나서 반가워요');
    expect(text).toContain('로그인');
    expect(text).toContain('아직 계정이 없으신가요?');
    expect(text).toContain('회원가입');
    expect(text).toContain('로그인 없이 둘러보기');
    expect(inputs(t).map((i: any) => i.props.placeholder)).toEqual(['이메일', '비밀번호']);
  });

  it('입력 전에는 로그인 버튼이 비활성, 입력하면 활성', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    const btn = () => t.root.findAll((n: any) => typeof n.props?.onPress === 'function' && (n.props.disabled === true || n.props.disabled === false) && screenText({ toJSON: () => n.children }) !== undefined).length;
    expect(btn()).toBeGreaterThan(0);
    await press(t, '로그인'); // 비활성이라 아무 일도 일어나지 않음
    expect(screenText(t)).not.toContain('올바르지 않아요');
  });

  it('잘못된 정보로 로그인 → 입력창 아래에 오류 문구', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    await typeInto(t, '이메일', 'wrong@example.com');
    await typeInto(t, '비밀번호', 'badpassword');
    await press(t, '로그인');
    expect(screenText(t)).toContain('이메일 또는 비밀번호가 올바르지 않아요.');
    // 다시 입력하기 시작하면 오류가 사라짐
    await typeInto(t, '비밀번호', 'badpassword2');
    expect(screenText(t)).not.toContain('올바르지 않아요');
  });

  it('비밀번호 보기 토글', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    const pw = () => inputs(t).find((i: any) => i.props.placeholder === '비밀번호');
    expect(pw().props.secureTextEntry).toBe(true);
    await press(t, '비밀번호 보기');
    expect(pw().props.secureTextEntry).toBe(false);
    await press(t, '비밀번호 숨기기');
    expect(pw().props.secureTextEntry).toBe(true);
  });

  it('회원가입 / 로그인 없이 둘러보기', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    await press(t, '회원가입');
    expect(nav.navigate).toHaveBeenCalledWith('Register');
    await press(t, '로그인 없이 둘러보기');
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
  });

  it('로그인 후 돌아갈 화면(next)이 있으면 Main 위에 그 화면을 쌓는다 (미리보기 바로 로그인)', async () => {
    (global as any).__routeParams = { next: { name: 'StudentPasses' } };
    const t = track(await mount(LOGIN, 'GUEST'));
    await press(t, '학생');
    expect(nav.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Main' }, { name: 'StudentPasses', params: undefined }] });
  });

  it('미리보기: "일반 회원"으로 바로 로그인', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    expect(auth.user).toBeNull();
    await press(t, '일반 회원');
    await pump(500);
    expect(auth.isMember).toBe(true);
    expect(nav.reset).toHaveBeenCalled();
  });

  it('뒤로가기 버튼', async () => {
    const t = track(await mount(LOGIN, 'GUEST'));
    await press(t, '뒤로');
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe('회원가입 3단계 마법사', () => {
  it('1단계: 유형 카드 5개(일반 회원이 기본 선택) + 진행 표시', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    const text = screenText(t);
    expect(text).toContain('어떤 분이세요?');
    for (const title of ['일반 회원', '학생', '학부모', '강사', '원장']) expect(text).toContain(title);
    expect(text).toContain('1/3');
    expect(text).toContain('다음');
    const radios = t.root.findAll((n: any) => typeof n.type === 'string' && n.props?.accessibilityRole === 'radio'); // 실제로 그려지는 요소만
    expect(radios).toHaveLength(5);
    expect(radios[0].props.accessibilityState.selected).toBe(true);
  });

  it('2단계: 이메일·비밀번호 검증 오류가 입력창 아래에 표시', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    await press(t, '다음');
    expect(screenText(t)).toContain('2/3');
    await press(t, '다음'); // 아무것도 입력하지 않고 → 오류 표시, 단계 유지
    let text = screenText(t);
    expect(text).toContain('올바른 이메일 형식이 아니에요');
    expect(text).toContain('6자 이상 입력해주세요');
    expect(text).toContain('2/3');

    await typeInto(t, 'you@example.com', 'a@b.co');
    await typeInto(t, '6자 이상', 'secret1');
    await typeInto(t, '한 번 더 입력', 'different');
    await press(t, '다음');
    text = screenText(t);
    expect(text).not.toContain('올바른 이메일 형식이 아니에요');
    expect(text).toContain('비밀번호가 서로 달라요');
    expect(text).toContain('2/3');
  });

  it('3단계: 이름 필수, 완료하면 선택한 유형으로 가입되고 홈으로 이동', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    await press(t, '다음');
    await typeInto(t, 'you@example.com', 'newbie@example.com');
    await typeInto(t, '6자 이상', 'secret1');
    await typeInto(t, '한 번 더 입력', 'secret1');
    await press(t, '다음');
    expect(screenText(t)).toContain('3/3');
    expect(screenText(t)).toContain('가입하기');

    await press(t, '가입하기'); // 이름 없이 → 오류
    expect(screenText(t)).toContain('이름을 입력해주세요');
    expect(nav.reset).not.toHaveBeenCalled();

    await typeInto(t, '홍길동', '새회원');
    await press(t, '가입하기', 900);
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
    expect(auth.isMember).toBe(true); // 기본 선택이 "일반 회원"
  });

  it('유형을 학생으로 바꾸면 가입 후 학생(미리보기)으로', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    await press(t, '학생');
    await press(t, '다음');
    await typeInto(t, 'you@example.com', 'stu@example.com');
    await typeInto(t, '6자 이상', 'secret1');
    await typeInto(t, '한 번 더 입력', 'secret1');
    await press(t, '다음');
    await typeInto(t, '홍길동', '김학생');
    await press(t, '가입하기', 900);
    expect(auth.profile?.role).toBe('STUDENT');
    expect(auth.isMember).toBe(false); // 학생(연동된 미리보기 학생)
  });

  it('강사는 소속 학원 선택이 필수', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    await press(t, '강사');
    await press(t, '다음');
    await typeInto(t, 'you@example.com', 'teacher@example.com');
    await typeInto(t, '6자 이상', 'secret1');
    await typeInto(t, '한 번 더 입력', 'secret1');
    await press(t, '다음');
    expect(screenText(t)).toContain('소속 학원');
    await typeInto(t, '홍길동', '박강사');
    await press(t, '가입하기');
    expect(screenText(t)).toContain('소속 학원을 선택해주세요');
    expect(nav.reset).not.toHaveBeenCalled();
  });

  it('원장으로 가입하면 학원 등록(OwnerClaim) 화면으로', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    await press(t, '원장');
    await press(t, '다음');
    await typeInto(t, 'you@example.com', 'owner@example.com');
    await typeInto(t, '6자 이상', 'secret1');
    await typeInto(t, '한 번 더 입력', 'secret1');
    await press(t, '다음');
    await typeInto(t, '홍길동', '김원장님');
    await press(t, '가입하기', 900);
    expect(nav.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Main' }, { name: 'OwnerClaim' }] });
  });

  it('뒤로가기: 단계를 거슬러 올라가고, 1단계에서는 화면을 닫는다', async () => {
    const t = track(await mount(REGISTER, 'GUEST'));
    await press(t, '다음');
    expect(screenText(t)).toContain('2/3');
    await press(t, '뒤로');
    expect(screenText(t)).toContain('1/3');
    expect(nav.goBack).not.toHaveBeenCalled();
    await press(t, '뒤로');
    expect(nav.goBack).toHaveBeenCalled();
  });
});
