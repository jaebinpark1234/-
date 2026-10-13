import { describe, expect, it } from 'vitest';
import { estimateWinRate } from '../src/core/bot';
import { paramsForLevel } from '../src/core/difficulty';
import { buildCues, dailyFor, dealCrates, levelFor } from '../src/core/levelgen';
import { PICTURES, PICTURE_DEFS, parsePicture } from '../src/core/pictures';
import { Rng } from '../src/core/rng';
import {
  addRackSlot,
  canUndo,
  cellsForPack,
  continueAfterJam,
  newGame,
  tap,
  totalCells,
  undoPark,
  type Level,
  type Pack,
} from '../src/core/rules';
import { solve } from '../src/core/solver';

const P = (id: number, color: number, hidden = false): Pack => ({ id, color, hidden });

/** 손으로 만든 작은 레벨. 색 0, 1 두 가지, 순서: 0×2 → 1×1 → 0×1 */
function tinyLevel(crates: Pack[][], rackCapacity = 2): Level {
  return {
    id: 't',
    seed: 0,
    pictureId: 'x',
    width: 4,
    height: 1,
    cues: [
      { color: 0, packs: 2, cells: [0, 1] },
      { color: 1, packs: 1, cells: [2] },
      { color: 0, packs: 1, cells: [3] },
    ],
    crates,
    rackCapacity,
  };
}

describe('rules', () => {
  it('맞는 색은 하늘로, 다른 색은 거치대로 간다', () => {
    const level = tinyLevel([
      [P(0, 0), P(1, 1)],
      [P(2, 0), P(3, 0)],
    ]);
    const s = newGame(level);
    const e1 = tap(level, s, 0); // 맨 위 = 색1 → 거치대
    expect(e1.map((e) => e.type)).toEqual(['park']);
    expect(s.rack.map((p) => p.id)).toEqual([1]);
    const e2 = tap(level, s, 1); // 색0 → 보냄 (1/2)
    expect(e2[0]).toMatchObject({ type: 'deliver', cells: [0] });
  });

  it('순서가 끝나면 거치대 팩이 연쇄로 나간다', () => {
    const level = tinyLevel([
      [P(0, 0), P(1, 1)],
      [P(2, 0), P(3, 0)],
    ]);
    const s = newGame(level);
    tap(level, s, 0); // 색1 거치대
    tap(level, s, 1); // 색0 1/2
    const e = tap(level, s, 1); // 색0 2/2 → 순서 완료 → 거치대 색1 자동 → 완료 → 다음 색0
    const types = e.map((x) => x.type);
    expect(types).toEqual(['deliver', 'cueComplete', 'deliver', 'cueComplete']);
    expect(e[2]).toMatchObject({ type: 'deliver', from: { kind: 'rack', slot: 0 } });
    expect(s.rack).toHaveLength(0);
    expect(s.cueIndex).toBe(2);
    expect(s.bestChain).toBe(1);
    const last = tap(level, s, 0);
    expect(last.map((x) => x.type)).toEqual(['deliver', 'cueComplete', 'win']);
    expect(s.status).toBe('won');
    expect(s.litCells).toBe(totalCells(level));
  });

  it('거치대가 꽉 찼고 맞는 색이 맨 위에 없으면 막힌다', () => {
    const level = tinyLevel(
      [
        [P(0, 1), P(1, 1)],
        [P(2, 0), P(3, 1)],
      ],
      1,
    );
    const s = newGame(level);
    const e = tap(level, s, 0); // 색1 거치대 (1/1, 꽉 참). 두 상자 맨 위가 모두 색1 → 막힘
    expect(e.at(-1)).toEqual({ type: 'jam' });
    expect(s.status).toBe('jammed');
  });

  it('꽉 찬 거치대에서 다른 색을 누르면 blocked만 나오고 상태는 그대로다', () => {
    const level = tinyLevel(
      [
        [P(0, 0), P(1, 1)],
        [P(2, 0), P(4, 0), P(3, 1)],
      ],
      1,
    );
    const s = newGame(level);
    tap(level, s, 0); // 색1 거치대 (꽉 참). 상자0 맨 위가 이제 색0 → 아직 둘 수 있음
    expect(s.status).toBe('playing');
    const e = tap(level, s, 1); // 상자1 맨 위 색1 → 막힘
    expect(e).toEqual([{ type: 'blocked', crate: 1 }]);
    expect(s.crates[1]).toHaveLength(3);
  });

  it('막힌 뒤 이어하기를 하면 칸이 2개 늘고 계속할 수 있다', () => {
    const level = tinyLevel(
      [
        [P(0, 1), P(1, 1)],
        [P(2, 0), P(3, 1)],
      ],
      1,
    );
    const s = newGame(level);
    tap(level, s, 0);
    expect(s.status).toBe('jammed');
    continueAfterJam(s);
    expect(s.status).toBe('playing');
    expect(s.rackCapacity).toBe(3);
  });

  it('? 팩은 맨 위가 되면 드러난다', () => {
    const level = tinyLevel([
      [P(0, 0, true), P(1, 1)],
      [P(2, 0), P(3, 0)],
    ]);
    const s = newGame(level);
    const e = tap(level, s, 0);
    expect(e.at(-1)).toMatchObject({ type: 'reveal', crate: 0 });
    expect(s.crates[0]![0]!.hidden).toBe(false);
  });

  it('되돌리기는 마지막으로 둔 팩을 원래 상자 위로 돌려놓는다', () => {
    const level = tinyLevel([
      [P(0, 0), P(1, 1)],
      [P(2, 0), P(3, 0)],
    ]);
    const s = newGame(level);
    tap(level, s, 0);
    expect(canUndo(s)).toBe(true);
    const r = undoPark(s);
    expect(r).toMatchObject({ crate: 0 });
    expect(s.rack).toHaveLength(0);
    expect(s.crates[0]!.map((p) => p.id)).toEqual([0, 1]);
    expect(canUndo(s)).toBe(false);
  });

  it('+1칸은 상한이 있다', () => {
    const s = newGame(tinyLevel([[P(0, 0)]], 8));
    expect(addRackSlot(s)).toBe(true);
    expect(addRackSlot(s)).toBe(false);
  });

  it('팩별 칸 나누기는 빠짐도 겹침도 없다', () => {
    for (let n = 1; n <= 20; n++) {
      for (let k = 1; k <= 3; k++) {
        const cue = { color: 0, packs: k, cells: Array.from({ length: n }, (_, i) => i) };
        const all = Array.from({ length: k }, (_, j) => cellsForPack(cue, j)).flat();
        expect(all).toEqual(cue.cells);
      }
    }
  });
});

describe('pictures', () => {
  it('모든 그림이 형식에 맞는다', () => {
    for (const def of PICTURE_DEFS) expect(() => parsePicture(def)).not.toThrow();
    const ids = new Set(PICTURES.map((p) => p.id));
    expect(ids.size).toBe(PICTURES.length);
  });
});

describe('levelgen', () => {
  it('순서가 그림의 모든 칸을 정확히 한 번씩 덮는다', () => {
    for (const pic of PICTURES) {
      const cues = buildCues(pic, paramsForLevel(30), new Rng(1));
      const covered = cues.flatMap((c) => c.cells).sort((a, b) => a - b);
      const filled = pic.cells.flatMap((c, i) => (c >= 0 ? [i] : []));
      expect(covered).toEqual(filled);
      for (const c of cues) for (const i of c.cells) expect(pic.cells[i]).toBe(c.color);
    }
  });

  it('기본 배치는 순서대로 누르기만 해도 거치대를 안 쓴다', () => {
    const pic = PICTURES[0]!;
    const params = { ...paramsForLevel(30), hiddenRatio: 0 };
    const cues = buildCues(pic, params, new Rng(3));
    const crates = dealCrates(cues, params, new Rng(4));
    const level: Level = {
      id: 'z',
      seed: 0,
      pictureId: pic.id,
      width: pic.width,
      height: pic.height,
      cues,
      crates,
      rackCapacity: 5,
    };
    expect(solve(level, 0).solvable).toBe(true);
  });

  it('같은 시드는 같은 레벨', () => {
    expect(JSON.stringify(levelFor(37).level)).toBe(JSON.stringify(levelFor(37).level));
    expect(JSON.stringify(dailyFor('2026-10-13').level)).toBe(JSON.stringify(dailyFor('2026-10-13').level));
  });

  it('레벨 1~200과 데일리 60일치가 전부 거치대 안에서 풀린다', () => {
    const levels = [
      ...Array.from({ length: 200 }, (_, i) => levelFor(i + 1)),
      ...Array.from({ length: 60 }, (_, i) => dailyFor(`2026-11-${String((i % 28) + 1).padStart(2, '0')}-${i}`)),
    ];
    for (const g of levels) {
      const { level, params } = g;
      const packs = level.crates.flat().length;
      expect(packs).toBe(level.cues.reduce((n, c) => n + c.packs, 0));
      expect(level.crates.every((c) => c.length > 0)).toBe(true);
      expect(level.crates.length).toBeLessThanOrEqual(8);
      const r = solve(level, params.rackTarget[1], 2_000_000);
      expect(r.solvable, `${level.id} should be solvable within ${params.rackTarget[1]}`).toBe(true);
      expect(g.rackNeed).toBeLessThanOrEqual(params.rackTarget[1]);
    }
  }, 60_000);

  it('풀이 경로를 실제 규칙으로 재생하면 이긴다', () => {
    const { level, params } = levelFor(45);
    const r = solve(level, params.rackTarget[1]);
    const s = newGame(level);
    for (const move of r.path) tap(level, s, move);
    expect(s.status).toBe('won');
  });

  it('튜토리얼은 봇이 거의 항상 이긴다', () => {
    for (let n = 1; n <= 3; n++) expect(estimateWinRate(levelFor(n).level, 40, n)).toBeGreaterThan(0.9);
  });
});
