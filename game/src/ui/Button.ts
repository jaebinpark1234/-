import Phaser from 'phaser';
import { THEME } from '../config/game';
import { shadeHex } from './textures';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  textColor?: string;
  fontSize?: number;
  /** 보상형 광고 버튼처럼 아이콘 글자를 앞에 붙일 때. */
  prefix?: string;
}

/**
 * 둥근 사각형 + 글자 버튼. 누르면 살짝 줄었다가 돌아오고, 손을 뗄 때 onClick이 불린다.
 * 나중에 스프라이트 버튼으로 바꿔도 이 클래스만 고치면 된다.
 */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private enabled = true;
  readonly w: number;
  readonly h: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOptions = {}) {
    super(scene, x, y);
    this.w = opts.width ?? 420;
    this.h = opts.height ?? 110;
    const color = opts.color ?? THEME.primary;

    this.bg = scene.add.graphics();
    this.drawBg(color);
    this.label = scene.add
      .text(0, 0, (opts.prefix ?? '') + text, {
        fontFamily: THEME.font,
        fontSize: `${opts.fontSize ?? 44}px`,
        color: opts.textColor ?? '#ffffff',
        fontStyle: 'bold',
        shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.35)', blur: 0, fill: true },
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);

    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 0.96, duration: 60 });
      this.bg.y = 4;
      this.label.y = 4;
    });
    const release = () => {
      this.bg.y = 0;
      this.label.y = 0;
      scene.tweens.add({ targets: this, scale: 1, duration: 80 });
    };
    this.on('pointerout', release);
    this.on('pointerup', () => {
      release();
      if (!this.enabled) return;
      onClick();
    });
    scene.add.existing(this);
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.45);
    return this;
  }

  /** 아래쪽 두께(lip)가 보이는 입체 버튼. 눌리면 면이 lip 쪽으로 내려간다. */
  private drawBg(color: number): void {
    const r = Math.min(28, this.h / 2);
    const lip = 8;
    const { w, h } = this;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + lip + 4, w, h, r);
    this.bg.fillStyle(shadeHex(color, -0.35), 1).fillRoundedRect(-w / 2, -h / 2 + lip, w, h, r);
    this.bg.fillGradientStyle(shadeHex(color, 0.18), shadeHex(color, 0.18), color, color, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bg.fillStyle(0xffffff, 0.16).fillRoundedRect(-w / 2 + 10, -h / 2 + 5, w - 20, Math.min(22, h * 0.28), r / 2);
  }
}
