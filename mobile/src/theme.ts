import { Platform } from 'react-native';

// 웹(Tailwind) 팔레트 기반 + 앱다운 부드러운 톤으로 다듬은 색상 토큰
export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySoft: '#EAF1FF',
  indigo: '#4F46E5',
  indigoSoft: '#ECEBFF',
  bg: '#F3F5F9',
  card: '#FFFFFF',
  border: '#E8EBF0',
  borderStrong: '#D5DAE1',
  text: '#0F172A',
  textSub: '#5B6577',
  textMuted: '#98A2B3',
  danger: '#EF4444',
  dangerSoft: '#FEECEC',
  dangerText: '#D92D20',
  success: '#12A150',
  successSoft: '#E6F7EE',
  warn: '#F59E0B',
  warnSoft: '#FFF4DB',
  warnText: '#B54708',
  gray: '#667085',
  graySoft: '#F0F2F5',
  white: '#FFFFFF',
  dark: '#0F172A',
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** 카드/시트에 쓰는 부드러운 그림자 (iOS shadow + Android elevation) */
export const shadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 2 },
  default: {},
}) as object;
