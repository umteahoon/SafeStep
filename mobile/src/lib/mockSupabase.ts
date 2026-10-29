/**
 * 미리보기 모드(EXPO_PUBLIC_PREVIEW_MODE=1) 전용 메모리 가짜 Supabase.
 * 실제 서버 없이 채팅/팀/출결 등 화면이 동작하도록, 앱이 쓰는 쿼리 빌더·RPC·Realtime 일부만 흉내 냅니다.
 * 앱을 다시 시작하면 데이터는 초기화됩니다. 실서비스 코드 경로에서는 사용되지 않습니다.
 */
import { PREVIEW_ACADEMY_ID, PREVIEW_MEMBER_ID, PREVIEW_USER_ID } from './preview';

// 지금 미리보기에서 보고 있는 가짜 사용자 id (AuthProvider 가 역할을 바꿀 때 알려줌) — 가짜 API 가 "누가 요청했는지" 알 수 있도록
let mockUserId: string = PREVIEW_USER_ID;
export function setMockUserId(id: string) {
  mockUserId = id;
}

type Row = Record<string, any>;
type Db = Record<string, Row[]>;

const ME = PREVIEW_USER_ID;
const AC = PREVIEW_ACADEMY_ID;
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
let seq = 1000;
const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// ── 초기 데이터 ────────────────────────────────────────
const db: Db = {
  academies: [
    { id: AC, name: '이룸수학학원 강남점', kind: 'ACADEMY', category: 'MATH', address: '서울 강남구 테헤란로 123', latitude: 37.4979, longitude: 127.0276, total_seats: 12, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 20), created_at: ago(60 * 24 * 90) },
    { id: 'a-2', name: '해냄국어논술학원 신촌점', kind: 'ACADEMY', category: 'KOREAN', address: '서울 서대문구 연세로 50', latitude: 37.5551, longitude: 126.9368, total_seats: 12, subscription_status: 'TRIAL', subscription_expires_at: ago(-60 * 24 * 7), created_at: ago(60 * 24 * 30) },
  ],
  seats: [],
  academy_landmarks: [],
  profiles: [
    { id: ME, name: '미리보기', email: 'preview@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: PREVIEW_MEMBER_ID, name: '일반회원', email: 'member@safestep.app', role: 'STUDENT', academy_id: null, approval_status: 'APPROVED' },
    { id: 'u-t1', name: '박선생', email: 't1@safestep.app', role: 'TEACHER', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-s1', name: '김민지', email: 's1@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-s2', name: '이준호', email: 's2@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-s3', name: '최서연', email: 's3@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-s4', name: '정하늘', email: 's4@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-s5', name: '오지훈', email: 's5@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-s6', name: '한소희', email: 's6@safestep.app', role: 'STUDENT', academy_id: AC, approval_status: 'APPROVED' },
    { id: 'u-own', name: '김원장', email: 'owner@safestep.app', role: 'ACADEMY_ADMIN', academy_id: AC, approval_status: 'APPROVED' },
  ],
  students: [
    { id: 'st-me', user_id: ME, academy_id: AC, name: '미리보기', attendance_code: '111111', qr_token: 'PREVIEW-QR-TOKEN', link_code: '000000', status: 'ACTIVE', parent_phone: '010-0000-0000', created_at: ago(500) },
    { id: 'st-1', user_id: 'u-s1', academy_id: AC, name: '김민지', attendance_code: '222222', qr_token: 'qr-1', link_code: '111222', status: 'ACTIVE', parent_phone: '010-1111-2222', created_at: ago(400) },
    { id: 'st-2', user_id: 'u-s2', academy_id: AC, name: '이준호', attendance_code: '333333', qr_token: 'qr-2', link_code: '333444', status: 'ACTIVE', parent_phone: '010-3333-4444', created_at: ago(300) },
    { id: 'st-3', user_id: 'u-s3', academy_id: AC, name: '최서연', attendance_code: '444444', qr_token: 'qr-3', link_code: '555666', status: 'ACTIVE', parent_phone: '010-5555-6666', created_at: ago(200) },
    { id: 'st-4', user_id: null, academy_id: AC, name: '정우진', attendance_code: '555555', qr_token: 'qr-4', link_code: '777888', status: 'ACTIVE', parent_phone: '010-7777-8888', created_at: ago(100) },
  ],
  classes: [
    { id: 'c-1', academy_id: AC, teacher_id: 'u-t1', name: '중3 수학 A', color_code: '#3B82F6', created_at: ago(900) },
    { id: 'c-2', academy_id: AC, teacher_id: 'u-t1', name: '고1 영어 B', color_code: '#10B981', created_at: ago(800) },
  ],
  class_enrollments: [
    { id: 'e-1', class_id: 'c-1', student_id: 'st-me' },
    { id: 'e-2', class_id: 'c-1', student_id: 'st-1' },
    { id: 'e-3', class_id: 'c-1', student_id: 'st-2' },
    { id: 'e-4', class_id: 'c-2', student_id: 'st-3' },
    { id: 'e-5', class_id: 'c-2', student_id: 'st-4' },
  ],
  class_schedules: [
    { id: 'sc-1', class_id: 'c-1', day_of_week: 1, start_time: '16:00', end_time: '18:00' },
    { id: 'sc-2', class_id: 'c-2', day_of_week: 3, start_time: '18:30', end_time: '20:30' },
  ],
  class_attendance_records: [
    { id: 'ar-1', academy_id: AC, class_id: 'c-1', student_id: 'st-me', date: new Date(Date.now() - 86400_000).toISOString().slice(0, 10), status: 'LATE', reason: null, recorded_at: ago(60 * 22) },
    { id: 'ar-2', academy_id: AC, class_id: 'c-1', student_id: 'st-me', date: new Date(Date.now() - 4 * 86400_000).toISOString().slice(0, 10), status: 'PRESENT', reason: null, recorded_at: ago(60 * 24 * 4) },
  ],
  attendance_logs: [],
  seat_reports: [
    { id: 'sr-1', academy_id: AC, seat_number: 3, reason: 'NOISE', resolved: false, resolved_at: null, created_at: ago(40) },
  ],
  student_passes: [
    { id: 'sp-2', academy_id: AC, student_id: 'st-me', pass_type: 'PERIOD', product_name: '기간권 1개월', remaining_minutes: null, expires_at: ago(-60 * 24 * 3), status: 'ACTIVE', payment_key: 'p', order_id: 'o1', amount: 120000, paid_at: ago(60 * 24 * 27), created_at: ago(60 * 24 * 27) },
    { id: 'sp-1', academy_id: AC, student_id: 'st-me', pass_type: 'TIME', product_name: '시간권 10시간', remaining_minutes: 95, expires_at: null, status: 'ACTIVE', payment_key: 'p', order_id: 'o2', amount: 15000, paid_at: ago(60 * 24 * 10), created_at: ago(60 * 24 * 10) },
  ],
  subscriptions: [],
  chat_rooms: [
    { id: 'r-ann', academy_id: AC, class_id: null, type: 'ANNOUNCEMENT', name: '전체 공지', created_at: ago(2000) },
    { id: 'r-c1', academy_id: AC, class_id: 'c-1', type: 'CLASS', name: '중3 수학 A', join_code: 'CLS3MATH', created_at: ago(1900) },
    { id: 'r-c2', academy_id: AC, class_id: 'c-2', type: 'CLASS', name: '고1 영어 B', join_code: 'CLS1ENGB', created_at: ago(1800) },
  ],
  chat_messages: [
    { id: 'm-1', room_id: 'r-ann', sender_id: 'u-t1', type: 'TEXT', content: '이번 주 토요일은 정기 휴무입니다. 참고해주세요.', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 26) },
    { id: 'm-2', room_id: 'r-c1', sender_id: 'u-t1', type: 'TEXT', content: '내일 단원평가 범위는 3단원까지입니다.', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 5) },
    { id: 'm-3', room_id: 'r-c1', sender_id: 'u-s1', type: 'TEXT', content: '선생님 문제집 몇 페이지까지인가요?', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 4) },
    { id: 'm-4', room_id: 'r-c1', sender_id: 'u-t1', type: 'TEXT', content: '85쪽까지 풀어오세요', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 3) },
    { id: 'm-5', room_id: 'r-c2', sender_id: 'u-t1', type: 'TEXT', content: '단어 시험은 금요일입니다.', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 20) },
  ],
  chat_room_reads: [],
  // 반 채팅방은 코드를 입력해 참가한 사람만 목록에 나옴 (공지방은 학원 전체)
  chat_room_members: [],
  teams: [
    { id: 'tm-1', academy_id: AC, name: '수학 스터디', description: '중3 수학 같이 풀어요', join_code: 'MATH2024', created_by: 'u-s1', created_at: ago(5000) },
    { id: 'tm-2', academy_id: AC, name: '영어 회화', description: '주 2회 회화 연습', join_code: 'ENGL1234', created_by: 'u-s2', created_at: ago(3000) },
  ],
  team_members: [
    { team_id: 'tm-1', user_id: 'u-s1', role: 'OWNER', joined_at: ago(5000) },
    { team_id: 'tm-1', user_id: 'u-s2', role: 'MEMBER', joined_at: ago(4900) },
    { team_id: 'tm-1', user_id: 'u-s3', role: 'MEMBER', joined_at: ago(4800) },
    { team_id: 'tm-2', user_id: 'u-s2', role: 'OWNER', joined_at: ago(3000) },
    { team_id: 'tm-2', user_id: 'u-s3', role: 'MEMBER', joined_at: ago(2800) },
  ],
  team_chat_rooms: [
    { id: 'tr-1', team_id: 'tm-1', type: 'TEAM', user_a: null, user_b: null, created_at: ago(5000) },
    { id: 'tr-2', team_id: 'tm-2', type: 'TEAM', user_a: null, user_b: null, created_at: ago(3000) },
  ],
  team_chat_messages: [
    { id: 1, room_id: 'tr-2', sender_id: 'u-s2', content: '다들 이번 주 목요일 괜찮아요?', created_at: ago(180) },
    { id: 2, room_id: 'tr-2', sender_id: 'u-s3', content: '저는 좋아요!', created_at: ago(170) },
  ],
};

const PASS_PLANS = [
  { id: 'time-10', passType: 'TIME', name: '시간권 10시간', amount: 15000, minutes: 600 },
  { id: 'time-30', passType: 'TIME', name: '시간권 30시간', amount: 42000, minutes: 1800 },
  { id: 'time-50', passType: 'TIME', name: '시간권 50시간', amount: 65000, minutes: 3000 },
  { id: 'period-30', passType: 'PERIOD', name: '기간권 1개월', amount: 120000, days: 30 },
  { id: 'period-90', passType: 'PERIOD', name: '기간권 3개월', amount: 330000, days: 90 },
] as { id: string; passType: 'TIME' | 'PERIOD'; name: string; amount: number; minutes?: number; days?: number }[];

// 오늘 수업 시드: 미리보기 학생이 출석 버튼을 바로 써볼 수 있도록 "방금 시작한" 수업을 하나 둔다
{
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  const mins = n.getHours() * 60 + n.getMinutes();
  const startM = Math.max(0, mins - 5);
  const endM = Math.min(23 * 60 + 59, mins + 180);
  const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  if (!db.class_schedules.some((x: any) => x.class_id === 'c-1' && x.day_of_week === n.getDay())) {
    db.class_schedules.push({ id: 'sc-today', class_id: 'c-1', day_of_week: n.getDay(), start_time: hm(startM), end_time: hm(endM) });
  }
}

// 스터디카페 5곳 추가 (총 7곳) — 규모와 혼잡도를 다양하게
db.academies.push(
  { id: 'a-3', name: '공부의정석 스터디카페 홍대점', kind: 'STUDY_CAFE', address: '서울 마포구 와우산로 94', latitude: 37.5563, longitude: 126.9236, total_seats: 24, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 40), created_at: ago(60 * 24 * 70) },
  { id: 'a-4', name: '집중시간 스터디카페 건대점', kind: 'STUDY_CAFE', address: '서울 광진구 능동로 120', latitude: 37.5404, longitude: 127.0692, total_seats: 20, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 25), created_at: ago(60 * 24 * 55) },
  { id: 'a-5', name: '탑클래스영어학원 잠실점', kind: 'ACADEMY', category: 'ENGLISH', address: '서울 송파구 올림픽로 240', latitude: 37.5133, longitude: 127.1002, total_seats: 30, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 12), created_at: ago(60 * 24 * 45) },
  { id: 'a-6', name: '더집중 스터디카페 노원점', kind: 'STUDY_CAFE', address: '서울 노원구 동일로 1414', latitude: 37.6554, longitude: 127.0614, total_seats: 16, subscription_status: 'TRIAL', subscription_expires_at: ago(-60 * 24 * 5), created_at: ago(60 * 24 * 20) },
  { id: 'a-8', name: '바다향 스터디카페 해운대점', kind: 'STUDY_CAFE', address: '부산광역시 해운대구 해운대로 570', latitude: 35.1631, longitude: 129.1635, total_seats: 22, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-9', name: '한솔종합학원 서면점', kind: 'ACADEMY', category: 'GENERAL', address: '부산 부산진구 서전로 10', latitude: 35.1579, longitude: 129.0597, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 18), created_at: ago(60 * 24 * 25) },
  { id: 'a-10', name: '플랜비 스터디카페 둔산점', kind: 'STUDY_CAFE', address: '대전광역시 서구 둔산로 100', latitude: 36.3504, longitude: 127.3845, total_seats: 20, subscription_status: 'TRIAL', subscription_expires_at: ago(-60 * 24 * 9), created_at: ago(60 * 24 * 10) },
  { id: 'a-7', name: '큐브코딩학원 판교점', kind: 'ACADEMY', category: 'CODING', address: '경기 성남시 분당구 판교역로 166', latitude: 37.3947, longitude: 127.1112, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 60), created_at: ago(60 * 24 * 15) },
  { id: 'a-11', name: '뉴턴과학학원 서초점', kind: 'ACADEMY', category: 'SCIENCE', address: '서울 서초구 서초대로 77길 54', latitude: 37.4947, longitude: 127.0148, total_seats: 14, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 33), created_at: ago(60 * 24 * 22) },
  { id: 'a-12', name: '정석수학학원 목동점', kind: 'ACADEMY', category: 'MATH', address: '서울 양천구 목동동로 233', latitude: 37.5265, longitude: 126.8647, total_seats: 16, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-13', name: '미래탐구과학학원 대치점', kind: 'ACADEMY', category: 'SCIENCE', address: '서울 강남구 대치동 905', latitude: 37.4946, longitude: 127.0627, total_seats: 14, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-14', name: '리딩앤라이팅영어학원 분당점', kind: 'ACADEMY', category: 'ENGLISH', address: '경기 성남시 분당구 서현로 180', latitude: 37.3835, longitude: 127.1207, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-15', name: '글빛논술학원 일산점', kind: 'ACADEMY', category: 'KOREAN', address: '경기 고양시 일산동구 중앙로 1160', latitude: 37.6584, longitude: 126.7683, total_seats: 12, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-16', name: '수담수학학원 광교점', kind: 'ACADEMY', category: 'MATH', address: '경기 수원시 영통구 광교중앙로 145', latitude: 37.2866, longitude: 127.0563, total_seats: 16, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-17', name: '코딩메이커학원 송도점', kind: 'ACADEMY', category: 'CODING', address: '인천 연수구 센트럴로 160', latitude: 37.3927, longitude: 126.6406, total_seats: 14, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-18', name: '스피킹플러스영어학원 유성점', kind: 'ACADEMY', category: 'ENGLISH', address: '대전 유성구 대학로 99', latitude: 36.3622, longitude: 127.3563, total_seats: 12, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-19', name: '사이언스랩학원 상무점', kind: 'ACADEMY', category: 'SCIENCE', address: '광주 서구 상무중앙로 110', latitude: 35.1527, longitude: 126.8519, total_seats: 14, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-20', name: '한빛종합학원 수성점', kind: 'ACADEMY', category: 'GENERAL', address: '대구 수성구 달구벌대로 2410', latitude: 35.8583, longitude: 128.6316, total_seats: 20, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-21', name: '또래국어학원 전주점', kind: 'ACADEMY', category: 'KOREAN', address: '전북 전주시 완산구 효자로 225', latitude: 35.8107, longitude: 127.1156, total_seats: 12, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-22', name: '탄탄수학학원 센텀점', kind: 'ACADEMY', category: 'MATH', address: '부산 해운대구 센텀중앙로 79', latitude: 35.169, longitude: 129.1306, total_seats: 16, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-23', name: '해든영어학원 노원점', kind: 'ACADEMY', category: 'ENGLISH', address: '서울 노원구 상계로 77', latitude: 37.6559, longitude: 127.0643, total_seats: 14, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-24', name: '스터디온 스터디카페 신촌점', kind: 'STUDY_CAFE', address: '서울 서대문구 신촌로 129', latitude: 37.5559, longitude: 126.9366, total_seats: 22, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-25', name: '모두의독서실 스터디카페 수원점', kind: 'STUDY_CAFE', address: '경기 수원시 팔달구 매산로 45', latitude: 37.266, longitude: 127.001, total_seats: 26, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-26', name: '열공카페 스터디카페 부산대점', kind: 'STUDY_CAFE', address: '부산 금정구 부산대학로63번길 2', latitude: 35.2316, longitude: 129.0842, total_seats: 24, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-27', name: '포커스온 스터디카페 동성로점', kind: 'STUDY_CAFE', address: '대구 중구 동성로 38', latitude: 35.869, longitude: 128.596, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-28', name: '이음 스터디카페 부평점', kind: 'STUDY_CAFE', address: '인천 부평구 부흥로 264', latitude: 37.4895, longitude: 126.7243, total_seats: 20, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-29', name: '아침달 스터디카페 충장로점', kind: 'STUDY_CAFE', address: '광주 동구 충장로 77', latitude: 35.1495, longitude: 126.9177, total_seats: 16, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-30', name: '몰입 스터디카페 영등포점', kind: 'STUDY_CAFE', address: '서울 영등포구 영중로 15', latitude: 37.516, longitude: 126.907, total_seats: 28, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 35) },
  { id: 'a-31', name: '온도 스터디카페 울산삼산점', kind: 'STUDY_CAFE', address: '울산 남구 삼산로 282', latitude: 35.5384, longitude: 129.339, total_seats: 20, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-32', name: '세움 스터디카페 세종나성점', kind: 'STUDY_CAFE', address: '세종 나성북로 28', latitude: 36.492, longitude: 127.257, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-33', name: '호반 스터디카페 춘천퇴계점', kind: 'STUDY_CAFE', address: '강원 춘천시 퇴계로 85', latitude: 37.853, longitude: 127.734, total_seats: 16, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-34', name: '파도소리 스터디카페 강릉교동점', kind: 'STUDY_CAFE', address: '강원 강릉시 임영로 151', latitude: 37.765, longitude: 128.902, total_seats: 14, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-35', name: '청춘독서실 스터디카페 청주성안길점', kind: 'STUDY_CAFE', address: '충북 청주시 상당구 상당로 85', latitude: 36.636, longitude: 127.489, total_seats: 22, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-36', name: '단단 스터디카페 천안두정점', kind: 'STUDY_CAFE', address: '충남 천안시 서북구 두정로 71', latitude: 36.833, longitude: 127.144, total_seats: 24, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-37', name: '한옥마을 스터디카페 전주객사점', kind: 'STUDY_CAFE', address: '전북 전주시 완산구 홍산로 24', latitude: 35.819, longitude: 127.148, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-38', name: '푸른바다 스터디카페 여수학동점', kind: 'STUDY_CAFE', address: '전남 여수시 학동서4길 18', latitude: 34.745, longitude: 127.737, total_seats: 16, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-39', name: '영일만 스터디카페 포항북구점', kind: 'STUDY_CAFE', address: '경북 포항시 북구 중앙로 255', latitude: 36.042, longitude: 129.366, total_seats: 20, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) },
  { id: 'a-40', name: '탐라 스터디카페 제주노형점', kind: 'STUDY_CAFE', address: '제주 제주시 노형로 407', latitude: 33.485, longitude: 126.478, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 30) }
);
// 지점 소개 정보(소개글·연락처·운영시간·특징) — 종류/과목에 맞게 자동 생성
{
  const AREA: Record<string, string> = {
    서울: '02', 경기: '031', 인천: '032', 부산: '051', 대구: '053', 대전: '042', 광주: '062', 울산: '052',
    세종: '044', 강원: '033', 충북: '043', 충남: '041', 전북: '063', 전남: '061', 경북: '054', 제주: '064',
  };
  const ACADEMY_DESC: Record<string, { text: string; features: string[] }> = {
    MATH: { text: '개념 이해부터 심화까지, 학년별 맞춤 커리큘럼으로 수학 실력을 단단하게 만드는 소수정예 수학 전문 학원입니다.', features: ['소수정예', '레벨 테스트', '오답 클리닉', '학부모 리포트'] },
    ENGLISH: { text: '읽기·듣기·말하기·쓰기를 균형 있게 다루는 영어 전문 학원. 레벨 테스트로 수준에 맞는 반을 배정합니다.', features: ['레벨 테스트', '원어민 수업', '단어 시험', '학부모 리포트'] },
    KOREAN: { text: '독해력과 논리적 글쓰기를 키우는 국어·논술 전문 학원. 첨삭 중심 수업으로 서술형 대비까지 챙깁니다.', features: ['첨삭 수업', '독서 토론', '서술형 대비', '학부모 리포트'] },
    SCIENCE: { text: '실험과 원리 중심으로 물리·화학·생명·지구과학을 가르치는 과학 전문 학원입니다.', features: ['실험 수업', '내신 대비', '소수정예', '학부모 리포트'] },
    CODING: { text: '파이썬·웹·알고리즘까지, 프로젝트 중심으로 배우는 코딩 전문 학원입니다.', features: ['프로젝트 수업', '1:1 코드 리뷰', '대회 준비', '학부모 리포트'] },
    GENERAL: { text: '국·영·수·과 전 과목을 학년별 맞춤반으로 운영하는 종합 학원. 자습실과 학습 관리를 함께 제공합니다.', features: ['전 과목', '자습실', '학습 관리', '학부모 리포트'] },
  };
  const CAFE_DESC = [
    { text: '조용한 집중석과 가벼운 대화가 가능한 오픈석을 나눠 운영하는 스터디카페. 개인 콘센트와 칸막이를 갖췄어요.', features: ['개인 콘센트', '칸막이 좌석', '무료 음료', '프린터'] },
    { text: '시험 기간에도 쾌적하게, 넉넉한 좌석과 스터디룸을 갖춘 24시간 무인 스터디카페입니다.', features: ['24시간', '스터디룸', '개인 콘센트', '무인 키오스크'] },
    { text: '노트북석과 컴퓨터석을 따로 운영하고, 커피·차를 무료로 제공하는 편안한 분위기의 스터디카페입니다.', features: ['노트북석', '컴퓨터석', '무료 음료', '사물함'] },
  ];
  db.academies.forEach((a: any, i: number) => {
    if (a.description) return;
    const sido = String(a.address).split(' ')[0].replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '');
    const code = AREA[sido] ?? '02';
    a.phone = `${code}-${String(300 + ((i * 37) % 600)).padStart(3, '0')}-${String(1000 + ((i * 7919) % 9000)).padStart(4, '0')}`;
    if (a.kind === 'ACADEMY') {
      const d = ACADEMY_DESC[a.category ?? 'GENERAL'] ?? ACADEMY_DESC.GENERAL;
      a.description = d.text;
      a.features = d.features;
      a.opening_hours = '평일 14:00 – 22:00 · 토 10:00 – 18:00 · 일 휴무';
    } else {
      const d = CAFE_DESC[i % CAFE_DESC.length];
      a.description = d.text;
      a.features = d.features;
      a.opening_hours = i % 2 === 0 ? '24시간 운영' : '매일 06:00 – 24:00';
    }
  });
}

// 지점별 혼잡도(점유율): 이후 좌석 생성에 사용
const OCCUPANCY: Record<string, number> = { [AC]: 0.35, 'a-2': 0.5, 'a-3': 0.75, 'a-4': 0.4, 'a-5': 0.9, 'a-6': 1, 'a-7': 0.2, 'a-8': 0.55, 'a-9': 0.3, 'a-10': 0.6, 'a-24': 0.45, 'a-25': 0.8, 'a-26': 0.6, 'a-27': 0.3, 'a-28': 0.92, 'a-29': 0.5, 'a-30': 0.7, 'a-31': 0.55, 'a-32': 0.35, 'a-33': 0.4, 'a-34': 0.65, 'a-35': 0.5, 'a-36': 0.85, 'a-37': 0.45, 'a-38': 0.3, 'a-39': 0.6, 'a-40': 0.5 };

// 지점별 좌석 생성 (존: 집중석 25% / 자유석 / 노트북·컴퓨터 / 큰 지점은 스터디룸)
for (const a of db.academies) {
  const total = a.total_seats as number;
  const occ = OCCUPANCY[a.id] ?? 0.4;
  const cols = total >= 24 ? 6 : 4;
  for (let i = 0; i < total; i++) {
    const zone =
      i < Math.ceil(total * 0.25) ? 'FOCUS' : total >= 24 && i >= total - 4 ? 'ROOM_A' : i >= total - 3 && total >= 16 ? (i % 2 ? 'LAPTOP' : 'DESK') : 'OPEN';
    const taken = ((i * 7 + 3) % total) / total < occ;
    db.seats.push({
      id: `${a.id}-s${i + 1}`,
      academy_id: a.id,
      seat_number: i + 1,
      zone_type: zone,
      grid_x: i % cols,
      grid_y: Math.floor(i / cols),
      status: taken ? (i % 9 === 4 ? 'AWAY' : 'OCCUPIED') : 'EMPTY',
      current_student_id: null,
    });
  }
}

// 내 학습 기록(최근 12일): 퇴실 로그에 이용 시간 기록 + 오늘은 현재 이용 중(입실 95분 전)
for (const dayOffset of [1, 2, 4, 5, 6, 8, 9, 11]) {
  const base = Date.now() - dayOffset * 86400_000;
  const stay = 50 + ((dayOffset * 37) % 140);
  db.attendance_logs.push(
    { id: uid(), academy_id: AC, student_id: 'st-me', seat_number: 7, type: 'CHECK_IN', check_method: 'QR', logged_at: new Date(base - stay * 60_000).toISOString(), stay_duration_minutes: 0 },
    { id: uid(), academy_id: AC, student_id: 'st-me', seat_number: 7, type: 'CHECK_OUT', check_method: 'QR', logged_at: new Date(base).toISOString(), stay_duration_minutes: stay }
  );
}
db.attendance_logs.push({ id: uid(), academy_id: AC, student_id: 'st-me', seat_number: 7, type: 'CHECK_IN', check_method: 'QR', logged_at: ago(95), stay_duration_minutes: 0 });
{
  // 학생이 이용 중인 좌석은 스터디카페(공부의정석 홍대점) 좌석 — 홈의 좌석 시간 카드에 스터디카페 이름이 나옵니다
  const mine = db.seats.find((s) => s.id === 'a-3-s7');
  if (mine) Object.assign(mine, { status: 'OCCUPIED', current_student_id: 'st-me', occupied_at: ago(95), zone_type: 'FOCUS' });
}

// ── Realtime 흉내 ──────────────────────────────────────
interface Listener {
  channel: object;
  event: string;
  table: string;
  filter?: string;
  cb: (payload: any) => void;
}
const listeners: Listener[] = [];

function emit(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', next: Row | null, old: Row | null) {
  const row = (next ?? old) as Row;
  setTimeout(() => {
    for (const l of [...listeners]) {
      if (l.table !== table) continue;
      if (l.event !== '*' && l.event !== eventType) continue;
      if (l.filter) {
        const m = /^(\w+)=eq\.(.+)$/.exec(l.filter);
        if (m && String(row[m[1]]) !== m[2]) continue;
      }
      l.cb({ eventType, new: next ?? {}, old: old ?? {}, table, schema: 'public' });
    }
  }, 0);
}

// ── 쿼리 빌더 ──────────────────────────────────────────
// "alias:table(cols)" 형태 조인 → 외래키 컬럼
const FK: Record<string, string> = {
  'chat_messages:profiles': 'sender_id',
  'classes:profiles': 'teacher_id',
  'class_enrollments:students': 'student_id',
  'team_members:teams': 'team_id',
  'chat_room_members:profiles': 'user_id',
  'academy_owner_invites:academies': 'academy_id',
};

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function pick(row: Row, cols: string): Row {
  if (cols.trim() === '*') return { ...row };
  const out: Row = {};
  for (const c of cols.split(',').map((x) => x.trim())) out[c] = row[c];
  return out;
}

function project(table: string, row: Row, select: string): Row {
  const out: Row = {};
  for (const item of splitTop(select)) {
    const m = /^(?:(\w+):)?(\w+)\(([^)]*)\)$/.exec(item);
    if (m) {
      const alias = m[1] ?? m[2];
      const relTable = m[2];
      const fk = FK[`${table}:${relTable}`];
      const rel = fk ? (db[relTable] ?? []).find((r) => r.id === row[fk]) : null;
      out[alias] = rel ? pick(rel, m[3]) : null;
    } else if (item === '*') {
      Object.assign(out, row);
    } else {
      out[item] = row[item];
    }
  }
  return out;
}

type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null };

class QB implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private filters: ((r: Row) => boolean)[] = [];
  private orderCol: string | null = null;
  private asc = true;
  private limitN: number | null = null;
  private selectStr = '*';
  private payload: any = null;
  private onConflict: string | null = null;
  private returning = false;
  private mode: 'single' | 'maybe' | null = null;
  private head = false;
  private wantCount = false;

  constructor(private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    this.selectStr = cols;
    if (this.op !== 'select') this.returning = true;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(p: any, o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict ?? null; return this; }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: any) { this.filters.push((r) => r[k] !== v); return this; }
  in(k: string, vs: any[]) { this.filters.push((r) => vs.includes(r[k])); return this; }
  is(k: string, v: any) { this.filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderCol = col; this.asc = o?.ascending ?? true; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private matches(rows: Row[]) { return rows.filter((r) => this.filters.every((f) => f(r))); }

  private run(): Result {
    const rows = (db[this.table] ??= []);
    const done = (list: Row[]): Result => {
      let data: any = list.map((r) => project(this.table, r, this.selectStr));
      if (this.mode) {
        if (data.length === 0) {
          return this.mode === 'single'
            ? { data: null, error: { message: '결과가 없습니다.', code: 'PGRST116' } }
            : { data: null, error: null };
        }
        data = data[0];
      }
      return { data, error: null };
    };

    switch (this.op) {
      case 'select': {
        let list = this.matches(rows);
        if (this.orderCol) {
          const c = this.orderCol;
          // 같은 값이면 입력 순서로 정렬(내림차순이면 나중에 만든 것이 먼저)
          const idx = new Map(list.map((r, i) => [r, i]));
          list = [...list].sort((a, b) => {
            const cmp = a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0;
            if (cmp !== 0) return cmp * (this.asc ? 1 : -1);
            return ((idx.get(a) ?? 0) - (idx.get(b) ?? 0)) * (this.asc ? 1 : -1);
          });
        }
        if (this.limitN != null) list = list.slice(0, this.limitN);
        if (this.head) return { data: null, error: null, count: list.length };
        const res = done(list);
        if (this.wantCount) res.count = list.length;
        return res;
      }
      case 'insert': {
        const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row) => {
          const row: Row = { ...p };
          if (row.id == null) row.id = this.table === 'team_chat_messages' ? ++seq : uid();
          if (!row.created_at) row.created_at = new Date().toISOString();
          return row;
        });
        // 반 채팅 방 이름 중복 등의 제약은 흉내 내지 않음
        for (const r of items) {
          rows.push(r);
          emit(this.table, 'INSERT', r, null);
          botReply(this.table, r);
        }
        return this.returning ? done(items) : { data: null, error: null };
      }
      case 'update': {
        const hit = this.matches(rows);
        for (const r of hit) {
          const old = { ...r };
          Object.assign(r, this.payload);
          emit(this.table, 'UPDATE', r, old);
        }
        return this.returning ? done(hit) : { data: null, error: null };
      }
      case 'delete': {
        const hit = this.matches(rows);
        db[this.table] = rows.filter((r) => !hit.includes(r));
        for (const r of hit) emit(this.table, 'DELETE', null, r);
        return { data: null, error: null };
      }
      case 'upsert': {
        const keys = (this.onConflict ?? 'id').split(',').map((k) => k.trim());
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const p of items) {
          const existing = rows.find((r) => keys.every((k) => r[k] === p[k]));
          if (existing) {
            const old = { ...existing };
            Object.assign(existing, p);
            emit(this.table, 'UPDATE', existing, old);
          } else {
            const row = { id: uid(), created_at: new Date().toISOString(), ...p };
            rows.push(row);
            emit(this.table, 'INSERT', row, null);
          }
        }
        return { data: null, error: null };
      }
    }
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return new Promise<Result>((resolve) => setTimeout(() => resolve(this.run()), 60)).then(onfulfilled, onrejected);
  }
}

// 상대방이 답장하는 것처럼 보이게 하는 봇 (반 채팅/팀 채팅에서 내가 보낸 메시지에만 반응)
const BOT_LINES = ['확인했어요!', '네 알겠습니다 :)', '좋아요, 그렇게 해요', '감사합니다!'];
function botReply(table: string, row: Row) {
  if (row.sender_id !== ME) return;
  if (table === 'chat_messages') {
    const room = db.chat_rooms.find((r) => r.id === row.room_id);
    if (!room || room.type !== 'CLASS' || row.type !== 'TEXT') return;
    setTimeout(() => {
      const r = { id: uid(), room_id: row.room_id, sender_id: 'u-t1', type: 'TEXT', content: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)], image_url: null, edited_at: null, metadata: null, created_at: new Date().toISOString() };
      db.chat_messages.push(r);
      emit('chat_messages', 'INSERT', r, null);
    }, 1400);
  }
  if (table === 'team_chat_messages') {
    const room = db.team_chat_rooms.find((r) => r.id === row.room_id);
    if (!room) return;
    const others = db.team_members.filter((m) => m.team_id === room.team_id && m.user_id !== ME);
    const from = room.type === 'DIRECT' ? (room.user_a === ME ? room.user_b : room.user_a) : others[0]?.user_id;
    if (!from) return;
    setTimeout(() => {
      const r = { id: ++seq, room_id: row.room_id, sender_id: from, content: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)], created_at: new Date().toISOString() };
      db.team_chat_messages.push(r);
      emit('team_chat_messages', 'INSERT', r, null);
    }, 1400);
  }
}

// ── RPC ───────────────────────────────────────────────
const nameOf = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? '알 수 없음';
const fail = (message: string): Result => ({ data: null, error: { message } });
const ok = (data: any): Result => ({ data, error: null });

function rpc(fn: string, args: Row): Result {
  switch (fn) {
    case 'create_team': {
      const id = uid();
      // 팀은 일반 회원이 만드는 스터디 모임이라 소속 학원 없이 만들어짐
      const team = { id, academy_id: null, name: args.p_name, description: args.p_description ?? null, join_code: genCode(), created_by: ME, created_at: new Date().toISOString() };
      db.teams.push(team);
      db.team_members.push({ team_id: id, user_id: ME, role: 'OWNER', joined_at: new Date().toISOString() });
      db.team_chat_rooms.push({ id: uid(), team_id: id, type: 'TEAM', user_a: null, user_b: null, created_at: new Date().toISOString() });
      return ok(team);
    }
    case 'student_check_in': {
      // 서버 함수 student_check_in 과 같은 규칙: 본인 반 + 오늘 수업 + (시작 30분 전 ~ 종료) + 하루 1회
      const st = db.students.find((x) => x.user_id === mockUserId && x.status === 'ACTIVE');
      if (!st) return fail('학원에 연동된 학생 계정이 아닙니다.');
      const cls = db.classes.find((c) => c.id === args.p_class_id && c.academy_id === st.academy_id);
      if (!cls) return fail('내 학원의 반이 아닙니다.');
      if (!db.class_enrollments.some((e) => e.class_id === cls.id && e.student_id === st.id)) return fail('이 반에 배정되어 있지 않습니다.');
      const d = new Date(Date.now());
      const today = d.toISOString().slice(0, 10);
      const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = db.class_attendance_records.find((r) => r.class_id === cls.id && r.student_id === st.id && (r.date === localToday || r.date === today));
      if (existing) return ok({ status: existing.status, already: true, class_id: cls.id, date: existing.date });
      const sch = db.class_schedules.filter((x) => x.class_id === cls.id && x.day_of_week === d.getDay()).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
      if (!sch) return fail('오늘은 이 반의 수업이 없습니다.');
      const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
      const nowM = d.getHours() * 60 + d.getMinutes();
      if (nowM < toMin(sch.start_time) - 30) return fail('아직 출석할 수 있는 시간이 아닙니다. (수업 30분 전부터 가능)');
      if (nowM > toMin(sch.end_time)) return fail('수업이 이미 끝났습니다.');
      const status = nowM > toMin(sch.start_time) + 10 ? 'LATE' : 'PRESENT';
      const rec = { id: uid(), academy_id: st.academy_id, class_id: cls.id, student_id: st.id, date: localToday, status, reason: null, note: '학생 출석 버튼', alert_sent: false, recorded_by: mockUserId, recorded_at: new Date().toISOString() };
      db.class_attendance_records.push(rec);
      emit('class_attendance_records', 'INSERT', rec, null);
      return ok({ status, already: false, class_id: cls.id, date: localToday });
    }
    case 'open_parent_room': {
      // 미리보기: 학생별 학부모 상담방을 찾거나 새로 만듦
      const st = db.students.find((x) => x.id === args.p_student_id);
      if (!st) return fail('상담방을 열 수 없습니다.');
      let room = db.chat_rooms.find((r) => r.type === 'PARENT' && r.student_id === st.id);
      if (!room) {
        room = { id: uid(), academy_id: st.academy_id, class_id: null, student_id: st.id, type: 'PARENT', name: `${st.name} 학부모 상담`, created_at: new Date().toISOString() };
        db.chat_rooms.push(room);
      }
      return ok(room.id);
    }
    case 'list_academy_chat_rooms': {
      const mine = db.chat_room_members.filter((m) => m.user_id === mockUserId).map((m) => m.room_id);
      const isStaff = db.profiles.find((p) => p.id === mockUserId)?.role === 'TEACHER' || db.profiles.find((p) => p.id === mockUserId)?.role === 'ACADEMY_ADMIN';
      return ok(
        db.chat_rooms
          .filter((r) => r.academy_id === args.p_academy_id)
          .map((r) => ({ id: r.id, name: r.name, type: r.type, class_id: r.class_id, created_at: r.created_at, joined: r.type === 'ANNOUNCEMENT' || isStaff || mine.includes(r.id) }))
          .sort((a, b) => Number(b.type === 'ANNOUNCEMENT') - Number(a.type === 'ANNOUNCEMENT'))
      );
    }
    case 'join_chat_room': {
      const room = db.chat_rooms.find((r) => r.id === args.p_room_id && r.type === 'CLASS');
      if (!room) return fail('참여할 수 없는 채팅방입니다.');
      if (!room.join_code || String(room.join_code).toUpperCase() !== String(args.p_password ?? '').trim().toUpperCase()) return fail('비밀번호가 맞지 않아요.');
      if (!db.chat_room_members.some((m) => m.room_id === room.id && m.user_id === mockUserId)) {
        db.chat_room_members.push({ room_id: room.id, user_id: mockUserId, joined_at: new Date().toISOString() });
      }
      return ok(room.id);
    }
    case 'join_chat_room_by_code': {
      const room = db.chat_rooms.find((r) => r.type === 'CLASS' && String(r.join_code ?? '').toUpperCase() === String(args.p_code).toUpperCase());
      if (!room) return fail('유효하지 않은 참가 코드입니다.');
      if (!db.chat_room_members.some((m) => m.room_id === room.id && m.user_id === ME)) {
        db.chat_room_members.push({ room_id: room.id, user_id: ME, joined_at: new Date().toISOString() });
      }
      return ok(room.id);
    }
    case 'join_team_by_code': {
      const team = db.teams.find((t) => t.join_code === String(args.p_code).toUpperCase());
      if (!team) return fail('유효하지 않은 참가 코드입니다.');
      if (!db.team_members.some((m) => m.team_id === team.id && m.user_id === ME)) {
        db.team_members.push({ team_id: team.id, user_id: ME, role: 'MEMBER', joined_at: new Date().toISOString() });
      }
      return ok(team.id);
    }
    case 'team_preview_by_code': {
      const team = db.teams.find((t) => t.join_code === String(args.p_code).toUpperCase());
      if (!team) return ok([]);
      return ok([
        {
          team_id: team.id,
          team_name: team.name,
          description: team.description,
          member_count: db.team_members.filter((m) => m.team_id === team.id).length,
          same_academy: true,
          already_member: db.team_members.some((m) => m.team_id === team.id && m.user_id === ME),
        },
      ]);
    }
    case 'list_team_members':
      return ok(
        db.team_members
          .filter((m) => m.team_id === args.p_team)
          .map((m) => ({
            member_id: m.user_id,
            member_name: nameOf(m.user_id),
            team_role: m.role,
            account_role: db.profiles.find((p) => p.id === m.user_id)?.role ?? 'STUDENT',
          }))
      );
    case 'start_direct_chat': {
      const existing = db.team_chat_rooms.find(
        (r) => r.team_id === args.p_team && r.type === 'DIRECT' && [r.user_a, r.user_b].includes(ME) && [r.user_a, r.user_b].includes(args.p_other)
      );
      if (existing) return ok(existing.id);
      const room = { id: uid(), team_id: args.p_team, type: 'DIRECT', user_a: ME, user_b: args.p_other, created_at: new Date().toISOString() };
      db.team_chat_rooms.push(room);
      return ok(room.id);
    }
    case 'kick_team_member':
      db.team_members = db.team_members.filter((m) => !(m.team_id === args.p_team && m.user_id === args.p_user));
      db.team_chat_rooms = db.team_chat_rooms.filter(
        (r) => !(r.team_id === args.p_team && r.type === 'DIRECT' && [r.user_a, r.user_b].includes(args.p_user))
      );
      return ok(null);
    case 'delete_team':
      db.teams = db.teams.filter((t) => t.id !== args.p_team);
      db.team_members = db.team_members.filter((m) => m.team_id !== args.p_team);
      db.team_chat_rooms = db.team_chat_rooms.filter((r) => r.team_id !== args.p_team);
      return ok(null);
    case 'regenerate_team_code': {
      const team = db.teams.find((t) => t.id === args.p_team);
      if (!team) return fail('팀을 찾을 수 없습니다.');
      team.join_code = genCode();
      return ok(team.join_code);
    }
    default:
      return ok(null);
  }
}

// ── 클라이언트 ─────────────────────────────────────────
export const mockSupabase = {
  from: (table: string) => new QB(table),
  rpc: (fn: string, args: Row = {}) =>
    new Promise<Result>((resolve) => setTimeout(() => resolve(rpc(fn, args)), 80)),
  channel: (_name: string) => {
    const ch: any = {
      on: (_type: string, cfg: { event: string; table: string; filter?: string }, cb: (p: any) => void) => {
        listeners.push({ channel: ch, event: cfg.event, table: cfg.table, filter: cfg.filter, cb });
        return ch;
      },
      subscribe: () => ch,
    };
    return ch;
  },
  removeChannel: (ch: object) => {
    for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].channel === ch) listeners.splice(i, 1);
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: { path: 'preview' }, error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: 'https://placehold.co/600x400/png?text=Preview' }, error: null }),
    }),
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: '미리보기 모드에서는 로그인할 수 없습니다.' } }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};

/** 미리보기용 backend API 흉내 (일부 엔드포인트만) */
let teacherInviteCode = 'TCHR2024';

export function mockApi(path: string, method: string, body: any): any {
  if (path === '/api/chat/announce') {
    const r = { id: uid(), room_id: body.roomId, sender_id: ME, type: 'TEXT', content: body.content, image_url: null, edited_at: null, metadata: null, created_at: new Date().toISOString() };
    db.chat_messages.push(r);
    emit('chat_messages', 'INSERT', r, null);
    return { ok: true };
  }
  if (path === '/api/owner/academies' && method === 'POST') {
    if (!String(body.name ?? '').trim() || !String(body.address ?? '').trim()) throw new Error('학원 이름과 주소는 필수입니다.');
    const academy = { id: uid(), name: String(body.name).trim(), kind: 'ACADEMY', address: String(body.address).trim(), latitude: 37.5665, longitude: 126.978, total_seats: 20, subscription_status: 'TRIAL', subscription_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(), created_at: new Date().toISOString() };
    db.academies.push(academy);
    return { success: true, academy, teacherInviteCode: 'TCHR2024' };
  }
  if (path === '/api/owner/teacher-invite' && method === 'GET') return { code: teacherInviteCode };
  if (path === '/api/owner/teacher-invite/regenerate' && method === 'POST') {
    teacherInviteCode = genCode();
    return { code: teacherInviteCode };
  }
  if (path === '/api/teacher-invite/join' && method === 'POST') {
    if (String(body.code ?? '').trim().toUpperCase() !== teacherInviteCode) throw new Error('유효하지 않은 초대 코드입니다.');
    return { success: true, academy: { id: AC, name: db.academies[0].name } };
  }
  if (path === '/api/attendance' && method === 'PUT') {
    const rows = db.class_attendance_records;
    const existing = rows.find((r) => r.class_id === body.classId && r.student_id === body.studentId && r.date === body.date);
    if (existing) {
      const old = { ...existing };
      Object.assign(existing, { status: body.status, reason: body.reason ?? null });
      emit('class_attendance_records', 'UPDATE', existing, old);
    } else {
      const r = { id: uid(), academy_id: AC, class_id: body.classId, student_id: body.studentId, date: body.date, status: body.status, reason: body.reason ?? null, note: null, alert_sent: false };
      rows.push(r);
      emit('class_attendance_records', 'INSERT', r, null);
    }
    return { alertSent: false };
  }
  if (path === '/api/student-link/link') {
    // 실제 백엔드와 같은 규칙: 6자리, 이미 연동된 계정/학생이면 거절, 성공하면 students.user_id 를 내 계정으로
    const code = String(body.linkCode ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new Error('6자리 숫자 코드를 입력해주세요.');
    if (db.students.some((x) => x.user_id === mockUserId)) throw new Error('이미 연동된 학생 계정이 있습니다.');
    const st = db.students.find((x) => x.link_code === code);
    if (!st) throw new Error('일치하는 학생이 없습니다.');
    if (st.user_id && st.user_id !== mockUserId) throw new Error('이미 다른 계정과 연동된 학생입니다.');
    st.user_id = mockUserId;
    return { success: true, student: { id: st.id, name: st.name } };
  }
  if (path === '/api/auth/register') {
    return { ok: true };
  }
  if (path === '/api/parent/children') {
    return { data: [{ id: 'st-1', name: '김민지', academy_id: AC, attendance_code: '222222', status: 'ACTIVE' }] };
  }
  if (path.startsWith('/api/parent/report')) {
    const d = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
    return {
      range: { from: d(6), to: d(0) },
      attendanceRate: 83,
      totalStudyMinutes: 1260,
      records: [
        { date: d(5), status: 'PRESENT', reason: null },
        { date: d(3), status: 'LATE', reason: null },
        { date: d(1), status: 'PRESENT', reason: null },
      ],
    };
  }
  if (path === '/api/student-passes/plans') {
    return { plans: PASS_PLANS };
  }
  if (path === '/api/student-passes/confirm') {
    const plan = PASS_PLANS.find((p) => p.id === body.planId);
    if (!plan) throw new Error('존재하지 않는 이용권입니다.');
    const now = new Date();
    const pass = {
      id: uid(),
      academy_id: AC,
      student_id: 'st-me',
      pass_type: plan.passType,
      product_name: plan.name,
      remaining_minutes: plan.passType === 'TIME' ? plan.minutes : null,
      expires_at: plan.passType === 'PERIOD' ? new Date(now.getTime() + (plan.days ?? 30) * 86400_000).toISOString() : null,
      status: 'ACTIVE',
      payment_key: body.paymentKey,
      order_id: body.orderId,
      amount: plan.amount,
      paid_at: now.toISOString(),
      created_at: now.toISOString(),
    };
    db.student_passes.push(pass);
    return { pass };
  }
  if (path === '/api/payments/confirm') {
    const expires = new Date(Date.now() + 30 * 86400_000).toISOString();
    const academy = db.academies.find((a) => a.id === AC);
    if (academy) Object.assign(academy, { subscription_status: 'ACTIVE', subscription_expires_at: expires });
    db.subscriptions.push({ id: uid(), academy_id: AC, order_id: body.orderId, amount: body.amount, status: 'PAID', paid_at: new Date().toISOString(), expires_at: expires, created_at: new Date().toISOString() });
    return { expiresAt: expires };
  }
  return undefined;
}
