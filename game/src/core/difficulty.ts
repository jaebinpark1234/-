export type LevelKind = 'tutorial' | 'normal' | 'hard' | 'breather' | 'finale' | 'daily';

/**
 * 레벨 생성 파라미터. 아래 표의 숫자는 처음 잡은 설계 목표치다.
 * 실제 플레이 데이터(레벨별 실패율)를 보고 조정한다. 조정은 scripts/levels-report.ts로 확인.
 */
export interface LevelParams {
  kind: LevelKind;
  /** 팩 한 개가 켜는 칸 수의 기준. 작을수록 팩이 많아진다. */
  cellsPerPack: number;
  /** 순서 하나가 요구하는 팩 수 상한. */
  maxPacksPerCue: number;
  /** 순서 하나가 켜는 칸 수 상한. */
  chunkSize: number;
  /** 상자 하나에 쌓는 팩 수 기준. */
  depth: number;
  minCrates: number;
  maxCrates: number;
  /** 맨 위가 아닌 팩 중 '?'로 가릴 비율. */
  hiddenRatio: number;
  rackCapacity: number;
  /**
   * 완벽하게 둬도 거치대가 최소 몇 칸 필요해야 하는지 [하한, 상한].
   * 생성기가 이 범위에 들어올 때까지 팩 위치를 바꾼다. 상한은 rackCapacity보다 작게 둬서
   * '?' 팩과 실수를 받아 줄 여유를 남긴다.
   */
  rackTarget: [number, number];
  /**
   * '?'를 모르는 봇(core/bot.ts, noise 0.1)의 승률 목표 [하한, 상한].
   * 봇은 사람의 대용품일 뿐이라 출시 후 레벨별 실패율 데이터로 다시 맞춘다.
   */
  botWinTarget: [number, number];
  /** 승리 코인 배수. */
  coinMultiplier: number;
}

const BASE: LevelParams = {
  kind: 'normal',
  cellsPerPack: 6,
  maxPacksPerCue: 2,
  chunkSize: 12,
  depth: 4,
  minCrates: 4,
  maxCrates: 5,
  hiddenRatio: 0,
  rackCapacity: 5,
  rackTarget: [1, 1],
  botWinTarget: [0.55, 0.95],
  coinMultiplier: 1,
};

function kindFor(level: number): LevelKind {
  if (level <= 3) return 'tutorial';
  if (level >= 20 && level % 10 === 0) return 'finale';
  if (level >= 10 && level % 5 === 0) return 'hard';
  if (level >= 11 && level % 5 === 1) return 'breather';
  return 'normal';
}

export function paramsForLevel(level: number): LevelParams {
  const kind = kindFor(level);
  if (kind === 'tutorial') {
    return {
      ...BASE,
      kind,
      cellsPerPack: 10,
      maxPacksPerCue: 2,
      chunkSize: 20,
      depth: 3,
      minCrates: 3,
      maxCrates: 4,
      rackTarget: [0, 0],
      botWinTarget: [0.95, 1],
    };
  }

  let p: LevelParams;
  if (level <= 20) {
    p = { ...BASE, hiddenRatio: level < 8 ? 0 : 0.1, rackTarget: level <= 10 ? [1, 1] : [1, 2] };
  } else if (level <= 60) {
    const t = (level - 21) / 39;
    p = {
      ...BASE,
      cellsPerPack: 5,
      maxPacksPerCue: 3,
      chunkSize: 10,
      depth: 5,
      minCrates: 5,
      maxCrates: 7,
      hiddenRatio: 0.15 + 0.1 * t,
      rackTarget: t < 0.5 ? [2, 2] : [2, 3],
    };
  } else {
    p = {
      ...BASE,
      cellsPerPack: 4,
      maxPacksPerCue: 3,
      chunkSize: 9,
      depth: 6,
      minCrates: 6,
      maxCrates: 8,
      hiddenRatio: Math.min(0.35, 0.25 + (level - 61) * 0.002),
      rackTarget: [3, 3],
    };
  }

  p.kind = kind;
  const [lo, hi] = p.rackTarget;
  if (kind === 'hard') {
    p.rackTarget = [Math.min(4, hi + 1), Math.min(4, hi + 1)];
    p.botWinTarget = [0.35, 0.8];
  } else if (kind === 'breather') {
    p.rackTarget = [0, Math.max(0, lo - 1)];
    p.hiddenRatio = Math.max(0, p.hiddenRatio - 0.1);
    p.botWinTarget = [0.9, 1];
  } else if (kind === 'finale') {
    p.rackTarget = [Math.min(4, hi + 1), Math.min(4, hi + 1)];
    p.botWinTarget = [0.3, 0.75];
    p.coinMultiplier = 2;
  }
  return p;
}

/** 데일리 쇼는 모든 사람에게 같은 난이도. 중간 구간 수준으로 고정한다. */
export function paramsForDaily(): LevelParams {
  return { ...paramsForLevel(34), kind: 'daily', rackTarget: [2, 3], botWinTarget: [0.45, 0.9], coinMultiplier: 2 };
}
