import Phaser from 'phaser';
import { PALETTE, type SymbolName } from '../core/palette';

/** 팩 텍스처 크기(2배 해상도). 화면에서는 setDisplaySize로 줄여 쓴다. */
export const PACK_W = 192;
export const PACK_H = 120;
/** 드론 빛 텍스처 한 변. 크기 계산할 때 이 값으로 나눈다. */
export const DRONE_SIZE = 128;

export const TextureKeys = {
  pack: (color: number) => `pack-${color}`,
  packHidden: 'pack-hidden',
  drone: 'drone',
  dot: 'dot',
  /** 튜토리얼 탭 표시(고리) */
  finger: 'tap-ring',
} as const;

/**
 * 그림 파일 없이 코드로 만드는 기본 텍스처. 아트 담당이 같은 키로 PNG를 넣으면(config/assets.ts)
 * 그게 먼저 로드되고 여기서는 건너뛴다.
 */
export function makeGameTextures(scene: Phaser.Scene): void {
  PALETTE.forEach((c, i) => {
    canvasTexture(scene, TextureKeys.pack(i), PACK_W, PACK_H, (ctx) => {
      drawBlock(ctx, c.hex);
      drawSymbol(ctx, c.symbol, PACK_W / 2, BLOCK_FACE_H / 2 + 2, 24, c.hex);
    });
  });

  canvasTexture(scene, TextureKeys.packHidden, PACK_W, PACK_H, (ctx) => {
    drawBlock(ctx, 0x343c5e);
    ctx.font = '300 60px "Noto Sans KR", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(238,240,247,0.75)';
    ctx.fillText('?', PACK_W / 2, BLOCK_FACE_H / 2 + 4);
  });

  // 가운데 하얀 점 + 바깥으로 퍼지는 빛. 흰색으로 만들고 setTint로 색을 입힌다.
  canvasTexture(scene, TextureKeys.drone, DRONE_SIZE, DRONE_SIZE, (ctx) => {
    const r = DRONE_SIZE / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DRONE_SIZE, DRONE_SIZE);
  });

  canvasTexture(scene, TextureKeys.dot, 16, 16, (ctx) => {
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
  });

  // 튜토리얼에서 누를 곳에 퍼지는 고리. 흰색 원 테두리.
  canvasTexture(scene, TextureKeys.finger, 128, 128, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return;
  draw(ctx);
  tex.refresh();
}

/** 0xRRGGBB에 흰색(amount>0) 또는 검은색(amount<0)을 섞은 CSS 색. */
export function shade(hex: number, amount: number, alpha = 1): string {
  const mix = (v: number) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  const r = mix((hex >> 16) & 0xff);
  const g = mix((hex >> 8) & 0xff);
  const b = mix(hex & 0xff);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 같은 계산을 Phaser 색 숫자로. */
export function shadeHex(hex: number, amount: number): number {
  const mix = (v: number) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return (mix((hex >> 16) & 0xff) << 16) | (mix((hex >> 8) & 0xff) << 8) | mix(hex & 0xff);
}

const BLOCK_FACE_H = PACK_H - 12;

/** 무광 타일. 아래쪽에 얇은 두께만 보이고 광택은 넣지 않는다. */
function drawBlock(ctx: CanvasRenderingContext2D, hex: number): void {
  const r = 22;
  ctx.fillStyle = shade(hex, -0.32);
  ctx.beginPath();
  ctx.roundRect(4, 10, PACK_W - 8, PACK_H - 12, r);
  ctx.fill();
  ctx.fillStyle = shade(hex, 0);
  ctx.beginPath();
  ctx.roundRect(4, 2, PACK_W - 8, BLOCK_FACE_H, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4 + r, 3);
  ctx.lineTo(PACK_W - 4 - r, 3);
  ctx.stroke();
}

/** 팩 위의 흰 기호. 색만으로 구분하지 않게 하려는 것. 살짝 눌린 자국처럼 아래에 그림자를 깐다. */
function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: SymbolName,
  x: number,
  y: number,
  r: number,
  bg: number,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  symbolPath(ctx, symbol, x, y, r, bg, false);
}

function symbolPath(
  ctx: CanvasRenderingContext2D,
  symbol: SymbolName,
  x: number,
  y: number,
  r: number,
  bg: number,
  isShadow: boolean,
): void {
  const poly = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.fill();
  };
  const circle = (cx: number, cy: number, cr: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  };
  switch (symbol) {
    case 'circle':
      circle(x, y, r * 0.8);
      break;
    case 'square':
      ctx.beginPath();
      ctx.roundRect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5, r * 0.2);
      ctx.fill();
      break;
    case 'triangle':
      poly([
        [x, y - r],
        [x - r, y + r * 0.8],
        [x + r, y + r * 0.8],
      ]);
      break;
    case 'diamond':
      poly([
        [x, y - r],
        [x + r * 0.8, y],
        [x, y + r],
        [x - r * 0.8, y],
      ]);
      break;
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
      }
      poly(pts);
      break;
    }
    case 'heart':
      circle(x - r * 0.45, y - r * 0.25, r * 0.5);
      circle(x + r * 0.45, y - r * 0.25, r * 0.5);
      poly([
        [x - r * 0.93, y - r * 0.05],
        [x + r * 0.93, y - r * 0.05],
        [x, y + r * 0.9],
      ]);
      break;
    case 'moon': {
      // 초승달은 안쪽을 배경색으로 덮어서 만든다. 그림자 단계에서는 덮지 않는다.
      const fill = ctx.fillStyle;
      circle(x, y, r * 0.85);
      if (!isShadow) {
        ctx.fillStyle = shade(bg, 0);
        circle(x + r * 0.4, y - r * 0.2, r * 0.7);
        ctx.fillStyle = fill;
      }
      break;
    }
    case 'bolt':
      poly([
        [x + r * 0.2, y - r],
        [x - r * 0.6, y + r * 0.15],
        [x - r * 0.05, y + r * 0.15],
        [x - r * 0.25, y + r],
        [x + r * 0.6, y - r * 0.15],
        [x + r * 0.05, y - r * 0.15],
      ]);
      break;
  }
}

/** 누를 곳을 알려 주는 표시: 가운데 점 + 퍼져 나가는 고리. */
export function tapHint(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const box = scene.add.container(x, y);
  const dot = scene.add.circle(0, 0, 9, 0xffffff, 0.95);
  const ring = scene.add.image(0, 0, TextureKeys.finger).setScale(0.15).setAlpha(0.9);
  scene.tweens.add({ targets: ring, scale: 0.6, alpha: 0, duration: 1000, repeat: -1, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: dot, scale: 0.75, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  box.add([ring, dot]);
  return box;
}
