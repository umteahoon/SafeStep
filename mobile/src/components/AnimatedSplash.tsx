import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { colors } from '../theme';

// 앱 시작 스플래시: 로고(필기체 그라데이션) + 부제목이 튕기며 등장 → 발자국 아이콘이 걸음 걷듯 흔들림 → 약 2.1초 후 종료.
// 다음 화면 결정(소개 화면 / 메인)은 RootNavigator 가 이 애니메이션이 도는 동안 미리 해 둡니다.

const LOGO = 'SafeStep';
const SUBTITLE = '학원 출결 · 스터디카페 좌석';
const MAIN = colors.primary; // #2563EB
const GRADIENT_START = '#5B9BFF';
export const SPLASH_BG = { light: '#FFFFFF', dark: '#0B0F1A' };

const FONT_SIZE = 72;
// 필기체 꼬리가 잘리지 않게 오른쪽 24 · 아래 8 여백
const PAD_RIGHT = 24;
const PAD_BOTTOM = 8;
const LOGO_W = 330 + PAD_RIGHT;
const LOGO_H = 112 + PAD_BOTTOM;
const BASELINE = 82;

const useNative = Platform.OS !== 'web';
const wait = (ms: number) => Animated.delay(ms);

// 네온 빛: 같은 글자를 메인 색으로 한 겹 더 깔고 그림자 2개(흐림 40 · 80).
// 웹은 글자 모양을 따라가는 drop-shadow, iOS 는 뷰 그림자(글자 알파를 따라감)
const GLOW_STYLE =
  Platform.OS === 'web'
    ? ({ filter: `drop-shadow(0 0 20px ${MAIN}) drop-shadow(0 0 40px ${MAIN})` } as object)
    : { shadowColor: MAIN, shadowOpacity: 1, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } };

/** 그라데이션 글자 로고 (왼쪽 위 밝은 파랑 → 오른쪽 아래 메인 파랑) */
function GradientLogo({ width, solid }: { width: number; solid?: string }) {
  return (
    <Svg width={width} height={(width * LOGO_H) / LOGO_W} viewBox={`0 0 ${LOGO_W} ${LOGO_H}`}>
      <Defs>
        <LinearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={GRADIENT_START} />
          <Stop offset="1" stopColor={MAIN} />
        </LinearGradient>
      </Defs>
      <SvgText
        x={(LOGO_W - PAD_RIGHT) / 2}
        y={BASELINE}
        textAnchor="middle"
        fontFamily="Pacifico_400Regular"
        fontSize={FONT_SIZE}
        fill={solid ?? 'url(#logoGrad)'}
      >
        {LOGO}
      </SvgText>
    </Svg>
  );
}

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const dark = useColorScheme() === 'dark';
  const { width: screenW } = useWindowDimensions();
  const logoW = Math.min(LOGO_W, screenW - 32);
  // 폰트를 못 불러와도(오프라인 등) 1.5초 뒤에는 시작 — 스플래시에서 멈추지 않게
  const [fontsLoaded, fontError] = useFonts({ Pacifico_400Regular });
  const [fontTimeout, setFontTimeout] = useState(false);
  const ready = fontsLoaded || !!fontError || fontTimeout;

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const glow = useRef(new Animated.Value(0.4)).current;
  const glowOn = useRef(new Animated.Value(0)).current;
  const iconFade = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const running: Animated.CompositeAnimation[] = [];
    const run = (a: Animated.CompositeAnimation) => {
      running.push(a);
      a.start();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) {
          // 동작 줄이기: 튕김 · 흔들기 · 빛 없이 페이드만
          scale.setValue(1);
          run(
            Animated.sequence([
              wait(200),
              Animated.parallel([
                Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: useNative }),
                Animated.timing(iconFade, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: useNative }),
              ]),
            ])
          );
          timers.push(setTimeout(() => alive && finishRef.current(), 1600));
          return;
        }

        // 1) 0.2초 뒤 로고 + 부제목 등장 (투명도 0.7초 easeIn, 크기 0.9초 elasticOut)
        run(
          Animated.sequence([
            wait(200),
            Animated.parallel([
              Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: useNative }),
              Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.out(Easing.elastic(1.2)), useNativeDriver: useNative }),
            ]),
          ])
        );

        // 2) 0.6초 뒤 (다크 모드만) 로고 뒤 네온 빛 0.4 ↔ 1.0 반복
        if (dark) {
          timers.push(
            setTimeout(() => {
              if (!alive) return;
              glowOn.setValue(1);
              run(
                Animated.loop(
                  Animated.sequence([
                    Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
                    Animated.timing(glow, { toValue: 0.4, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
                  ])
                )
              );
            }, 800)
          );
        }

        // 3) 그 0.3초 뒤 아이콘 등장 + 걸음 걷듯 좌우 흔들기 (0.6초 왕복 반복)
        timers.push(
          setTimeout(() => {
            if (!alive) return;
            run(Animated.timing(iconFade, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: useNative }));
            run(
              Animated.loop(
                Animated.timing(shake, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
                { resetBeforeIteration: true }
              )
            );
          }, 1100)
        );

        // 4) 1초 뒤 반복 애니메이션 정지 → 다음 화면
        timers.push(
          setTimeout(() => {
            if (!alive) return;
            running.forEach((a) => a.stop());
            finishRef.current();
          }, 2100)
        );
      });

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      running.forEach((a) => a.stop());
    };
  }, [ready, dark, fade, scale, glow, glowOn, iconFade, shake]);

  const bg = dark ? SPLASH_BG.dark : SPLASH_BG.light;
  // 한 번 흔들 때: 회전 0 → +0.14 → -0.14 → 0 라디안, 크기 1.0 → 1.12 → 1.0
  const rotate = shake.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0rad', '0.14rad', '-0.14rad', '0rad'] });
  const iconScale = shake.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] });

  return (
    <View style={[styles.root, { backgroundColor: bg }]} accessibilityLabel="SafeStep 시작 화면">
      {ready && (
        <>
          <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ scale }] }}>
            <View>
              {dark && (
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, GLOW_STYLE, { opacity: Animated.multiply(glow, glowOn) }]}>
                  <GradientLogo width={logoW} solid={MAIN} />
                </Animated.View>
              )}
              <GradientLogo width={logoW} />
            </View>
            <Text style={[styles.subtitle, { color: dark ? '#9E9E9E' : '#858585' }]}>{SUBTITLE}</Text>
          </Animated.View>
          <Animated.View style={{ marginTop: 32, opacity: iconFade, transform: [{ rotate }, { scale: iconScale }] }}>
            <Ionicons name="footsteps" size={44} color={MAIN} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: 4, fontSize: 14, fontWeight: '500', letterSpacing: 2 },
});
