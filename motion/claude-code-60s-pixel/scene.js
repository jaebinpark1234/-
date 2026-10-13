'use strict';
// "World 1-1" — a 60s pixel-art platformer about Claude Code.
// Drawn at native pixel resolution (320x180 or 180x320); the renderer upscales 6x with nearest neighbour.
// renderAt(t) is deterministic.

const P = new URLSearchParams(location.search);
const V = (P.get('o') || 'L') === 'V';
const LW = V ? 180 : 240, LH = V ? 320 : 135;
const MODE = P.get('mode') || 'preview';
const cv = document.getElementById('c');
cv.width = LW; cv.height = LH;
document.documentElement.style.setProperty('--ar', LW / LH);
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const PI = Math.PI, TAU = PI * 2;
const DUR = 60;

const C = {
  sky0: '#0D0F1C', sky1: '#111428', sky2: '#161A33', star: '#C9CBE0',
  far: '#171B35', farEdge: '#20264A', farText: '#262D57',
  gTop: '#6A72A6', gTop2: '#454C7C', g: '#272B48', gDot: '#31365C', void: '#07080F',
  o: '#E07A50', oD: '#B5532F', oL: '#F4A27E', eye: '#141414', cream: '#F2EDE2',
  red: '#E5484D', redD: '#9E2A2E', redL: '#FF8A80', green: '#4ADE80', greenD: '#1F9D55',
  gold: '#F6C453', used: '#4A4F70', usedD: '#363A55', ink: '#0A0B12',
  wall: '#1A1530', brick: '#231C3C', brickL: '#2C2449',
  castle: '#4A4F78', castleD: '#33375A', castleL: '#6A70A0', win: '#F6B25A',
};
const GY = 148;                       // ground surface (world y)
const CAMY = V ? GY - 226 : GY - 110;  // world y at the top of the screen

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: u => 1 - Math.pow(1 - u, 3),
  in: u => u * u * u,
  sine: u => -(Math.cos(PI * u) - 1) / 2,
  lin: u => u,
  outBack: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
};
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, (e || E.lin)((t - t0) / (t1 - t0 || 1)));
    }
  }
  return keys[keys.length - 1][1];
}
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const R = Math.round;
let IS_THUMB = false;
const mod = (a, n) => ((a % n) + n) % n;
const arc = (t, t0, t1, h) => (t > t0 && t < t1 ? 4 * h * ((t - t0) / (t1 - t0)) * (1 - (t - t0) / (t1 - t0)) : 0);
const step4 = a => Math.round(a * 3) / 3;    // retro stepped fades

// ---------- pixel helpers ----------
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w, h); }
const textCache = new Map();
function textBmp(str, col, size) {
  const key = str + '|' + col + '|' + size;
  if (textCache.has(key)) return textCache.get(key);
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `${size}px PS2P`;
  c.width = Math.max(1, Math.ceil(x.measureText(str).width) + 2); c.height = size + 2;
  x.font = `${size}px PS2P`; x.textBaseline = 'top'; x.fillStyle = col; x.fillText(str, 0, 1);
  const d = x.getImageData(0, 0, c.width, c.height);
  const n = parseInt(col.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] >= 110) { d.data[i] = r; d.data[i + 1] = g; d.data[i + 2] = b; d.data[i + 3] = 255; } else d.data[i + 3] = 0;
  }
  x.putImageData(d, 0, 0);
  textCache.set(key, c);
  return c;
}
function text(str, x, y, col, size = 8, align = 'left', shadow = null) {
  if (!str) return 0;
  const b = textBmp(str, col, size);
  const w = b.width - 2;
  let xx = x;
  if (align === 'center') xx = x - Math.floor(w / 2);
  if (align === 'right') xx = x - w;
  if (shadow) ctx.drawImage(textBmp(str, shadow, size), R(xx) + 1, R(y) + 1);
  ctx.drawImage(b, R(xx), R(y));
  return w;
}

// ---------- timeline ----------
const T = {
  type1: 0.7, enter1: 1.55, logo: 1.6, type2: 2.5, enter2: 4.2, world0: 4.4, world1: 5.85, level: 6.0,
  pipe0: 6.3, pipe1: 6.7, run0: 7.2, arena: 18.0,
  roar: 18.8, bugA: 19.2, leap1: 21.0, leap1e: 21.7, hitA: 22.35, back0: 23.2, back1: 23.8,
  dash0: 24.0, dash1: 24.6, hitB: 25.3, fixed: 25.85, boom: 26.4, exit0: 27.6,
  bridge0: 30.2, bridge1: 34.2, flaky: 33.3, back2: 35.0, pound: 36.5, fw0: 37.0,
  pole0: 41.2, pole1: 41.9, slide1: 43.1, door: 44.8, inside: 45.3,
  lightsOff: 48.5, bugIn: 50.4, box0: 51.0, alarm: 53.9, dashOut: 54.3, end: 55.0, fade0: 59.45,
};
const SPEED = 80;
const xAt = x => T.run0 + (x - 70) / SPEED;               // when the run reaches world x
const BLOCKS = [136, 232, 330, 500, 640, 820].map(x => ({ x, th: xAt(x) }));
const GAPS = [[380, 412], [700, 740], [1196, 1348]];
const STOMPS = [{ x: 568, ts: xAt(568), from: 660 }, { x: 880, ts: xAt(880), from: 990 }];
const EQ = [{ x: 1000, th: T.hitA }, { x: 1076, th: T.hitB }];
const ARENA = { l: 944, r: 1132, c: 1038 };
const TILE0 = 1200, TILEW = 12, NT = 12, FLAKY = 8;
const POLE = 1420, CASTLE = 1446, DOOR = 1478;
const BLOCK_Y = GY - 44;

const CX = [
  [0, 40], [T.pipe1, 40], [T.run0, 70, E.sine], [T.arena, 934], [18.6, 980, E.out], [22.0, 980], [22.15, 1000, E.inOut],
  [24.1, 1000], [24.75, 1060], [25.05, 1060], [25.3, 1076, E.inOut], [T.exit0, 1076], [29.6, 1196, E.inOut],
  [T.bridge0, 1200], [T.bridge1, 1344], [34.4, 1350, E.out], [T.back2, 1350], [36.0, 1302, E.inOut], [37.5, 1302],
  [T.pole0, 1396, E.inOut], [T.pole1, 1413, E.out], [T.slide1, 1413], [43.4, 1428, E.out], [T.door, 1478],
  [T.dashOut, 1478], [54.9, 1580, E.in],
];
const JUMPS = [
  { t0: T.pipe1, t1: T.run0, h: 10, y0: GY - 30, y1: GY },
  ...BLOCKS.map(b => ({ t0: b.th - 0.25, t1: b.th + 0.25, h: 17, y0: GY, y1: GY })),
  { t0: xAt(364), t1: xAt(428), h: 26, y0: GY, y1: GY },
  { t0: xAt(684), t1: xAt(756), h: 26, y0: GY, y1: GY },
  ...STOMPS.flatMap(s => [{ t0: s.ts - 0.4, t1: s.ts, h: 16, y0: GY, y1: GY - 7 }, { t0: s.ts, t1: s.ts + 0.35, h: 12, y0: GY - 7, y1: GY }]),
  { t0: 20.3, t1: 20.85, h: 26, y0: GY, y1: GY },
  { t0: T.hitA - 0.25, t1: T.hitA + 0.25, h: 17, y0: GY, y1: GY },
  { t0: 24.1, t1: 24.75, h: 34, y0: GY, y1: GY },
  { t0: T.hitB - 0.25, t1: T.hitB + 0.25, h: 17, y0: GY, y1: GY },
  { t0: 26.9, t1: 27.2, h: 10, y0: GY, y1: GY }, { t0: 27.25, t1: 27.55, h: 10, y0: GY, y1: GY },
  { t0: 36.0, t1: T.pound, h: 22, y0: GY, y1: GY, pound: true },
  { t0: T.pound, t1: T.pound + 0.3, h: 8, y0: GY, y1: GY },
  { t0: 37.0, t1: 37.3, h: 9, y0: GY, y1: GY }, { t0: 37.35, t1: 37.65, h: 9, y0: GY, y1: GY },
  { t0: T.pole0, t1: T.pole1, h: 26, y0: GY, y1: GY - 60 },
  { t0: T.slide1, t1: 43.4, h: 6, y0: GY, y1: GY },
];
const LANDS = JUMPS.map(j => j.t1);

function clawd(t) {
  const s = { x: kf(t, CX), y: GY, face: 1, eyes: 'open', air: false, squash: 0, armsUp: false, vis: true, pole: false, behindPipe: false };
  if (t < T.pipe0 || (t >= T.inside && t < T.dashOut)) s.vis = false;
  if (t >= T.pipe0 && t < T.pipe1) { s.y = lerp(GY - 14, GY - 30, E.out(seg(t, T.pipe0, T.pipe1))); s.behindPipe = true; }
  for (const j of JUMPS) {
    if (t >= j.t0 && t < j.t1) {
      const u = (t - j.t0) / (j.t1 - j.t0);
      if (j.pound) s.y = u < 0.7 ? j.y0 - j.h * E.out(u / 0.7) : j.y0 - j.h * (1 - E.in((u - 0.7) / 0.3));
      else s.y = lerp(j.y0, j.y1, u) - 4 * j.h * u * (1 - u);
      s.air = true; s.armsUp = true;
    }
  }
  if (t >= T.pole1 && t < T.slide1) { s.y = lerp(GY - 60, GY, seg(t, T.pole1, T.slide1)); s.pole = true; s.air = true; s.armsUp = true; }
  for (const l of LANDS) if (t >= l && t < l + 0.09) s.squash = 1;
  s.legPh = s.x / 4;
  if (t >= 34.4 && t < 36.05) s.face = -1;
  if (t < T.run0 || (t > 36.5 && t < 37.7) || (t > T.slide1 && t < 43.6)) s.face = 0;
  // eyes
  const blinks = [9.8, 13.9, 19.6, 28.6, 32.2, 39.5, 44.2];
  if (t >= 18.6 && t < T.fixed) s.eyes = 'focus';
  if ((t >= 18.55 && t < 18.95) || (t >= 21.7 && t < 21.95)) s.eyes = 'wide';
  if ((t >= T.fixed && t < 27.7) || (t >= T.pound && t < 38.0) || (t >= T.slide1 && t < 44.0)) s.eyes = 'happy';
  if (t >= T.flaky && t < 34.4) s.eyes = 'open';
  if (t >= 34.4 && t < 35.4) s.eyes = 'wide';
  if (t >= 35.4 && t < T.pound) s.eyes = 'focus';
  if (t >= T.dashOut) s.eyes = 'focus';
  if (s.eyes === 'open') for (const b of blinks) if (t >= b && t < b + 0.12) s.eyes = 'blink';
  return s;
}

// ---------- sprites ----------
function drawClawd(x, feetY, o, scale = 1) {
  const X = R(x), Y = R(feetY), s = scale;
  const Q = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + dx * s, Y + dy * s, w * s, h * s); };
  const f = o.air ? -1 : mod(Math.floor(o.legPh || 0), 4);
  [-7, -4, 2, 5].forEach((lx, i) => {
    let up = 0;
    if (o.air) up = 1;
    else if ((f === 1 && i % 2 === 0) || (f === 3 && i % 2 === 1)) up = 1;
    Q(lx, -4, 1, 4 - up, C.o); Q(lx + 1, -4, 1, 4 - up, C.oD);
  });
  const bob = !o.air && (f === 1 || f === 3) ? -1 : 0;
  const sq = o.squash || 0;
  const bw = 20 + sq * 2, bh = 11 - sq;
  const bx = -bw / 2, by = -4 - bh + bob;
  const ay = by + 4 - (o.armsUp ? 3 : 0);
  Q(bx - 3, ay, 3, 4, C.o); Q(bx - 3, ay + 3, 3, 1, C.oD);
  Q(bx + bw, ay, 3, 4, C.oD);
  Q(bx, by, bw, bh, C.o);
  Q(bx + bw - 3, by, 3, bh, C.oD);
  Q(bx, by, bw - 3, 1, C.oL);
  Q(bx, by + bh - 1, bw, 1, C.oD);
  const fx = o.face || 0;
  for (const side of [0, 1]) {
    const ex = bx + (side ? bw - 8 : 5) + fx, ey = by + 3;
    switch (o.eyes) {
      case 'blink': Q(ex, ey + 1, 2, 1, C.eye); break;
      case 'happy': Q(ex - 1, ey + 1, 1, 1, C.eye); Q(ex, ey, 2, 1, C.eye); Q(ex + 2, ey + 1, 1, 1, C.eye); break;
      case 'wide': Q(ex - 1, ey - 1, 3, 4, C.eye); Q(ex - 1, ey - 1, 1, 1, C.cream); break;
      case 'focus':
        Q(ex, ey + 1, 2, 2, C.eye);
        if (side === 0) { Q(ex - 1, ey - 1, 1, 1, C.eye); Q(ex, ey, 2, 1, C.eye); }
        else { Q(ex, ey, 2, 1, C.eye); Q(ex + 2, ey - 1, 1, 1, C.eye); }
        break;
      case 'closed': Q(ex - 1, ey + 2, 4, 1, C.eye); break;
      default: Q(ex, ey, 2, 3, C.eye);
    }
  }
}

function drawBug(x, feetY, o) {
  const X = R(x), Y = R(feetY), f = o.face || 1;
  const Q = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(f > 0 ? X + dx : X - dx - w + 1, Y + dy, w, h); };
  if (o.flat) {
    Q(-5, -2, 11, 2, C.redD); Q(-4, -3, 9, 1, C.red); Q(3, -3, 1, 1, C.cream); Q(5, -3, 1, 1, C.cream);
    return;
  }
  const ph = mod(Math.floor(o.ph || 0), 2);
  [-4, -1, 2].forEach((lx, i) => { Q(lx + ((i + ph) % 2), -2, 1, 2, C.redD); });
  Q(-3, -8, 5, 1, C.red); Q(-5, -7, 8, 4, C.red); Q(-4, -3, 7, 1, C.redD);
  Q(-1, -7, 1, 4, C.redD); Q(-4, -7, 2, 1, C.redL);
  Q(3, -7, 3, 4, C.redD); Q(4, -6, 1, 1, C.cream);
  Q(5, -9, 1, 2, C.redD); Q(6, -10, 1, 1, C.redD); Q(3, -9, 1, 1, C.redD); Q(4, -10, 1, 1, C.redD);
}

function drawBoss(x, feetY, o) {
  const X = R(x), Y = R(feetY), f = o.face || -1;
  const sc = o.scale == null ? 1 : o.scale;
  if (sc <= 0.05) return;
  const flash = o.flash;
  const Q = (dx, dy, w, h, c) => {
    ctx.fillStyle = flash ? C.cream : c;
    const ddx = R(dx * sc), ddy = R(dy * sc), ww = Math.max(1, R(w * sc)), hh = Math.max(1, R(h * sc));
    ctx.fillRect(f > 0 ? X + ddx : X - ddx - ww + 1, Y + ddy, ww, hh);
  };
  const ph = mod(Math.floor(o.ph || 0), 2);
  for (let i = 0; i < 3; i++) {
    const lx = -12 + i * 9 + ((i + ph) % 2 ? 1 : -1);
    Q(lx, -6, 2, 3, C.redD); Q(lx - 1, -3, 2, 3, C.redD);
  }
  const a = 15, b = 10, cx = -4, cy = -15;
  for (let yy = -b; yy <= b; yy++) {
    for (let xx = -a; xx <= a; xx++) {
      if ((xx * xx) / (a * a) + (yy * yy) / (b * b) > 1) continue;
      let c = C.red;
      if (yy > 4) c = C.redD;
      else if (yy < -6 && xx < -3) c = C.redL;
      if (xx === 0 && yy > -9) c = C.redD;
      if ((xx === -8 && yy === -2) || (xx === 6 && yy === -4) || (xx === -5 && yy === 3)) c = C.redL;
      Q(cx + xx, cy + yy, 1, 1, c);
    }
  }
  const hx = 13, hy = -14;
  for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) if (xx * xx + yy * yy <= 49) Q(hx + xx, hy + yy, 1, 1, '#7A1E22');
  const mouth = o.roar ? 3 : 0;
  Q(hx - 4, hy - 4, 3, 3, C.cream); Q(hx + 2, hy - 4, 3, 3, C.cream);
  Q(hx - 3 + (o.look || 0), hy - 3, 1, 1, C.red); Q(hx + 3 + (o.look || 0), hy - 3, 1, 1, C.red);
  Q(hx - 5, hy - 6, 3, 1, C.ink); Q(hx - 2, hy - 5, 1, 1, C.ink); Q(hx + 2, hy - 5, 1, 1, C.ink); Q(hx + 3, hy - 6, 3, 1, C.ink);
  Q(hx - 2, hy + 2, 5, 1 + mouth, C.ink);
  Q(hx - 2, hy + 2, 1, 2, C.cream); Q(hx + 2, hy + 2, 1, 2, C.cream);
  Q(hx - 3, hy - 9, 1, 3, '#7A1E22'); Q(hx - 4, hy - 11, 1, 2, '#7A1E22'); Q(hx + 3, hy - 9, 1, 3, '#7A1E22'); Q(hx + 4, hy - 12, 1, 3, '#7A1E22');
}

function drawPage(x, y, s = 1) {
  const X = R(x), Y = R(y);
  ctx.fillStyle = C.cream; ctx.fillRect(X, Y, 6 * s, 8 * s);
  ctx.fillStyle = C.o; ctx.fillRect(X + 4 * s, Y, 2 * s, 2 * s);
  ctx.fillStyle = '#8C8597'; ctx.fillRect(X + 1 * s, Y + 3 * s, 4 * s, 1 * s); ctx.fillRect(X + 1 * s, Y + 5 * s, 3 * s, 1 * s);
}

// ---------- world ----------
function groundAt(x) { for (const [a, b] of GAPS) if (x > a && x < b) return null; return GY; }

function drawSky(t, camX) {
  px(0, 0, LW, LH, C.sky0);
  const hz = GY - CAMY;
  px(0, hz - 70, LW, 30, C.sky1);
  px(0, hz - 40, LW, 40, C.sky2);
  const r = rng(3);
  for (let i = 0; i < 70; i++) {
    const wx = r() * 2400, wy = r() * (hz - 30), ph = r() * 6, big = r() < 0.15;
    const sx = mod(wx - camX * 0.1, 400) - 40;
    if (sx < -2 || sx > LW + 2) continue;
    const tw = Math.sin(t * 2 + ph) > -0.3;
    if (!tw) continue;
    px(sx, wy, 1, 1, C.star);
    if (big && Math.sin(t * 3 + ph) > 0.6) { px(sx - 1, wy, 3, 1, C.star); px(sx, wy - 1, 1, 3, C.star); }
  }
}
function drawFar(camX) {
  const r = rng(11);
  const hz = GY - CAMY;
  for (let i = 0; i < 26; i++) {
    const wx = i * 90 + r() * 40, w = 50 + R(r() * 40), h = 40 + R(r() * 60);
    const sx = R(wx - camX * 0.35) % 2400;
    if (sx > LW || sx + w < 0) continue;
    const y = hz - h + 8;
    px(sx, y, w, h, C.far);
    px(sx, y, w, 1, C.farEdge); px(sx, y, 1, h, C.farEdge); px(sx + w - 1, y, 1, h, C.farEdge);
    px(sx + 1, y + 1, w - 2, 4, C.farEdge);
    px(sx + 3, y + 2, 1, 1, '#3A2E4A'); px(sx + 6, y + 2, 1, 1, '#2E3A4A');
    for (let k = 0; k < 5; k++) {
      const lw = 8 + R(r() * (w - 20));
      if (y + 9 + k * 6 < y + h - 3) px(sx + 4, y + 9 + k * 6, lw, 2, C.farText);
    }
  }
}
function drawGround(camX) {
  const x0 = Math.floor((camX - 16) / 8) * 8, x1 = camX + LW + 16;
  const bottom = LH + CAMY + 10;
  for (let x = x0; x < x1; x += 8) {
    const gx = x + 4;
    if (groundAt(gx) == null) { px(x, GY + 6, 8, bottom - GY, C.void); continue; }
    px(x, GY, 8, bottom - GY, C.g);
    px(x, GY, 8, 2, C.gTop); px(x, GY + 2, 8, 1, C.gTop2);
    const k = mod(x / 8, 7);
    if (k === 1 || k === 4) px(x + 2, GY + 6, 3, 1, C.gDot);
    if (k === 2 || k === 6) px(x + 4, GY + 10, 2, 1, C.gDot);
    if (k === 3) px(x + 1, GY + 14, 4, 1, C.gDot);
    for (let y = GY + 18; y < bottom; y += 8) if (mod(x / 8 + y / 8, 3) === 0) px(x + 3, y, 2, 1, C.gDot);
  }
  const r = rng(21);
  for (let i = 0; i < 40; i++) {
    const vx = 1196 + r() * 152, vy = GY + 14 + r() * 60;
    px(vx, vy, 1, 1, i % 3 ? '#1C2040' : '#2C3366');
  }
}
function drawPipe() {
  const x = 26;
  px(x - 2, GY - 32, 32, 6, C.oD); px(x - 2, GY - 32, 32, 1, C.oL);
  px(x, GY - 26, 28, 26, '#2A2E4A'); px(x, GY - 26, 2, 26, C.o); px(x + 26, GY - 26, 2, 26, C.oD);
  px(x + 5, GY - 22, 18, 12, C.ink);
  px(x + 7, GY - 19, 1, 1, C.green); px(x + 8, GY - 18, 1, 1, C.green); px(x + 7, GY - 17, 1, 1, C.green);
  px(x + 10, GY - 15, 4, 1, C.cream);
}
function drawBlock(x, y, kind, used, bump) {
  const X = R(x - 6), Y = R(y - bump);
  if (used) {
    px(X, Y, 12, 12, C.used); px(X, Y, 12, 1, '#5F6590'); px(X, Y + 11, 12, 1, C.usedD); px(X + 11, Y, 1, 12, C.usedD);
    px(X + 2, Y + 2, 1, 1, C.usedD); px(X + 9, Y + 2, 1, 1, C.usedD); px(X + 2, Y + 9, 1, 1, C.usedD); px(X + 9, Y + 9, 1, 1, C.usedD);
    return;
  }
  if (kind === 'file') {
    px(X, Y, 12, 12, C.o); px(X, Y, 12, 1, C.oL); px(X + 11, Y, 1, 12, C.oD); px(X, Y + 11, 12, 1, C.oD);
    drawPage(X + 3, Y + 2);
  } else {
    px(X, Y, 12, 12, C.gold); px(X, Y, 12, 1, '#FFE29A'); px(X + 11, Y, 1, 12, '#B98A2A'); px(X, Y + 11, 12, 1, '#B98A2A');
    px(X + 3, Y + 4, 6, 1, C.ink); px(X + 3, Y + 7, 6, 1, C.ink);
  }
}
function bumpOf(t, th) { return t >= th && t < th + 0.12 ? 3 - R(25 * (t - th)) : 0; }

function drawArena(t, camX) {
  if (camX + LW < ARENA.l - 10 || camX > ARENA.r + 10) return;
  for (let y = GY - 120; y < GY; y += 6) {
    for (let x = ARENA.l + 8; x < ARENA.r - 8; x += 12) {
      const off = mod((y - GY) / 6, 2) * 6;
      px(x + off, y, 11, 5, C.brick);
      px(x + off, y, 11, 1, C.brickL);
    }
  }
  for (const pxl of [ARENA.l, ARENA.r - 8]) {
    px(pxl, GY - 124, 8, 124, '#2E3150'); px(pxl, GY - 124, 8, 2, '#4A4F78'); px(pxl + 6, GY - 124, 2, 124, '#22253D');
  }
  for (const tx of [ARENA.l + 20, ARENA.r - 22]) {
    px(tx, GY - 56, 3, 10, '#5A4A3A');
    const fl = mod(Math.floor(t * 10 + tx), 3);
    px(tx - 1, GY - 61 - fl, 5, 5 + fl, C.o); px(tx, GY - 63 - fl, 3, 3, C.gold); px(tx + 1, GY - 64 - fl, 1, 2, C.cream);
  }
}

function drawLabel(t) {
  const n = t >= T.fixed ? 3 : t >= T.hitA + 0.55 ? 2 : 1;
  const fixed = t >= T.fixed;
  const str1 = 'token ', str2 = '='.repeat(n), str3 = ' null';
  const w = (str1.length + n + str3.length) * 8;
  const bw = 132, bx = ARENA.c - bw / 2, by = 54;
  const flashA = (t >= T.hitA + 0.55 && t < T.hitA + 0.85) || (t >= T.fixed && t < T.fixed + 0.3);
  px(bx + 14, 0, 1, by, '#5A5F84'); px(bx + bw - 15, 0, 1, by, '#5A5F84');
  px(bx, by, bw, 16, flashA && Math.floor(t * 20) % 2 ? C.gold : C.cream);
  px(bx, by + 15, bw, 1, '#B9B2A2'); px(bx, by, 1, 16, '#B9B2A2'); px(bx + bw - 1, by, 1, 16, '#B9B2A2');
  let x = ARENA.c - w / 2;
  x += text(str1, x, by + 4, C.ink);
  x += text(str2, x, by + 4, fixed ? C.greenD : C.red);
  text(str3, x, by + 4, C.ink);
  if (fixed) { px(bx + bw - 6, by - 4, 8, 8, C.green); px(bx + bw - 4, by, 1, 1, C.cream); px(bx + bw - 3, by + 1, 1, 1, C.cream); px(bx + bw - 2, by, 1, 1, C.cream); px(bx + bw - 1, by - 1, 1, 1, C.cream); }
}
function labelEqPos(n) {
  const w = (6 + n + 5) * 8;
  return { x: ARENA.c - w / 2 + 6 * 8 + (n - 1) * 8 + 4, y: 62 };
}

function tileState(i, t) {
  const tx = TILE0 + i * TILEW + 6;
  const pass = T.bridge0 + (tx - TILE0) / 36;
  if (t < pass) return 'red';
  if (i === FLAKY) {
    if (t < T.flaky) return 'green';
    if (t < T.pound) return Math.floor(t * 8) % 2 && t < T.flaky + 0.4 ? 'green' : 'red';
  }
  return 'green';
}
function drawBridge(t, camX) {
  if (camX + LW < TILE0 - 8 || camX > TILE0 + NT * TILEW + 8) return;
  for (let x = TILE0 - 4; x < TILE0 + NT * TILEW + 4; x += 36) { px(x, GY + 6, 3, 80, '#2A2E4A'); px(x, GY + 6, 1, 80, '#3B4066'); }
  const all = t >= T.pound + 0.3 && t < T.pound + 1.6 && Math.floor(t * 8) % 2 === 0;
  for (let i = 0; i < NT; i++) {
    const st = tileState(i, t), x = TILE0 + i * TILEW;
    const col = st === 'red' ? C.red : C.green, dk = st === 'red' ? C.redD : C.greenD;
    const sink = i === FLAKY && t >= T.pound && t < T.pound + 0.12 ? 2 : 0;
    px(x, GY + sink, TILEW, 6, all ? C.cream : col);
    px(x, GY + 5 + sink, TILEW, 1, dk); px(x + TILEW - 1, GY + sink, 1, 6, dk);
    if (st === 'red') { px(x + 4, GY + 1 + sink, 1, 1, C.cream); px(x + 6, GY + 1 + sink, 1, 1, C.cream); px(x + 5, GY + 2 + sink, 1, 1, C.cream); px(x + 4, GY + 3 + sink, 1, 1, C.cream); px(x + 6, GY + 3 + sink, 1, 1, C.cream); }
    else { px(x + 3, GY + 2 + sink, 1, 1, C.cream); px(x + 4, GY + 3 + sink, 1, 1, C.cream); px(x + 5, GY + 2 + sink, 1, 1, C.cream); px(x + 6, GY + 1 + sink, 1, 1, C.cream); px(x + 7, GY + sink, 1, 1, C.cream); }
  }
}

function drawPoleAndCastle(t, camX) {
  if (camX + LW < POLE - 20) return;
  px(POLE - 4, GY - 8, 8, 8, '#3B4066'); px(POLE - 4, GY - 8, 8, 1, '#5A608E');
  px(POLE, GY - 84, 2, 76, C.cream);
  px(POLE - 1, GY - 88, 4, 4, C.o);
  const fy = R(lerp(GY - 22, GY - 82, E.out(seg(t, T.pole1, T.slide1))));
  const wave = mod(Math.floor(t * 6), 2);
  px(POLE + 2, fy, 14, 10, C.green); px(POLE + 2 + 13, fy + wave, 1, 9, C.greenD);
  px(POLE + 6, fy + 5, 1, 1, C.cream); px(POLE + 7, fy + 6, 1, 1, C.cream); px(POLE + 8, fy + 5, 1, 1, C.cream); px(POLE + 9, fy + 4, 1, 1, C.cream); px(POLE + 10, fy + 3, 1, 1, C.cream);
  const x = CASTLE, w = 64, h = 46, y = GY - h;
  px(x, y, w, h, C.castle);
  for (let k = 0; k < 8; k++) if (k % 2 === 0) px(x + k * 8, y - 6, 8, 6, C.castle);
  px(x, y, w, 1, C.castleL);
  for (let yy = y + 6; yy < GY; yy += 7) for (let xx = x + ((yy / 7) % 2 ? 3 : 0); xx < x + w - 4; xx += 10) px(xx, yy, 6, 1, C.castleD);
  px(x + w - 2, y - 6, 2, h + 6, C.castleD);
  px(x + 22, y - 26, 20, 20, C.castle); px(x + 22, y - 32, 6, 6, C.castle); px(x + 36, y - 32, 6, 6, C.castle); px(x + 22, y - 26, 20, 1, C.castleL);
  const lit = (t >= T.inside + 0.3 && t < T.lightsOff) || t >= T.alarm;
  const lit2 = (t >= T.inside + 0.6 && t < T.lightsOff + 0.4) || t >= T.alarm;
  px(x + 29, y - 20, 6, 8, lit ? C.win : C.ink);
  px(x + 8, y + 10, 8, 10, lit2 ? C.win : C.ink); px(x + 48, y + 10, 8, 10, lit ? C.win : C.ink);
  const open = t >= T.dashOut - 0.15 && t < T.dashOut + 0.5;
  px(DOOR - 6, GY - 16, 12, 16, open ? '#3A2416' : C.ink); px(DOOR - 6, GY - 17, 12, 1, C.castleD);
  px(x + 26, y + 12, 1, 1, C.ink);
  text('main', x + w / 2, y + 26, C.o, 8, 'center');
  px(x + 31, y - 46, 1, 14, C.cream); px(x + 32, y - 46, 8, 5, C.o);
}

// ---------- particles ----------
function drawPuff(t, t0, x, y, col) {
  const u = seg(t, t0, t0 + 0.4);
  if (u <= 0 || u >= 1) return;
  const d = R(2 + 8 * u);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) px(x + dx * d, y + dy * d * 0.6, 2, 2, col);
}
function drawFirework(t, t0, x, y, seed, cols) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.4) return;
  if (dt < 0.35) { px(x, y + 60 * (1 - dt / 0.35), 1, 2, C.cream); return; }
  const r = rng(seed), d = dt - 0.35;
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU + r() * 0.2, sp = 42 + r() * 34, col = cols[i % cols.length];
    for (let k = 0; k < 3; k++) {
      const dd = Math.max(0, d - k * 0.05);
      const sx = x + Math.cos(a) * sp * dd, sy = y + Math.sin(a) * sp * dd + 30 * dd * dd;
      if (d < 0.9 || Math.floor(t * 16 + i) % 2) px(sx, sy, k === 0 && d < 0.45 ? 2 : 1, k === 0 && d < 0.45 ? 2 : 1, k === 0 ? col : C.sky2);
    }
  }
}
function drawExplosion(t, t0, x, y) {
  const d = t - t0;
  if (d < 0 || d > 1.0) return;
  const r = rng(77);
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU, sp = 20 + r() * 60, col = [C.red, C.gold, C.cream, C.o][i % 4];
    const sx = x + Math.cos(a) * sp * d, sy = y + Math.sin(a) * sp * d + 40 * d * d;
    if (d < 0.7 || i % 2) px(sx, sy, d < 0.25 ? 2 : 1, d < 0.25 ? 2 : 1, col);
  }
  if (d < 0.08) { ctx.fillStyle = C.cream; ctx.fillRect(R(x) - 10, R(y) - 10, 20, 20); }
}

// ---------- camera ----------
function camX(t) {
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += clawd(Math.max(0, t - i * 0.06)).x;
  let cx = sum / 8 - LW * (V ? 0.5 : 0.38);
  const lockA = E.inOut(seg(t, 17.5, 18.3)) * (1 - E.inOut(seg(t, 27.9, 28.7)));
  cx = lerp(cx, ARENA.c - LW / 2, lockA);
  const lockB = E.inOut(seg(t, 43.2, 44.4));
  cx = lerp(cx, (V ? DOOR : 1450) - LW / 2, lockB);
  return Math.max(0, cx);
}
function shake(t) {
  let a = 0;
  for (const [t0, amp] of [[T.leap1e, 3], [T.dash1, 3], [T.boom, 4], [T.pound, 2]]) if (t >= t0 && t < t0 + 0.3) a = Math.max(a, amp * (1 - (t - t0) / 0.3));
  return { x: R(Math.sin(t * 90) * a), y: R(Math.cos(t * 70) * a) };
}

// ---------- level scene ----------
function drawLevel(t) {
  const cx = R(camX(t)), sh = shake(t);
  drawSky(t, cx);
  drawFar(cx);
  ctx.save();
  ctx.translate(-cx + sh.x, -CAMY + sh.y);
  drawArena(t, cx);
  if (t >= 17 && t < 28.5) drawLabel(t);
  drawPoleAndCastle(t, cx);
  drawGround(cx);
  drawBridge(t, cx);
  // blocks
  BLOCKS.forEach(b => drawBlock(b.x, BLOCK_Y, 'file', t >= b.th, bumpOf(t, b.th)));
  if (t >= 16) EQ.forEach(b => drawBlock(b.x, BLOCK_Y, 'eq', t >= b.th, bumpOf(t, b.th)));
  // pages popping out of blocks
  BLOCKS.forEach(b => {
    const u = seg(t, b.th, b.th + 0.3);
    if (u > 0 && u < 1) drawPage(b.x - 3, BLOCK_Y - 10 - 14 * E.out(u));
  });
  // "=" flying into the label
  EQ.forEach((b, i) => {
    const u = seg(t, b.th, b.th + 0.55);
    if (u <= 0 || u >= 1) return;
    const tgt = labelEqPos(i + 2);
    const x = lerp(b.x, tgt.x, E.inOut(u)), y = lerp(BLOCK_Y - 6, tgt.y, E.inOut(u)) - Math.sin(PI * u) * 20;
    text('=', x, y - 4, C.gold, 8, 'center', C.ink);
  });
  // stomped bugs on the way
  STOMPS.forEach((s, i) => {
    if (t < s.ts - 4 || t > s.ts + 0.75) return;
    if (t < s.ts) drawBug(s.x + (s.ts - t) * 24, GY, { face: -1, ph: t * 8 });
    else if (t < s.ts + 0.35) drawBug(s.x, GY, { face: -1, flat: true });
    drawPuff(t, s.ts + 0.35, s.x, GY - 3, C.cream);
  });
  // arena
  if (t >= 17 && t < 27.5) drawBossScene(t);
  // pipe hides Clawd while he climbs out
  const c = clawd(t);
  if (c.vis && c.behindPipe) drawClawd(c.x, c.y, c);
  drawPipe();
  if (c.vis && !c.behindPipe) drawClawd(c.x, c.y, c);
  if (t >= 34.4 && t < 35.4) text('?', c.x, c.y - 30, C.gold, 8, 'center', C.ink);
  if (t >= 18.55 && t < 19.1) text('!', c.x, c.y - 30, C.gold, 8, 'center', C.ink);
  if (t >= T.alarm && t < T.dashOut) text('!', DOOR, GY - 30 - (Math.floor(t * 8) % 2), C.gold, 8, 'center', C.ink);
  // ending bug
  if (t >= T.bugIn && t < T.end) {
    const bx = t < T.dashOut ? kf(t, [[T.bugIn, 1560], [51.0, 1500, E.out]]) : kf(t, [[T.dashOut, 1500], [54.7, 1600, E.in]]);
    drawBug(bx, GY, { face: t < T.dashOut ? -1 : 1, ph: t * 10 });
  }
  // fireworks
  [[T.fw0, 1240, 70, 1], [T.fw0 + 0.4, 1300, 55, 2], [T.fw0 + 0.8, 1270, 80, 3]].forEach(([t0, x, y, s]) => drawFirework(t, t0, x, y, s, [C.green, C.cream, C.gold]));
  [[T.inside + 0.2, CASTLE - 8, 62, 4], [T.inside + 0.7, CASTLE + 74, 56, 5], [T.inside + 1.2, CASTLE + 34, 48, 6]].forEach(([t0, x, y, s]) => drawFirework(t, t0, x, y, s, [C.o, C.cream, C.gold, C.green]));
  // sleepy z's from the window
  if (t >= T.lightsOff + 0.3 && t < T.alarm) {
    for (let i = 0; i < 3; i++) {
      const ph = mod(t * 0.6 + i / 3, 1);
      if (ph < 0.85) text('z', CASTLE + 36 + ph * 14, GY - 70 - ph * 30, C.cream, 8, 'center');
    }
  }
  ctx.restore();
  drawHUD(t);
}

function drawBossScene(t) {
  // mini bug A runs under Clawd's jump
  if (t >= T.bugA && t < 22.5) {
    const x = 1075 - 70 * (t - T.bugA);
    if (x > 850) drawBug(x, GY, { face: -1, ph: t * 12 });
  }
  if (t >= T.boom + 0.05) {
    const x = 960 + 200 * (t - T.boom);
    if (t < 27.3) drawBug(x, GY, { face: 1, ph: t * 14 });
    drawExplosion(t, T.boom, 960, GY - 14);
    return;
  }
  let x = 1090, y = GY, face = -1, roar = false, flash = false, scale = 1, look = 0;
  if (t >= T.roar && t < T.roar + 0.6) { roar = true; y = GY - (Math.floor(t * 20) % 2); }
  if (t >= T.leap1 && t < T.leap1e) { const u = seg(t, T.leap1, T.leap1e); x = lerp(1090, 1035, u); y = GY - arc(t, T.leap1, T.leap1e, 30); }
  else if (t >= T.leap1e && t < T.back0) x = 1035;
  if (t >= T.back0 && t < T.back1) { x = lerp(1035, 1100, seg(t, T.back0, T.back1)); y = GY - arc(t, T.back0, T.back1, 24); }
  else if (t >= T.back1 && t < T.dash0) x = 1100;
  if (t >= T.dash0) { x = lerp(1100, 966, E.in(seg(t, T.dash0, T.dash1))); }
  if (t >= T.dash1) { face = 1; }
  if ((t >= T.hitA + 0.55 && t < T.hitA + 0.85) && Math.floor(t * 20) % 2) flash = true;
  if (t >= T.fixed) { flash = Math.floor(t * 16) % 2 === 0; scale = 1 - 0.5 * seg(t, T.fixed + 0.15, T.boom); }
  drawBoss(x, y, { face, roar, flash, scale, ph: t * (t >= T.dash0 && t < T.dash1 ? 14 : 5), look });
  if (t >= T.dash1 && t < T.fixed) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * TAU / 3;
      px(x + Math.cos(a) * 12, y - 34 + Math.sin(a) * 3, 2, 2, C.gold);
    }
  }
}

// ---------- HUD ----------
function filesAt(t) { return BLOCKS.filter(b => t >= b.th + 0.85).length * 7; }
function drawHUD(t) {
  if (t >= T.end || IS_THUMB) return;
  const y = V ? 26 : 4;
  // file counter
  drawPage(6, y);
  text('x' + String(filesAt(t)).padStart(2, '0'), 15, y, C.cream, 8, 'left', C.ink);
  // pages flying from the blocks to the counter
  const cx = R(camX(t));
  BLOCKS.forEach(b => {
    const u = seg(t, b.th + 0.3, b.th + 0.85);
    if (u <= 0 || u >= 1) return;
    const sx = b.x - 3 - cx, sy = BLOCK_Y - 24 - CAMY;
    drawPage(lerp(sx, 6, E.inOut(u)), lerp(sy, y, E.inOut(u)) - Math.sin(PI * u) * 10);
  });
  // task pips
  const done = [17.4, 21.7, T.fixed, T.pound, T.slide1];
  for (let i = 0; i < 5; i++) {
    const x = LW - 8 - (5 - i) * 9;
    const on = t >= done[i];
    px(x, y, 7, 7, C.cream); px(x + 1, y + 1, 5, 5, on ? (Math.floor((t - done[i]) * 10) < 3 && Math.floor((t - done[i]) * 10) % 2 ? C.cream : C.o) : C.sky0);
  }
}

// ---------- title, world card, ending ----------
function typed(str, t, t0, dt) { return str.slice(0, Math.max(0, Math.min(str.length, Math.floor((t - t0) / dt) + 1))); }
function cursor(x, y, t) { if (Math.floor(t * 2.5) % 2 === 0) px(x + 1, y, 6, 8, C.cream); }
function drawLogo(cx, y, t) {
  if (V) {
    text('CLAUDE', cx, y, C.o, 16, 'center', C.oD);
    text('CODE', cx, y + 20, C.o, 16, 'center', C.oD);
  } else text('CLAUDE CODE', cx, y, C.o, 16, 'center', C.oD);
}
function drawTitle(t) {
  px(0, 0, LW, LH, C.ink);
  const L = V ? { px: 10, py: 50, logoY: 140, clawdY: 128, p2: 196 } : { px: 8, py: 8, logoY: 62, clawdY: 54, p2: 96 };
  let w = text('> ', L.px, L.py, C.green);
  const s1 = t < T.type1 ? '' : typed('claude', t, T.type1, 0.11);
  w += text(s1, L.px + w, L.py, C.cream);
  if (t < T.enter1) cursor(L.px + w, L.py, t);
  if (t >= T.logo) {
    const drop = E.out(seg(t, T.logo, T.logo + 0.35));
    const bounce = Math.abs(Math.sin(PI * seg(t, T.logo + 0.35, T.logo + 0.75))) * 6 * (1 - seg(t, T.logo + 0.35, T.logo + 0.75));
    const cy = lerp(-20, L.clawdY, drop) - bounce;
    drawClawd(LW / 2, cy, { eyes: t > 2.2 && t < 2.32 ? 'blink' : 'open', legPh: 0, face: 0 }, 2);
    if (Math.floor((t - T.logo) * 12) > 1 || t > T.logo + 0.3) drawLogo(LW / 2, L.logoY, t);
  }
  if (t >= T.type2 - 0.2) {
    const s = 'fix the login bug';
    let x = V ? 10 : LW / 2 - ((s.length + 2) * 8) / 2;
    let ww = text('> ', x, L.p2, C.green);
    ww += text(t < T.type2 ? '' : typed(s, t, T.type2, 0.075), x + ww, L.p2, C.cream);
    if (t < T.enter2) cursor(x + ww, L.p2, t);
  }
}
function drawWorldCard(t) {
  px(0, 0, LW, LH, C.ink);
  const cy = LH / 2;
  text('WORLD 1-1', LW / 2, cy - 22, C.cream, 8, 'center');
  text('auth.ts', LW / 2, cy - 8, C.o, 8, 'center');
  drawClawd(LW / 2 - 14, cy + 22, { eyes: 'open', legPh: 0, face: 0 });
  text('x 1', LW / 2 + 2, cy + 12, C.cream, 8, 'left');
}
function drawTextbox(t) {
  if (t < T.box0 || t >= T.alarm) return;
  const bw = V ? 164 : 160, bh = 46, bx = R((LW - bw) / 2), by = V ? 44 : 16;
  const u = seg(t, T.box0, T.box0 + 0.15);
  const hh = R(bh * u);
  px(bx, by, bw, hh, C.ink);
  if (u < 1) return;
  px(bx, by, bw, 2, C.cream); px(bx, by + bh - 2, bw, 2, C.cream); px(bx, by, 2, bh, C.cream); px(bx + bw - 2, by, 2, bh, C.cream);
  const lines = ['THANK YOU CLAUDE!', 'BUT THE BUG IS IN', 'ANOTHER FILE.'];
  let tt = T.box0 + 0.2;
  lines.forEach((ln, i) => {
    const s = typed(ln, t, tt, 0.045);
    if (t >= tt) text(s, bx + 8, by + 7 + i * 12, C.cream);
    tt += ln.length * 0.045 + 0.25;
  });
}
function drawEnd(t) {
  px(0, 0, LW, LH, C.ink);
  const L = V ? { logoY: 130, clawdY: 116, p: 200 } : { logoY: 64, clawdY: 54, p: 98 };
  const bob = Math.floor(t * 3) % 2;
  drawClawd(LW / 2, L.clawdY - bob, { eyes: t > 57.2 && t < 57.32 ? 'blink' : 'happy', legPh: 0, face: 0 }, 2);
  drawLogo(LW / 2, L.logoY, t);
  const s = '> claude';
  const x = LW / 2 - (s.length * 8) / 2;
  if (t > T.end + 0.6) {
    const ss = typed(s, t, T.end + 0.6, 0.08);
    const w = text(ss.slice(0, 2), x, L.p, C.green) + text(ss.slice(2), x + 16, L.p, C.cream);
    cursor(x + w + (ss.length > 2 ? 0 : 0), L.p, t);
  }
}

// ---------- frame ----------
function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  if (t < T.world0) drawTitle(t);
  else if (t < T.level) drawWorldCard(t);
  else if (t < T.end) { drawLevel(t); drawTextbox(t); }
  else drawEnd(t);
  // stepped fades between scenes
  let f = 0;
  if (t < 0.3) f = 1 - t / 0.3;
  else if (t >= T.enter2 && t < T.world0) f = seg(t, T.enter2 + 0.05, T.world0 - 0.02);
  else if (t >= T.world0 && t < T.world0 + 0.2) f = 1 - seg(t, T.world0, T.world0 + 0.2);
  else if (t >= T.world1 && t < T.level) f = seg(t, T.world1, T.level);
  else if (t >= T.level && t < T.level + 0.3) f = 1 - seg(t, T.level, T.level + 0.3);
  else if (t >= T.fade0) f = seg(t, T.fade0, DUR);
  if (f > 0) { ctx.globalAlpha = step4(f); px(0, 0, LW, LH, '#000000'); ctx.globalAlpha = 1; }
}

// ---------- thumbnail (logical 320x180, upscaled 4x) ----------
function drawThumb() {
  IS_THUMB = true;
  frame(24.38);
  IS_THUMB = false;
  text('BOSS FIGHT', LW / 2, 117, C.cream, 16, 'center', C.ink);
}

// ---------- audio cues ----------
function cues() {
  const c = [];
  const add = (t, type, extra) => c.push(Object.assign({ t: +t.toFixed(4), type }, extra || {}));
  for (let i = 0; i < 6; i++) add(T.type1 + i * 0.11, 'blip');
  add(T.enter1, 'enter');
  add(T.logo, 'jingle');
  for (let i = 0; i < 17; i++) add(T.type2 + i * 0.075, 'blip');
  add(T.enter2, 'enter');
  add(T.world0 + 0.1, 'world');
  add(T.pipe0, 'pipe');
  JUMPS.forEach(j => { if (j.t0 > 6 && !(j.y0 === GY - 7)) add(j.t0, j.pound ? 'jumpbig' : 'jump'); });
  BLOCKS.forEach(b => { add(b.th, 'bump'); add(b.th + 0.02, 'coin'); add(b.th + 0.85, 'tick'); });
  STOMPS.forEach(s => add(s.ts, 'stomp'));
  add(T.roar, 'roar');
  add(T.bugA, 'spawn');
  add(T.leap1e, 'thud');
  EQ.forEach(b => { add(b.th, 'bump'); add(b.th + 0.02, 'power'); add(b.th + 0.55, 'hit'); });
  add(T.dash0, 'dash');
  add(T.dash1, 'thud');
  add(T.dash1 + 0.05, 'dizzy');
  add(T.fixed, 'fixed');
  add(T.boom, 'boom');
  for (let i = 0; i < NT; i++) add(T.bridge0 + (i * TILEW + 6) / 36, 'tile', { i });
  add(T.flaky, 'error');
  add(34.4, 'huh');
  add(T.pound, 'pound'); add(T.pound + 0.05, 'tile', { i: 12 });
  [T.fw0, T.fw0 + 0.4, T.fw0 + 0.8, T.inside + 0.2, T.inside + 0.7, T.inside + 1.2].forEach(x => { add(x, 'launch'); add(x + 0.35, 'firework'); });
  add(T.pole1, 'slide');
  add(T.slide1, 'clear');
  add(T.inside - 0.2, 'door');
  add(T.lightsOff, 'off');
  add(T.bugIn, 'scuttle');
  const lines = ['THANK YOU CLAUDE!', 'BUT THE BUG IS IN', 'ANOTHER FILE.'];
  let tt = T.box0 + 0.2;
  for (const ln of lines) { for (let i = 0; i < ln.length; i++) if (ln[i] !== ' ') add(tt + i * 0.045, 'talk'); tt += ln.length * 0.045 + 0.25; }
  add(T.alarm, 'alarm');
  add(T.dashOut, 'door'); add(T.dashOut + 0.05, 'dash');
  add(T.end + 0.1, 'logo');
  for (let i = 0; i < 8; i++) add(T.end + 0.6 + i * 0.08, 'blip');
  return c.sort((a, b) => a.t - b.t);
}

// ---------- boot ----------
window.renderAt = t => frame(t);
window.renderThumb = () => drawThumb();
window.getCues = cues;
window.DUR = DUR;
window.LOGICAL = [LW, LH];
(async () => {
  await document.fonts.load('8px PS2P', 'A');
  await document.fonts.ready;
  window.READY = true;
  if (MODE === 'thumb') { drawThumb(); return; }
  if (MODE === 'preview') {
    document.body.classList.add('preview');
    let start = performance.now(), paused = false, pt = 0;
    cv.addEventListener('click', () => { paused = !paused; if (!paused) start = performance.now() - pt * 1000; });
    const tq = parseFloat(P.get('t'));
    if (!isNaN(tq)) { pt = tq; paused = true; }
    const loop = () => {
      if (!paused) pt = ((performance.now() - start) / 1000) % DUR;
      frame(pt);
      requestAnimationFrame(loop);
    };
    loop();
  }
})();
