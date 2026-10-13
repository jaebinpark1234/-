import Phaser from 'phaser';
import { SFX } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import { currentStreak, isDailyDone } from '../core/progress';
import { getServices } from '../services';
import { playSfx } from '../services/audio';
import { Button } from '../ui/Button';

// 가제. 상표 검색(KIPRIS, USPTO, 스토어 검색) 뒤에 확정한다. docs/LAUNCH.md 참고.
export const GAME_TITLE = { ko: '밤하늘 드론쇼', en: 'Night Sky Show' };

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

    new Button(
      this,
      cx,
      760,
      `${i18n.t('menu.play')}  ·  ${i18n.t('menu.level', { n: data.level })}`,
      () => {
        playSfx(this, SFX.tap);
        this.scene.start(SceneKeys.Game, { mode: 'level' });
      },
      { width: 520, height: 130, fontSize: 46 },
    );

    const dailyDone = isDailyDone(data, now);
    const dailyBtn = new Button(
      this,
      cx,
      920,
      i18n.t(dailyDone ? 'menu.dailyDone' : 'menu.daily'),
      () => {
        playSfx(this, SFX.tap);
        this.scene.start(SceneKeys.Game, { mode: 'daily' });
      },
      { width: 520, color: THEME.panel, fontSize: 38 },
    );
    if (dailyDone) dailyBtn.setEnabled(false);

    const streak = currentStreak(data, now);
    if (streak > 0) {
      this.add
        .text(cx, 1010, i18n.t('menu.streak', { n: streak }), {
          fontFamily: THEME.font,
          fontSize: '30px',
          color: THEME.textDim,
        })
        .setOrigin(0.5);
    }

    new Button(
      this,
      cx,
      GAME_HEIGHT - 110,
      i18n.t('settings.title'),
      () => {
        playSfx(this, SFX.tap);
        this.openSettings();
      },
      { width: 300, height: 76, fontSize: 28, color: 0x3a3f5c },
    );
  }

  /** 효과음, 음악, 진동, 언어. 언어를 바꾸면 메뉴를 다시 그린다. */
  private openSettings(): void {
    const { i18n, save } = getServices();
    const cx = GAME_WIDTH / 2;
    const layer = this.add.container(0, 0).setDepth(10);
    // 뒤쪽 버튼이 눌리지 않게 화면 전체를 덮는다.
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const panel = this.add.rectangle(cx, GAME_HEIGHT / 2, 600, 820, THEME.panel).setStrokeStyle(4, 0x3a3f5c);
    const title = this.add
      .text(cx, GAME_HEIGHT / 2 - 330, i18n.t('settings.title'), {
        fontFamily: THEME.font,
        fontSize: '52px',
        fontStyle: 'bold',
        color: THEME.text,
      })
      .setOrigin(0.5);
    layer.add([shade, panel, title]);

    type Toggle = 'sound' | 'music' | 'haptics';
    const toggles: [Toggle, 'settings.sound' | 'settings.music' | 'settings.haptics'][] = [
      ['sound', 'settings.sound'],
      ['music', 'settings.music'],
      ['haptics', 'settings.haptics'],
    ];
    const label = (key: Toggle, text: Parameters<typeof i18n.t>[0]): string =>
      `${i18n.t(text)}: ${i18n.t(save.get().settings[key] ? 'settings.on' : 'settings.off')}`;
    toggles.forEach(([key, text], i) => {
      const btn: Button = new Button(
        this,
        cx,
        GAME_HEIGHT / 2 - 200 + i * 120,
        label(key, text),
        () => {
          save.update((d) => {
            d.settings[key] = !d.settings[key];
          });
          btn.setText(label(key, text));
          playSfx(this, SFX.tap);
        },
        { width: 460, height: 96, fontSize: 34, color: 0x3a3f5c },
      );
      layer.add(btn);
    });

    // 언어 이름은 번역하지 않고 그 언어로 쓴다.
    const langNames = { ko: '한국어', en: 'English' } as const;
    const langBtn = new Button(
      this,
      cx,
      GAME_HEIGHT / 2 + 160,
      `${i18n.t('settings.lang')}: ${langNames[i18n.lang]}`,
      () => {
        const next = i18n.lang === 'ko' ? 'en' : 'ko';
        save.update((d) => {
          d.settings.lang = next;
        });
        i18n.lang = next;
        this.scene.restart();
      },
      { width: 460, height: 96, fontSize: 34, color: 0x3a3f5c },
    );
    const close = new Button(
      this,
      cx,
      GAME_HEIGHT / 2 + 310,
      i18n.t('settings.close'),
      () => {
        playSfx(this, SFX.tap);
        layer.destroy();
      },
      { width: 300, height: 86, fontSize: 32 },
    );
    layer.add([langBtn, close]);
  }
}
