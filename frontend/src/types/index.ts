export type UserRole =
  | 'SUPER_ADMIN'
  | 'ACADEMY_ADMIN'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  academy_id: string | null;
  approval_status: ApprovalStatus;
  phone: string | null;
  created_at: string;
}

export interface Academy {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  total_seats: number;
  subscription_status: 'TRIAL' | 'ACTIVE' | 'EXPIRED';
  subscription_expires_at: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  academy_id: string;
  payment_key: string | null;
  order_id: string;
  amount: number;
  status: string;
  paid_at: string;
  expires_at: string;
  created_at: string;
}

export interface Class {
  id: string;
  academy_id: string;
  teacher_id: string | null;
  name: string;
  color_code: string;
  created_at: string;
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  day_of_week: number; // 0(일) ~ 6(토)
  start_time: string; // 'HH:MM'
  end_time: string;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string | null;
  academy_id: string;
  name: string;
  attendance_code: string;
  qr_token: string;
  parent_user_id: string | null;
  parent_phone: string;
  link_code: string;
  parent_view_token: string;
  status: string;
  created_at: string;
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  enrolled_at: string;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface ClassAttendanceRecord {
  id: string;
  academy_id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  reason: string | null;
  note: string | null;
  alert_sent: boolean;
  recorded_by: string | null;
  recorded_at: string;
}

export type AbsenceRequestType = 'ABSENCE' | 'LATE';
export type AbsenceRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AbsenceRequest {
  id: string;
  academy_id: string;
  student_id: string;
  class_id: string | null;
  date: string;
  type: AbsenceRequestType;
  reason: string | null;
  status: AbsenceRequestStatus;
  requested_by: string | null;
  created_at: string;
}

export type ChatRoomType = 'CLASS' | 'ANNOUNCEMENT';

export interface ChatRoom {
  id: string;
  academy_id: string;
  class_id: string | null;
  type: ChatRoomType;
  name: string;
  created_at: string;
}

export type ChatMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'ATTENDANCE_CHECK'
  | 'ATTENDANCE_RESPONSE'
  | 'SYSTEM';

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string | null;
  type: ChatMessageType;
  content: string | null;
  image_url: string | null;
  edited_at: string | null;
  metadata: { classId?: string; date?: string } | null;
  created_at: string;
  sender?: { name: string } | null;
}

export interface ChatRoomRead {
  user_id: string;
  room_id: string;
  last_read_at: string;
}

export type SeatStatus = 'EMPTY' | 'OCCUPIED' | 'AWAY';

export interface Seat {
  id: string;
  academy_id: string;
  seat_number: number;
  zone_type: string;
  grid_x: number;
  grid_y: number;
  status: SeatStatus;
  current_student_id: string | null;
  occupied_at: string | null;
  away_at: string | null;
}

// ── 팀 / 채팅 ──────────────────────────────────────────────
export interface Team {
  id: string;
  academy_id: string;
  name: string;
  description: string | null;
  join_code: string;
  created_by: string;
  created_at: string;
}

export interface TeamMember {
  member_id: string;
  member_name: string;
  team_role: 'OWNER' | 'MEMBER';
  account_role: UserRole;
}

export interface TeamChatRoom {
  id: string;
  team_id: string;
  type: 'TEAM' | 'DIRECT';
  user_a: string | null;
  user_b: string | null;
}

export interface TeamChatMessage {
  id: number;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
