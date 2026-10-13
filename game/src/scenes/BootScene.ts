import Phaser from 'phaser';
import { SceneKeys } from '../config/game';
import { getServices } from '../services';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  async create(): Promise<void> {
    const { ads, analytics, platform } = getServices();
    await ads.init();
    analytics.track('boot', { platform, ads: ads.providerName });
    this.scene.start(SceneKeys.Preload);
  }
}
