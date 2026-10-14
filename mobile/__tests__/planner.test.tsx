import { daysLeft, ddayLabel, newTask, progress, pruneTasks, weekProgress } from '../src/lib/planner';

describe('학습 플래너 계산', () => {
  const today = new Date(2026, 9, 14); // 2026-10-14 (수)

  it('D-day 남은 일수와 라벨', () => {
    expect(daysLeft('2026-10-14', today)).toBe(0);
    expect(daysLeft('2026-10-26', today)).toBe(12);
    expect(daysLeft('2026-10-11', today)).toBe(-3);
    expect(ddayLabel(12)).toBe('D-12');
    expect(ddayLabel(0)).toBe('D-DAY');
    expect(ddayLabel(-3)).toBe('D+3');
  });

  it('진행률과 목표 시간', () => {
    const a = newTask('수학 30쪽', '수학', 60);
    const b = { ...newTask('영단어', '영어', 30), done: true };
    const c = newTask('독서', '국어', 0);
    const p = progress([a, b, c]);
    expect(p).toMatchObject({ total: 3, done: 1, percent: 33, planned: 90, finished: 30 });
    expect(progress([]).percent).toBe(0);
  });

  it('이번 주(월~일) 완료 현황', () => {
    const map = { '2026-10-12': [{ ...newTask('a', '수학', 0), done: true }, newTask('b', '영어', 0)] };
    const w = weekProgress(map, today);
    expect(w.map((d) => d.label)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
    expect(w[0]).toMatchObject({ key: '2026-10-12', total: 2, done: 1 });
    expect(w[2].isToday).toBe(true);
  });

  it('오래된 기록은 정리', () => {
    const map = { '2026-01-01': [newTask('old', '기타', 0)], '2026-10-13': [newTask('new', '기타', 0)] };
    expect(Object.keys(pruneTasks(map, today))).toEqual(['2026-10-13']);
  });
});
