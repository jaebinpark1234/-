import Phaser from 'phaser';
import { GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import type { PlayMode } from '../core/progress';
import { getServices } from '../services';
import { RoundEvents, type RoundResult } from './ResultScene';

// 장르가 정해지면 이 씬을 교체한다. 지금은 흐름 확인용 임시 판.
export class GameScene extends Phaser.Scene {
  private mode: PlayMode = 'level';

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: { mode?: PlayMode }): void {
    this.mode = data.mode ?? 'level';
  }

  create(): void {
    const { save, ads } = getServices();
    const level = save.get().level;
    ads.gameplayStart();
    this.add.text(GAME_WIDTH / 2, 200, `placeholder ${this.mode} ${level}`, { fontFamily: THEME.font, fontSize: '40px' }).setOrigin(0.5);
    this.input.once('pointerup', () => this.finish(true, level));
    this.game.events.on(RoundEvents.Continue, this.onContinue, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(RoundEvents.Continue, this.onContinue, this));
  }

  private onContinue(): void {
    getServices().ads.gameplayStart();
  }

  private finish(win: boolean, level: number): void {
    getServices().ads.gameplayStop();
    const result: RoundResult = { mode: this.mode, level, win, score: 0, coins: 10, canContinue: !win };
    this.scene.pause();
    this.scene.launch(SceneKeys.Result, result);
  }
}
