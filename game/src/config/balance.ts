// 경제 수치는 전부 여기. 처음 잡은 값이라 플레이 데이터를 보고 바꾼다.
export const BALANCE = {
  /** 승리 코인 = (base + floor(level / perLevelDivisor)) * coinMultiplier */
  winCoinsBase: 10,
  winCoinsPerLevelDivisor: 2,
  /** 연쇄 한 번마다 추가 코인. */
  chainBonus: 2,
  /** 그림 맞히기: 최소 보너스 + 아직 안 켜진 비율 * 추가분. */
  guessBonusMin: 5,
  guessBonusScale: 25,
  /** 이만큼 켜져야 맞히기 버튼이 나온다. 처음부터 찍으면 1/3 확률로 이득을 보는 구멍을 막으려는 것. */
  guessUnlockRatio: 0.3,
  /** 맞히면 쇼 프로그램을 몇 개까지 미리 보여 주는지(기본은 지금 + 다음 2개). */
  programPreviewDefault: 3,
  programPreviewAfterGuess: 7,
  boosterCost: { undo: 60, slot: 90 },
  /** 이어하기로 늘어나는 거치대 칸. */
  continueSlots: 2,
} as const;

export function winCoins(level: number, multiplier: number): number {
  return (BALANCE.winCoinsBase + Math.floor(level / BALANCE.winCoinsPerLevelDivisor)) * multiplier;
}

export function guessBonus(unlitRatio: number): number {
  return BALANCE.guessBonusMin + Math.round(BALANCE.guessBonusScale * Math.max(0, Math.min(1, unlitRatio)));
}
