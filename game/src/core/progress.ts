import type { SaveData } from '../services/save';
import { localDateKey } from './rng';

export type PlayMode = 'level' | 'daily';

export interface RoundOutcome {
  mode: PlayMode;
  level: number;
  win: boolean;
  score: number;
  coins: number;
}

function yesterdayKey(today: Date): string {
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

/** 한 판 결과를 저장 데이터에 반영한다. 순수 함수라서 테스트로 규칙을 고정해 둔다. */
export function applyRoundOutcome(data: SaveData, outcome: RoundOutcome, now: Date): void {
  data.stats.rounds++;
  if (!outcome.win) return;

  data.stats.wins++;
  data.coins += outcome.coins;

  if (outcome.mode === 'level' && outcome.level >= data.level) {
    data.level = outcome.level + 1;
  }

  if (outcome.mode === 'daily') {
    const today = localDateKey(now);
    if (data.daily.lastCompleted !== today) {
      data.daily.streak = data.daily.lastCompleted === yesterdayKey(now) ? data.daily.streak + 1 : 1;
      data.daily.lastCompleted = today;
    }
    data.daily.best = Math.max(data.daily.best, outcome.score);
  }
}

export function isDailyDone(data: SaveData, now: Date): boolean {
  return data.daily.lastCompleted === localDateKey(now);
}

/** 연속 기록이 끊겼는지까지 반영한 현재 연속 일수. 메뉴 표시용. */
export function currentStreak(data: SaveData, now: Date): number {
  const last = data.daily.lastCompleted;
  if (last === localDateKey(now) || last === yesterdayKey(now)) return data.daily.streak;
  return 0;
}
