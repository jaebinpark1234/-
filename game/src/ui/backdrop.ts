import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, THEME } from '../config/game';
import { Rng } from '../core/rng';
import { TextureKeys } from './textures';

/**
 * 먹색 밤하늘 + 도시 실루엣 두 겹. 메뉴와 게임이 같이 쓴다.
 * 꾸밈은 최소로 두고 드론 빛이 화면에서 가장 밝은 것이 되게 한다.
 * horizon 위는 하늘, 아래는 판이 놓이는 바닥이다. seed가 같으면 같은 도시가 나온다.
 */
export function drawNightBackdrop(scene: Phaser.Scene, horizon: number, seed = 7): void {
  const key = `backdrop-${horizon}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
    const ctx = tex?.getContext();
    if (tex && ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, THEME.bgCss);
      sky.addColorStop(0.7, '#121833');
      sky.addColorStop(1, '#1d2444');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, GAME_WIDTH, horizon);
      ctx.fillStyle = THEME.bgCss;
      ctx.fillRect(0, horizon, GAME_WIDTH, GAME_HEIGHT - horizon);
      tex.refresh();
    }
  }
  scene.add.image(0, 0, key).setOrigin(0);

  // 달: 무늬 없는 원 하나와 아주 옅은 빛
  scene.add.image(572, 168, TextureKeys.drone).setScale(1.6).setTint(0xfff1d6).setAlpha(0.12);
  scene.add.circle(572, 168, 26, 0xf4ecdc, 0.92);

  // 별. 연출용이라 Math.random을 써도 된다.
  for (let i = 0; i < 55; i++) {
    const star = scene.add
      .image(Math.random() * GAME_WIDTH, Math.random() * (horizon - 200), TextureKeys.dot)
      .setScale(0.08 + Math.random() * 0.16)
      .setAlpha(0.2 + Math.random() * 0.5);
    scene.tweens.add({
      targets: star,
      alpha: 0.05,
      duration: 1600 + Math.random() * 3000,
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 2000,
    });
  }

  drawCity(scene, horizon, new Rng(seed * 31 + 1));
  // 지평선 한 줄
  scene.add.rectangle(0, horizon, GAME_WIDTH, 1, 0xffffff, 0.08).setOrigin(0);
}

/** 먼 줄은 하늘보다 조금 밝게, 가까운 줄은 바닥색으로. 창문 불빛은 드문드문. */
function drawCity(scene: Phaser.Scene, horizon: number, rng: Rng): void {
  const layers = [
    { color: 0x1a2040, hMin: 50, hMax: 130, wMin: 34, wMax: 80, windows: 0.04 },
    { color: THEME.bg, hMin: 18, hMax: 70, wMin: 44, wMax: 110, windows: 0.08 },
  ];
  layers.forEach((layer) => {
    const g = scene.add.graphics();
    let x = -20 + rng.int(0, 30);
    while (x < GAME_WIDTH + 20) {
      const w = rng.int(layer.wMin, layer.wMax);
      const h = rng.int(layer.hMin, layer.hMax);
      const top = horizon - h;
      g.fillStyle(layer.color, 1).fillRect(x, top, w, h + 1);
      for (let wy = top + 10; wy < horizon - 8; wy += 14) {
        for (let wx = x + 7; wx < x + w - 8; wx += 12) {
          if (rng.next() < layer.windows) g.fillStyle(0xf2c46d, 0.35).fillRect(wx, wy, 4, 6);
        }
      }
      x += w + rng.int(0, 6);
    }
  });
}

/** 패널: 바탕보다 한 단계 밝은 면 + 가는 테두리. 그림자와 광택은 넣지 않는다. */
export function glassPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 22,
): Phaser.GameObjects.Graphics {
  g.fillStyle(THEME.panel, 0.94).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(2, THEME.line, 1).strokeRoundedRect(x, y, w, h, r);
  return g;
}
