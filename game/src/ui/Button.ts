import Phaser from 'phaser';
import { THEME } from '../config/game';

export interface ButtonOptions {
  width?: number;
  height?: number;
  /** solid일 때 바탕색. 밝은 색(primary, accent)이면 글자는 먹색이 된다. */
  color?: number;
  textColor?: string;
  fontSize?: number;
  /** solid: 색이 꽉 찬 주 버튼 / ghost: 가는 테두리만 있는 보조 버튼 */
  variant?: 'solid' | 'ghost';
  /** 보상형 광고 버튼처럼 아이콘 글자를 앞에 붙일 때. */
  prefix?: string;
}

/**
 * 알약 모양 버튼. 누르면 살짝 줄고 흐려졌다가 돌아오고, 손을 뗄 때 onClick이 불린다.
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
    this.h = opts.height ?? 104;
    const ghost = opts.variant === 'ghost';
    const color = opts.color ?? THEME.primary;
    const light = !ghost && (color === THEME.primary || color === THEME.accent);

    this.bg = scene.add.graphics();
    const r = this.h / 2;
    if (ghost) {
      this.bg.fillStyle(0xffffff, 0.04).fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
      this.bg.lineStyle(2, 0xffffff, 0.22).strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
    } else {
      this.bg.fillStyle(color, 1).fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
    }
    this.label = scene.add
      .text(0, 0, (opts.prefix ?? '') + text, {
        fontFamily: THEME.font,
        fontSize: `${opts.fontSize ?? 38}px`,
        color: opts.textColor ?? (light ? THEME.ink : THEME.text),
        fontStyle: ghost ? '400' : '600',
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);

    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 0.97, alpha: 0.8, duration: 60 });
    });
    const release = () => {
      if (this.enabled) scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 100 });
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
    this.setAlpha(enabled ? 1 : 0.35);
    return this;
  }
}
