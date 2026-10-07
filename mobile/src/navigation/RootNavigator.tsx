import { Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Linking from 'expo-linking';
import { useAuth } from '../lib/useAuth';
import { canExplore, canUseChat } from '../lib/teams';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MeScreen from '../screens/common/MeScreen';
import InquiryScreen from '../screens/common/InquiryScreen';
import MyInquiriesScreen from '../screens/common/MyInquiriesScreen';
import StartGuideScreen from '../screens/common/StartGuideScreen';
import MapScreen from '../screens/map/MapScreen';
import HomeScreen from '../screens/home/HomeScreen';
import CommunityHubScreen from '../screens/community/CommunityHubScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import PostWriteScreen from '../screens/community/PostWriteScreen';
import StudyScreen from '../screens/study/StudyScreen';
import FocusTimerScreen from '../screens/study/FocusTimerScreen';
import TimetableScreen from '../screens/study/TimetableScreen';
import HistoryScreen from '../screens/study/HistoryScreen';
import NotificationsScreen from '../screens/study/NotificationsScreen';
import SeatFloorPlanScreen from '../screens/map/SeatFloorPlanScreen';
import KioskScreen from '../screens/kiosk/KioskScreen';
import StudentQrScreen from '../screens/student/StudentQrScreen';
import StudentPassesScreen from '../screens/student/StudentPassesScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import TeamsScreen from '../screens/teams/TeamsScreen';
import TeamRoomScreen from '../screens/teams/TeamRoomScreen';
import JoinTeamScreen from '../screens/teams/JoinTeamScreen';
import OwnerClaimScreen from '../screens/owner/OwnerClaimScreen';
import DashboardScreen from '../screens/owner/DashboardScreen';
import TeachersScreen from '../screens/owner/TeachersScreen';
import BillingScreen from '../screens/owner/BillingScreen';
import StudentsScreen from '../screens/staff/StudentsScreen';
import ClassesScreen from '../screens/staff/ClassesScreen';
import ScheduleScreen from '../screens/staff/ScheduleScreen';
import AttendanceScreen from '../screens/staff/AttendanceScreen';
import ReportsScreen from '../screens/staff/ReportsScreen';
import SuperAdminScreen from '../screens/admin/SuperAdminScreen';
import AdminLogsScreen from '../screens/admin/AdminLogsScreen';
import ParentReportScreen from '../screens/parent/ParentReportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type IonName = React.ComponentProps<typeof Ionicons>['name'];
// 포커스 여부에 따라 채움/외곽선 아이콘 전환
const tabIcon =
  (active: IonName, inactive: IonName) =>
  ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );

// 웹 앱 모드의 하단 탭바(지도 / 키오스크 / 팀 / 내 정보)에 채팅을 더한 구성
function MainTabs() {
  const { user, profile, studentLinked, isMember } = useAuth();
  // 홈 · 지도 · 커뮤니티는 모두에게, 내 공부는 학생, 채팅은 운영진·학부모. 팀·키오스크는 홈 바로가기에서 진입
  const role = user ? profile?.role : undefined;
  // 지도·커뮤니티는 원장·강사·학부모에게 보이지 않음
  const showExplore = canExplore(role);
  const showStudy = role === 'STUDENT' && studentLinked; // 일반 회원(명부 미연동)은 제외
  // 채팅 탭은 운영진·학부모만 (학생은 홈·내 정보에서 진입해 탭이 늘어나지 않게 함)
  const showChat = !!role && canUseChat(role) && role !== 'STUDENT';
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingTop: 6,
        },
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: colors.text },
        headerTitleAlign: 'left',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: '홈', headerShown: false, tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      {showExplore && (
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          // 비로그인·일반 회원은 탐색 중심이라 "스터디카페", 소속이 있는 회원은 "지도"
          title: user && !isMember ? '지도' : '스터디카페',
          headerShown: false,
          tabBarIcon: tabIcon('map', 'map-outline'),
        }}
      />
      )}
      {showExplore && (
      <Tab.Screen
        name="CommunityTab"
        component={CommunityHubScreen}
        options={{ title: '커뮤니티', headerShown: false, tabBarIcon: tabIcon('chatbox-ellipses', 'chatbox-ellipses-outline') }}
      />
      )}
      {/* 내 공부: 학생 전용 (이용 기록·통계·목표·도구) */}
      {showStudy && (
        <Tab.Screen
          name="StudyTab"
          component={StudyScreen}
          options={{ title: '내 공부', headerShown: false, tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }}
        />
      )}
      {showChat && (
        <Tab.Screen
          name="ChatTab"
          component={ChatListScreen}
          options={{ title: '채팅', headerTitle: '채팅', tabBarIcon: tabIcon('chatbubbles', 'chatbubbles-outline') }}
        />
      )}
      <Tab.Screen
        name="MeTab"
        component={MeScreen}
        options={{ title: '내 정보', headerShown: false, tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tab.Navigator>
  );
}

// 딥링크: safestep://teams/join/CODE  (팀 초대 링크)
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'safestep://'],
  config: {
    screens: {
      JoinTeam: 'teams/join/:code',
    },
  },
};

const headerOpts = {
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.white },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
  headerBackTitle: '뒤로',
  contentStyle: { backgroundColor: colors.bg },
};

/**
 * 돌아갈 화면이 없을 때(딥링크로 앱이 바로 이 화면에서 시작된 경우 등)
 * 막다른 길이 되지 않도록 헤더 왼쪽에 "홈" 버튼을 보여줍니다.
 */
function HomeButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingRight: 12 }}>
      <Ionicons name="home-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          ...headerOpts,
          headerLeft: navigation.canGoBack()
            ? undefined
            : () => (
                <HomeButton
                  onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
                />
              ),
        })}
      >
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />

        {/* 인증 / 공개 */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Inquiry" component={InquiryScreen} options={{ title: '도입 문의' }} />
        <Stack.Screen name="MyInquiries" component={MyInquiriesScreen} options={{ title: '내 문의 내역' }} />
        <Stack.Screen name="StartGuide" component={StartGuideScreen} options={{ title: '시작 가이드' }} />

        {/* 지도 / 좌석 / 키오스크 */}
        <Stack.Screen name="SeatFloorPlan" component={SeatFloorPlanScreen} options={{ title: '좌석 도면' }} />
        <Stack.Screen name="Kiosk" component={KioskScreen} options={{ headerShown: false }} />

        {/* 스터디카페 커뮤니티 */}
        <Stack.Screen name="Community" component={CommunityScreen} options={{ title: '커뮤니티' }} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '게시글' }} />
        <Stack.Screen name="PostWrite" component={PostWriteScreen} options={{ title: '글쓰기' }} />

        {/* 학습 도구 */}
        <Stack.Screen name="FocusTimer" component={FocusTimerScreen} options={{ title: '집중 타이머' }} />
        <Stack.Screen name="Timetable" component={TimetableScreen} options={{ title: '시간표' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: '이용 내역' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: '알림' }} />

        {/* 학생 */}
        <Stack.Screen name="StudentQr" component={StudentQrScreen} options={{ title: '내 출결 QR' }} />
        <Stack.Screen name="StudentPasses" component={StudentPassesScreen} options={{ title: '이용권' }} />

        {/* 채팅 / 팀 */}
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: '채팅' }} />
        <Stack.Screen name="Chats" component={ChatListScreen} options={{ title: '채팅' }} />
        <Stack.Screen name="Teams" component={TeamsScreen} options={{ title: '팀' }} />
        <Stack.Screen name="TeamRoom" component={TeamRoomScreen} options={{ title: '팀' }} />
        <Stack.Screen name="JoinTeam" component={JoinTeamScreen} options={{ title: '팀 초대' }} />

        {/* 원장 / 강사 */}
        <Stack.Screen name="OwnerClaim" component={OwnerClaimScreen} options={{ title: '학원 등록' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: '원장 대시보드' }} />
        <Stack.Screen name="Students" component={StudentsScreen} options={{ title: '학생 관리' }} />
        <Stack.Screen name="Teachers" component={TeachersScreen} options={{ title: '강사 관리' }} />
        <Stack.Screen name="Classes" component={ClassesScreen} options={{ title: '반 관리' }} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: '주간 시간표' }} />
        <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: '반별 출석부' }} />
        <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: '신고 관제' }} />
        <Stack.Screen name="Billing" component={BillingScreen} options={{ title: '이용권 결제' }} />

        {/* 슈퍼 관리자 */}
        <Stack.Screen name="SuperAdmin" component={SuperAdminScreen} options={{ title: '플랫폼 관리자' }} />
        <Stack.Screen name="AdminLogs" component={AdminLogsScreen} options={{ title: '접속 로그' }} />

        {/* 학부모 */}
        <Stack.Screen name="ParentReport" component={ParentReportScreen} options={{ title: '자녀 출결 리포트' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
