import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

const ROLE_LABEL: Record<Profile['role'], string> = {
  SUPER_ADMIN: '슈퍼 관리자',
  ACADEMY_ADMIN: '학원 원장',
  TEACHER: '강사',
  STUDENT: '학생',
  PARENT: '학부모',
};

export default function HomeScreen({ profile }: { profile: Profile }) {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{profile.name}님, 안녕하세요</Text>
      <View style={styles.card}>
        <Row label="역할" value={ROLE_LABEL[profile.role]} />
        <Row label="이메일" value={profile.email} />
        {profile.role === 'TEACHER' && (
          <Row label="승인 상태" value={profile.approval_status} />
        )}
      </View>
      <Text style={styles.hint}>
        이 화면은 웹(frontend)과 같은 Supabase 프로젝트의 profiles 테이블을 읽어옵니다.
        화면(지도·키오스크·대시보드 등)은 이 스캐폴딩 위에 이어서 만들면 됩니다.
      </Text>
      <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.button}>
        <Text style={styles.buttonText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    backgroundColor: '#F9FAFB',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
    marginBottom: 24,
  },
  button: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});
