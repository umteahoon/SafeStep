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
    { id: AC, name: 'SafeStep 강남점', address: '서울 강남구 테헤란로 123', latitude: 37.4979, longitude: 127.0276, total_seats: 12, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 20), created_at: ago(60 * 24 * 90) },
    { id: 'a-2', name: 'SafeStep 신촌점', address: '서울 서대문구 연세로 50', latitude: 37.5551, longitude: 126.9368, total_seats: 12, subscription_status: 'TRIAL', subscription_expires_at: ago(-60 * 24 * 7), created_at: ago(60 * 24 * 30) },
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
    { id: 'r-c1', academy_id: AC, class_id: 'c-1', type: 'CLASS', name: '중3 수학 A', created_at: ago(1900) },
    { id: 'r-c2', academy_id: AC, class_id: 'c-2', type: 'CLASS', name: '고1 영어 B', created_at: ago(1800) },
  ],
  chat_messages: [
    { id: 'm-1', room_id: 'r-ann', sender_id: 'u-t1', type: 'TEXT', content: '이번 주 토요일은 정기 휴무입니다. 참고해주세요.', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 26) },
    { id: 'm-2', room_id: 'r-c1', sender_id: 'u-t1', type: 'TEXT', content: '내일 단원평가 범위는 3단원까지입니다.', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 5) },
    { id: 'm-3', room_id: 'r-c1', sender_id: 'u-s1', type: 'TEXT', content: '선생님 문제집 몇 페이지까지인가요?', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 4) },
    { id: 'm-4', room_id: 'r-c1', sender_id: 'u-t1', type: 'TEXT', content: '85쪽까지 풀어오세요', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 3) },
    { id: 'm-5', room_id: 'r-c2', sender_id: 'u-t1', type: 'TEXT', content: '단어 시험은 금요일입니다.', image_url: null, edited_at: null, metadata: null, created_at: ago(60 * 20) },
  ],
  chat_room_reads: [],
  teams: [
    { id: 'tm-1', academy_id: AC, name: '수학 스터디', description: '중3 수학 같이 풀어요', join_code: 'MATH2024', created_by: 'u-s1', created_at: ago(5000) },
    { id: 'tm-2', academy_id: AC, name: '영어 회화', description: '주 2회 회화 연습', join_code: 'ENGL1234', created_by: 'u-s2', created_at: ago(3000) },
  ],
  team_members: [
    { team_id: 'tm-1', user_id: 'u-s1', role: 'OWNER', joined_at: ago(5000) },
    { team_id: 'tm-1', user_id: 'u-s2', role: 'MEMBER', joined_at: ago(4900) },
    { team_id: 'tm-1', user_id: 'u-s3', role: 'MEMBER', joined_at: ago(4800) },
    { team_id: 'tm-2', user_id: 'u-s2', role: 'OWNER', joined_at: ago(3000) },
    { team_id: 'tm-2', user_id: ME, role: 'MEMBER', joined_at: ago(2900) },
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

// 커뮤니티 시드: 지점별 게시글·댓글·좋아요
db.community_posts = [
  { id: 'cp-1', academy_id: AC, author_id: 'u-own', category: 'FREE', title: '이번 주 금요일 야간 개방 안내', content: '시험 기간을 맞아 이번 주 금요일은 새벽 2시까지 운영합니다. 집중석은 선착순이니 일찍 오세요.', created_at: ago(60 * 5) },
  { id: 'cp-2', academy_id: AC, author_id: 'u-s1', category: 'QUESTION', title: '콘센트 있는 자리는 어디가 좋아요?', content: '노트북을 오래 써야 하는데 집중석에도 콘센트가 있나요? 처음 가보려고 해요.', created_at: ago(60 * 3) },
  { id: 'cp-3', academy_id: AC, author_id: 'u-s4', category: 'REVIEW', title: '집중석 한 달 써본 후기', content: '칸막이가 높아서 시선이 신경 안 쓰이고, 에어컨 바람도 세지 않아서 좋았어요. 다만 점심시간 직후엔 자리가 빨리 차요.', created_at: ago(60 * 26) },
  { id: 'cp-4', academy_id: AC, author_id: 'u-s5', category: 'STUDY', title: '평일 저녁 토익 스터디 구해요', content: '평일 7~9시에 같이 공부할 분 2~3명 모집합니다. 목표 점수 850 이상이면 좋아요!', created_at: ago(60 * 30) },
  { id: 'cp-5', academy_id: 'a-3', author_id: 'u-s6', category: 'REVIEW', title: '홍대점 스터디룸 후기', content: '4인 룸 예약해서 조별과제 했는데 화이트보드가 있어서 편했어요. 방음도 괜찮았습니다.', created_at: ago(60 * 8) },
  { id: 'cp-6', academy_id: 'a-3', author_id: 'u-s1', category: 'FREE', title: '주말 오전엔 거의 만석이에요', content: '토요일 10시 전에 가야 자리 있어요. 참고하세요.', created_at: ago(60 * 20) },
  { id: 'cp-7', academy_id: 'a-5', author_id: 'u-s2', category: 'QUESTION', title: '야간 이용권 따로 있나요?', content: '밤 10시 이후에만 이용하는 요금제가 있는지 궁금해요.', created_at: ago(60 * 12) },
  { id: 'cp-8', academy_id: 'a-5', author_id: 'u-s3', category: 'FREE', title: '잠실점 오늘 많이 붐비네요', content: '시험 기간이라 그런지 오후에 자리가 거의 없어요. 일찍 오세요.', created_at: ago(90) },
  { id: 'cp-9', academy_id: 'a-7', author_id: 'u-s4', category: 'STUDY', title: '판교점 코딩테스트 스터디', content: '주 2회 알고리즘 문제 풀이 스터디 같이 하실 분. 언어 무관, 초중급 환영해요.', created_at: ago(60 * 40) },
  { id: 'cp-10', academy_id: 'a-4', author_id: 'u-s5', category: 'REVIEW', title: '건대점 노트북존 좋네요', content: '탁 트인 창가 자리에서 공부하니 집중이 잘 돼요. 커피 한 잔 들고 가기 좋아요.', created_at: ago(60 * 15) },
];
db.community_comments = [
  { id: 'cc-1', post_id: 'cp-2', author_id: 'u-s4', content: '집중석 칸마다 콘센트 있어요! 1~4번 추천해요.', created_at: ago(60 * 2) },
  { id: 'cc-2', post_id: 'cp-2', author_id: 'u-own', content: '노트북 사용은 노트북존(카페존)도 편하게 쓰실 수 있어요.', created_at: ago(60 * 1) },
  { id: 'cc-3', post_id: 'cp-3', author_id: 'u-s1', content: '저도 집중석 좋아요. 후기 감사합니다!', created_at: ago(60 * 20) },
  { id: 'cc-4', post_id: 'cp-4', author_id: 'u-s6', content: '관심 있어요! 쪽지 어떻게 드리면 될까요?', created_at: ago(60 * 28) },
  { id: 'cc-5', post_id: 'cp-8', author_id: 'u-s2', content: '저도 방금 갔는데 만석이었어요 ㅠ', created_at: ago(60) },
  { id: 'cc-6', post_id: 'cp-5', author_id: 'u-s3', content: '스터디룸 예약은 어떻게 하나요?', created_at: ago(60 * 6) },
];
db.community_likes = [
  { post_id: 'cp-1', user_id: 'u-s1' }, { post_id: 'cp-1', user_id: 'u-s2' }, { post_id: 'cp-1', user_id: 'u-s3' }, { post_id: 'cp-1', user_id: 'u-s4' },
  { post_id: 'cp-2', user_id: 'u-s5' }, { post_id: 'cp-3', user_id: 'u-s1' }, { post_id: 'cp-3', user_id: 'u-s5' }, { post_id: 'cp-3', user_id: 'u-s6' },
  { post_id: 'cp-5', user_id: 'u-s1' }, { post_id: 'cp-5', user_id: 'u-s2' }, { post_id: 'cp-8', user_id: 'u-s1' }, { post_id: 'cp-9', user_id: 'u-s6' },
];

// 스터디카페 5곳 추가 (총 7곳) — 규모와 혼잡도를 다양하게
db.academies.push(
  { id: 'a-3', name: 'SafeStep 홍대점', address: '서울 마포구 와우산로 94', latitude: 37.5563, longitude: 126.9236, total_seats: 24, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 40), created_at: ago(60 * 24 * 70) },
  { id: 'a-4', name: 'SafeStep 건대점', address: '서울 광진구 능동로 120', latitude: 37.5404, longitude: 127.0692, total_seats: 20, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 25), created_at: ago(60 * 24 * 55) },
  { id: 'a-5', name: 'SafeStep 잠실점', address: '서울 송파구 올림픽로 240', latitude: 37.5133, longitude: 127.1002, total_seats: 30, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 12), created_at: ago(60 * 24 * 45) },
  { id: 'a-6', name: 'SafeStep 노원점', address: '서울 노원구 동일로 1414', latitude: 37.6554, longitude: 127.0614, total_seats: 16, subscription_status: 'TRIAL', subscription_expires_at: ago(-60 * 24 * 5), created_at: ago(60 * 24 * 20) },
  { id: 'a-8', name: 'SafeStep 해운대점', address: '부산광역시 해운대구 해운대로 570', latitude: 35.1631, longitude: 129.1635, total_seats: 22, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 30), created_at: ago(60 * 24 * 40) },
  { id: 'a-9', name: 'SafeStep 서면점', address: '부산 부산진구 서전로 10', latitude: 35.1579, longitude: 129.0597, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 18), created_at: ago(60 * 24 * 25) },
  { id: 'a-10', name: 'SafeStep 둔산점', address: '대전광역시 서구 둔산로 100', latitude: 36.3504, longitude: 127.3845, total_seats: 20, subscription_status: 'TRIAL', subscription_expires_at: ago(-60 * 24 * 9), created_at: ago(60 * 24 * 10) },
  { id: 'a-7', name: 'SafeStep 판교점', address: '경기 성남시 분당구 판교역로 166', latitude: 37.3947, longitude: 127.1112, total_seats: 18, subscription_status: 'ACTIVE', subscription_expires_at: ago(-60 * 24 * 60), created_at: ago(60 * 24 * 15) }
);
// 지점별 혼잡도(점유율): 이후 좌석 생성에 사용
const OCCUPANCY: Record<string, number> = { [AC]: 0.35, 'a-2': 0.5, 'a-3': 0.75, 'a-4': 0.4, 'a-5': 0.9, 'a-6': 1, 'a-7': 0.2, 'a-8': 0.55, 'a-9': 0.3, 'a-10': 0.6 };

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
  const mine = db.seats.find((s) => s.id === `${AC}-s7`);
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
  'academy_owner_invites:academies': 'academy_id',
  'community_posts:profiles': 'author_id',
  'community_comments:profiles': 'author_id',
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
      const team = { id, academy_id: AC, name: args.p_name, description: args.p_description ?? null, join_code: genCode(), created_by: ME, created_at: new Date().toISOString() };
      db.teams.push(team);
      db.team_members.push({ team_id: id, user_id: ME, role: 'OWNER', joined_at: new Date().toISOString() });
      db.team_chat_rooms.push({ id: uid(), team_id: id, type: 'TEAM', user_a: null, user_b: null, created_at: new Date().toISOString() });
      return ok(team);
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
export function mockApi(path: string, method: string, body: any): any {
  if (path === '/api/chat/announce') {
    const r = { id: uid(), room_id: body.roomId, sender_id: ME, type: 'TEXT', content: body.content, image_url: null, edited_at: null, metadata: null, created_at: new Date().toISOString() };
    db.chat_messages.push(r);
    emit('chat_messages', 'INSERT', r, null);
    return { ok: true };
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
