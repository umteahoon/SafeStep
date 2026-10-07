import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  HomeTab: undefined;
  /** preset: 홈 바로가기에서 넘기는 빠른 필터. ts 는 같은 필터를 다시 눌러도 재적용하기 위한 값 */
  MapTab: { preset?: 'near' | 'available' | 'quiet' | 'fav'; region?: { sido: string; sigungu?: string | null }; ts?: number } | undefined;
  StudyTab: undefined;
  ChatTab: undefined;
  /** mine: 내 정보의 "내 글"에서 열 때 내 글만 보여줌 */
  CommunityTab: { mine?: boolean; ts?: number } | undefined;
  MeTab: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;

  // 인증 / 공개
  Login: { next?: { name: keyof RootStackParamList; params?: any } } | undefined;
  Register: undefined;
  Inquiry: undefined;
  MyInquiries: undefined;
  StartGuide: undefined;
  TeacherPending: undefined;
  Unauthorized: undefined;

  // 지도 / 좌석 / 키오스크
  SeatFloorPlan: { academyId: string };
  Kiosk: { academyId?: string; demo?: boolean; self?: boolean } | undefined;

  // 학생 / 학습
  FocusTimer: undefined;
  Timetable: undefined;
  History: undefined;
  Notifications: undefined;
  StudentQr: undefined;
  StudentPasses: undefined;

  // 채팅 / 팀
  Community: { academyId: string };
  PostDetail: { postId: string };
  PostWrite: { academyId: string };
  Chats: undefined;
  Teams: undefined;
  ChatRoom: { roomId: string };
  TeamRoom: { teamId: string };
  JoinTeam: { code: string };

  // 원장 / 강사
  OwnerClaim: undefined;
  Dashboard: undefined;
  Students: undefined;
  Teachers: undefined;
  Classes: undefined;
  Schedule: undefined;
  Attendance: undefined;
  Reports: undefined;
  Billing: undefined;

  // 슈퍼 관리자
  SuperAdmin: undefined;
  AdminLogs: undefined;

  // 학부모
  ParentReport: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
