import Phaser from 'phaser';
import { SFX } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, THEME } from '../config/game';
import { PALETTE } from '../core/palette';
import { getServices } from '../services';
import { playSfx } from '../services/audio';
import type { StringKey } from '../services/i18n';
import { glassPanel } from './backdrop';
import { Button } from './Button';
import { DRONE_SIZE, TextureKeys, tapHint } from './textures';

const PAGES: {
  title: StringKey;
  body: StringKey;
  draw: (scene: Phaser.Scene, layer: Phaser.GameObjects.Container) => void;
}[] = [
  { title: 'howto.t1', body: 'howto.b1', draw: drawTapPage },
  { title: 'howto.t2', body: 'howto.b2', draw: drawOrderPage },
  { title: 'howto.t3', body: 'howto.b3', draw: drawRackPage },
  { title: 'howto.t4', body: 'howto.b4', draw: drawPicturePage },
];

const CX = GAME_WIDTH / 2;
const PANEL = { x: 40, y: 130, w: GAME_WIDTH - 80, h: 880 };
const ART_Y = 450;

/** 처음 하는 사람용 규칙 안내. 4장을 넘기며 보고, 닫으면 onClose를 부른다. */
export function showHowTo(scene: Phaser.Scene, onClose: () => void): void {
  const { i18n } = getServices();
  const root = scene.add.container(0, 0).setDepth(1000);
  const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070f, 0.82).setOrigin(0).setInteractive();
  root.add([shade, glassPanel(scene.add.graphics(), PANEL.x, PANEL.y, PANEL.w, PANEL.h, 36)]);

  const title = scene.add
    .text(CX, PANEL.y + 80, '', { fontFamily: THEME.font, fontSize: '44px', fontStyle: '300', color: THEME.text })
    .setOrigin(0.5);
  const body = scene.add
    .text(CX, 720, '', {
      fontFamily: THEME.font,
      fontSize: '27px',
      color: THEME.textDim,
      align: 'center',
      lineSpacing: 12,
      wordWrap: { width: PANEL.w - 70 },
    })
    .setOrigin(0.5, 0);
  const art = scene.add.container(0, 0);
  const dots = scene.add.graphics();
  root.add([title, art, body, dots]);

  let page = 0;
  const close = () => {
    playSfx(scene, SFX.tap);
    // 그림 애니메이션을 먼저 멈춘다. 남겨 두면 지워진 그림을 건드려 게임 루프가 멈춘다.
    art.each((o: Phaser.GameObjects.GameObject) => scene.tweens.killTweensOf(o));
    root.destroy();
    onClose();
  };
  const next = new Button(
    scene,
    CX,
    PANEL.y + PANEL.h - 64,
    '',
    () => {
      if (page === PAGES.length - 1) return close();
      playSfx(scene, SFX.tap);
      show(page + 1);
    },
    { width: 420, height: 100, fontSize: 38 },
  );
  const skip = scene.add
    .text(PANEL.x + PANEL.w - 34, PANEL.y + 34, i18n.t('howto.skip'), {
      fontFamily: THEME.font,
      fontSize: '24px',
      color: THEME.textDim,
    })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', close);
  root.add([next, skip]);
  // 버튼을 못 찾거나 화면 아래가 잘려도 넘길 수 있게, 안내 화면 아무 곳이나 눌러도 다음 장으로 간다.
  shade.on('pointerup', () => {
    if (page === PAGES.length - 1) return close();
    playSfx(scene, SFX.tap);
    show(page + 1);
  });

  function show(n: number): void {
    page = n;
    const def = PAGES[n]!;
    title.setText(i18n.t(def.title));
    body.setText(i18n.t(def.body));
    next.setText(i18n.t(n === PAGES.length - 1 ? 'howto.start' : 'howto.next'));
    skip.setVisible(n < PAGES.length - 1);
    art.each((o: Phaser.GameObjects.GameObject) => scene.tweens.killTweensOf(o));
    art.removeAll(true);
    def.draw(scene, art);
    dots.clear();
    PAGES.forEach((_, k) => {
      dots
        .fillStyle(k === n ? 0xffffff : 0x5a6090, 1)
        .fillCircle(CX + (k - 1.5) * 28, PANEL.y + PANEL.h - 140, k === n ? 8 : 6);
    });
    art.setAlpha(0);
    scene.tweens.add({ targets: art, alpha: 1, duration: 200 });
  }
  show(0);
}

// ───────────── 장마다 그림 ─────────────

function crate(scene: Phaser.Scene, x: number, baseY: number, colors: (number | '?')[], w = 120, ph = 52) {
  const g = scene.add.graphics();
  const h = colors.length * ph + 30;
  g.fillStyle(THEME.panel, 1).fillRoundedRect(x - w / 2, baseY - h, w, h + 10, 16);
  g.lineStyle(2, THEME.line, 1).strokeRoundedRect(x - w / 2, baseY - h, w, h + 10, 16);
  const packs = colors.map((c, j) =>
    scene.add
      .image(x, baseY - 10 - ph / 2 - j * ph, c === '?' ? TextureKeys.packHidden : TextureKeys.pack(c))
      .setDisplaySize(w - 20, ph - 2),
  );
  return { g, packs, topY: baseY - 10 - ph / 2 - (colors.length - 1) * ph };
}

function finger(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  return tapHint(scene, x, y);
}

function drawTapPage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const c = crate(scene, CX, ART_Y + 180, [5, 3, 0]);
  layer.add([c.g, ...c.packs]);
  // 드론 세 개가 맨 위 팩에서 하늘로 날아오른다.
  const tint = PALETTE[0]!.hex;
  for (let k = 0; k < 3; k++) {
    const d = scene.add
      .image(CX, c.topY, TextureKeys.drone)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(48 / DRONE_SIZE);
    scene.tweens.add({
      targets: d,
      x: CX + (k - 1) * 70,
      y: ART_Y - 170 + (k === 1 ? -20 : 10),
      scale: 80 / DRONE_SIZE,
      duration: 900,
      delay: k * 120,
      repeat: -1,
      repeatDelay: 600,
      ease: 'Sine.easeOut',
    });
    layer.add(d);
  }
  layer.add(finger(scene, CX + 10, c.topY));
}

function drawOrderPage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const { i18n } = getServices();
  const y = ART_Y - 110;
  layer.add(glassPanel(scene.add.graphics(), 90, y - 60, GAME_WIDTH - 180, 120, 22));
  const glow = scene.add
    .image(190, y + 6, TextureKeys.drone)
    .setTint(PALETTE[0]!.hex)
    .setScale(1.3, 0.8)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.6);
  scene.tweens.add({ targets: glow, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
  layer.add([
    glow,
    scene.add
      .text(190, y - 42, i18n.t('game.now'), {
        fontFamily: THEME.font,
        fontSize: '20px',
        fontStyle: '500',
        color: THEME.textDim,
      })
      .setOrigin(0.5),
    scene.add.image(190, y + 6, TextureKeys.pack(0)).setDisplaySize(104, 65),
    scene.add
      .text(254, y + 6, '0/2', { fontFamily: THEME.font, fontSize: '32px', fontStyle: '500', color: THEME.text })
      .setOrigin(0, 0.5),
    scene.add
      .image(400, y + 6, TextureKeys.pack(5))
      .setDisplaySize(66, 41)
      .setAlpha(0.85),
    scene.add
      .image(480, y + 6, TextureKeys.pack(3))
      .setDisplaySize(66, 41)
      .setAlpha(0.85),
  ]);
  // 아래 상자 둘: 빨강이 맨 위인 쪽을 누르라고 가리킨다.
  const a = crate(scene, CX - 110, ART_Y + 200, [3, 5], 116, 50);
  const b = crate(scene, CX + 110, ART_Y + 200, [5, 0], 116, 50);
  layer.add([a.g, ...a.packs, b.g, ...b.packs, finger(scene, CX + 120, b.topY)]);
}

function drawRackPage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const y = ART_Y - 20;
  const slotW = 92;
  const gap = 12;
  const left = CX - (5 * slotW + 4 * gap) / 2 + slotW / 2;
  const filled = [5, 3, 5, 6];
  for (let k = 0; k < 5; k++) {
    const x = left + k * (slotW + gap);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x - slotW / 2, y - 32, slotW, 64, 12);
    g.lineStyle(2, THEME.danger, 1).strokeRoundedRect(x - slotW / 2, y - 32, slotW, 64, 12);
    scene.tweens.add({ targets: g, alpha: 0.45, duration: 500, yoyo: true, repeat: -1 });
    layer.add(g);
    const c = filled[k];
    if (c !== undefined) layer.add(scene.add.image(x, y - 2, TextureKeys.pack(c)).setDisplaySize(slotW - 8, 58));
  }
  // 위로 날아가는 팩 하나: 거치대에 있던 파랑이 순서가 오자 출발한다.
  const fly = scene.add.image(left, y - 2, TextureKeys.pack(5)).setDisplaySize(slotW - 8, 58);
  scene.tweens.add({
    targets: fly,
    y: y - 220,
    alpha: 0,
    duration: 900,
    repeat: -1,
    repeatDelay: 700,
    ease: 'Quad.easeIn',
  });
  layer.add(fly);
}

function drawPicturePage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const heart = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  const cell = 38;
  const ox = CX - (7 * cell) / 2 + cell / 2;
  const oy = ART_Y - 250;
  let n = 0;
  heart.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const d = scene.add
        .image(ox + c * cell, oy + r * cell, TextureKeys.drone)
        .setTint(PALETTE[0]!.hex)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(84 / DRONE_SIZE)
        .setAlpha(0);
      scene.tweens.add({
        targets: d,
        alpha: 1,
        duration: 200,
        delay: 300 + n++ * 45,
        hold: 1600,
        yoyo: true,
        repeat: -1,
        repeatDelay: 400,
      });
      layer.add(d);
    }),
  );
  // '?' 팩이 맨 위에 오면 뒤집혀 색이 보인다.
  const box = crate(scene, CX, ART_Y + 230, [3, '?'], 130, 54);
  layer.add([box.g, ...box.packs]);
  const q = box.packs[1]!;
  const showColor = () => {
    scene.tweens.add({
      targets: q,
      scaleY: 0,
      duration: 160,
      delay: 900,
      onComplete: () => {
        if (!q.scene) return;
        q.setTexture(q.texture.key === TextureKeys.packHidden ? TextureKeys.pack(0) : TextureKeys.packHidden);
        q.setDisplaySize(110, 52);
        q.scaleY = 0;
        scene.tweens.add({ targets: q, displayHeight: 52, duration: 160, onComplete: () => q.scene && showColor() });
      },
    });
  };
  showColor();
}
