import { describe, expect, it } from 'vitest';
import { applyRoundOutcome, currentStreak, isDailyDone } from '../src/core/progress';
import { defaultSave } from '../src/services/save';

const day = (d: number) => new Date(2026, 9, d, 12, 0, 0);

describe('applyRoundOutcome', () => {
  it('레벨을 깨면 다음 레벨로 넘어가고 코인이 쌓인다', () => {
    const s = defaultSave();
    applyRoundOutcome(s, { mode: 'level', level: 1, win: true, score: 10, coins: 5 }, day(1));
    expect(s.level).toBe(2);
    expect(s.coins).toBe(5);
    expect(s.stats).toEqual({ rounds: 1, wins: 1 });
  });

  it('지면 진행은 그대로고 판 수만 는다', () => {
    const s = defaultSave();
    applyRoundOutcome(s, { mode: 'level', level: 1, win: false, score: 3, coins: 5 }, day(1));
    expect(s.level).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.stats).toEqual({ rounds: 1, wins: 0 });
  });

  it('이미 깬 레벨을 다시 깨도 레벨이 뒤로 가지 않는다', () => {
    const s = defaultSave();
    s.level = 10;
    applyRoundOutcome(s, { mode: 'level', level: 3, win: true, score: 1, coins: 1 }, day(1));
    expect(s.level).toBe(10);
  });

  it('데일리 연속 기록: 이어지면 +1, 하루 건너뛰면 1로', () => {
    const s = defaultSave();
    const daily = (d: number) => applyRoundOutcome(s, { mode: 'daily', level: 0, win: true, score: d, coins: 0 }, day(d));
    daily(1);
    daily(2);
    daily(2); // 같은 날 두 번은 한 번으로 친다
    expect(s.daily.streak).toBe(2);
    expect(isDailyDone(s, day(2))).toBe(true);
    expect(currentStreak(s, day(3))).toBe(2);
    expect(currentStreak(s, day(4))).toBe(0);
    daily(4);
    expect(s.daily.streak).toBe(1);
    expect(s.daily.best).toBe(4);
  });
});
