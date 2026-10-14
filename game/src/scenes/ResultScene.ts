import Phaser from 'phaser';
import { SFX } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import { applyRoundOutcome, type RoundOutcome } from '../core/progress';
import { getServices } from '../services';
import { playSfx } from '../services/audio';
import { glassPanel } from '../ui/backdrop';
import { Button } from '../ui/Button';

export interface RoundResult extends RoundOutcome {
  /** 결과 화면 두 번째 줄. 이기면 완성된 그림 이름을 보여 준다. */
  subtitle?: string;
  /** 거치대를 한 번도 안 쓴 승리. */
  perfect: boolean;
  /** 승리 화면에서 '광고 보고 2배'를 보여 줄지. 눈에 띄는 승리에만 보여 줘서 광고 피로를 줄인다. */
  offerDouble: boolean;
  /** 졌을 때 보상형 광고로 이어하기를 허용할지. 한 판에 한 번만 허용하는 게 보통이다. */
  canContinue: boolean;
}

export const RoundEvents = {
  Continue: 'round:continue',
} as const;

/**
 * 결과 화면. GameScene을 멈춘 채 위에 띄운다(scene.launch).
 * 이어하기를 고르면 GameScene을 다시 깨우고 RoundEvents.Continue를 보낸다.
 */
export class ResultScene extends Phaser.Scene {
  private result!: RoundResult;
  private leaving = false;
  private rewardedOffered = false;

  constructor() {
    super(SceneKeys.Result);
  }

  init(data: RoundResult): void {
    this.result = data;
    this.leaving = false;
    this.rewardedOffered = false;
  }

  create(): void {
    const { i18n, save, analytics } = getServices();
    const r = this.result;
    const cx = GAME_WIDTH / 2;

    save.update((d) => applyRoundOutcome(d, r, new Date()));
    analytics.track(r.win ? 'round_win' : 'round_lose', { mode: r.mode, level: r.level, score: r.score });
    playSfx(this, r.win ? SFX.win : SFX.lose);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const panel = this.add.graphics();
    glassPanel(panel, 60, 300, GAME_WIDTH - 120, 720, 36);

    this.add
      .text(cx, 400, i18n.t(r.win ? (r.perfect ? 'result.perfect' : 'result.win') : 'result.lose'), {
        fontFamily: THEME.font,
        fontSize: '72px',
        fontStyle: '500',
        color: r.win ? THEME.text : '#ff8a8a',
      })
      .setOrigin(0.5);
    if (r.subtitle) {
      this.add
        .text(cx, 490, r.subtitle, { fontFamily: THEME.font, fontSize: '48px', color: THEME.text })
        .setOrigin(0.5);
    }

    if (r.win && r.coins > 0) {
      this.rewardedOffered = r.offerDouble;
      const coinText = this.add
        .text(cx, 560, i18n.t('result.coins', { n: r.coins }), {
          fontFamily: THEME.font,
          fontSize: '36px',
          color: THEME.accentCss,
        })
        .setOrigin(0.5);
      if (r.offerDouble) {
        const doubleBtn = new Button(
          this,
          cx,
          680,
          i18n.t('result.double'),
          async () => {
            doubleBtn.setEnabled(false);
            const res = await getServices().ads.showRewarded();
            analytics.track('rewarded_double', { result: res, level: r.level });
            if (res === 'rewarded') {
              save.update((d) => {
                d.coins += r.coins;
              });
              coinText.setText(i18n.t('result.coins', { n: r.coins * 2 }));
              playSfx(this, SFX.coin);
            } else {
              doubleBtn.setEnabled(true);
            }
          },
          { color: THEME.accent, fontSize: 34, width: 480, prefix: '▶ ' },
        );
      }
    }

    if (!r.win && r.canContinue) {
      this.rewardedOffered = true;
      new Button(this, cx, 680, i18n.t('result.continue'), () => void this.continueWithAd(), {
        color: THEME.accent,
        fontSize: 34,
        width: 480,
        prefix: '▶ ',
      });
    }

    const primaryLabel = r.win && r.mode === 'level' ? i18n.t('result.next') : i18n.t('result.retry');
    new Button(this, cx, 820, primaryLabel, () => void this.leave(SceneKeys.Game), { width: 480 });
    new Button(this, cx, 940, i18n.t('result.home'), () => void this.leave(SceneKeys.Menu), {
      width: 480,
      variant: 'ghost',
      fontSize: 36,
      height: 90,
    });
  }

  private async continueWithAd(): Promise<void> {
    if (this.leaving) return;
    const { ads, analytics } = getServices();
    const res = await ads.showRewarded();
    analytics.track('rewarded_continue', { result: res, level: this.result.level });
    if (res !== 'rewarded') return;
    this.leaving = true;
    this.scene.stop();
    this.scene.resume(SceneKeys.Game);
    this.game.events.emit(RoundEvents.Continue);
  }

  private async leave(target: typeof SceneKeys.Game | typeof SceneKeys.Menu): Promise<void> {
    if (this.leaving) return;
    this.leaving = true;
    const { ads } = getServices();
    // 전면 광고는 이긴 뒤 넘어갈 때만. 같은 화면에서 보상형 광고를 제안했다면 건너뛴다(CrazyGames 규칙).
    if (this.result.win && !this.rewardedOffered) await ads.maybeShowInterstitial(this.result.level);
    this.scene.stop(SceneKeys.Game);
    this.scene.start(target, { mode: this.result.mode });
  }
}
