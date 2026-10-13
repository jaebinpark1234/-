import { estimateWinRate } from './bot';
import { paramsForDaily, paramsForLevel, type LevelKind, type LevelParams } from './difficulty';
import type { ColorId } from './palette';
import { PICTURES, effectiveColors, type Picture } from './pictures';
import { Rng, hashSeed } from './rng';
import type { Cue, Level, Pack } from './rules';
import { solve } from './solver';

/**
 * 그림 → 쇼 순서(cue) 목록.
 * 같은 색끼리 붙은 영역을 아래쪽 칸부터 너비 우선으로 훑어 chunkSize 이하 덩어리로 자르고,
 * 아래 덩어리부터 순서를 매긴다. 그래서 그림이 지평선에서 위로 차오르듯 완성된다.
 */
export function buildCues(pic: Picture, params: LevelParams, rng: Rng): Cue[] {
  const { width, height, cells } = pic;
  const seen = new Uint8Array(cells.length);
  const chunks: Array<{ color: ColorId; cells: number[]; cy: number }> = [];

  // 아래 줄부터 시작점을 찾는다.
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      const color = cells[start]!;
      if (color < 0 || seen[start]) continue;

      const region: number[] = [];
      const queue = [start];
      seen[start] = 1;
      while (queue.length > 0) {
        const i = queue.shift()!;
        region.push(i);
        const cx = i % width;
        const neighbours = [i + width, i - 1, i + 1, i - width];
        for (const n of neighbours) {
          if (n < 0 || n >= cells.length || seen[n] || cells[n] !== color) continue;
          const nx = n % width;
          if (Math.abs(nx - cx) > 1) continue; // 줄 넘어감 방지
          seen[n] = 1;
          queue.push(n);
        }
      }

      const parts = Math.ceil(region.length / params.chunkSize);
      for (let k = 0; k < parts; k++) {
        const from = Math.floor((k * region.length) / parts);
        const to = Math.floor(((k + 1) * region.length) / parts);
        const part = region.slice(from, to);
        const cy = part.reduce((s, i) => s + Math.floor(i / width), 0) / part.length;
        chunks.push({ color, cells: part, cy });
      }
    }
  }

  // 아래(큰 y)부터, 약간 흔들어서.
  const keyed = chunks.map((c) => ({ c, key: -c.cy + rng.next() * 1.5 }));
  keyed.sort((a, b) => a.key - b.key);
  const ordered = keyed.map((k) => k.c);

  // 같은 색 순서가 3번 연속이면 뒤에서 다른 색을 당겨 온다.
  for (let i = 2; i < ordered.length; i++) {
    const a = ordered[i - 2]!;
    const b = ordered[i - 1]!;
    const c = ordered[i]!;
    if (a.color === b.color && b.color === c.color) {
      const j = ordered.findIndex((x, idx) => idx > i && x.color !== c.color);
      if (j > 0) {
        const [moved] = ordered.splice(j, 1);
        ordered.splice(i, 0, moved!);
      }
    }
  }

  return ordered.map((c) => ({
    color: c.color,
    cells: c.cells,
    packs: Math.max(1, Math.min(params.maxPacksPerCue, Math.ceil(c.cells.length / params.cellsPerPack))),
  }));
}

/**
 * 순서대로 필요한 팩 목록을 만들어 마지막 팩부터 거꾸로 상자에 쌓는다.
 * 이렇게만 쌓으면 순서대로 누르기만 해도 거치대를 한 번도 안 쓰는 레벨이 된다(난이도 0).
 * 난이도는 shapeDifficulty()가 팩 위치를 바꿔서 올린다.
 */
export function dealCrates(cues: Cue[], params: LevelParams, rng: Rng): Pack[][] {
  const order: Pack[] = [];
  let id = 0;
  for (const cue of cues) for (let k = 0; k < cue.packs; k++) order.push({ id: id++, color: cue.color, hidden: false });

  const n = order.length;
  const crateCount = Math.max(params.minCrates, Math.min(params.maxCrates, Math.ceil(n / params.depth)));
  const cap = Math.max(params.depth, Math.ceil(n / crateCount));
  const crates: Pack[][] = Array.from({ length: crateCount }, () => []);

  for (let k = n - 1; k >= 0; k--) {
    const remaining = k + 1;
    const empty = crates.filter((c) => c.length === 0);
    // 남은 팩 수가 빈 상자 수와 같아지면 빈 상자부터 채워서 빈 상자가 남지 않게 한다.
    const pool = remaining <= empty.length ? empty : crates.filter((c) => c.length < cap);
    rng.pick(pool).push(order[k]!);
  }
  return crates;
}

const SHAPE_ITERATIONS = 160;
const SHAPE_NODE_BUDGET = 40_000;

/** 완벽하게 둘 때 필요한 거치대 칸 수. hi보다 많이 필요하거나 판단 불가면 hi + 1. */
function rackNeed(level: Level, hi: number): number {
  for (let cap = 0; cap <= hi; cap++) {
    const r = solve(level, cap, SHAPE_NODE_BUDGET);
    if (r.solvable) return cap;
    if (r.exhausted) return hi + 1;
  }
  return hi + 1;
}

/**
 * 서로 다른 상자의 팩 두 개를 맞바꾸면서, 필요한 거치대 칸 수가 rackTarget 범위에 들어오게 만든다.
 * 상한을 넘는 교환은 되돌리고, 필요 칸 수가 줄어드는 교환도 받지 않는다(언덕 오르기).
 * 정해진 횟수 안에 하한에 못 미치면 그때까지 가장 어려운 배치를 쓴다.
 */
export function shapeDifficulty(level: Level, params: LevelParams, rng: Rng): number {
  const [lo, hi] = params.rackTarget;
  let need = rackNeed(level, hi);
  const crates = level.crates;
  for (let it = 0; it < SHAPE_ITERATIONS && need < lo; it++) {
    const a = rng.int(0, crates.length - 1);
    let b = rng.int(0, crates.length - 2);
    if (b >= a) b++;
    const ca = crates[a]!;
    const cb = crates[b]!;
    const ia = rng.int(0, ca.length - 1);
    const ib = rng.int(0, cb.length - 1);
    const pa = ca[ia]!;
    const pb = cb[ib]!;
    if (pa.color === pb.color) continue;
    ca[ia] = pb;
    cb[ib] = pa;
    const next = rackNeed(level, hi);
    if (next > hi || next < need) {
      ca[ia] = pa;
      cb[ib] = pb;
    } else {
      need = next;
    }
  }
  return need;
}

function applyHidden(crates: Pack[][], ratio: number, rng: Rng): void {
  for (const crate of crates) {
    for (let i = 0; i < crate.length - 1; i++) crate[i]!.hidden = rng.next() < ratio;
  }
}

export interface GeneratedLevel {
  level: Level;
  params: LevelParams;
  /** 완벽하게 둘 때 필요한 거치대 칸 수. params.rackTarget[0]보다 작으면 목표보다 쉬운 레벨이 나온 것. */
  rackNeed: number;
  /** 생성 때 잰 봇 승률. */
  botWin: number;
  attempts: number;
}

const MAX_ATTEMPTS = 6;
const WIN_RUNS = 40;

/**
 * 시드가 같으면 어느 기기에서든 같은 레벨이 나온다. 반드시 거치대 칸 안에서 풀린다.
 * 배치를 만든 뒤 봇 승률이 목표 범위에 들어오는지 보고, 아니면 다른 하위 시드로 다시 만든다.
 * 끝까지 못 맞추면 목표에 가장 가까운 배치를 쓴다.
 */
export function generateLevel(pic: Picture, params: LevelParams, seed: number, id: string): GeneratedLevel {
  const cues = buildCues(pic, params, new Rng(seed));
  const [winLo, winHi] = params.botWinTarget;
  let best: GeneratedLevel | null = null;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new Rng(hashSeed(`${seed}:${attempt}`));
    const crates = dealCrates(cues, params, rng);
    const level: Level = {
      id,
      seed,
      pictureId: pic.id,
      width: pic.width,
      height: pic.height,
      cues,
      crates,
      rackCapacity: params.rackCapacity,
    };
    const need = shapeDifficulty(level, params, rng);
    applyHidden(level.crates, params.hiddenRatio, rng);
    const win = estimateWinRate(level, WIN_RUNS, seed);
    const dist = win < winLo ? winLo - win : win > winHi ? win - winHi : 0;
    const result = { level, params, rackNeed: need, botWin: win, attempts: attempt + 1 };
    if (dist < bestDist) {
      best = result;
      bestDist = dist;
    }
    if (dist === 0) break;
  }
  return best!;
}

/**
 * 레벨에 쓸 그림. 색이 적은 그림은 거치대를 쓰게 만들 수가 없어서 튜토리얼과 쉬어가는 레벨에만 쓴다.
 * 그림이 늘어나면 자동으로 섞여 들어간다.
 */
export function minColorsFor(kind: LevelKind, level: number): number {
  if (kind === 'tutorial' || kind === 'breather') return 1;
  return level <= 20 ? 2 : 3;
}

export function pictureForLevel(level: number, kind: LevelKind): Picture {
  const min = minColorsFor(kind, level);
  const pool = PICTURES.filter((p) => effectiveColors(p) >= min);
  const list = pool.length > 0 ? pool : PICTURES;
  return list[(level - 1) % list.length]!;
}

export function levelFor(levelNumber: number): GeneratedLevel {
  const params = paramsForLevel(levelNumber);
  const pic = pictureForLevel(levelNumber, params.kind);
  return generateLevel(pic, params, hashSeed(`level-${levelNumber}`), `level-${levelNumber}`);
}

export function dailyFor(dateKey: string): GeneratedLevel {
  const seed = hashSeed(`daily-${dateKey}`);
  const pool = PICTURES.filter((p) => effectiveColors(p) >= 3);
  const pic = new Rng(seed).pick(pool.length > 0 ? pool : PICTURES);
  return generateLevel(pic, paramsForDaily(), seed, `daily-${dateKey}`);
}
