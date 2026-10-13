import Phaser from 'phaser';
import { PALETTE, type SymbolName } from '../core/palette';

export const PACK_W = 96;
export const PACK_H = 56;

export const TextureKeys = {
  pack: (color: number) => `pack-${color}`,
  packHidden: 'pack-hidden',
  drone: 'drone',
  dot: 'dot',
} as const;

/**
 * 그림 파일 없이 코드로 만드는 기본 텍스처. 아트 담당이 같은 키로 PNG를 넣으면(config/assets.ts)
 * 그게 먼저 로드되고 여기서는 건너뛴다.
 */
export function makeGameTextures(scene: Phaser.Scene): void {
  PALETTE.forEach((c, i) => {
    const key = TextureKeys.pack(i);
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x000000, 0.25).fillRoundedRect(0, 6, PACK_W, PACK_H - 6, 14);
    g.fillStyle(c.hex, 1).fillRoundedRect(0, 0, PACK_W, PACK_H - 6, 14);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(6, 4, PACK_W - 12, 12, 6);
    drawSymbol(g, c.symbol, PACK_W / 2, (PACK_H - 6) / 2, 15, c.hex);
    g.generateTexture(key, PACK_W, PACK_H);
    g.destroy();
  });

  if (!scene.textures.exists(TextureKeys.packHidden)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x000000, 0.25).fillRoundedRect(0, 6, PACK_W, PACK_H - 6, 14);
    g.fillStyle(0x4a4f6b, 1).fillRoundedRect(0, 0, PACK_W, PACK_H - 6, 14);
    g.lineStyle(3, 0x8a90b0, 1).strokeRoundedRect(2, 2, PACK_W - 4, PACK_H - 10, 12);
    g.generateTexture(TextureKeys.packHidden, PACK_W, PACK_H);
    g.destroy();
  }

  if (!scene.textures.exists(TextureKeys.drone)) {
    // 가운데가 밝고 바깥으로 퍼지는 빛. 흰색으로 만들고 setTint로 색을 입힌다.
    const size = 64;
    const tex = scene.textures.createCanvas(TextureKeys.drone, size, size);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.22, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
    }
  }

  if (!scene.textures.exists(TextureKeys.dot)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture(TextureKeys.dot, 8, 8);
    g.destroy();
  }
}

/** 팩 위의 흰 기호. 색만으로 구분하지 않게 하려는 것. */
function drawSymbol(
  g: Phaser.GameObjects.Graphics,
  symbol: SymbolName,
  x: number,
  y: number,
  r: number,
  bg: number,
): void {
  g.fillStyle(0xffffff, 1);
  switch (symbol) {
    case 'circle':
      g.fillCircle(x, y, r * 0.8);
      break;
    case 'square':
      g.fillRect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
      break;
    case 'triangle':
      g.fillTriangle(x, y - r, x - r, y + r * 0.8, x + r, y + r * 0.8);
      break;
    case 'diamond':
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x, y - r),
          new Phaser.Math.Vector2(x + r * 0.8, y),
          new Phaser.Math.Vector2(x, y + r),
          new Phaser.Math.Vector2(x - r * 0.8, y),
        ],
        true,
      );
      break;
    case 'star': {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rad, y + Math.sin(a) * rad));
      }
      g.fillPoints(pts, true);
      break;
    }
    case 'heart':
      g.fillCircle(x - r * 0.45, y - r * 0.25, r * 0.5);
      g.fillCircle(x + r * 0.45, y - r * 0.25, r * 0.5);
      g.fillTriangle(x - r * 0.93, y - r * 0.05, x + r * 0.93, y - r * 0.05, x, y + r * 0.9);
      break;
    case 'moon':
      g.fillCircle(x, y, r * 0.85);
      g.fillStyle(bg, 1).fillCircle(x + r * 0.4, y - r * 0.2, r * 0.7);
      break;
    case 'bolt':
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x + r * 0.2, y - r),
          new Phaser.Math.Vector2(x - r * 0.6, y + r * 0.15),
          new Phaser.Math.Vector2(x - r * 0.05, y + r * 0.15),
          new Phaser.Math.Vector2(x - r * 0.25, y + r),
          new Phaser.Math.Vector2(x + r * 0.6, y - r * 0.15),
          new Phaser.Math.Vector2(x + r * 0.05, y - r * 0.15),
        ],
        true,
      );
      break;
  }
}
