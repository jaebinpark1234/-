import type { ColorId } from './palette';

/** 드론 팩 한 개. 상자 안에 쌓여 있고 맨 위 것만 꺼낼 수 있다. */
export interface Pack {
  id: number;
  color: ColorId;
  /** 맨 위로 올라오기 전까지 색이 '?'로 가려진 팩. */
  hidden: boolean;
}

/** 쇼 프로그램의 한 순서. 같은 색 팩 `packs`개를 보내면 `cells` 칸이 하늘에 켜진다. */
export interface Cue {
  color: ColorId;
  packs: number;
  /** 그림 격자 칸 번호(y * width + x). */
  cells: number[];
}

export interface Level {
  id: string;
  seed: number;
  pictureId: string;
  width: number;
  height: number;
  cues: Cue[];
  /** 각 상자는 아래 → 위 순서. */
  crates: Pack[][];
  rackCapacity: number;
}

export type Status = 'playing' | 'won' | 'jammed';

export interface GameState {
  crates: Pack[][];
  rack: Pack[];
  rackCapacity: number;
  cueIndex: number;
  /** 지금 순서에 이미 보낸 팩 수. */
  delivered: number;
  status: Status;
  taps: number;
  parks: number;
  rackPeak: number;
  litCells: number;
  bestChain: number;
  parkLog: Array<{ packId: number; crate: number }>;
}

export type PackSource = { kind: 'crate'; index: number } | { kind: 'rack'; slot: number };

export type GameEvent =
  | { type: 'deliver'; pack: Pack; from: PackSource; cueIndex: number; cells: number[] }
  | { type: 'park'; pack: Pack; crate: number; slot: number }
  | { type: 'reveal'; crate: number; pack: Pack }
  | { type: 'cueComplete'; cueIndex: number; chain: number }
  /** 거치대가 꽉 찼는데 지금 순서와 다른 색을 눌렀다. 아무 일도 일어나지 않는다. */
  | { type: 'blocked'; crate: number }
  | { type: 'win' }
  | { type: 'jam' };

export const MAX_RACK_CAPACITY = 9;

function clonePack(p: Pack): Pack {
  return { id: p.id, color: p.color, hidden: p.hidden };
}

export function newGame(level: Level): GameState {
  return {
    crates: level.crates.map((c) => c.map(clonePack)),
    rack: [],
    rackCapacity: level.rackCapacity,
    cueIndex: 0,
    delivered: 0,
    status: level.cues.length === 0 ? 'won' : 'playing',
    taps: 0,
    parks: 0,
    rackPeak: 0,
    litCells: 0,
    bestChain: 0,
    parkLog: [],
  };
}

export function currentCue(level: Level, s: GameState): Cue | null {
  return level.cues[s.cueIndex] ?? null;
}

export function totalCells(level: Level): number {
  return level.cues.reduce((n, c) => n + c.cells.length, 0);
}

/** 순서 하나의 칸들을 팩 수만큼 고르게 나눈다. j번째 팩이 켜는 칸들. */
export function cellsForPack(cue: Cue, packIndex: number): number[] {
  const n = cue.cells.length;
  const from = Math.floor((packIndex * n) / cue.packs);
  const to = Math.floor(((packIndex + 1) * n) / cue.packs);
  return cue.cells.slice(from, to);
}

export function topOf(s: GameState, crate: number): Pack | null {
  const c = s.crates[crate];
  return c && c.length > 0 ? (c[c.length - 1] as Pack) : null;
}

/** 지금 눌러도 되는 상자인지. 거치대가 꽉 찼을 땐 지금 순서 색만 된다. */
export function canTap(level: Level, s: GameState, crate: number): boolean {
  if (s.status !== 'playing') return false;
  const top = topOf(s, crate);
  const cue = currentCue(level, s);
  if (!top || !cue) return false;
  return top.color === cue.color || s.rack.length < s.rackCapacity;
}

/** 거치대가 꽉 찼고 어느 상자 맨 위도 지금 순서 색이 아니면 더 둘 수가 없다. */
export function isDeadlocked(level: Level, s: GameState): boolean {
  if (s.status !== 'playing') return false;
  for (let i = 0; i < s.crates.length; i++) if (canTap(level, s, i)) return false;
  return true;
}

/**
 * 상자 하나를 누른다. 상태를 직접 바꾸고, 화면 연출에 쓸 이벤트를 순서대로 돌려준다.
 *
 * 규칙
 * 1. 맨 위 팩이 지금 순서 색이면 하늘로 보낸다(deliver). 칸이 바로 켜진다.
 * 2. 아니면 거치대 빈칸에 둔다(park). 거치대가 꽉 찼으면 누름 자체가 무시된다(blocked).
 * 3. 순서가 다 채워지면 다음 순서로 넘어가고, 거치대에 그 색이 있으면 왼쪽부터 자동으로 보낸다.
 *    이게 연달아 일어나면 연쇄(chain)다.
 * 4. 꺼낸 뒤 새로 맨 위가 된 '?' 팩은 색이 드러난다.
 * 5. 모든 순서를 끝내면 승리. 더 둘 곳이 없으면 막힘(jam).
 */
export function tap(level: Level, s: GameState, crateIndex: number): GameEvent[] {
  if (s.status !== 'playing') return [];
  const crate = s.crates[crateIndex];
  const cue = currentCue(level, s);
  if (!crate || crate.length === 0 || !cue) return [];

  const pack = crate[crate.length - 1] as Pack;
  if (pack.color !== cue.color && s.rack.length >= s.rackCapacity) {
    return [{ type: 'blocked', crate: crateIndex }];
  }

  const slotBefore = new Map(s.rack.map((p, i) => [p.id, i]));
  const events: GameEvent[] = [];
  crate.pop();
  s.taps++;

  if (pack.color === cue.color) {
    deliver(level, s, pack, { kind: 'crate', index: crateIndex }, slotBefore, events);
  } else {
    s.rack.push(pack);
    s.parks++;
    s.rackPeak = Math.max(s.rackPeak, s.rack.length);
    s.parkLog.push({ packId: pack.id, crate: crateIndex });
    events.push({ type: 'park', pack, crate: crateIndex, slot: s.rack.length - 1 });
  }

  const newTop = crate[crate.length - 1];
  if (newTop?.hidden) {
    newTop.hidden = false;
    events.push({ type: 'reveal', crate: crateIndex, pack: newTop });
  }

  if (s.cueIndex >= level.cues.length) {
    s.status = 'won';
    events.push({ type: 'win' });
  } else if (isDeadlocked(level, s)) {
    s.status = 'jammed';
    events.push({ type: 'jam' });
  }
  return events;
}

function deliver(
  level: Level,
  s: GameState,
  pack: Pack,
  from: PackSource,
  slotBefore: Map<number, number>,
  events: GameEvent[],
): void {
  const cue = level.cues[s.cueIndex] as Cue;
  const cells = cellsForPack(cue, s.delivered);
  s.delivered++;
  s.litCells += cells.length;
  events.push({ type: 'deliver', pack, from, cueIndex: s.cueIndex, cells });

  let chain = 0;
  for (;;) {
    const done = level.cues[s.cueIndex];
    if (!done || s.delivered < done.packs) break;
    events.push({ type: 'cueComplete', cueIndex: s.cueIndex, chain });
    s.bestChain = Math.max(s.bestChain, chain);
    s.cueIndex++;
    s.delivered = 0;
    chain++;

    const next = level.cues[s.cueIndex];
    if (!next) break;
    for (let i = 0; i < s.rack.length && s.delivered < next.packs; ) {
      const p = s.rack[i] as Pack;
      if (p.color !== next.color) {
        i++;
        continue;
      }
      s.rack.splice(i, 1);
      const c = cellsForPack(next, s.delivered);
      s.delivered++;
      s.litCells += c.length;
      events.push({
        type: 'deliver',
        pack: p,
        from: { kind: 'rack', slot: slotBefore.get(p.id) ?? i },
        cueIndex: s.cueIndex,
        cells: c,
      });
    }
  }
}

/** 부스터 '되돌리기': 가장 최근에 거치대에 둔 팩을 원래 상자 맨 위로 돌려놓는다. */
export function undoPark(s: GameState): { pack: Pack; crate: number } | null {
  if (s.status !== 'playing') return null;
  while (s.parkLog.length > 0) {
    const entry = s.parkLog.pop() as { packId: number; crate: number };
    const idx = s.rack.findIndex((p) => p.id === entry.packId);
    if (idx < 0) continue;
    const [pack] = s.rack.splice(idx, 1) as [Pack];
    s.crates[entry.crate]?.push(pack);
    return { pack, crate: entry.crate };
  }
  return null;
}

export function canUndo(s: GameState): boolean {
  return s.status === 'playing' && s.parkLog.some((e) => s.rack.some((p) => p.id === e.packId));
}

/** 부스터 '+1칸'. */
export function addRackSlot(s: GameState, n = 1): boolean {
  if (s.rackCapacity >= MAX_RACK_CAPACITY) return false;
  s.rackCapacity = Math.min(MAX_RACK_CAPACITY, s.rackCapacity + n);
  return true;
}

/** 막힌 뒤 보상형 광고로 이어하기: 거치대 칸을 늘리고 다시 플레이 상태로. */
export function continueAfterJam(s: GameState, extraSlots = 2): void {
  if (s.status !== 'jammed') return;
  s.rackCapacity = Math.min(MAX_RACK_CAPACITY, s.rackCapacity + extraSlots);
  s.status = 'playing';
}
