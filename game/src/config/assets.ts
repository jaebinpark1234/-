/**
 * 에셋 목록. 아트/사운드 담당 AI는 public/assets/에 파일을 넣고 여기에 한 줄 추가하면 된다.
 * 파일이 없거나 로딩에 실패해도 게임은 돌아간다. 이미지는 PreloadScene이 임시 도형으로 대신 그리고,
 * 소리는 audio.ts가 조용히 건너뛴다.
 */
export type AssetEntry = { type: 'image'; key: string; path: string } | { type: 'audio'; key: string; path: string[] };

export const ASSETS: AssetEntry[] = [
  // 예시:
  // { type: 'image', key: 'bg', path: 'assets/images/bg.png' },
  // { type: 'audio', key: 'sfx.tap', path: ['assets/audio/tap.ogg', 'assets/audio/tap.mp3'] },
];

/** 코드에서 쓰는 사운드 키. 파일이 없어도 호출해도 된다. */
export const SFX = {
  tap: 'sfx.tap',
  win: 'sfx.win',
  lose: 'sfx.lose',
  coin: 'sfx.coin',
} as const;
