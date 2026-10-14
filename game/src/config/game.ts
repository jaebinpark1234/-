// 화면 기준 해상도. 세로 9:16. 실제 화면에는 Scale.FIT으로 맞춘다.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const SceneKeys = {
  Boot: 'Boot',
  Preload: 'Preload',
  Menu: 'Menu',
  Game: 'Game',
  Result: 'Result',
} as const;

// 색과 글꼴은 여기서만 정한다. 아트 담당 AI는 이 값과 public/assets만 바꾸면 된다.
// 미니멀 방향(beta 3): 먹색 밤하늘 위에 드론 빛만 도드라지게. 광택, 그라데이션 버튼, 네온은 쓰지 않는다.
export const THEME = {
  font: '"Noto Sans KR", "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif',
  bg: 0x0b0f1e,
  bgCss: '#0b0f1e',
  /** 패널과 상자 바탕 */
  panel: 0x141a2e,
  /** 가는 테두리 선 */
  line: 0x2b3352,
  /** 주 버튼(밝은 면 + 먹색 글자) */
  primary: 0xeef0f7,
  ink: '#0b0f1e',
  accent: 0xf2c46d,
  accentCss: '#f2c46d',
  danger: 0xff6b6b,
  success: 0x5fd3a0,
  text: '#eef0f7',
  textDim: '#8a91ab',
} as const;
