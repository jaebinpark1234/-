import Phaser from 'phaser';
import { SFX } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import { currentStreak, isDailyDone } from '../core/progress';
import { getServices } from '../services';
import { playSfx } from '../services/audio';
import { Button } from '../ui/Button';

export const GAME_TITLE = { ko: '제목 미정', en: 'Untitled' };

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    const { i18n, save, analytics } = getServices();
    const data = save.get();
    const now = new Date();
    const cx = GAME_WIDTH / 2;
    analytics.track('menu_view', { level: data.level });

    this.add
      .text(cx, 330, GAME_TITLE[i18n.lang], {
        fontFamily: THEME.font,
        fontSize: '88px',
        fontStyle: 'bold',
        color: THEME.text,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH - 40, 60, `● ${data.coins}`, { fontFamily: THEME.font, fontSize: '36px', color: '#ffc845' })
      .setOrigin(1, 0.5);

    new Button(this, cx, 760, `${i18n.t('menu.play')}  ·  ${i18n.t('menu.level', { n: data.level })}`, () => {
      playSfx(this, SFX.tap);
      this.scene.start(SceneKeys.Game, { mode: 'level' });
    }, { width: 520, height: 130, fontSize: 46 });

    const dailyDone = isDailyDone(data, now);
    const dailyBtn = new Button(this, cx, 920, i18n.t(dailyDone ? 'menu.dailyDone' : 'menu.daily'), () => {
      playSfx(this, SFX.tap);
      this.scene.start(SceneKeys.Game, { mode: 'daily' });
    }, { width: 520, color: THEME.panel, fontSize: 38 });
    if (dailyDone) dailyBtn.setEnabled(false);

    const streak = currentStreak(data, now);
    if (streak > 0) {
      this.add
        .text(cx, 1010, i18n.t('menu.streak', { n: streak }), { fontFamily: THEME.font, fontSize: '30px', color: THEME.textDim })
        .setOrigin(0.5);
    }

    const soundLabel = (): string =>
      `${i18n.t('settings.sound')}: ${i18n.t(save.get().settings.sound ? 'settings.on' : 'settings.off')}`;
    const soundBtn: Button = new Button(this, cx, GAME_HEIGHT - 110, soundLabel(), () => {
      save.update((d) => {
        d.settings.sound = !d.settings.sound;
      });
      soundBtn.setText(soundLabel());
    }, { width: 300, height: 76, fontSize: 28, color: 0x3a3f5c });
  }
}
