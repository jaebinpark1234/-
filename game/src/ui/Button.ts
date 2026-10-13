import Phaser from 'phaser';
import { THEME } from '../config/game';

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
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);

    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 0.94, duration: 60 });
    });
    this.on('pointerout', () => scene.tweens.add({ targets: this, scale: 1, duration: 80 }));
    this.on('pointerup', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 1, duration: 80 });
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

  private drawBg(color: number): void {
    const r = Math.min(28, this.h / 2);
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25);
    this.bg.fillRoundedRect(-this.w / 2, -this.h / 2 + 8, this.w, this.h, r);
    this.bg.fillStyle(color, 1);
    this.bg.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
  }
}
