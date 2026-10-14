import { COLOR_COUNT } from './palette';
import type { Level } from './rules';

export interface SolveResult {
  solvable: boolean;
  /** 노드 예산을 다 써서 판단을 못 했으면 true. 이 경우 solvable은 false로 둔다. */
  exhausted: boolean;
  nodes: number;
  /** 풀이가 있으면 누를 상자 순서. */
  path: number[];
}

/**
 * 모든 '?'를 아는 상태로 푸는 정확한 해법 탐색. 레벨 생성기가 "이 레벨은 풀 수 있다"를 보장하는 데 쓴다.
 *
 * 핵심 관찰: 꺼낸 팩들의 색 묶음이 같으면 진행 순서, 거치대 내용도 같다(맞는 색은 항상 바로 보내고,
 * 거치대 팩은 차례가 오면 자동으로 나가니까). 그래서 상자별 남은 높이만으로 상태를 기억해도 된다.
 * 같은 높이 조합에서 한 번 실패했으면 다시 볼 필요가 없다.
 */
export function solve(level: Level, capacity: number, nodeBudget = 200_000): SolveResult {
  const crates = level.crates.map((c) => c.map((p) => p.color));
  const heights = crates.map((c) => c.length);
  const cues = level.cues;
  const rack = new Array<number>(COLOR_COUNT).fill(0);
  const failed = new Set<string>();
  const path: number[] = [];
  let nodes = 0;
  let exhausted = false;

  let cueIndex = 0;
  let delivered = 0;
  let rackSize = 0;

  const dfs = (): boolean => {
    if (cueIndex >= cues.length) return true;
    if (++nodes > nodeBudget) {
      exhausted = true;
      return false;
    }
    const key = heights.join(',');
    if (failed.has(key)) return false;

    const cue = cues[cueIndex]!;
    // 지금 순서 색이 맨 위인 상자를 먼저, 그다음 곧 필요한 색 순서로 시도한다.
    const order: Array<[number, number]> = [];
    for (let i = 0; i < crates.length; i++) {
      const h = heights[i]!;
      if (h === 0) continue;
      const color = crates[i]![h - 1]!;
      let score = 100;
      if (color === cue.color) score = 0;
      else {
        if (rackSize >= capacity) continue;
        for (let d = 1; d < 6 && cueIndex + d < cues.length; d++) {
          if (cues[cueIndex + d]!.color === color) {
            score = d;
            break;
          }
        }
      }
      order.push([score, i]);
    }
    order.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    for (const [, i] of order) {
      // 적용
      const saved = { cueIndex, delivered, rackSize, rack: rack.slice() };
      const h = heights[i]!;
      const color = crates[i]![h - 1]!;
      heights[i] = h - 1;
      if (color === cues[cueIndex]!.color) {
        delivered++;
        while (cueIndex < cues.length && delivered >= cues[cueIndex]!.packs) {
          cueIndex++;
          delivered = 0;
          const next = cues[cueIndex];
          if (!next) break;
          const take = Math.min(rack[next.color]!, next.packs);
          rack[next.color]! -= take;
          rackSize -= take;
          delivered = take;
        }
      } else {
        rack[color]!++;
        rackSize++;
      }
      path.push(i);
      if (dfs()) return true;
      path.pop();
      // 되돌리기
      heights[i] = h;
      cueIndex = saved.cueIndex;
      delivered = saved.delivered;
      rackSize = saved.rackSize;
      for (let c = 0; c < COLOR_COUNT; c++) rack[c] = saved.rack[c]!;
      if (exhausted) return false;
    }
    failed.add(key);
    return false;
  };

  const solvable = dfs();
  return { solvable, exhausted: !solvable && exhausted, nodes, path: solvable ? path.slice() : [] };
}

/** 거치대가 최소 몇 칸 있어야 풀리는지. 도구와 밸런스 리포트용(게임 중에는 쓰지 않는다). */
export function minRackNeeded(level: Level, maxCapacity = 9, nodeBudget = 200_000): number | null {
  for (let cap = 0; cap <= maxCapacity; cap++) {
    const r = solve(level, cap, nodeBudget);
    if (r.solvable) return cap;
    if (r.exhausted) return null;
  }
  return null;
}
