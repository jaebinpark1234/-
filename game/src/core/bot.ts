import { Rng } from './rng';
import { canTap, currentCue, newGame, tap, type GameState, type Level, type Pack } from './rules';

/**
 * 사람처럼 '?'를 모르는 상태로 두는 봇. 난이도 측정(승률), 스모크 테스트 자동 플레이,
 * 크리에이터 모드(영상 녹화용 자동 플레이)에 쓴다.
 *
 * 둘 수 있는 수를 하나씩 가상으로 둬 보고 결과 상태를 점수로 매긴다(한 수 앞보기).
 * 가상으로 둘 때 '?' 팩은 색을 모르는 팩(-1)으로 바꿔서, 봇이 가려진 색을 미리 알지 못하게 한다.
 * noise는 아무 수나 두는 확률. 0이면 이 봇이 할 수 있는 최선이다.
 */
export function chooseMove(level: Level, s: GameState, rng: Rng, noise = 0): number | null {
  const legal: number[] = [];
  for (let i = 0; i < s.crates.length; i++) if (canTap(level, s, i)) legal.push(i);
  if (legal.length === 0) return null;
  if (noise > 0 && rng.next() < noise) return rng.pick(legal);

  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const i of legal) {
    const sim = maskedClone(s);
    tap(level, sim, i);
    const score = evaluate(level, sim) + rng.next() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

const UNKNOWN = -1;

function maskedClone(s: GameState): GameState {
  const mask = (p: Pack): Pack => ({ id: p.id, color: p.hidden ? UNKNOWN : p.color, hidden: p.hidden });
  return {
    ...s,
    crates: s.crates.map((c) => c.map(mask)),
    rack: s.rack.map(mask),
    parkLog: [],
  };
}

function evaluate(level: Level, s: GameState): number {
  if (s.status === 'won') return 1e9;
  const cue = currentCue(level, s);
  if (!cue) return 1e9;

  const free = s.rackCapacity - s.rack.length;
  let score = s.litCells * 10;
  // 거치대가 찰수록 급격히 위험해진다.
  score -= s.rack.length * s.rack.length * 6;

  let matchingTops = 0;
  let unknownTops = 0;
  let nearest = Infinity;
  for (const crate of s.crates) {
    const top = crate[crate.length - 1];
    if (!top) continue;
    if (top.color === UNKNOWN) unknownTops++;
    if (top.color === cue.color) matchingTops++;
    for (let d = crate.length - 1, depth = 0; d >= 0; d--, depth++) {
      const p = crate[d]!;
      if (p.color === UNKNOWN) break;
      if (p.color === cue.color) {
        nearest = Math.min(nearest, depth);
        break;
      }
    }
  }

  // 가상 상태에서는 '?'가 맨 위에 오면 색을 몰라 막힘으로 보일 수 있다. 그건 확정이 아니라 위험으로 친다.
  if (free <= 0 && matchingTops === 0) {
    if (unknownTops === 0) return -1e8 + score;
    score -= 400;
  }
  if (matchingTops > 0) score += 25;
  if (nearest !== Infinity) score += 30 / (1 + nearest) - (nearest > free ? 40 : 0);

  // 거치대 팩이 곧 쓰일수록 좋다.
  for (const p of s.rack) {
    for (let d = 0; d < 5; d++) {
      if (level.cues[s.cueIndex + d]?.color === p.color) {
        score += 5 - d;
        break;
      }
    }
  }
  return score;
}

export interface PlayoutResult {
  win: boolean;
  taps: number;
  rackPeak: number;
}

export function playout(level: Level, rng: Rng, noise = 0.1, maxTaps = 2000): PlayoutResult {
  const s = newGame(level);
  for (let t = 0; t < maxTaps && s.status === 'playing'; t++) {
    const move = chooseMove(level, s, rng, noise);
    if (move === null) break;
    tap(level, s, move);
  }
  return { win: s.status === 'won', taps: s.taps, rackPeak: s.rackPeak };
}

export function estimateWinRate(level: Level, runs = 100, seed = 1, noise = 0.1): number {
  let wins = 0;
  for (let r = 0; r < runs; r++) if (playout(level, new Rng(seed + r * 7919), noise).win) wins++;
  return wins / runs;
}
