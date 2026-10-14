import Phaser from 'phaser';
import { SFX } from '../config/assets';
import { BALANCE, guessBonus, winCoins } from '../config/balance';
import { GAME_WIDTH, SceneKeys, THEME } from '../config/game';
import { chooseMove } from '../core/bot';
import { dailyFor, levelFor, type GeneratedLevel } from '../core/levelgen';
import { PALETTE } from '../core/palette';
import { PICTURES, getPicture, type Picture } from '../core/pictures';
import type { PlayMode } from '../core/progress';
import { Rng, localDateKey } from '../core/rng';
import {
  addRackSlot,
  canUndo,
  continueAfterJam,
  currentCue,
  newGame,
  tap,
  topOf,
  totalCells,
  undoPark,
  type GameEvent,
  type GameState,
  type Level,
  type Pack,
} from '../core/rules';
import { getServices } from '../services';
import { haptic, playSfx } from '../services/audio';
import { Button } from '../ui/Button';
import { drawNightBackdrop, glassPanel } from '../ui/backdrop';
import { showHowTo } from '../ui/howto';
import { DRONE_SIZE, TextureKeys } from '../ui/textures';
import { RoundEvents, type RoundResult } from './ResultScene';

/** 화면 배치(720x1280 기준). 위에서부터 HUD → 하늘(그림) → 쇼 프로그램 → 거치대 → 상자 → 부스터. */
const L = {
  hudY: 48,
  skyTop: 88,
  skyBottom: 708,
  picture: { x: 40, y: 104, w: 640, h: 496 },
  skylineTop: 612,
  guessY: 660,
  programY: 760,
  rackY: 858,
  crateTop: 912,
  crateBase: 1172,
  boosterY: 1230,
} as const;

/** 거치대 칸. 폭은 칸 수에 맞춰 slotW()가 정한다(최대 9칸까지 늘어남). */
const RACK_SLOT = { maxW: 84, h: 52, gap: 10 };

type PackSprite = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

export class GameScene extends Phaser.Scene {
  private mode: PlayMode = 'level';
  private levelNumber = 1;
  private gen!: GeneratedLevel;
  private level!: Level;
  private picture!: Picture;
  private state!: GameState;

  private boardLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private drones = new Map<number, Phaser.GameObjects.Image>();
  private rackSprites = new Map<number, PackSprite>();
  private arriving = new Set<number>();
  private flights = 0;
  private finished = false;
  private continued = false;
  private guessed = false;
  private guessCoins = 0;
  private chains = 0;
  private programPreview: number = BALANCE.programPreviewDefault;
  private guessLayer: Phaser.GameObjects.Container | null = null;
  private undoBtn!: Button;
  private slotBtn!: Button;
  private coinText!: Phaser.GameObjects.Text;
  private autoplayTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: { mode?: PlayMode }): void {
    this.mode = data.mode ?? 'level';
    this.drones = new Map();
    this.rackSprites = new Map();
    this.arriving = new Set();
    this.flights = 0;
    this.finished = false;
    this.continued = false;
    this.guessed = false;
    this.guessCoins = 0;
    this.chains = 0;
    this.programPreview = BALANCE.programPreviewDefault;
    this.guessLayer = null;
    this.autoplayTimer = null;
  }

  create(): void {
    const { save, ads, analytics } = getServices();
    this.levelNumber = save.get().level;
    this.gen = this.mode === 'daily' ? dailyFor(localDateKey(new Date())) : levelFor(this.levelNumber);
    this.level = this.gen.level;
    this.picture = getPicture(this.level.pictureId);
    this.state = newGame(this.level);

    this.drawSky();
    this.drawPictureGrid();
    this.boardLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.drawHud();
    this.drawCrateZones();
    this.drawBoosters();
    this.renderBoard();

    ads.gameplayStart();
    analytics.track('level_start', {
      mode: this.mode,
      level: this.levelNumber,
      kind: this.gen.params.kind,
      picture: this.picture.id,
    });

    this.game.events.on(RoundEvents.Continue, this.onContinue, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(RoundEvents.Continue, this.onContinue, this);
      this.autoplayTimer?.remove();
      delete (window as unknown as { __smoke?: unknown }).__smoke;
    });
    this.exposeSmokeHooks();
    this.showFirstTimeHelp();
  }

  /** 1레벨 첫 판에는 규칙 안내, 4레벨(거치대가 처음 필요한 판)에는 한 줄 힌트. */
  private showFirstTimeHelp(): void {
    if (this.mode !== 'level') return;
    const { save, i18n } = getServices();
    if (this.levelNumber === 1 && !save.get().howToSeen) {
      showHowTo(this, () =>
        save.update((d) => {
          d.howToSeen = true;
        }),
      );
    }
    if (this.levelNumber === 4) {
      const hint = this.add
        .text(GAME_WIDTH / 2, L.rackY - 44, i18n.t('game.rackHint'), {
          fontFamily: THEME.font,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#4a3f9a',
          padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 500, onComplete: () => hint.destroy() });
    }
  }

  // ───────────────────────── 배경과 그림 격자 ─────────────────────────

  private drawSky(): void {
    drawNightBackdrop(this, L.skyBottom, this.level.seed);
  }

  private cellSize = 0;
  private cellOrigin = { x: 0, y: 0 };

  private drawPictureGrid(): void {
    const width = this.level.width;
    const height = this.level.height;
    this.cellSize = Math.min(L.picture.w / width, L.picture.h / height);
    this.cellOrigin = {
      x: L.picture.x + (L.picture.w - this.cellSize * width) / 2,
      y: L.picture.y + (L.picture.h - this.cellSize * height) / 2,
    };
    // 칸 위치를 희미한 점으로. 그림 모양이 드러나지 않게 빈칸까지 전부 찍는다.
    for (let i = 0; i < width * height; i++) {
      const p = this.cellPos(i);
      this.add.image(p.x, p.y, TextureKeys.dot).setScale(0.22).setAlpha(0.16);
    }
  }

  private cellPos(i: number): { x: number; y: number } {
    const x = i % this.level.width;
    const y = Math.floor(i / this.level.width);
    return { x: this.cellOrigin.x + (x + 0.5) * this.cellSize, y: this.cellOrigin.y + (y + 0.5) * this.cellSize };
  }

  // ───────────────────────── HUD, 입력, 부스터 ─────────────────────────

  private drawHud(): void {
    const { i18n, save } = getServices();
    new Button(this, 70, L.hudY, '‹', () => this.goHome(), { width: 84, height: 64, fontSize: 40, color: THEME.panel });
    const title = this.mode === 'daily' ? i18n.t('game.daily') : i18n.t('game.level', { n: this.levelNumber });
    this.add
      .text(GAME_WIDTH / 2, L.hudY, title, {
        fontFamily: THEME.font,
        fontSize: '36px',
        fontStyle: 'bold',
        color: THEME.text,
        shadow: { offsetX: 0, offsetY: 3, color: 'rgba(0,0,0,0.5)', blur: 6, fill: true },
      })
      .setOrigin(0.5);
    this.coinText = this.add
      .text(GAME_WIDTH - 30, L.hudY, `● ${save.get().coins}`, {
        fontFamily: THEME.font,
        fontSize: '32px',
        color: '#ffc845',
      })
      .setOrigin(1, 0.5);
  }

  private crateX(i: number): number {
    const n = this.level.crates.length;
    const cw = this.crateWidth();
    const total = n * cw;
    return (GAME_WIDTH - total) / 2 + cw * (i + 0.5);
  }

  private crateWidth(): number {
    return Math.min(132, (GAME_WIDTH - 32) / this.level.crates.length);
  }

  /** 처음 배치에서 가장 높은 상자. 되돌리기로 팩이 돌아와도 이 높이를 넘지 않는다. */
  private get maxDepth(): number {
    return Math.max(...this.level.crates.map((c) => c.length), 1);
  }

  private packHeight(): number {
    return Math.min(56, (L.crateBase - L.crateTop) / this.maxDepth);
  }

  private packPos(crate: number, index: number): { x: number; y: number } {
    return { x: this.crateX(crate), y: L.crateBase - (index + 0.5) * this.packHeight() };
  }

  private slotW(): number {
    return Math.min(RACK_SLOT.maxW, (GAME_WIDTH - 40) / this.state.rackCapacity - RACK_SLOT.gap);
  }

  private rackSlotX(slot: number): number {
    const cap = this.state.rackCapacity;
    const total = cap * (this.slotW() + RACK_SLOT.gap) - RACK_SLOT.gap;
    return (GAME_WIDTH - total) / 2 + slot * (this.slotW() + RACK_SLOT.gap) + this.slotW() / 2;
  }

  private drawCrateZones(): void {
    const cw = this.crateWidth();
    for (let i = 0; i < this.level.crates.length; i++) {
      const x = this.crateX(i);
      const zone = this.add
        .zone(x, (L.crateTop + L.crateBase) / 2, cw, L.crateBase - L.crateTop + 40)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onCrateTap(i));
    }
  }

  private drawBoosters(): void {
    this.undoBtn = new Button(this, 230, L.boosterY, '', () => this.useBooster('undo'), {
      width: 250,
      height: 70,
      fontSize: 26,
      color: 0x3a3f5c,
    });
    this.slotBtn = new Button(this, 490, L.boosterY, '', () => this.useBooster('slot'), {
      width: 250,
      height: 70,
      fontSize: 26,
      color: 0x3a3f5c,
    });
    this.refreshBoosters();
  }

  private refreshBoosters(): void {
    const { i18n, save } = getServices();
    const coins = save.get().coins;
    const label = (name: string, cost: number) =>
      coins >= cost ? `${name} · ● ${cost}` : `${name} · ▶ ${i18n.t('booster.free')}`;
    this.undoBtn.setText(label(i18n.t('booster.undo'), BALANCE.boosterCost.undo));
    this.slotBtn.setText(label(i18n.t('booster.slot'), BALANCE.boosterCost.slot));
    const playing = this.state.status === 'playing' && !this.finished;
    this.undoBtn.setEnabled(playing && canUndo(this.state));
    this.slotBtn.setEnabled(playing);
    this.coinText.setText(`● ${coins}`);
  }

  private async useBooster(kind: 'undo' | 'slot'): Promise<void> {
    if (this.state.status !== 'playing' || this.finished) return;
    if (kind === 'undo' && !canUndo(this.state)) return;
    const { save, ads, analytics } = getServices();
    const cost = BALANCE.boosterCost[kind];
    let paidWith: 'coins' | 'ad' = 'coins';
    if (save.get().coins >= cost) {
      save.update((d) => {
        d.coins -= cost;
      });
    } else {
      const res = await ads.showRewarded();
      if (res !== 'rewarded') return;
      paidWith = 'ad';
    }
    if (kind === 'undo') undoPark(this.state);
    else addRackSlot(this.state);
    analytics.track('booster_use', { booster: kind, paidWith, level: this.levelNumber });
    playSfx(this, SFX.tap);
    this.renderBoard();
  }

  // ───────────────────────── 판 그리기 ─────────────────────────

  /** 상자, 거치대, 쇼 프로그램을 상태 그대로 다시 그린다. 날아가는 연출은 fxLayer에 따로 있다. */
  private renderBoard(): void {
    this.boardLayer.removeAll(true);
    this.rackSprites.clear();
    const s = this.state;
    const ph = this.packHeight();
    const cw = this.crateWidth();
    const cue = currentCue(this.level, s);
    let hinted = false;

    // 상자: 바닥에 그림자, 뒤판, 안쪽 홈, 앞쪽 받침과 발사대 불빛
    for (let i = 0; i < s.crates.length; i++) {
      const x = this.crateX(i);
      const g = this.add.graphics();
      const panelTop = L.crateBase - this.maxDepth * ph;
      const left = x - cw / 2 + 4;
      const w = cw - 8;
      const h = L.crateBase - panelTop + 28;
      g.fillStyle(0x000000, 0.4).fillEllipse(x, L.crateBase + 30, w + 10, 22);
      g.fillStyle(0x2a3060, 1).fillRoundedRect(left, panelTop - 14, w, h, 16);
      g.fillStyle(0x0f1230, 1).fillRoundedRect(left + 6, panelTop - 8, w - 12, h - 26, 11);
      g.lineStyle(2, 0xa0a8ff, 0.18).strokeRoundedRect(left, panelTop - 14, w, h, 16);
      g.fillStyle(0x3b4382, 1).fillRoundedRect(left - 2, L.crateBase + 4, w + 4, 18, 8);
      g.fillStyle(0x1c2048, 1).fillRect(left + 2, L.crateBase + 16, w - 4, 6);
      g.fillStyle(0x8f95ff, 0.8).fillRect(left + 10, L.crateBase + 8, w - 20, 3);
      this.boardLayer.add(g);
      const crate = s.crates[i]!;
      crate.forEach((pack, j) => {
        const pos = this.packPos(i, j);
        const img = this.packImage(pack, pos.x, pos.y, cw - 18, ph - 2);
        this.boardLayer.add(img);
      });
      const top = topOf(s, i);
      if (top && cue && top.color === cue.color && this.gen.params.kind === 'tutorial') {
        const pos = this.packPos(i, crate.length - 1);
        const ring = this.add.graphics();
        ring.lineStyle(4, 0xffffff, 1).strokeRoundedRect(pos.x - cw / 2 + 6, pos.y - ph / 2 - 2, cw - 12, ph + 4, 10);
        this.tweens.add({ targets: ring, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
        this.boardLayer.add(ring);
        // 누를 곳을 손가락 하나로만 가리킨다.
        if (!hinted && !this.finished) {
          hinted = true;
          const finger = this.add
            .image(pos.x + 8, pos.y + 4, TextureKeys.finger)
            .setOrigin(0.36, 0)
            .setScale(0.62);
          this.tweens.add({
            targets: finger,
            y: finger.y + 16,
            duration: 420,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
          this.boardLayer.add(finger);
        }
      }
    }

    // 거치대: 바닥에 파인 홈
    const warn = s.rack.length >= s.rackCapacity - 1;
    for (let k = 0; k < s.rackCapacity; k++) {
      const x = this.rackSlotX(k);
      const slot = this.add.graphics();
      const sx = x - this.slotW() / 2;
      const sy = L.rackY - RACK_SLOT.h / 2;
      slot.fillStyle(0xffffff, 0.06).fillRoundedRect(sx - 2, sy - 2, this.slotW() + 4, RACK_SLOT.h + 6, 12);
      slot.fillStyle(0x070816, 1).fillRoundedRect(sx, sy, this.slotW(), RACK_SLOT.h, 10);
      slot.fillStyle(0x000000, 0.5).fillRoundedRect(sx + 3, sy + 2, this.slotW() - 6, 8, 4);
      slot
        .lineStyle(3, warn ? THEME.danger : 0x3d4378, warn ? 1 : 0.9)
        .strokeRoundedRect(sx, sy, this.slotW(), RACK_SLOT.h, 10);
      this.boardLayer.add(slot);
    }
    s.rack.forEach((pack, k) => {
      const img = this.packImage(pack, this.rackSlotX(k), L.rackY - 2, this.slotW() - 6, RACK_SLOT.h);
      if (this.arriving.has(pack.id)) img.setAlpha(0);
      this.rackSprites.set(pack.id, img);
      this.boardLayer.add(img);
    });

    // 쇼 프로그램: 지금 순서 + 다음 순서들
    const { i18n } = getServices();
    this.boardLayer.add(glassPanel(this.add.graphics(), 24, L.programY - 50, GAME_WIDTH - 48, 100, 22));
    this.boardLayer.add(
      this.add
        .text(110, L.programY - 36, i18n.t('game.now'), {
          fontFamily: THEME.font,
          fontSize: '20px',
          fontStyle: 'bold',
          color: THEME.textDim,
        })
        .setOrigin(0.5),
    );
    for (let d = 0; d < this.programPreview; d++) {
      const c = this.level.cues[s.cueIndex + d];
      if (!c) break;
      const big = d === 0;
      const x = big ? 110 : 200 + d * 74;
      if (big) {
        const glow = this.add
          .image(x, L.programY + 6, TextureKeys.drone)
          .setTint(PALETTE[c.color]!.hex)
          .setScale(1.3, 0.8)
          .setAlpha(0.55)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
        this.boardLayer.add(glow);
      }
      const img = this.add
        .image(x, L.programY + (big ? 6 : 8), TextureKeys.pack(c.color))
        .setDisplaySize(big ? 96 : 62, big ? 60 : 39)
        .setAlpha(big ? 1 : 0.85);
      this.boardLayer.add(img);
      if (big) {
        const progress = `${s.delivered}/${c.packs}`;
        this.boardLayer.add(
          this.add
            .text(170, L.programY + 4, progress, {
              fontFamily: THEME.font,
              fontSize: '30px',
              fontStyle: 'bold',
              color: THEME.text,
            })
            .setOrigin(0, 0.5),
        );
      } else {
        this.boardLayer.add(
          this.add
            .text(x, L.programY + 36, `×${c.packs}`, { fontFamily: THEME.font, fontSize: '18px', color: THEME.textDim })
            .setOrigin(0.5),
        );
      }
    }

    this.refreshBoosters();
  }

  private packImage(pack: Pack, x: number, y: number, w: number, h: number): PackSprite {
    const key = pack.hidden ? TextureKeys.packHidden : TextureKeys.pack(pack.color);
    return this.add.image(x, y, key).setDisplaySize(w, h);
  }

  // ───────────────────────── 입력 처리와 연출 ─────────────────────────

  private onCrateTap(i: number): void {
    if (this.finished) return;
    const before = this.state.crates[i]?.length ?? 0;
    const sourcePos = this.packPos(i, Math.max(0, before - 1));
    const events = tap(this.level, this.state, i);
    if (events.length === 0) return;
    this.playEvents(events, sourcePos);
  }

  private playEvents(events: GameEvent[], tapPos: { x: number; y: number }): void {
    const { i18n } = getServices();
    for (const e of events) {
      switch (e.type) {
        case 'blocked':
          this.shakeRack();
          this.toast(i18n.t('game.rackFull'), THEME.danger);
          playSfx(this, SFX.blocked);
          haptic(40);
          break;
        case 'park':
          this.arriving.add(e.pack.id);
          this.flyPackToRack(e.pack, tapPos, e.slot);
          playSfx(this, SFX.park);
          break;
        case 'deliver': {
          const from = e.from.kind === 'crate' ? tapPos : { x: this.rackSlotX(e.from.slot), y: L.rackY };
          this.launchDrones(e.pack.color, from, e.cells);
          playSfx(this, SFX.launch);
          haptic(10);
          break;
        }
        case 'cueComplete':
          if (e.chain > 0) {
            this.chains++;
            this.toast(i18n.t('game.chain', { n: e.chain + 1 }), THEME.accent);
            playSfx(this, SFX.chain);
          }
          break;
        case 'reveal':
          break;
        case 'win':
          this.finish(true);
          break;
        case 'jam':
          this.finish(false);
          break;
      }
    }
    this.renderBoard();
    this.maybeShowGuess();
  }

  private flyPackToRack(pack: Pack, from: { x: number; y: number }, slot: number): void {
    const img = this.add
      .image(from.x, from.y, TextureKeys.pack(pack.color))
      .setDisplaySize(this.slotW() - 6, RACK_SLOT.h);
    this.fxLayer.add(img);
    this.flights++;
    this.tweens.add({
      targets: img,
      x: this.rackSlotX(slot),
      y: L.rackY,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => {
        img.destroy();
        this.arriving.delete(pack.id);
        this.rackSprites.get(pack.id)?.setAlpha(1);
        this.flights--;
      },
    });
  }

  /** 팩 하나가 켜는 칸마다 드론이 곡선을 그리며 날아올라 자리를 잡는다. */
  private launchDrones(color: number, from: { x: number; y: number }, cells: number[]): void {
    const tint = PALETTE[color]!.hex;
    const scale = (this.cellSize * 2.2) / DRONE_SIZE;
    cells.forEach((cell, k) => {
      const to = this.cellPos(cell);
      const drone = this.add
        .image(from.x, from.y, TextureKeys.drone)
        .setTint(tint)
        .setScale(scale * 0.5);
      drone.setBlendMode(Phaser.BlendModes.ADD);
      this.fxLayer.add(drone);
      this.flights++;
      const ctrl = { x: from.x + (to.x - from.x) * 0.3 + (Math.random() - 0.5) * 160, y: Math.min(from.y, to.y) - 140 };
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1,
        delay: k * 28,
        duration: 520 + Math.random() * 160,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const u = 1 - p.t;
          drone.x = u * u * from.x + 2 * u * p.t * ctrl.x + p.t * p.t * to.x;
          drone.y = u * u * from.y + 2 * u * p.t * ctrl.y + p.t * p.t * to.y;
          drone.setScale(scale * (0.5 + 0.5 * p.t));
        },
        onComplete: () => {
          this.drones.get(cell)?.destroy();
          this.drones.set(cell, drone);
          this.tweens.add({ targets: drone, scale: scale * 1.3, duration: 90, yoyo: true });
          this.flights--;
        },
      });
    });
  }

  private shakeRack(): void {
    this.tweens.add({
      targets: this.boardLayer,
      x: 8,
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.boardLayer.setX(0),
    });
  }

  private toast(text: string, color: number): void {
    const t = this.add
      .text(GAME_WIDTH / 2, L.skyBottom - 40, text, {
        fontFamily: THEME.font,
        fontSize: '40px',
        fontStyle: 'bold',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#0b1030',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: t.y - 70,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ───────────────────────── 그림 맞히기 ─────────────────────────

  private maybeShowGuess(): void {
    if (this.guessed || this.guessLayer || this.finished) return;
    if (this.state.litCells / totalCells(this.level) < BALANCE.guessUnlockRatio) return;
    const { i18n, analytics } = getServices();
    const rng = new Rng(this.level.seed ^ 0x9e3779b9);
    const decoys = rng.shuffle(PICTURES.filter((p) => p.id !== this.picture.id)).slice(0, 2);
    const options = rng.shuffle([this.picture, ...decoys]);
    const layer = this.add.container(0, 0);
    this.guessLayer = layer;
    layer.add(
      this.add
        .text(GAME_WIDTH / 2, L.guessY - 44, i18n.t('game.guessTitle'), {
          fontFamily: THEME.font,
          fontSize: '24px',
          color: '#ffffff',
          stroke: '#0b1030',
          strokeThickness: 5,
        })
        .setOrigin(0.5),
    );
    const buttons: Button[] = [];
    options.forEach((pic, k) => {
      const btn = new Button(
        this,
        140 + k * 220,
        L.guessY,
        pic.name[i18n.lang],
        () => {
          if (this.guessed) return;
          this.guessed = true;
          const right = pic.id === this.picture.id;
          buttons.forEach((b) => b.setEnabled(false));
          analytics.track('guess_result', { right, litRatio: this.state.litCells / totalCells(this.level) });
          if (right) {
            this.guessCoins = guessBonus(1 - this.state.litCells / totalCells(this.level));
            this.programPreview = BALANCE.programPreviewAfterGuess;
            this.toast(i18n.t('game.guessRight', { n: this.guessCoins }), THEME.success);
            playSfx(this, SFX.coin);
            this.renderBoard();
          } else {
            this.toast(i18n.t('game.guessWrong'), THEME.danger);
            playSfx(this, SFX.wrong);
          }
          this.time.delayedCall(700, () => {
            this.tweens.add({ targets: layer, alpha: 0, duration: 250, onComplete: () => layer.destroy() });
          });
        },
        { width: 200, height: 64, fontSize: 26, color: 0x4a3f9a },
      );
      buttons.push(btn);
      layer.add(btn);
    });
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 250 });
  }

  // ───────────────────────── 끝내기 ─────────────────────────

  private finish(win: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.autoplayTimer?.remove();
    const { ads, analytics } = getServices();
    ads.gameplayStop();
    const s = this.state;
    analytics.track(win ? 'level_win' : 'level_fail', {
      mode: this.mode,
      level: this.levelNumber,
      taps: s.taps,
      parks: s.parks,
      rackPeak: s.rackPeak,
      chain: s.bestChain,
      continued: this.continued,
    });

    const waitForFlights = (then: () => void) => {
      const check = () => (this.flights > 0 ? this.time.delayedCall(80, check) : then());
      check();
    };

    waitForFlights(() => {
      if (win) {
        playSfx(this, SFX.win);
        this.tweens.add({
          targets: [...this.drones.values()],
          scale: `*=1.25`,
          duration: 260,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
        });
        this.time.delayedCall(1100, () => this.showResult(true));
      } else {
        playSfx(this, SFX.lose);
        haptic(80);
        this.shakeRack();
        this.time.delayedCall(500, () => this.showResult(false));
      }
    });
  }

  private showResult(win: boolean): void {
    const { i18n } = getServices();
    const s = this.state;
    const params = this.gen.params;
    const perfect = win && s.parks === 0;
    const base = winCoins(this.mode === 'daily' ? 20 : this.levelNumber, params.coinMultiplier);
    const coins = win ? base + this.chains * BALANCE.chainBonus + this.guessCoins : 0;
    const result: RoundResult = {
      mode: this.mode,
      level: this.levelNumber,
      win,
      score: s.litCells,
      coins,
      subtitle: win ? this.picture.name[i18n.lang] : undefined,
      perfect,
      offerDouble:
        win &&
        params.kind !== 'tutorial' &&
        (perfect || params.kind === 'finale' || this.mode === 'daily' || s.bestChain >= 2),
      canContinue: !win && !this.continued,
    };
    this.scene.pause();
    this.scene.launch(SceneKeys.Result, result);
  }

  private onContinue(): void {
    if (this.state.status !== 'jammed') return;
    continueAfterJam(this.state, BALANCE.continueSlots);
    this.continued = true;
    this.finished = false;
    getServices().ads.gameplayStart();
    this.renderBoard();
  }

  private goHome(): void {
    getServices().ads.gameplayStop();
    this.scene.start(SceneKeys.Menu);
  }

  // ───────────────────────── 자동 플레이(스모크 테스트, 영상 녹화) ─────────────────────────

  private exposeSmokeHooks(): void {
    const rng = new Rng(this.level.seed);
    (window as unknown as { __smoke?: unknown }).__smoke = {
      autoplay: (intervalMs = 60) =>
        new Promise<void>((resolve) => {
          this.autoplayTimer = this.time.addEvent({
            delay: intervalMs,
            loop: true,
            callback: () => {
              if (this.finished || this.state.status !== 'playing') {
                this.autoplayTimer?.remove();
                resolve();
                return;
              }
              const move = chooseMove(this.level, this.state, rng, 0);
              if (move === null) {
                this.autoplayTimer?.remove();
                resolve();
                return;
              }
              this.onCrateTap(move);
            },
          });
        }),
      state: () => ({ status: this.state.status, cueIndex: this.state.cueIndex, rack: this.state.rack.length }),
    };
  }
}
