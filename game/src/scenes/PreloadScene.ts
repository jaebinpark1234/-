import Phaser from 'phaser';
import { ASSETS } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import { getServices } from '../services';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    const { i18n } = getServices();
    const barW = 420;
    const x = (GAME_WIDTH - barW) / 2;
    const y = GAME_HEIGHT / 2;
    const track = this.add.graphics().fillStyle(THEME.panel, 1).fillRoundedRect(x, y, barW, 18, 9);
    const bar = this.add.graphics();
    this.add
      .text(GAME_WIDTH / 2, y - 50, i18n.t('common.loading'), { fontFamily: THEME.font, fontSize: '32px', color: THEME.textDim })
      .setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      bar.clear().fillStyle(THEME.primary, 1).fillRoundedRect(x, y, Math.max(18, barW * p), 18, 9);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn('[preload] missing asset, using placeholder:', file.key);
    });
    this.load.once('complete', () => track.destroy());

    for (const asset of ASSETS) {
      if (asset.type === 'image') this.load.image(asset.key, asset.path);
      else this.load.audio(asset.key, asset.path);
    }
  }

  create(): void {
    this.makePlaceholders();
    getServices().ads.loadingFinished();
    this.scene.start(SceneKeys.Menu);
  }

  /** 아직 그림이 없는 키는 단색 도형으로 만들어 둔다. 실제 PNG가 들어오면 그게 우선이다. */
  private makePlaceholders(): void {
    for (const asset of ASSETS) {
      if (asset.type !== 'image' || this.textures.exists(asset.key)) continue;
      const g = this.make.graphics({}, false);
      g.fillStyle(THEME.primary, 1).fillRoundedRect(0, 0, 96, 96, 18);
      g.generateTexture(asset.key, 96, 96);
      g.destroy();
    }
  }
}
