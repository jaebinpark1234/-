import Phaser from 'phaser';
import { SFX } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import { currentStreak, isDailyDone } from '../core/progress';
import { getServices } from '../services';
import { playSfx } from '../services/audio';
import { PALETTE } from '../core/palette';
import { drawNightBackdrop, glassPanel } from '../ui/backdrop';
import { Button } from '../ui/Button';
import { showHowTo } from '../ui/howto';
import { DRONE_SIZE, TextureKeys } from '../ui/textures';

// 가제. 상표 검색(KIPRIS, USPTO, 스토어 검색) 뒤에 확정한다. docs/LAUNCH.md 참고.
export const GAME_TITLE = { ko: '밤하늘 드론쇼', en: 'Night Sky Show' };
/** 테스트 빌드 표시. 정식 출시 때 빈 문자열로 둔다. */
export const BUILD_LABEL = 'beta 2';

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

    drawNightBackdrop(this, 880, 3);
    this.droneShow();

    if (BUILD_LABEL) {
      this.add
        .text(36, 56, BUILD_LABEL, { fontFamily: THEME.font, fontSize: '26px', color: THEME.textDim })
        .setOrigin(0, 0.5);
    }
    const coinPill = this.add.graphics();
    coinPill.fillStyle(0x000000, 0.35).fillRoundedRect(GAME_WIDTH - 196, 30, 170, 54, 27);
    this.add.circle(GAME_WIDTH - 166, 57, 15, 0xffc845).setStrokeStyle(3, 0xc48a12);
    this.add
      .text(GAME_WIDTH - 44, 57, `${data.coins}`, {
        fontFamily: THEME.font,
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffe08a',
      })
      .setOrigin(1, 0.5);

    this.add
      .text(cx, 600, GAME_TITLE[i18n.lang], {
        fontFamily: THEME.font,
        fontSize: '84px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
        shadow: { offsetX: 0, offsetY: 0, color: '#b48cff', blur: 28, fill: true },
      })
      .setOrigin(0.5);

    new Button(
      this,
      cx,
      790,
      `${i18n.t('menu.play')}  ·  ${i18n.t('menu.level', { n: data.level })}`,
      () => {
        playSfx(this, SFX.tap);
        this.scene.start(SceneKeys.Game, { mode: 'level' });
      },
      { width: 540, height: 130, fontSize: 46 },
    );

    const dailyDone = isDailyDone(data, now);
    const dailyBtn = new Button(
      this,
      cx,
      945,
      i18n.t(dailyDone ? 'menu.dailyDone' : 'menu.daily'),
      () => {
        playSfx(this, SFX.tap);
        this.scene.start(SceneKeys.Game, { mode: 'daily' });
      },
      { width: 540, height: 100, color: 0x6a4bd6, fontSize: 38 },
    );
    if (dailyDone) dailyBtn.setEnabled(false);

    const streak = currentStreak(data, now);
    if (streak > 0) {
      this.add
        .text(cx, 1030, i18n.t('menu.streak', { n: streak }), {
          fontFamily: THEME.font,
          fontSize: '30px',
          color: '#ffc845',
        })
        .setOrigin(0.5);
    }

    new Button(
      this,
      cx - 140,
      GAME_HEIGHT - 110,
      i18n.t('menu.howto'),
      () => {
        playSfx(this, SFX.tap);
        showHowTo(this, () => save.update((d) => void (d.howToSeen = true)));
      },
      { width: 260, height: 80, fontSize: 28, color: 0x3a3f6c },
    );
    new Button(
      this,
      cx + 140,
      GAME_HEIGHT - 110,
      i18n.t('settings.title'),
      () => {
        playSfx(this, SFX.tap);
        this.openSettings();
      },
      { width: 260, height: 80, fontSize: 28, color: 0x3a3f6c },
    );
  }

  /** 메뉴 배경의 드론쇼. 도시에서 날아올라 하트 → 별 → 원 모양을 돌아가며 만든다. 연출이라 Math.random을 쓴다. */
  private droneShow(): void {
    const count = 40;
    const center = { x: GAME_WIDTH / 2, y: 300 };
    const shapes: ((t: number) => { x: number; y: number })[] = [
      (t) => {
        const a = t * Math.PI * 2;
        return {
          x: 13 * Math.pow(Math.sin(a), 3),
          y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
        };
      },
      (t) => {
        const k = Math.floor(t * 10);
        const f = t * 10 - k;
        const pt = (i: number) => {
          const r = i % 2 === 0 ? 15 : 6.5;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          return { x: Math.cos(a) * r, y: Math.sin(a) * r };
        };
        const p = pt(k);
        const q = pt(k + 1);
        return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
      },
      (t) => ({ x: Math.cos(t * Math.PI * 2) * 14, y: Math.sin(t * Math.PI * 2) * 14 }),
    ];
    const colors = [PALETTE[0]!.hex, PALETTE[2]!.hex, PALETTE[4]!.hex];
    const drones = Array.from({ length: count }, () =>
      this.add
        .image(Math.random() * GAME_WIDTH, 880, TextureKeys.drone)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(56 / DRONE_SIZE)
        .setAlpha(0),
    );
    let step = 0;
    const form = () => {
      const shape = shapes[step % shapes.length]!;
      const tint = colors[step % colors.length]!;
      drones.forEach((d, i) => {
        const p = shape(i / count);
        d.setTint(tint);
        this.tweens.add({
          targets: d,
          x: center.x + p.x * 11,
          y: center.y + p.y * 11,
          alpha: 1,
          duration: 1400,
          delay: i * 18,
          ease: 'Sine.easeInOut',
        });
      });
      step++;
    };
    form();
    this.time.addEvent({ delay: 4200, loop: true, callback: form });
  }

  /** 효과음, 음악, 진동, 언어. 언어를 바꾸면 메뉴를 다시 그린다. */
  private openSettings(): void {
    const { i18n, save } = getServices();
    const cx = GAME_WIDTH / 2;
    const layer = this.add.container(0, 0).setDepth(10);
    // 뒤쪽 버튼이 눌리지 않게 화면 전체를 덮는다.
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const panel = glassPanel(this.add.graphics(), cx - 300, GAME_HEIGHT / 2 - 410, 600, 820, 36);
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
