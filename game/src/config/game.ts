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
export const THEME = {
  font: '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
  bg: 0x1b1d2b,
  bgCss: '#1b1d2b',
  panel: 0x262a3d,
  primary: 0x4f7cff,
  accent: 0xffc845,
  danger: 0xff5d6c,
  success: 0x3ddc97,
  text: '#ffffff',
  textDim: '#9aa3c7',
} as const;
