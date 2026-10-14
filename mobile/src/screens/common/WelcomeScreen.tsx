import { useRef, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { academyImage, cafeImage } from '../../lib/cafeImages';
import { markWelcomeDone } from '../../lib/welcome';
import { colors, radius } from '../../theme';
import type { RootNav, RootStackParamList } from '../../navigation/types';

const PAGES = [
  {
    image: cafeImage('a-3'),
    title: '학원과 스터디카페를\n한 곳에서 찾아요',
    desc: '지도를 움직이며 내 주변 학원과 스터디카페를 둘러보고, 실시간 잔여석도 확인하세요.',
  },
  {
    image: academyImage('a-5'),
    title: '출결과 시간표를\n간편하게 챙겨요',
    desc: 'QR 한 번으로 입실·퇴실을 기록하고, 오늘 수업과 공지를 홈에서 바로 확인해요.',
  },
  {
    image: academyImage('00000000-0000-0000-0000-000000000001'),
    title: '학부모도 원장님도\n함께 쓰는 서비스',
    desc: '학부모는 자녀의 출결 리포트를, 원장·강사는 학생과 반 관리를 한 곳에서 해요.',
  },
];

/** 앱을 처음 열 때 보여주는 소개 화면. 내 정보에서 다시 볼 수도 있습니다. */
export default function WelcomeScreen() {
  const navigation = useNavigation<RootNav>();
  const replay = useRoute<RouteProp<RootStackParamList, 'Welcome'>>().params?.replay;
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const width = Dimensions.get('window').width;
  const last = page === PAGES.length - 1;

  const finish = async (next: 'Main' | 'Login') => {
    await markWelcomeDone();
    if (replay && next === 'Main') return navigation.goBack();
    navigation.reset({ index: 0, routes: next === 'Login' ? [{ name: 'Main' }, { name: 'Login' }] : [{ name: 'Main' }] });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (last) return;
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.brand}>SafeStep</Text>
        {!last && (
          <Pressable onPress={() => finish('Main')} hitSlop={10}>
            <Text style={styles.skip}>건너뛰기</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flexGrow: 0 }}
      >
        {PAGES.map((p, i) => (
          <View key={i} style={{ width, paddingHorizontal: 24 }}>
            <Image source={p.image} style={styles.photo} resizeMode="cover" />
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.desc}>{p.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>

      <View style={styles.actions}>
        {last ? (
          <>
            <Pressable onPress={() => finish('Login')} style={styles.primary}>
              <Text style={styles.primaryText}>로그인 / 회원가입</Text>
            </Pressable>
            <Pressable onPress={() => finish('Main')} style={styles.secondary}>
              <Text style={styles.secondaryText}>먼저 둘러볼게요</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={next} style={styles.primary}>
            <Text style={styles.primaryText}>다음</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  brand: { fontSize: 15, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
  skip: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  photo: { width: '100%', height: 300, borderRadius: 28, backgroundColor: colors.graySoft, marginTop: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8, lineHeight: 37, marginTop: 28 },
  desc: { fontSize: 15, color: colors.textSub, lineHeight: 23, marginTop: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D9DEE5' },
  dotOn: { width: 22, backgroundColor: colors.primary },
  actions: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 12, gap: 10 },
  primary: { height: 54, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '800', color: colors.white },
  secondary: { height: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.textSub },
});
