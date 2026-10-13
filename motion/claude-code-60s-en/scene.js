'use strict';
// "Bug Hunt" — a 60s hand-drawn story about Claude Code.
// renderAt(t) is deterministic: the same t always draws the same frame.

const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 1920), H = +(P.get('h') || 1080);
const V = H > W;
const MODE = P.get('mode') || 'preview';
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const rc = rough.canvas(cv);

const BS = Math.min(W, H) / 1080;          // virtual units: short side = 1080
const VW = W / BS, VH = H / BS;
const STAGE = V ? 0.68 : 1;                // the story stage is designed for 16:9 and scaled into 9:16
const STAGE_Y = V ? 60 : 0;
const PI = Math.PI, TAU = PI * 2;
const DUR = 60;
const MONO = "'Plex', monospace";
const INK = '#2A221D', PAPER = '#ECE9E1', CREAM = '#F4F0E8', SHEET = '#FAF8F3';
const ORANGE = '#E27C4F', ORANGE_D = '#C85D35', RED = '#DE5A43', GREEN = '#4FA65E';
const G = 250;                             // ground line (stage y)

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: u => 1 - Math.pow(1 - u, 3),
  in: u => u * u * u,
  outBack: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  sine: u => -(Math.cos(PI * u) - 1) / 2,
  lin: u => u,
};
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, (e || E.inOut)((t - t0) / (t1 - t0 || 1)));
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
const pulse = (t, t0, d) => Math.sin(PI * seg(t, t0, t0 + d));
const rotP = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
function blinkAt(t, list) { let b = 0; for (const x of list) b = Math.max(b, pulse(t, x, 0.16)); return b; }
const hop = (t, t0, d, h) => h * Math.sin(PI * seg(t, t0, t0 + d));

// ---------- rough helpers ----------
let BOIL = 0;                                     // line boil: shapes re-jitter 8 times a second
let IS_THUMB = false;
const sd = k => ((k * 1013 + BOIL * 7919) % 2147483000) + 1;
function R(kind, args, o) {
  const opt = Object.assign({ roughness: 1, bowing: 1, stroke: INK, strokeWidth: 3 }, o);
  opt.seed = sd(o.k || 1);
  delete opt.k;
  rc[kind](...args, opt);
}
function rrPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
}
function stage() {
  if (IS_THUMB) { const s = BS * 1.3; ctx.setTransform(s, 0, 0, s, W / 2 - 40 * BS, H / 2 + 10 * BS); return; }
  const s = BS * STAGE; ctx.setTransform(s, 0, 0, s, W / 2, H / 2 + STAGE_Y * BS);
}
function overlay() { ctx.setTransform(BS, 0, 0, BS, W / 2, H / 2); }
function setFont(wt, size) { ctx.font = `${wt} ${size}px ${MONO}`; }
function star4(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -PI / 2 + i * PI / 4, d = i % 2 ? r * 0.32 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

// ---------- timeline (96 BPM: beat 0.625s, bar 2.5s) ----------
const T = {
  line0: 0.2, line1: 1.3, list0: 0.9,
  walk0: 1.5, walk1: 4.2, prompt0: 3.0,
  read0: 5.0, poof: 13.75, cloud0: 13.9, cloud1: 15.2, read1: 14.6,
  find0: 15.0, mag0: 15.2, sneak0: 15.625, sneakSteps: 9, bugIn: 16.6, turn: 21.875, bang: 22.0,
  chase0: 22.5, wrap: 24.2, skid: 25.85, jar: 26.0, jarLand: 26.25, tag: 26.6, find1: 27.0,
  fix0: 27.5, sign0: 27.7, hammer0: 28.6, hit1: 30.0, hit2: 31.25, fixed: 32.5, wipe: 33.6, fix1: 36.6, signOut: 37.0,
  test0: 37.5, lights0: 37.6, podium0: 37.9, press: 39.375, bulb0: 40.0, bulbStep: 0.3125, red: 8, flick: 44.2, green: 45.0,
  test1: 46.6, lightsOut: 47.0,
  ship0: 47.5, sheet: 48.5, fold0: 48.8, fold1: 49.6, throw: 50.0, fly1: 52.6, ship1: 53.5,
  end0: 55.0, title0: 56.0, fade0: 59.3,
};
const TASKS = [
  ['read the codebase', T.read0, T.read1],
  ['find the bug', T.find0, T.find1],
  ['fix it', T.fix0, T.fix1],
  ['run the tests', T.test0, T.test1],
  ['ship it', T.ship0, T.ship1],
];
const FIXX = -60, BTNX = 110, PODX = 360, JARX = V ? -540 : -610;

// papers read in section 1: one per beat, then 8ths, then 16ths
const PAPERS = (() => {
  const out = [], r = rng(31);
  let t = 5.3125;
  while (t < 13.4) {
    const fly = t < 7.8 ? 1.1 : t < 10.3 ? 0.9 : 0.75;
    out.push({ t0: t, t1: t + fly, y0: -140 + r() * 120, rot: (r() - 0.5) * 0.5, dx: (r() - 0.5) * 10, k: 300 + out.length * 11 });
    t += t < 7.8 ? 0.625 : t < 10.3 ? 0.3125 : 0.15625;
  }
  return out;
})();
const landed = t => PAPERS.filter(p => t >= p.t1).length;

// ---------- paper background (rendered once) ----------
const paperCv = (() => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  const r = rng(5);
  for (let i = 0; i < 18; i++) {
    const cx = r() * W, cy = r() * H, rad = (200 + r() * 500) * BS;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const dark = r() < 0.5;
    g.addColorStop(0, dark ? 'rgba(150,135,110,0.06)' : 'rgba(255,255,250,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 16;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 220; i++) {
    x.fillStyle = `rgba(42,34,29,${0.15 + r() * 0.5})`;
    x.beginPath(); x.arc(r() * W, r() * H, (0.5 + r() * 1.6) * BS, 0, TAU); x.fill();
  }
  x.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const sx = r() * W, sy = r() * H, len = (10 + r() * 30) * BS, a = r() * TAU;
    x.strokeStyle = `rgba(80,65,50,${0.05 + r() * 0.07})`; x.lineWidth = 1.2 * BS;
    x.beginPath(); x.moveTo(sx, sy);
    x.quadraticCurveTo(sx + Math.cos(a + 0.6) * len * 0.6, sy + Math.sin(a + 0.6) * len * 0.6, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    x.stroke();
  }
  const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(70,55,35,0.10)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  return c;
})();

// ---------- the block ----------
const BW = 380, BH = 240, LH = 60, LW = 34, AW = 58, AH = 66;
const LEGX = [-150, -90, 58, 118];

function blockState(t) {
  const s = { x: -1250, lift: 0, sx: 1, sy: 1, rot: 0, face: 0, eyes: 'open', lx: 0, ly: 0, blink: 0,
    legPhase: 0, legAmp: 0, fold: 0, armL: 0, armR: 0, tool: null, toolP: 1, crouch: 0 };
  s.blink = blinkAt(t, [4.7, 9.4, 12.3, 18.6, 34.9, 41.0, 54.3]);
  const br = Math.sin(t * 2.4) * 0.006;
  s.sy = 1 + br; s.sx = 1 - br;

  if (t < T.read0) {
    // walk in
    const u = E.out(seg(t, T.walk0, T.walk1));
    s.x = lerp(-1250, 0, u);
    s.legPhase = (s.x + 1250) / 48;
    const walking = 1 - seg(t, 3.7, T.walk1);
    s.legAmp = 13 * walking;
    s.lift = Math.abs(Math.sin(s.legPhase)) * 5 * walking;
    s.face = t < 4.3 ? 1 : 1 - seg(t, 4.3, 4.5);
    s.sy -= 0.07 * pulse(t, T.walk1 - 0.05, 0.25); s.sx += 0.05 * pulse(t, T.walk1 - 0.05, 0.25);
    s.sy -= 0.05 * pulse(t, 4.85, 0.2);            // nod: "on it"
    if (t > 3.2 && t < 4.3) { s.lx = 6; }
  } else if (t < T.find0) {
    // reading
    s.x = 0;
    let best = null;
    for (const p of PAPERS) {
      const u = seg(t, p.t0, p.t1);
      if (u > 0.2 && u < 0.7) { best = p; break; }
    }
    if (best) { const pp = paperPos(best, t); s.lx = clamp(pp.x / 300, -1, 1) * 16; s.ly = clamp((pp.y + 40) / 200, -1, 1) * 10; }
    if (t > 10.3 && t < 13.7) s.eyes = 'wide';
    if (t >= T.cloud0) { s.lx = 0; s.ly = -16; s.eyes = t > 14.4 ? 'happy' : 'wide'; }
    s.sy -= 0.03 * pulse(t, 14.4, 0.3);
  } else if (t < T.chase0) {
    // sneak right with the magnifier
    s.face = 1;
    s.tool = 'mag'; s.toolP = E.outBack(seg(t, T.mag0, T.mag0 + 0.35));
    s.armR = lerp(0, -0.55, E.out(seg(t, T.mag0, T.mag0 + 0.4)));
    s.eyes = 'focus';
    s.ly = 8;
    const k = (t - T.sneak0) / 0.625;
    if (k > 0 && k < T.sneakSteps) {
      const i = Math.floor(k), f = k - i;
      s.x = (i + E.inOut(f)) * 33.3;
      s.legPhase = PI * f + (i % 2) * PI;
      s.legAmp = 18;
      s.lift = 5 * Math.sin(PI * f);
    } else s.x = k <= 0 ? 0 : T.sneakSteps * 33.3;
    s.crouch = 1;
    if (t >= T.turn) {
      const u = seg(t, T.turn, T.turn + 0.15);
      s.face = 1 - 2 * u;
      s.armR = lerp(-0.55, -0.2, u);
      s.eyes = t >= T.bang ? 'wide' : 'open';
      s.ly = lerp(8, 0, u);
      s.lift = hop(t, T.bang, 0.25, 26);
    }
  } else if (t < T.fix0) {
    // chase, wrap around, catch
    s.face = -1; s.eyes = 'focus';
    let x;
    if (t < T.wrap) x = kf(t, [[T.chase0 + 0.15, 300], [23.6, -1250, E.in]]);
    else x = kf(t, [[T.wrap + 0.3, 1250], [T.skid, -110, E.out]]);
    s.x = x;
    const dist = t < T.wrap ? 300 - x : 1550 + (1250 - x);
    s.legPhase = dist / 34;
    const running = (t < 23.6 || (t > T.wrap + 0.3 && t < T.skid + 0.1)) ? 1 : 0;
    s.legAmp = 18 * running;
    s.lift = Math.abs(Math.sin(s.legPhase)) * 8 * running;
    s.rot = 0.08 * s.face * running;
    if (t > T.skid - 0.2 && t < T.skid + 0.35) { s.rot = -0.1 * s.face * pulse(t, T.skid - 0.2, 0.55); s.legAmp = 0; }
    if (t >= T.jarLand) { s.eyes = t < 26.55 ? 'wide' : 'happy'; s.lift = hop(t, 26.6, 0.3, 30); s.rot = 0; }
    if (t >= 26.55) s.armL = 0.9 * pulse(t, 26.55, 0.7);
  } else if (t < T.test0) {
    // fix with a hammer
    s.x = kf(t, [[27.6, -110], [28.4, FIXX]]);
    s.face = 1;
    if (t < 28.4) { s.legPhase = (s.x + 110) / 20; s.legAmp = 12 * pulse(t, 27.6, 0.8); }
    s.tool = t < 33.4 ? 'hammer' : null;
    s.toolP = E.outBack(seg(t, T.hammer0, T.hammer0 + 0.3)) * (1 - seg(t, 33.1, 33.4));
    let a = lerp(0, 1.45, E.out(seg(t, T.hammer0, T.hammer0 + 0.4)));
    for (const th of [T.hit1, T.hit2]) {
      if (t >= th - 0.14 && t < th) a = lerp(1.45, -0.15, E.in(seg(t, th - 0.14, th)));
      else if (t >= th && t < th + 0.45) a = lerp(-0.15, 1.45, E.out(seg(t, th + 0.05, th + 0.45)));
    }
    if (t >= T.fixed - 0.2) a = lerp(1.45, 0.6, E.out(seg(t, T.fixed - 0.2, T.fixed + 0.3))) * (1 - seg(t, 33.0, 33.4));
    s.armR = a;
    s.eyes = t < T.fixed ? 'focus' : 'happy';
    for (const th of [T.hit1, T.hit2]) { s.sy -= 0.04 * pulse(t, th, 0.15); }
    if (t >= T.wipe && t < 35.0) { s.armL = 1.1 * pulse(t, T.wipe, 0.9); s.eyes = 'closed'; }
    if (t >= 35.0) s.eyes = 'open';
  } else if (t < T.ship0) {
    // tests
    s.x = kf(t, [[37.95, FIXX], [38.85, BTNX]]);
    s.face = 1;
    if (t < 38.9) { s.legPhase = (s.x - FIXX) / 24; s.legAmp = 13 * pulse(t, 37.95, 0.9); }
    s.armR = kf(t, [[38.9, 0], [39.15, 0.35, E.out], [T.press, -0.42, E.in], [39.7, 0.1, E.out], [40.0, 0]]);
    const lit = clamp((t - T.bulb0) / T.bulbStep, 0, 11.5);
    const bx = bulbX(Math.floor(lit));
    s.ly = t > T.bulb0 - 0.2 ? -16 : 0;
    s.lx = t > T.bulb0 - 0.2 ? clamp((bx - BTNX) / 500, -1, 1) * 18 : 0;
    s.eyes = 'open';
    const redOn = T.bulb0 + T.red * T.bulbStep;
    if (t >= redOn && t < T.green) {
      s.lx = clamp((bulbX(T.red) - BTNX) / 500, -1, 1) * 18;
      s.eyes = t < redOn + 0.6 ? 'wide' : 'squint';
      s.lift = hop(t, 43.75, 0.3, 22);
    }
    if (t >= T.green) {
      s.eyes = 'happy'; s.ly = -6;
      s.lift = hop(t, 45.0, 0.45, 70) + hop(t, 45.6, 0.45, 55);
      s.armL = s.armR = 1.0 * clamp(pulse(t, 45.0, 1.4) * 1.6);
      s.sy -= 0.08 * pulse(t, 45.45, 0.15) + 0.08 * pulse(t, 46.05, 0.15);
    }
  } else if (t < T.end0) {
    // ship
    s.x = kf(t, [[47.55, BTNX], [48.3, 0]]);
    s.face = t < 48.3 ? -1 : 0;
    if (t < 48.3) { s.legPhase = (BTNX - s.x) / 22; s.legAmp = 12 * pulse(t, 47.55, 0.75); }
    s.tool = t < T.throw ? 'sheet' : null;
    s.toolP = E.outBack(seg(t, T.sheet, T.sheet + 0.3));
    s.armR = kf(t, [[48.3, 0], [48.6, 0.9, E.out], [49.8, 1.0], [T.throw, -0.3, E.in], [50.6, 0, E.out]]);
    if (t >= T.throw - 0.2) {
      const pp = planePos(t);
      if (pp) { s.lx = clamp(pp.x / 400, -1, 1) * 18; s.ly = clamp((pp.y + 100) / 250, -1, 1) * 14; }
    }
    s.eyes = t > T.fly1 ? 'happy' : 'open';
    s.lift = hop(t, 53.6, 0.35, 34);
  } else {
    // sleep
    s.x = 0;
    s.fold = E.inOut(seg(t, 55.2, 55.9));
    s.eyes = t < 55.5 ? 'open' : 'closed';
    s.sy += Math.sin(t * 1.6) * 0.012;
  }
  if (s.crouch) { s.sy *= 0.95; s.sx *= 1.02; }
  return s;
}

function armPivot(s, side) {
  const legH = LH * (1 - s.fold);
  return { x: s.x + side * (BW / 2 - 6) * s.sx, y: G - s.lift - (legH + BH * 0.5) * s.sy };
}
function armDir(s, side) {
  const a = side > 0 ? s.armR : s.armL;
  const v = rotP(side, 0, -side * a);
  return { x: v.x, y: v.y };
}
function armTip(s, side) {
  const p = armPivot(s, side), d = armDir(s, side);
  return { x: p.x + d.x * AW, y: p.y + d.y * AW, dx: d.x, dy: d.y };
}

function drawArm(s, side) {
  const p = armPivot(s, side);
  const a = side > 0 ? s.armR : s.armL;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-side * a);
  const d = side > 0 ? rrPath(-6, -AH / 2, AW + 6, AH, 8) : rrPath(-AW, -AH / 2, AW + 6, AH, 8);
  R('path', [d], { k: side > 0 ? 40 : 41, fill: ORANGE, fillStyle: 'solid', strokeWidth: 4.5, roughness: 0.7 });
  ctx.restore();
}

function drawBlock(t, s) {
  const legH = LH * (1 - s.fold);
  const sh = 1 - clamp(s.lift / 300) * 0.5;
  R('ellipse', [s.x, G + 3, BW * 1.22 * sh, 22 * sh], { k: 11, stroke: 'none', fill: 'rgba(42,34,29,0.34)', fillStyle: 'hachure', hachureGap: 3.5, hachureAngle: -12, fillWeight: 1, roughness: 1.4 });
  drawArm(s, -1); drawArm(s, 1);
  ctx.save();
  ctx.translate(s.x, G - s.lift);
  ctx.rotate(s.rot);
  ctx.scale(s.sx, s.sy);
  if (legH > 3) {
    LEGX.forEach((lx, i) => {
      const ph = s.legPhase + (i % 2 ? PI : 0);
      const up = Math.max(0, Math.sin(ph)) * s.legAmp;
      const fw = Math.cos(ph) * s.legAmp * 0.5 * (s.face || 0);
      R('path', [rrPath(lx + fw, -legH - 12, LW, legH + 12 - up, 7)], { k: 20 + i, fill: ORANGE, fillStyle: 'solid', strokeWidth: 4.5, roughness: 0.7 });
    });
  }
  const bx = -BW / 2, by = -legH - BH;
  const body = rrPath(bx, by, BW, BH, 12);
  R('path', [body], { k: 30, fill: ORANGE, fillStyle: 'solid', stroke: 'none', roughness: 0.5 });
  R('path', [rrPath(bx + BW - 54, by + 5, 48, BH - 10, 8)], { k: 31, fill: ORANGE_D, fillStyle: 'solid', stroke: 'none', roughness: 0.9 });
  R('path', [body], { k: 32, fill: 'rgba(150,55,25,0.24)', fillStyle: 'hachure', hachureGap: 9, hachureAngle: -42, fillWeight: 1.1, stroke: 'none', roughness: 1.8 });
  const r = rng(77);
  for (let i = 0; i < 9; i++) {
    const gx = bx + 24 + r() * (BW - 120), gy = by + 16 + r() * (BH - 40), gl = 30 + r() * 60;
    R('line', [gx, gy, gx + gl, gy - 4 + r() * 8], { k: 90 + i, stroke: 'rgba(255,214,186,0.45)', strokeWidth: 1.6, roughness: 1.2 });
  }
  R('path', [body], { k: 33, stroke: INK, strokeWidth: 6, roughness: 0.9, bowing: 0.6 });
  drawEyes(s, by);
  ctx.restore();
}

function drawEyes(s, by) {
  const ey = by + BH * 0.37;
  const fx = (s.face || 0) * 34 + s.lx, fy = s.ly;
  for (const side of [-1, 1]) {
    const cx = side * 98 + fx, cy = ey + fy;
    if (s.eyes === 'closed') {
      R('curve', [[[cx - 20, cy + 2], [cx, cy + 12], [cx + 20, cy + 2]]], { k: 52 + side, strokeWidth: 6, roughness: 0.5 });
      continue;
    }
    if (s.eyes === 'happy') {
      R('curve', [[[cx - 20, cy + 10], [cx, cy - 10], [cx + 20, cy + 10]]], { k: 54 + side, strokeWidth: 6.5, roughness: 0.5 });
      continue;
    }
    let w = 30, h = 54;
    if (s.eyes === 'wide') { w = 38; h = 66; }
    if (s.eyes === 'squint') h = 14;
    h = Math.max(5, h * (1 - s.blink));
    let pts;
    if (s.eyes === 'focus' && h > 20) {
      const dip = 18;
      pts = side < 0
        ? [[cx - w / 2, cy - h / 2 + 4], [cx + w / 2, cy - h / 2 + dip], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]
        : [[cx - w / 2, cy - h / 2 + dip], [cx + w / 2, cy - h / 2 + 4], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
      R('polygon', [pts], { k: 56 + side, fill: '#1C1612', fillStyle: 'solid', stroke: '#1C1612', strokeWidth: 2, roughness: 0.4 });
    } else {
      R('path', [rrPath(cx - w / 2, cy - h / 2, w, h, Math.min(9, h / 2))], { k: 58 + side, fill: '#1C1612', fillStyle: 'solid', stroke: 'none', roughness: 0.4 });
    }
    if (h > 20) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - w / 2 + 6, cy - h / 2 + (s.eyes === 'focus' ? 14 : 6), w > 32 ? 11 : 8, w > 32 ? 13 : 10);
    }
  }
}

// ---------- the bug ----------
function bugState(t) {
  const b = { vis: false, x: 0, face: 1, legPh: 0, run: 0, lift: 0, eyes: 'open', lx: 0, inJar: false, s: 1 };
  if (t > 0.3 && t < 2.6) {
    // cameo: scuttles in, stares at us, scuttles off
    b.vis = true;
    b.x = kf(t, [[0.4, -1100], [1.2, -40, E.out], [1.75, -40], [2.5, 1150, E.in]]);
    b.run = t < 1.2 || t > 1.75 ? 1 : 0;
    b.legPh = b.x / 9;
    b.lx = t > 1.25 && t < 1.7 ? 2 : 0;
    b.eyes = t > 1.3 && t < 1.7 ? 'wide' : 'open';
    b.lift = hop(t, 1.32, 0.18, 12);
  } else if (t >= T.bugIn && t < T.wrap) {
    b.vis = true;
    const cs = blockState(Math.min(t, T.turn));
    const follow = cs.x - 440;
    if (t < 17.5) b.x = lerp(-1100, follow, E.out(seg(t, T.bugIn, 17.5)));
    else b.x = follow;
    b.legPh = b.x / 7;
    b.run = 1;
    if (t >= 21.45) { b.run = 0; }
    if (t >= T.bang) { b.eyes = 'wide'; b.lift = hop(t, T.bang, 0.2, 20); }
    if (t >= T.chase0 - 0.1) {
      b.face = -1;
      b.x = lerp(follow, -1150, E.in(seg(t, T.chase0 - 0.1, 23.1)));
      b.run = 1; b.legPh = b.x / 6;
    }
  } else if (t >= T.wrap && t < T.jarLand) {
    b.vis = true; b.face = -1;
    b.x = kf(t, [[T.wrap, 1150], [25.5, JARX, E.out], [25.95, JARX], [26.25, JARX - 30, E.in]]);
    b.run = t < 25.45 || t > 25.95 ? 1 : 0;
    b.legPh = b.x / 6;
    if (t > 25.55 && t < 25.95) { b.face = 1; b.eyes = 'wide'; }
  } else if (t >= T.jarLand) {
    b.vis = true; b.inJar = true; b.x = JARX - 30;
    b.x += Math.sin(t * 9) * 6 * (1 - seg(t, 26.3, 28.0));
    b.face = t < 30.0 ? -1 : 1;
    b.eyes = 'angry';
    if (t >= T.fixed) b.eyes = 'sad';
    if (t >= 55.4) b.eyes = 'sleep';
    b.legPh = t * 9 * (1 - seg(t, 26.3, 27.5));
    b.run = t < 27.5 ? 1 : 0;
  }
  return b;
}

function drawBug(t, b) {
  ctx.save();
  ctx.translate(b.x, G - b.lift);
  ctx.scale(b.face * b.s, b.s);
  if (!b.inJar) R('ellipse', [0, 3, 92, 10], { k: 60, stroke: 'none', fill: 'rgba(42,34,29,0.3)', fillStyle: 'hachure', hachureGap: 3, fillWeight: 1 });
  for (let i = 0; i < 3; i++) {
    const lx = -26 + i * 20, ph = b.legPh + i * 2.1;
    const up = Math.max(0, Math.sin(ph)) * 7 * b.run, fw = Math.cos(ph) * 6 * b.run;
    R('linearPath', [[[lx, -18], [lx + fw - 7, -9 - up], [lx + fw - 3, -1 - up * 0.3]]], { k: 61 + i, strokeWidth: 3.2, roughness: 0.6 });
  }
  R('ellipse', [-6, -30, 76, 46], { k: 65, fill: INK, fillStyle: 'solid', strokeWidth: 3, roughness: 0.8 });
  R('curve', [[[-4, -51], [0, -32], [-5, -10]]], { k: 66, stroke: 'rgba(244,240,232,0.35)', strokeWidth: 2, roughness: 0.6 });
  R('circle', [30, -34, 36], { k: 67, fill: INK, fillStyle: 'solid', strokeWidth: 3, roughness: 0.7 });
  const droop = b.eyes === 'sad' || b.eyes === 'sleep' ? 22 : 0;
  R('curve', [[[26, -50], [30, -68 + droop * 0.5], [42, -78 + droop]]], { k: 68, strokeWidth: 2.6, roughness: 0.6 });
  R('curve', [[[36, -48], [48, -62 + droop * 0.5], [62, -66 + droop]]], { k: 69, strokeWidth: 2.6, roughness: 0.6 });
  for (const ex of [27, 40]) {
    if (b.eyes === 'sleep') { R('line', [ex - 5, -36, ex + 5, -36], { k: 70 + ex, stroke: CREAM, strokeWidth: 2.5, roughness: 0.3 }); continue; }
    const r = b.eyes === 'wide' ? 8.5 : 6.5;
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(ex, -37, r, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 1.5 + b.lx, -37, b.eyes === 'wide' ? 3 : 3.4, 0, TAU); ctx.fill();
    if (b.eyes === 'angry' || b.eyes === 'sad') {
      ctx.fillStyle = INK;
      ctx.beginPath();
      const tilt = b.eyes === 'angry' ? (ex < 30 ? -1 : 1) : (ex < 30 ? 1 : -1);
      ctx.moveTo(ex - 8, -45 + (tilt < 0 ? 0 : 5)); ctx.lineTo(ex + 8, -45 + (tilt < 0 ? 5 : 0)); ctx.lineTo(ex + 8, -46 - 6); ctx.lineTo(ex - 8, -46 - 6);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- props ----------
function paperPos(p, t) {
  const u = seg(t, p.t0, p.t1);
  const read = { x: 300 + p.dx, y: -90 };
  const stackTop = G - 8 - PAPERS.indexOf(p) * 6.5;
  if (u < 0.45) {
    const e = E.out(u / 0.45);
    return { x: lerp(1100, read.x, e), y: lerp(p.y0, read.y, e) - Math.sin(PI * e) * 60, rot: lerp(p.rot * 3, 0, e), s: 1 };
  }
  if (u < 0.6) return { x: read.x - (u - 0.45) * 60, y: read.y, rot: 0, s: 1 };
  const e = E.inOut((u - 0.6) / 0.4);
  return { x: lerp(read.x - 9, -430, e), y: lerp(read.y, stackTop - 40, e) - Math.sin(PI * e) * 120, rot: lerp(0, p.rot, e), s: lerp(1, 0.9, e) };
}
function drawPaper(x, y, rot, s, k) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  R('path', ['M-34,-46 H20 L34,-32 V46 H-34 Z'], { k, fill: SHEET, fillStyle: 'solid', strokeWidth: 2.4, roughness: 0.8 });
  R('linearPath', [[[20, -46], [20, -32], [34, -32]]], { k: k + 1, strokeWidth: 1.8, roughness: 0.5 });
  const lens = [44, 52, 36, 48, 28];
  for (let i = 0; i < 5; i++) R('line', [-24, -26 + i * 13, -24 + lens[i], -26 + i * 13], { k: k + 2 + i, stroke: 'rgba(42,34,29,0.45)', strokeWidth: 1.6, roughness: 0.6 });
  ctx.restore();
}
function drawPapers(t) {
  if (t < 5 || t > 14.2) return;
  for (const p of PAPERS) {
    if (t < p.t0 || t >= p.t1) continue;
    const pp = paperPos(p, t);
    drawPaper(pp.x, pp.y, pp.rot, pp.s, p.k);
  }
}
function drawStack(t) {
  const n = landed(t);
  if (n === 0 || t > T.poof + 0.05) return;
  const wob = Math.sin(t * 9) * 0.05 * seg(t, 12.6, T.poof);
  ctx.save();
  ctx.translate(-430, G); ctx.rotate(wob);
  const r = rng(12);
  for (let i = 0; i < n; i++) {
    const ox = (r() - 0.5) * 10, y = -8 - i * 6.5;
    ctx.fillStyle = SHEET; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.rect(-36 + ox, y - 3, 74, 6); ctx.fill(); ctx.stroke();
  }
  R('rectangle', [-38, -8 - n * 6.5 - 1, 78, n * 6.5 + 8], { k: 140, strokeWidth: 2.2, roughness: 1.2 });
  ctx.restore();
}
function drawPuff(t, t0, x, y, n, size, k) {
  const u = seg(t, t0, t0 + 0.6);
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3, d = size * 0.6 * E.out(u);
    R('circle', [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, size * 0.5 * (1 - u)], { k: k + i, fill: SHEET, fillStyle: 'solid', strokeWidth: 2, roughness: 1.2 });
  }
}

function drawCloud(t) {
  if (t < T.cloud0 || t >= T.cloud1) return;
  const u = E.outBack(seg(t, T.cloud0, T.cloud0 + 0.4)), out = seg(t, T.cloud1 - 0.2, T.cloud1);
  const cx = 0, cy = -330;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(u * (1 - out * 0.4), u * (1 - out * 0.4));
  ctx.globalAlpha = 1 - out;
  const puffs = [[-150, 10, 170, 120], [-60, -40, 200, 140], [70, -35, 210, 140], [160, 15, 170, 120], [0, 50, 330, 110]];
  puffs.forEach((p, i) => R('ellipse', [p[0], p[1], p[2], p[3]], { k: 150 + i, strokeWidth: 3, roughness: 1.1 }));
  puffs.forEach((p, i) => R('ellipse', [p[0], p[1], p[2] - 6, p[3] - 6], { k: 160 + i, stroke: 'none', fill: '#F7F4EE', fillStyle: 'solid', roughness: 0.6 }));
  const nodes = [[0, -55], [-110, 5], [0, 5], [110, 5], [60, 60], [160, 60]];
  const edges = [[0, 1], [0, 2], [0, 3], [3, 4], [3, 5]];
  edges.forEach(([a, b], i) => R('line', [nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1]], { k: 170 + i, strokeWidth: 2, roughness: 0.8 }));
  nodes.forEach((n, i) => {
    const bad = i === 4;
    R('rectangle', [n[0] - 30, n[1] - 15, 60, 30], { k: 180 + i, fill: bad ? RED : SHEET, fillStyle: 'solid', strokeWidth: 2.2, roughness: 0.8 });
  });
  const pr = 1 + 0.35 * Math.abs(Math.sin(t * 7));
  R('circle', [60, 60, 70 * pr], { k: 190, stroke: RED, strokeWidth: 3, roughness: 1.4 });
  ctx.restore();
  for (const [bx, by, d, k] of [[40, -150, 26, 195], [70, -195, 38, 196]]) {
    if (u > 0.3) R('circle', [bx, by, d * u], { k, fill: '#F7F4EE', fillStyle: 'solid', strokeWidth: 2.4 });
  }
}

const FOOT = (() => { const a = []; for (let x = -60; x < 900; x += 34) a.push([x, a.length % 2 ? G - 5 : G - 11]); return a; })();
function drawFootprints(t, scale) {
  for (const [x, y] of FOOT) {
    ctx.fillStyle = 'rgba(42,34,29,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, 4 * scale, 2.6 * scale, 0, 0, TAU); ctx.fill();
  }
}
function drawMagnifier(t, s) {
  const tip = armTip(s, 1);
  const p = s.toolP;
  if (p <= 0.01) return;
  const L = 60 * p, Rr = 55 * p;
  const cx = tip.x + tip.dx * (L + Rr), cy = tip.y + tip.dy * (L + Rr);
  R('line', [tip.x - tip.dx * 6, tip.y - tip.dy * 6, tip.x + tip.dx * L, tip.y + tip.dy * L], { k: 200, stroke: '#7A5A3C', strokeWidth: 12, roughness: 0.5 });
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.clip();
  ctx.fillStyle = '#F3F1EA'; ctx.fillRect(cx - Rr, cy - Rr, Rr * 2, Rr * 2);
  ctx.translate(cx, cy); ctx.scale(2, 2); ctx.translate(-cx, -cy);
  ctx.strokeStyle = 'rgba(42,34,29,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 200, G); ctx.lineTo(cx + 200, G); ctx.stroke();
  drawFootprints(t, 1);
  ctx.restore();
  R('circle', [cx, cy, Rr * 2], { k: 201, fill: 'rgba(170,210,230,0.22)', fillStyle: 'solid', stroke: INK, strokeWidth: 7, roughness: 0.6 });
  R('curve', [[[cx - Rr * 0.6, cy - Rr * 0.3], [cx - Rr * 0.45, cy - Rr * 0.6], [cx - Rr * 0.15, cy - Rr * 0.72]]], { k: 202, stroke: 'rgba(255,255,255,0.8)', strokeWidth: 4, roughness: 0.3 });
}

function hammerGeom(s) {
  const tip = armTip(s, 1);
  const L = 300 * s.toolP;
  const hx = tip.x + tip.dx * L, hy = tip.y + tip.dy * L;
  return { tip, hx, hy, px: -tip.dy, py: tip.dx };
}
function drawHammer(t, s) {
  if (s.toolP <= 0.01) return;
  const { tip, hx, hy, px, py } = hammerGeom(s);
  R('line', [tip.x - tip.dx * 6, tip.y - tip.dy * 6, hx, hy], { k: 210, stroke: '#9A6B42', strokeWidth: 13, roughness: 0.4 });
  R('line', [tip.x - tip.dx * 6, tip.y - tip.dy * 6, hx, hy], { k: 211, stroke: INK, strokeWidth: 2, roughness: 0.6 });
  const hl = 46 * s.toolP, hw = 50 * s.toolP;
  const c = [[hx - px * hl - tip.dx * hw / 2, hy - py * hl - tip.dy * hw / 2], [hx + px * hl - tip.dx * hw / 2, hy + py * hl - tip.dy * hw / 2],
    [hx + px * hl + tip.dx * hw / 2, hy + py * hl + tip.dy * hw / 2], [hx - px * hl + tip.dx * hw / 2, hy - py * hl + tip.dy * hw / 2]];
  R('polygon', [c], { k: 212, fill: '#8E9196', fillStyle: 'solid', strokeWidth: 3.5, roughness: 0.6 });
  R('polygon', [c], { k: 213, fill: 'rgba(42,34,29,0.25)', fillStyle: 'hachure', hachureGap: 6, stroke: 'none' });
}
// where the hammer head lands at the moment of impact
const HIT = (() => {
  const s = { x: FIXX, lift: 0, sx: 1, sy: 1, fold: 0, armR: -0.15, armL: 0, toolP: 1 };
  const g = hammerGeom(s);
  return { x: g.hx, y: g.hy + 46 };
})();

function drawSign(t) {
  if (t < T.sign0 || t > T.signOut + 0.4) return;
  const up = E.outBack(seg(t, T.sign0, T.sign0 + 0.5)) * (1 - E.in(seg(t, T.signOut, T.signOut + 0.4)));
  setFont(700, 52);
  const pre = '(token ', cw = ctx.measureText('M').width;
  const nEq = t >= T.hit2 ? 3 : t >= T.hit1 ? 2 : 1;
  const tail = ' null)';
  const full = pre.length + nEq + tail.length;
  // keep the "=" under the hammer: the text is anchored at the first "="
  const eqX = HIT.x - cw / 2;
  const textL = eqX - cw * pre.length;
  const textW = cw * full;
  const bx = textL - 30, bw = textW + 60, ty = HIT.y + 4, bh = 92, by = ty - bh / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 2000 + G); ctx.clip();
  ctx.translate(0, (1 - up) * 330);
  R('line', [bx + 40, by + bh, bx + 40, G + 2], { k: 220, strokeWidth: 8, stroke: '#9A6B42', roughness: 0.5 });
  R('line', [bx + bw - 40, by + bh, bx + bw - 40, G + 2], { k: 221, strokeWidth: 8, stroke: '#9A6B42', roughness: 0.5 });
  R('rectangle', [bx, by, bw, bh], { k: 222, fill: SHEET, fillStyle: 'solid', strokeWidth: 4, roughness: 0.9 });
  const fixed = t >= T.fixed;
  if (fixed) R('rectangle', [bx, by, bw, bh], { k: 223, fill: 'rgba(79,166,94,0.22)', fillStyle: 'hachure', hachureGap: 7, stroke: 'none' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  setFont(700, 52);
  ctx.fillStyle = INK; ctx.fillText(pre, textL, ty + 2);
  const eqCol = fixed ? GREEN : RED;
  ctx.fillStyle = eqCol;
  for (let i = 0; i < nEq; i++) {
    const pop = i === 0 ? 0 : E.outBack(seg(t, i === 1 ? T.hit1 : T.hit2, (i === 1 ? T.hit1 : T.hit2) + 0.2));
    ctx.save(); ctx.translate(eqX + i * cw + cw / 2, ty + 2); ctx.scale(i === 0 ? 1 : pop, i === 0 ? 1 : pop);
    ctx.textAlign = 'center'; ctx.fillText('=', 0, 0); ctx.restore();
  }
  ctx.fillStyle = INK; ctx.textAlign = 'left';
  ctx.fillText(tail, eqX + nEq * cw, ty + 2);
  if (!fixed && t > T.sign0 + 0.6) {
    const w = 0.6 + 0.4 * Math.abs(Math.sin(t * 6));
    R('ellipse', [eqX + cw / 2, ty, cw * 1.8 * w + 10, 70], { k: 224, stroke: RED, strokeWidth: 3, roughness: 1.6 });
  }
  if (fixed) {
    const p = E.outBack(seg(t, T.fixed, T.fixed + 0.35));
    R('ellipse', [eqX + cw * 1.5, ty, (cw * 3 + 40) * p, 74 * p], { k: 225, stroke: GREEN, strokeWidth: 4, roughness: 1.2 });
    ctx.save(); ctx.translate(bx + bw - 6, by + 4); ctx.scale(p, p);
    R('circle', [0, 0, 44], { k: 226, fill: GREEN, fillStyle: 'solid', strokeWidth: 3 });
    R('linearPath', [[[-10, 0], [-3, 8], [11, -9]]], { k: 227, stroke: '#FFFFFF', strokeWidth: 5, roughness: 0.3 });
    ctx.restore();
  }
  ctx.restore();
}

function drawSparks(t) {
  for (const th of [T.hit1, T.hit2]) {
    const u = seg(t, th, th + 0.4);
    if (u <= 0 || u >= 1) continue;
    for (let i = 0; i < 8; i++) {
      const a = -PI + (i / 7) * PI, d0 = 30 + 60 * E.out(u), d1 = d0 + 28 * (1 - u);
      R('line', [HIT.x + Math.cos(a) * d0, HIT.y - 40 + Math.sin(a) * d0, HIT.x + Math.cos(a) * d1, HIT.y - 40 + Math.sin(a) * d1],
        { k: 230 + i, stroke: i % 2 ? '#E9A23B' : ORANGE, strokeWidth: 4, roughness: 0.4 });
    }
  }
}

function drawJar(t) {
  if (t < T.jar) return;
  const y = lerp(-900, 0, E.in(seg(t, T.jar, T.jarLand)));
  const sq = 0.08 * pulse(t, T.jarLand, 0.2);
  ctx.save();
  ctx.translate(JARX, G + y); ctx.scale(1 + sq, 1 - sq);
  const glass = rrPath(-75, -160, 150, 160, 18);
  R('path', [glass], { k: 240, fill: 'rgba(178,212,228,0.30)', fillStyle: 'solid', strokeWidth: 3.5, roughness: 0.8 });
  R('path', [rrPath(-52, -182, 104, 24, 6)], { k: 241, fill: 'rgba(178,212,228,0.30)', fillStyle: 'solid', strokeWidth: 3, roughness: 0.7 });
  R('path', [rrPath(-60, -204, 120, 26, 6)], { k: 242, fill: '#9AA0A6', fillStyle: 'solid', strokeWidth: 3.5, roughness: 0.7 });
  R('rectangle', [-60, -204, 120, 26], { k: 243, fill: 'rgba(42,34,29,0.25)', fillStyle: 'hachure', hachureGap: 6, stroke: 'none' });
  R('line', [-52, -140, -52, -30], { k: 244, stroke: 'rgba(255,255,255,0.75)', strokeWidth: 5, roughness: 0.4 });
  R('line', [-40, -150, -40, -110], { k: 245, stroke: 'rgba(255,255,255,0.6)', strokeWidth: 3, roughness: 0.4 });
  ctx.restore();
  const tp = E.outBack(seg(t, T.tag, T.tag + 0.4));
  if (tp > 0) {
    const sw = Math.sin(t * 2.2) * 0.05;
    ctx.save();
    ctx.translate(JARX - 60, G - 178); ctx.rotate(-0.12 + sw); ctx.scale(tp, tp);
    R('line', [0, 0, -18, 26], { k: 246, strokeWidth: 2, roughness: 0.5 });
    R('rectangle', [-160, 24, 150, 44], { k: 247, fill: SHEET, fillStyle: 'solid', strokeWidth: 2.5 });
    setFont(500, 22); ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('auth.ts:12', -148, 47);
    ctx.restore();
  }
}

// test lights
function wireY(x) { return -410 + 110 * (1 - Math.pow((x - 50) / 600, 2)); }
const bulbX = i => -470 + i * (1040 / 11);
function bulbColor(i, t) {
  const on = T.bulb0 + i * T.bulbStep;
  if (t < on) return null;
  if (i === T.red && t < T.green) {
    if (t > T.flick && Math.floor(t * 12) % 2 === 0) return null;
    return RED;
  }
  return GREEN;
}
function drawLights(t) {
  if (t < T.lights0 || t > T.lightsOut + 0.5) return;
  const drop = E.outBack(seg(t, T.lights0, T.lights0 + 0.6)) * (1 - E.in(seg(t, T.lightsOut, T.lightsOut + 0.5)));
  ctx.save();
  ctx.translate(0, (1 - drop) * -1100);
  const sway = Math.sin(t * 2) * 0.012 * (1 + 3 * pulse(t, 44.0, 1.0));
  ctx.rotate(sway);
  const pts = [];
  for (let x = -550; x <= 650; x += 40) pts.push([x, wireY(x)]);
  R('curve', [pts], { k: 250, strokeWidth: 2.6, roughness: 0.8 });
  for (let i = 0; i < 12; i++) {
    const x = bulbX(i), y = wireY(x);
    const col = bulbColor(i, t);
    const pop = col ? E.outBack(seg(t, T.bulb0 + i * T.bulbStep, T.bulb0 + i * T.bulbStep + 0.2)) : 1;
    if (col) {
      const g = ctx.createRadialGradient(x, y + 46, 0, x, y + 46, 70);
      g.addColorStop(0, col === RED ? 'rgba(222,90,67,0.35)' : 'rgba(79,166,94,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 70, y - 24, 140, 140);
    }
    R('rectangle', [x - 9, y, 18, 20], { k: 260 + i, fill: '#5A524C', fillStyle: 'solid', strokeWidth: 2 });
    R('circle', [x, y + 44, 46 * (col ? 0.92 + 0.08 * pop : 1)], { k: 280 + i, fill: col || '#DCD6C9', fillStyle: 'solid', strokeWidth: 2.6, roughness: 0.8 });
    R('curve', [[[x - 9, y + 34], [x - 12, y + 44], [x - 8, y + 53]]], { k: 300 + i, stroke: 'rgba(255,255,255,0.7)', strokeWidth: 2.5, roughness: 0.3 });
  }
  ctx.restore();
}
function drawPodium(t) {
  if (t < T.podium0 || t > 47.6) return;
  const up = E.outBack(seg(t, T.podium0, T.podium0 + 0.45)) * (1 - E.in(seg(t, 47.2, 47.6)));
  const press = pulse(t, T.press - 0.05, 0.25);
  ctx.save();
  ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 2000 + G); ctx.clip();
  ctx.translate(0, (1 - up) * 200);
  R('rectangle', [PODX - 40, G - 132, 80, 132], { k: 320, fill: '#9AA0A6', fillStyle: 'solid', strokeWidth: 3.5, roughness: 0.8 });
  R('rectangle', [PODX - 40, G - 132, 80, 132], { k: 321, fill: 'rgba(42,34,29,0.2)', fillStyle: 'hachure', hachureGap: 8, stroke: 'none' });
  const dh = 30 * (1 - 0.6 * press);
  R('path', [`M${PODX - 34},${G - 132} Q${PODX - 34},${G - 132 - dh} ${PODX},${G - 132 - dh} Q${PODX + 34},${G - 132 - dh} ${PODX + 34},${G - 132} Z`],
    { k: 322, fill: RED, fillStyle: 'solid', strokeWidth: 3.5, roughness: 0.6 });
  ctx.restore();
}

// paper plane
const PLANE_PTS = [[290, -10], [420, -160], [330, -330], [140, -290], [150, -150], [330, -150], [640, -330], [1250, -620]];
function catmull(pts, u) {
  const n = pts.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * k + (2 * a - 5 * b + 4 * c2 - d) * k * k + (-a + 3 * b - 3 * c2 + d) * k * k * k);
  return { x: c(p0[0], p1[0], p2[0], p3[0]), y: c(p0[1], p1[1], p2[1], p3[1]) };
}
function planeU(t) { return E.sine(seg(t, T.throw, T.fly1)); }
function planePos(t) { if (t < T.throw || t > T.fly1) return null; return catmull(PLANE_PTS, planeU(t)); }
function planeShape(fold) {
  const sheet = [[-34, -46], [34, -46], [34, 46], [-34, 46], [0, 46], [-34, 46]];
  const plane = [[60, 0], [-40, -34], [-22, 0], [-40, 34], [-22, 0], [-50, 8]];
  return sheet.map((p, i) => [lerp(p[0], plane[i][0], fold), lerp(p[1], plane[i][1], fold)]);
}
function drawPlane(t, s) {
  if (t >= T.sheet && t < T.throw && s.tool === 'sheet') {
    const tip = armTip(s, 1);
    const f = E.inOut(seg(t, T.fold0, T.fold1));
    ctx.save(); ctx.translate(tip.x + 20, tip.y - 40); ctx.scale(s.toolP, s.toolP); ctx.rotate(-0.3 * f);
    const sh = planeShape(f);
    R('polygon', [sh.slice(0, 4)], { k: 340, fill: SHEET, fillStyle: 'solid', strokeWidth: 2.6, roughness: 0.8 });
    if (f > 0.3) R('linearPath', [[sh[2], sh[4], sh[0]]], { k: 341, strokeWidth: 2, roughness: 0.5 });
    ctx.restore();
  }
  const pp = planePos(t);
  if (!pp) return;
  const u = planeU(t), a = catmull(PLANE_PTS, Math.min(1, u + 0.01));
  const ang = Math.atan2(a.y - pp.y, a.x - pp.x);
  const trail = [];
  for (let k = 0; k <= 14; k++) { const uu = u - k * 0.02; if (uu < 0) break; const q = catmull(PLANE_PTS, uu); trail.push([q.x, q.y]); }
  if (trail.length > 2) {
    ctx.save(); ctx.setLineDash([10, 12]);
    ctx.strokeStyle = 'rgba(42,34,29,0.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); trail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.translate(pp.x, pp.y); ctx.rotate(ang);
  const sh = planeShape(1);
  R('polygon', [sh.slice(0, 4)], { k: 342, fill: SHEET, fillStyle: 'solid', strokeWidth: 2.6, roughness: 0.8 });
  R('linearPath', [[sh[2], sh[4], sh[0]]], { k: 343, strokeWidth: 2, roughness: 0.5 });
  ctx.restore();
}

// ---------- small effects ----------
function drawBang(t, s) {
  const u = seg(t, T.bang, T.bang + 0.15), out = seg(t, T.chase0 - 0.1, T.chase0 + 0.1);
  if (u <= 0 || out >= 1) return;
  const x = s.x - 30, y = G - LH - BH - 70 - s.lift;
  ctx.save(); ctx.translate(x, y); ctx.scale(E.outBack(u) * (1 - out), E.outBack(u) * (1 - out));
  R('line', [0, -70, 0, -10], { k: 350, strokeWidth: 10, roughness: 0.5 });
  R('circle', [0, 14, 14], { k: 351, fill: INK, fillStyle: 'solid', strokeWidth: 3 });
  ctx.restore();
}
function drawDust(t, t0, x, dir, k) {
  const u = seg(t, t0, t0 + 0.7);
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 4; i++) {
    const d = (20 + i * 28) * E.out(u);
    R('circle', [x + dir * d, G - 12 - i * 6 - 20 * u, (22 - i * 3) * (1 - u) + 4], { k: k + i, fill: SHEET, fillStyle: 'solid', strokeWidth: 2, roughness: 1.3 });
  }
}
function drawSpeedLines(t, s) {
  const run = (t > T.chase0 + 0.2 && t < 23.6) || (t > T.wrap + 0.3 && t < T.skid);
  if (!run) return;
  for (let i = 0; i < 4; i++) {
    const y = G - 80 - i * 50, x0 = s.x - s.face * (230 + i * 15);
    R('line', [x0, y, x0 - s.face * (90 + i * 20), y], { k: 360 + i, stroke: 'rgba(42,34,29,0.5)', strokeWidth: 3, roughness: 0.6 });
  }
}
function drawSweat(t, s) {
  const u = seg(t, T.wipe + 0.3, T.wipe + 1.0);
  if (u <= 0 || u >= 1) return;
  const x = s.x - 150 - 120 * E.out(u), y = G - LH - BH - 20 - 140 * Math.sin(PI * u * 0.9) + 200 * u * u;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
  R('path', ['M0,-18 Q12,0 0,10 Q-12,0 0,-18 Z'], { k: 370, fill: '#9CCAE6', fillStyle: 'solid', strokeWidth: 2.4 });
  ctx.restore();
}
function drawConfetti(t) {
  const dt = t - T.green;
  if (dt < 0 || dt > 2.6) return;
  const r = rng(51);
  const cols = [ORANGE, GREEN, '#E9C46A', '#7FA7D6', CREAM];
  for (let i = 0; i < 70; i++) {
    const x0 = (r() - 0.5) * 1500, vy = 160 + r() * 260, sw = r() * TAU, w = 10 + r() * 8, h = 6 + r() * 6;
    const x = x0 + Math.sin(dt * 3 + sw) * 30, y = -560 + dt * vy + r() * -200;
    ctx.save(); ctx.globalAlpha = 1 - seg(dt, 2.0, 2.6);
    ctx.translate(x, y); ctx.rotate(dt * 4 + sw); ctx.scale(Math.cos(dt * 7 + i), 1);
    ctx.fillStyle = cols[i % cols.length]; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
function drawZ(t, x, y, amt, size, k) {
  if (amt <= 0) return;
  setFont(700, size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.55 + i / 3) % 1;
    ctx.fillStyle = `rgba(42,34,29,${Math.sin(PI * ph) * amt * 0.8})`;
    ctx.fillText('z', x + ph * 50 + Math.sin(ph * 5) * 8, y - ph * 90);
  }
}

// ---------- HUD: checklist and tool label ----------
function drawChecklist(t) {
  const a = seg(t, T.list0, T.list0 + 0.6) * (1 - seg(t, 55.3, 55.9));
  if (a <= 0) return;
  const L = V ? { x: -VW / 2 + 80, y: -VH / 2 + 190, fs: 34, lh: 50 } : { x: -VW / 2 + 92, y: -VH / 2 + 96, fs: 27, lh: 40 };
  ctx.save(); ctx.globalAlpha = a;
  TASKS.forEach(([label, a0, a1], i) => {
    const y = L.y + i * L.lh;
    const st = t < a0 ? 0 : t < a1 ? 1 : 2;
    const box = L.fs * 0.72;
    setFont(st === 1 ? 700 : 500, L.fs);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    if (st === 1) {
      const p = E.outBack(seg(t, a0, a0 + 0.3));
      ctx.save(); ctx.translate(L.x - 12, y); ctx.scale(1, p);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(0, -L.fs * 0.78, box + tw + 42, L.fs * 1.56, 8); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(L.x + box / 2, y, box * 0.42, 0, TAU); ctx.stroke();
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(L.x + box / 2, y, box * 0.2 * (0.7 + 0.3 * Math.sin(t * 6)), 0, TAU); ctx.fill();
      ctx.fillStyle = CREAM;
    } else if (st === 2) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.strokeRect(L.x, y - box / 2, box, box);
      const p = seg(t, a1, a1 + 0.25);
      R('linearPath', [[[L.x + box * 0.18, y - box * 0.02], [L.x + box * 0.42, y + box * 0.3], [L.x + box * (0.42 + 0.5 * p), y + box * (0.3 - 0.8 * p)]]], { k: 400 + i, strokeWidth: 3, roughness: 0.4 });
      ctx.fillStyle = '#3B342E';
    } else {
      ctx.strokeStyle = 'rgba(42,34,29,0.28)'; ctx.lineWidth = 2;
      ctx.strokeRect(L.x, y - box / 2, box, box);
      ctx.fillStyle = 'rgba(42,34,29,0.3)';
    }
    ctx.fillText(label, L.x + box + 16, y + 1);
  });
  ctx.restore();
}

const LABELS = [
  [T.prompt0, T.read0 - 0.1, 'prompt'],
  [T.read0 + 0.2, T.find0 - 0.15, 'read'],
  [T.find0 + 0.1, T.find1 + 0.3, 'Grep  "token"'],
  [T.fix0 + 0.1, T.fix1 + 0.3, 'Edit  auth.ts'],
  [T.test0 + 0.1, T.test1 + 0.3, 'Bash  npm test'],
  [T.ship0 + 0.1, T.ship1, 'gh pr create'],
  [T.ship1 + 0.1, 55.3, 'done'],
];
function labelText(kind, t) {
  if (kind === 'prompt') {
    const full = 'login is broken. fix it.';
    const n = Math.floor(clamp((t - T.prompt0 - 0.2) / 1.1) * full.length);
    return { pre: '>', text: full.slice(0, n) + (t < T.read0 - 0.5 && Math.floor(t * 3) % 2 ? '_' : ''), star: false };
  }
  if (kind === 'read') { const n = Math.round(landed(t) * 42 / PAPERS.length); return { pre: '✦', text: `Read  ${n} file${n === 1 ? '' : 's'}`, star: true }; }
  if (kind === 'done') return { pre: '✦', text: 'done', star: true, check: true };
  return { pre: '✦', text: kind, star: true };
}
function drawLabel(t) {
  for (const [a, b, kind] of LABELS) {
    if (t < a || t > b) continue;
    const pin = E.outBack(seg(t, a, a + 0.3)), out = seg(t, b - 0.2, b);
    const L = V ? { x: -VW / 2 + 80, y: VH / 2 - 560, fs: 40 } : { x: -VW / 2 + 92, y: VH / 2 - 112, fs: 36 };
    const lt = labelText(kind, t);
    setFont(500, L.fs);
    const tw = ctx.measureText(lt.text || ' ').width;
    const h = L.fs * 1.75, w = tw + L.fs * 2.2;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(L.x, L.y); ctx.scale(pin, pin);
    ctx.fillStyle = 'rgba(42,34,29,0.18)'; ctx.beginPath(); ctx.roundRect(5, -h / 2 + 6, w, h, 10); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(0, -h / 2, w, h, 10); ctx.fill();
    if (lt.star) { ctx.fillStyle = ORANGE; star4(L.fs * 0.75, 0, L.fs * 0.36); ctx.fill(); }
    else { ctx.fillStyle = ORANGE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lt.pre, L.fs * 0.75, 2); }
    ctx.fillStyle = CREAM; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lt.text, L.fs * 1.4, 2);
    ctx.restore();
  }
}
function drawTitle(t) {
  const u = E.out(seg(t, T.title0, T.title0 + 0.8));
  if (u <= 0) return;
  const y = V ? -VH / 2 + 430 : -300;
  ctx.save();
  ctx.globalAlpha = u;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  setFont(700, V ? 92 : 84); ctx.fillStyle = INK;
  ctx.fillText('Claude Code', 0, y + (1 - u) * 16);
  const u2 = E.out(seg(t, T.title0 + 0.5, T.title0 + 1.2));
  ctx.globalAlpha = u2;
  setFont(500, V ? 38 : 32);
  ctx.fillStyle = ORANGE; ctx.fillText('> claude', 0, y + (V ? 82 : 72));
  ctx.restore();
}

// ---------- frame ----------
function frame(t) {
  BOIL = Math.floor(t * 8) % 4;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(paperCv, 0, 0);
  stage();
  const lineU = E.inOut(seg(t, T.line0, T.line1));
  if (lineU > 0) {
    const x0 = V ? -900 : -830;
    R('line', [x0, G, lerp(x0, -x0, lineU), G], { k: 3, stroke: 'rgba(42,34,29,0.55)', strokeWidth: 2.2, roughness: 0.6, bowing: 0.3 });
  }
  drawLights(t);
  drawPodium(t);
  drawSign(t);
  drawStack(t);
  drawPuff(t, T.poof, -430, G - 130, 7, 90, 130);
  const s = blockState(t);
  const b = bugState(t);
  if (t >= T.sneak0 && t < T.chase0) drawFootprints(t, 1);
  drawSpeedLines(t, s);
  drawBlock(t, s);
  if (s.tool === 'mag') drawMagnifier(t, s);
  if (s.tool === 'hammer') drawHammer(t, s);
  drawPlane(t, s);
  if (b.vis) drawBug(t, b);
  drawJar(t);
  drawDust(t, T.chase0 + 0.15, 300, 1, 380);
  drawDust(t, T.skid, -110, -1, 390);
  drawDust(t, T.jarLand, JARX, 1, 400);
  drawDust(t, T.jarLand, JARX, -1, 410);
  drawSparks(t);
  drawSweat(t, s);
  drawBang(t, s);
  drawPapers(t);
  drawCloud(t);
  drawConfetti(t);
  drawZ(t, 120, G - 190, seg(t, 55.9, 56.5), 44, 0);
  drawZ(t + 0.4, JARX + 40, G - 120, seg(t, 55.6, 56.2), 26, 0);
  overlay();
  if (IS_THUMB) return;
  drawChecklist(t);
  drawLabel(t);
  drawTitle(t);
  const fade = Math.max(1 - seg(t, 0, 0.25), seg(t, T.fade0, DUR));
  if (fade > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = fade;
    ctx.drawImage(paperCv, 0, 0);
    ctx.globalAlpha = 1;
  }
}

// ---------- thumbnail ----------
function drawThumb() {
  IS_THUMB = true;
  frame(22.3);
  IS_THUMB = false;
  overlay();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  setFont(700, 150); ctx.fillStyle = INK;
  ctx.fillText('BUG HUNT', -VW / 2 + 90, -250);
  R('line', [-VW / 2 + 96, -220, -VW / 2 + 820, -214], { k: 900, stroke: ORANGE, strokeWidth: 14, roughness: 1.2 });
  setFont(500, 52); ctx.fillStyle = ORANGE;
  ctx.fillText('> claude', -VW / 2 + 96, -130);
}

// ---------- audio cues ----------
function cues() {
  const c = [];
  const add = (t, type, extra) => c.push(Object.assign({ t: +t.toFixed(4), type }, extra || {}));
  add(T.line0, 'pencil', { dur: 1.1 });
  for (let t = 0.45; t < 1.2; t += 0.09) add(t, 'skitter');
  add(1.32, 'peep');
  for (let t = 1.8; t < 2.45; t += 0.08) add(t, 'skitter');
  for (let i = 0; i < 14; i++) {
    const ph = (i + 0.5) * PI;
    const x = (ph * 48) - 1250;
    const u = (x + 1250) / 1250;
    const tt = T.walk0 + (T.walk1 - T.walk0) * (1 - Math.cbrt(1 - clamp(u)));
    if (tt < T.walk1) add(tt, 'step');
  }
  add(T.walk1, 'land');
  const full = 'login is broken. fix it.';
  for (let i = 0; i < full.length; i++) add(T.prompt0 + 0.2 + (i / full.length) * 1.1, 'key');
  add(T.read0, 'task');
  PAPERS.forEach(p => { add(p.t0, 'paper'); add(p.t1, 'thud'); });
  add(T.poof, 'poof');
  add(T.cloud0, 'idea');
  add(T.read1, 'check');
  add(T.find0, 'task');
  add(T.mag0, 'pop');
  for (let i = 0; i < T.sneakSteps; i++) add(T.sneak0 + i * 0.625, 'tiptoe', { i });
  add(T.turn, 'turn');
  add(T.bang, 'bang');
  add(T.chase0, 'run');
  add(T.wrap + 0.3, 'run');
  add(T.skid - 0.15, 'skid');
  add(T.jar + 0.05, 'fall');
  add(T.jarLand, 'jar');
  add(T.tag, 'pop');
  add(T.find1, 'check');
  add(T.fix0, 'task');
  add(T.sign0, 'rise');
  add(T.hammer0, 'pop');
  add(T.hit1, 'clank'); add(T.hit2, 'clank', { up: 1 });
  add(T.fixed, 'fixed');
  add(T.wipe + 0.3, 'phew');
  add(T.fix1, 'check');
  add(T.signOut, 'sink');
  add(T.test0, 'task');
  add(T.lights0, 'jingle');
  add(T.podium0, 'rise');
  add(T.press, 'button');
  for (let i = 0; i < 12; i++) add(T.bulb0 + i * T.bulbStep, i === T.red ? 'buzz' : 'bulb', { i });
  add(T.flick, 'flicker');
  add(T.green, 'bulb', { i: 12 });
  add(T.green, 'party');
  add(T.test1, 'check');
  add(T.ship0, 'task');
  add(T.sheet, 'pop');
  add(T.fold0, 'fold'); add(T.fold0 + 0.4, 'fold');
  add(T.throw - 0.05, 'throw');
  add(T.fly1 - 0.3, 'ding');
  add(T.ship1, 'check');
  add(53.6, 'boing');
  add(55.6, 'sleep');
  add(T.title0, 'title');
  return c.sort((a, b) => a.t - b.t);
}

// ---------- boot ----------
window.renderAt = t => frame(t);
window.renderThumb = () => drawThumb();
window.getCues = cues;
window.DUR = DUR;
(async () => {
  await Promise.all(['400 20px Plex', '500 20px Plex', '700 20px Plex'].map(f => document.fonts.load(f, 'Aa')));
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
