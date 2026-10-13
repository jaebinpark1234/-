import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, THEME } from './config/game';
import { initServices } from './services';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultScene } from './scenes/ResultScene';

let game: Phaser.Game | null = null;

initServices({
  search: window.location.search,
  buildPlatform: import.meta.env.VITE_PLATFORM,
  navigatorLang: navigator.language,
  hooks: {
    // 광고가 떠 있는 동안 소리와 게임 시간을 멈춘다. 포털 심사에서 확인하는 항목이다.
    onPause: () => {
      if (!game) return;
      game.sound.mute = true;
      game.loop.sleep();
    },
    onResume: () => {
      if (!game) return;
      game.loop.wake();
      game.sound.mute = false;
    },
  },
});

game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: THEME.bgCss,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: { activePointers: 2 },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, ResultScene],
});

// 스모크 테스트와 디버깅용. 배포 빌드에서도 해가 없다.
(window as unknown as { __game?: Phaser.Game }).__game = game;
