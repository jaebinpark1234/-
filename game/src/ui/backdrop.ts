import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { Rng } from '../core/rng';
import { TextureKeys } from './textures';

/** 화면 맨 위와 맨 아래 색. index.html의 바깥 배경도 이 두 색으로 맞춰 둬야 위아래 여백이 티 나지 않는다. */
export const BACKDROP_TOP = 0x060918;
export const BACKDROP_BOTTOM = 0x0a0c1a;

/**
 * 밤하늘 + 도시 3겹 + 원근 바닥. 메뉴와 게임이 같이 쓴다.
 * horizon 위는 하늘, 아래는 판이 놓이는 바닥이다. seed가 같으면 같은 도시가 나온다.
 */
export function drawNightBackdrop(scene: Phaser.Scene, horizon: number, seed = 7): void {
  const key = `backdrop-${horizon}-${seed}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      paintSkyAndGround(ctx, horizon, new Rng(seed));
      tex.refresh();
    }
  }
  scene.add.image(0, 0, key).setOrigin(0);

  // 달
  scene.add.image(560, 170, TextureKeys.drone).setScale(3.2).setTint(0xffe9b0).setAlpha(0.35);
  scene.add.circle(560, 170, 34, 0xfff3d2);
  scene.add.circle(574, 160, 30, 0x1a1e4a, 0.18);

  // 별. 연출용이라 Math.random을 써도 된다.
  for (let i = 0; i < 90; i++) {
    const star = scene.add
      .image(Math.random() * GAME_WIDTH, Math.random() * (horizon - 160), TextureKeys.dot)
      .setScale(0.12 + Math.random() * 0.3)
      .setAlpha(0.3 + Math.random() * 0.6);
    scene.tweens.add({
      targets: star,
      alpha: 0.08,
      duration: 1000 + Math.random() * 2600,
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 2000,
    });
  }

  drawCity(scene, horizon, new Rng(seed * 31 + 1));
}

function paintSkyAndGround(ctx: CanvasRenderingContext2D, horizon: number, rng: Rng): void {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#060918');
  sky.addColorStop(0.5, '#111845');
  sky.addColorStop(0.82, '#2c2163');
  sky.addColorStop(1, '#5a3277');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_WIDTH, horizon);

  // 은하수 느낌의 흐린 빛 몇 덩이
  const blobs = [
    [0.2, 0.25, 260, '120,90,255'],
    [0.75, 0.45, 220, '60,140,255'],
    [0.45, 0.6, 300, '200,80,200'],
  ] as const;
  for (const [fx, fy, rad, rgb] of blobs) {
    const x = GAME_WIDTH * fx + rng.int(-40, 40);
    const y = horizon * fy;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${rgb},0.16)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, horizon);
  }

  // 바닥: 지평선에서 아래로 어두워지는 면 + 원근 격자
  const ground = ctx.createLinearGradient(0, horizon, 0, GAME_HEIGHT);
  ground.addColorStop(0, '#1d1840');
  ground.addColorStop(0.25, '#12122c');
  ground.addColorStop(1, '#0a0c1a');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, GAME_WIDTH, GAME_HEIGHT - horizon);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, GAME_WIDTH, GAME_HEIGHT - horizon);
  ctx.clip();
  ctx.strokeStyle = 'rgba(140,120,255,0.10)';
  ctx.lineWidth = 2;
  const vx = GAME_WIDTH / 2;
  const depth = GAME_HEIGHT - horizon;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(vx + i * 14, horizon);
    ctx.lineTo(vx + i * 150, GAME_HEIGHT + 40);
    ctx.stroke();
  }
  for (let i = 1; i <= 10; i++) {
    const y = horizon + depth * Math.pow(i / 10, 1.8);
    ctx.globalAlpha = 0.4 + i / 20;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // 지평선 위로 번지는 도시 불빛
  const glow = ctx.createLinearGradient(0, horizon - 120, 0, horizon + 30);
  glow.addColorStop(0, 'rgba(255,140,120,0)');
  glow.addColorStop(0.8, 'rgba(255,140,160,0.20)');
  glow.addColorStop(1, 'rgba(255,140,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - 120, GAME_WIDTH, 150);
}

/** 멀수록 밝고 낮은 대비, 가까울수록 어둡고 창문이 많은 건물 세 겹. */
function drawCity(scene: Phaser.Scene, horizon: number, rng: Rng): void {
  const layers = [
    { color: 0x2b2457, hMin: 70, hMax: 170, wMin: 40, wMax: 90, windows: 0.06, light: 0x8a7dff },
    { color: 0x1b1a3e, hMin: 40, hMax: 120, wMin: 44, wMax: 96, windows: 0.16, light: 0xffc98a },
    { color: 0x0f1026, hMin: 20, hMax: 70, wMin: 50, wMax: 110, windows: 0.3, light: 0xffd27a },
  ];
  layers.forEach((layer, li) => {
    const g = scene.add.graphics();
    let x = -20 + rng.int(0, 30);
    while (x < GAME_WIDTH + 20) {
      const w = rng.int(layer.wMin, layer.wMax);
      const h = rng.int(layer.hMin, layer.hMax);
      const top = horizon - h;
      g.fillStyle(layer.color, 1).fillRect(x, top, w, h + 2);
      // 옥상 테두리 한 줄로 입체감
      g.fillStyle(0xffffff, 0.05 + li * 0.02).fillRect(x, top, w, 2);
      for (let wy = top + 10; wy < horizon - 8; wy += 14) {
        for (let wx = x + 7; wx < x + w - 8; wx += 12) {
          if (rng.next() < layer.windows) g.fillStyle(layer.light, 0.35 + li * 0.15).fillRect(wx, wy, 5, 7);
        }
      }
      // 먼 쪽 높은 건물 꼭대기의 빨간 항공등
      if (li === 0 && h > 140) {
        const lamp = scene.add.circle(x + w / 2, top - 6, 3, 0xff4d5e);
        scene.tweens.add({ targets: lamp, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
      }
      x += w + rng.int(0, 8);
    }
  });
}

/** 반투명 유리 패널. 위쪽에 얇은 빛 테두리. */
export function glassPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 22,
): Phaser.GameObjects.Graphics {
  g.fillStyle(0x000000, 0.25).fillRoundedRect(x, y + 6, w, h, r);
  g.fillStyle(0x161a38, 0.82).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(2, 0x8f95ff, 0.22).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, r);
  g.fillStyle(0xffffff, 0.06).fillRoundedRect(x + 8, y + 4, w - 16, Math.min(18, h / 3), r / 2);
  return g;
}
