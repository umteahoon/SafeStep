import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, Vibration, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { addFocusMinutes, getFocusDaily } from '../../lib/focusLog';
import { dayKey, formatMinutes, weekBars } from '../../lib/studyStats';
import { WeekChart } from '../../components/study';
import { Banner, Button, Card, Chip, Icon, Muted, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme';

const PRESETS = [15, 25, 50, 90];
const SIZE = 250;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

type Phase = 'idle' | 'running' | 'paused';

export default function FocusTimerScreen() {
  const [presetMin, setPresetMin] = useState(25);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(25 * 60);
  const [daily, setDaily] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const endAt = useRef(0);

  const reloadDaily = useCallback(async () => setDaily(await getFocusDaily()), []);
  useFocusEffect(
    useCallback(() => {
      reloadDaily();
    }, [reloadDaily])
  );

  // 종료 시각 기준으로 남은 시간을 계산 → 앱이 백그라운드로 가도 시간이 정확
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      const left = Math.ceil((endAt.current - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(t);
        setRemaining(0);
        setPhase('idle');
        Vibration.vibrate([0, 400, 200, 400]);
        addFocusMinutes(presetMin).then(setDaily);
        setMessage(`${presetMin}분 집중 완료! 기록에 저장했어요.`);
        setRemaining(presetMin * 60);
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase, presetMin]);

  const choose = (m: number) => {
    if (phase !== 'idle') return;
    setPresetMin(m);
    setRemaining(m * 60);
    setMessage(null);
  };

  const start = () => {
    setMessage(null);
    endAt.current = Date.now() + remaining * 1000;
    setPhase('running');
  };
  const pause = () => setPhase('paused');
  const resume = () => {
    endAt.current = Date.now() + remaining * 1000;
    setPhase('running');
  };
  const stopAndSave = async () => {
    const doneMin = Math.floor((presetMin * 60 - remaining) / 60);
    setPhase('idle');
    setRemaining(presetMin * 60);
    if (doneMin >= 1) {
      setDaily(await addFocusMinutes(doneMin));
      setMessage(`${doneMin}분 집중한 시간을 기록했어요.`);
    } else {
      setMessage('1분 미만은 기록되지 않아요.');
    }
  };

  const total = presetMin * 60;
  const progress = total > 0 ? 1 - remaining / total : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const today = new Date();
  const todayMin = daily[dayKey(today)] ?? 0;
  const bars = weekBars(daily, today);

  return (
    <Screen>
      <Banner kind="success">{message ?? undefined}</Banner>

      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={phase === 'paused' ? colors.warn : colors.primary}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              strokeDashoffset={C * (1 - progress)}
              rotation={-90}
              originX={SIZE / 2}
              originY={SIZE / 2}
            />
          </Svg>
          <Text style={{ fontSize: 56, fontWeight: '800', color: colors.text, letterSpacing: -2 }}>
            {mm}:{ss}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 }}>
            {phase === 'running' ? '집중하는 중' : phase === 'paused' ? '일시정지' : '시작할 준비가 됐어요'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {PRESETS.map((m) => (
          <Chip key={m} label={`${m}분`} selected={presetMin === m} onPress={() => choose(m)} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {phase === 'idle' && <Button title="시작" icon="play" onPress={start} style={{ flex: 1 }} />}
        {phase === 'running' && (
          <>
            <Button title="일시정지" icon="pause" variant="secondary" onPress={pause} style={{ flex: 1 }} />
            <Button title="종료·기록" icon="stop" variant="dark" onPress={stopAndSave} style={{ flex: 1 }} />
          </>
        )}
        {phase === 'paused' && (
          <>
            <Button title="이어서" icon="play" onPress={resume} style={{ flex: 1 }} />
            <Button title="종료·기록" icon="stop" variant="dark" onPress={stopAndSave} style={{ flex: 1 }} />
          </>
        )}
      </View>

      <SectionTitle>{'\n'}오늘의 집중</SectionTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Icon name="timer" size={28} color={colors.primary} />
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{formatMinutes(todayMin)}</Text>
          <Muted>오늘 집중 타이머로 쌓은 시간</Muted>
        </View>
      </Card>

      <SectionTitle>이번 주</SectionTitle>
      <Card>
        <WeekChart bars={bars} />
      </Card>
      <Muted>집중 기록은 이 기기에만 저장돼요.</Muted>
    </Screen>
  );
}
