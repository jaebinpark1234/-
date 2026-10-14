// 드론 색 8가지. 색약 플레이어를 위해 팩에는 항상 기호를 같이 그린다(symbol).
export const PALETTE = [
  { key: 'red', hex: 0xff4d5e, symbol: 'heart' },
  { key: 'orange', hex: 0xff9a3c, symbol: 'triangle' },
  { key: 'yellow', hex: 0xffd93d, symbol: 'star' },
  { key: 'green', hex: 0x4cd964, symbol: 'square' },
  { key: 'cyan', hex: 0x3dd6f5, symbol: 'diamond' },
  { key: 'blue', hex: 0x4f7cff, symbol: 'circle' },
  { key: 'purple', hex: 0xa66bff, symbol: 'moon' },
  { key: 'pink', hex: 0xff7ac8, symbol: 'bolt' },
] as const;

export type ColorId = number;
export type SymbolName = (typeof PALETTE)[number]['symbol'];

export const COLOR_COUNT = PALETTE.length;

/** 그림 ASCII에서 쓰는 글자 → 색 번호. '.'은 빈칸. */
export const PICTURE_CHARS: Readonly<Record<string, ColorId>> = {
  r: 0,
  o: 1,
  y: 2,
  g: 3,
  c: 4,
  b: 5,
  p: 6,
  k: 7,
};
