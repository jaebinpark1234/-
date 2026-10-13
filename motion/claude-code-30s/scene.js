'use strict';
// 30초 모션그래픽 "새벽 2시의 동료" — 결정론적 타임라인 렌더러.
// renderAt(t)는 같은 t에 항상 같은 프레임을 그린다. 렌더러(render.js)가 프레임 단위로 호출한다.

const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 1920), H = +(P.get('h') || 1080);
const V = H > W; // 세로(쇼츠) 레이아웃
const MODE = P.get('mode') || 'preview';
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const mainCtx = cv.getContext('2d');
let ctx = mainCtx;
const offCv = document.createElement('canvas');
offCv.width = W; offCv.height = H;
const offCtx = offCv.getContext('2d');

// 가상 좌표계: 화면 중앙이 (0,0), 짧은 변이 1080 단위.
const BS = Math.min(W, H) / 1080;
const VW = W / BS, VH = H / BS;
const PI = Math.PI, TAU = PI * 2;
const DUR = 30;
const SANS = "'Pretendard', sans-serif";
const MONO = "'JBM', 'Pretendard', monospace";

const C = {
  orange: '#D97757', orangeD: '#A9502F', cream: '#F4EFE6', ink: '#1F1E1D',
  red: '#FF5F57', green: '#4ADE80',
  termBg: '#101119', termFg: '#D7DAE6', termDim: '#6B7089',
  skin: '#F1C9A5', skinD: '#D9A27E', hair: '#2A1E1B',
  hoodie: '#4F5FD8', hoodieD: '#3A47AD', pants: '#262A44',
};

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: u => 1 - Math.pow(1 - u, 3),
  in: u => u * u * u,
  outBack: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  inOutSine: u => -(Math.cos(PI * u) - 1) / 2,
  inOutQuad: u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
};
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, (e || E.inOut)((t - t0) / (t1 - t0)));
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
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}
const pulse = (t, t0, dur) => Math.sin(PI * seg(t, t0, t0 + dur));
function shakeAt(t, t0, amp, dur) {
  if (t < t0 || t > t0 + dur) return { x: 0, y: 0 };
  const k = 1 - (t - t0) / dur;
  return { x: Math.sin((t - t0) * 83) * amp * k * k, y: Math.cos((t - t0) * 71) * amp * k * k };
}
function decaySin(t, t0, amp) {
  if (t < t0) return 0;
  const k = t - t0;
  return amp * Math.exp(-k * 5) * Math.sin(k * 22);
}
function blinkAt(t, list) {
  let b = 0;
  for (const bt of list) b = Math.max(b, pulse(t, bt, 0.16));
  return b;
}
const rotP = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

// ---------- drawing primitives ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
function setFont(wt, size, fam) { ctx.font = `${wt} ${size}px ${fam || SANS}`; }
function glow(x, y, r, col, a) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(0.45, hexA(col, a * 0.35));
  g.addColorStop(1, hexA(col, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}
function star4(x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + i * PI / 4, d = i % 2 ? r * 0.3 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}
function iconCheck(x, y, s, col, lw, prog) {
  prog = prog == null ? 1 : prog;
  if (prog <= 0) return;
  const p = [[x - s * 0.45, y + s * 0.02], [x - s * 0.12, y + s * 0.32], [x + s * 0.48, y - s * 0.34]];
  const l1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
  const l2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  const d = prog * (l1 + l2);
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  if (d <= l1) ctx.lineTo(lerp(p[0][0], p[1][0], d / l1), lerp(p[0][1], p[1][1], d / l1));
  else {
    ctx.lineTo(p[1][0], p[1][1]);
    const u = (d - l1) / l2;
    ctx.lineTo(lerp(p[1][0], p[2][0], u), lerp(p[1][1], p[2][1], u));
  }
  ctx.stroke();
  ctx.restore();
}
function iconCross(x, y, s, col, lw) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y - s / 2); ctx.lineTo(x + s / 2, y + s / 2);
  ctx.moveTo(x + s / 2, y - s / 2); ctx.lineTo(x - s / 2, y + s / 2);
  ctx.stroke();
  ctx.restore();
}
function iconAst(x, y, r, col, rot, lw) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = lw || r * 0.32; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = rot + i * PI / 4;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- camera ----------
function applyCam(c) {
  const s = BS * c.z;
  ctx.setTransform(s, 0, 0, s, W / 2 - c.x * s, H / 2 - c.y * s);
}
function overlay() { ctx.setTransform(BS, 0, 0, BS, W / 2, H / 2); }
const toOverlay = (c, x, y) => ({ x: (x - c.x) * c.z, y: (y - c.y) * c.z });
function camMix(a, b, u) {
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)) };
}

// ---------- timeline ----------
const T = {
  minuteFlip: 0.55,
  zoomIn0: 4.45, zoomIn1: 5.15,
  clear: 5.0, enter1: 6.0, welcome: 6.1, inputBox: 6.4, enter2: 8.1, reply: 8.22,
  pop: 8.85, zoomOut0: 8.72, zoomOut1: 9.35,
  dive0: 11.45, dive1: 11.95,
  zoomScreen0: 11.85, zoomScreen1: 12.5,
  codeFade0: 12.35, codeFade1: 12.7,
  alert: 15.05, diffOpen0: 15.6, diffOpen1: 15.95,
  ring: 16.15, ins1: 16.62, ins2: 16.78, fixed: 16.92,
  diffClose0: 17.55, diffClose1: 17.9,
  run0: 18.05, run1: 19.75, passed: 19.8,
  exit0: 20.3, flash0: 20.55, flash1: 20.8,
  clockFlip: 21.05, pop2: 21.35, wake: 21.55, joy: 22.0,
  hi0: 22.75, hiHit: 23.1, hi1: 23.55, yawn0: 23.6, press: 24.2,
  iris0: 25.45, iris1: 25.95,
  end: 26.0, endIris1: 26.45, tag0: 27.2, cmd0: 27.55, sub0: 27.95, click: 28.6, bell0: 28.72,
  fade0: 29.55,
};
const TODOS = [
  ['코드베이스 읽기', 13.15, 14.7],
  ['실패 원인 찾기', 14.7, 15.6],
  ['auth.ts 고치기', 15.6, 17.3],
  ['테스트 다시 돌리기', 17.6, 19.9],
];
const CAPS = [
  [0.35, 2.1, '새벽 2시.'],
  [2.2, 4.35, '테스트 47개가 깨졌다.'],
  [5.05, 6.5, '남은 방법은 하나.'],
  [15.7, 17.75, '범인은 `=` 하나.'],
  [20.95, 22.2, '7분 뒤.'],
  [23.65, 25.4, '이제 진짜 잔다.'],
];
const BUBBLES = [
  // t0, t1, text, x, y, tailX, tailY
  [9.45, 10.55, '맡겨!', 250, -292, 250, -215],
  [10.15, 11.05, '부탁해…', -300, -305, -250, -200],
  [22.05, 22.75, '됐다!!', -310, -330, -255, -215],
  [24.65, 25.4, '잘 자!', 300, -180, 295, -122],
];

function mkKeys(str, t0, dt, seed) {
  const r = rng(seed);
  return [...str].map((_, i) => t0 + i * dt + (r() - 0.5) * dt * 0.55);
}
const TY1 = { s: 'claude', k: mkKeys('claude', 5.32, 0.085, 7) };
const TY2 = { s: '테스트 좀 고쳐줘. 나 잠깐 잘게', k: mkKeys('테스트 좀 고쳐줘. 나 잠깐 잘게', 6.58, 0.072, 11) };
const TY3 = { s: 'Claude Code', k: mkKeys('Claude Code', 26.5, 0.052, 5) };
function typed(ty, t) {
  let n = 0;
  for (const k of ty.k) if (t >= k) n++;
  return [...ty.s].slice(0, n).join('');
}

// ---------- room geometry ----------
const MON = { x: -130, y: -250, w: 520, h: 326, b: 14 };
const SC = { x: MON.x + MON.w / 2, y: MON.y + MON.h / 2 };
const HIP = { x: -282, y: 205 };
const HOVER = { x: 250, y: -150 };
const CLK = { x: 330, y: -400 };
const WIN = { x: -520, y: -490, w: 250, h: 240 };
const CAM = {
  room: V ? { x: 30, y: -120, z: 1 } : { x: 0, y: -50, z: 1.06 },
  clock: V ? { x: 330, y: -400, z: 2.6 } : { x: 330, y: -400, z: 3.0 },
  clock2: V ? { x: 330, y: -400, z: 2.2 } : { x: 330, y: -400, z: 2.4 },
  mon: V ? { x: 130, y: -87, z: 1.9 } : { x: 130, y: -87, z: 2.6 },
  dive: { x: 130, y: -87, z: 11 },
};
let CAM_OVERRIDE = null;
let IS_THUMB = false;

function roomCam(t) {
  if (CAM_OVERRIDE) return CAM_OVERRIDE;
  const R = CAM.room;
  let c;
  if (t < T.zoomIn0) {
    const p = camMix(CAM.clock, R, E.inOut(seg(t, 0.9, 2.2)));
    const u = E.inOutSine(seg(t, 2.2, T.zoomIn0));
    c = { x: p.x + 30 * u, y: p.y + 10 * u, z: p.z * (1 + 0.06 * u) };
  } else if (t < T.zoomOut0) {
    c = camMix({ x: R.x + 30, y: R.y + 10, z: R.z * 1.06 }, CAM.mon, E.inOut(seg(t, T.zoomIn0, T.zoomIn1)));
  } else if (t < T.zoomScreen0) {
    c = camMix(CAM.mon, R, E.out(seg(t, T.zoomOut0, T.zoomOut1)));
  } else if (t < T.flash1) {
    c = camMix(R, CAM.dive, E.in(seg(t, T.zoomScreen0, T.zoomScreen1)));
  } else {
    const p = camMix(CAM.clock2, R, E.inOut(seg(t, 21.15, 21.6)));
    const u = E.inOutSine(seg(t, 21.6, T.iris1));
    c = { x: p.x + 20 * u, y: p.y - 10 * u, z: p.z * (1 + 0.05 * u) };
  }
  for (const [t0, a, d] of [[T.pop, 7, 0.35], [T.hiHit, 9, 0.35], [T.pop2, 5, 0.3]]) {
    const s = shakeAt(t, t0, a, d);
    c.x += s.x / c.z; c.y += s.y / c.z;
  }
  return c;
}

function glowState(t) {
  if (t < T.clear) return { c: '#FF4B4B', a: 0.3 + 0.06 * Math.sin(t * 5) };
  if (t < 8.3) return { c: '#7C8CFF', a: 0.22 };
  if (t < 12.6) return { c: '#FF9466', a: 0.26 + 0.4 * pulse(t, 8.35, 1.0) };
  return { c: '#3EE07A', a: 0.32 * (1 - seg(t, T.press, T.press + 0.2)) };
}

// ---------- room: environment ----------
function drawWall() {
  let g = ctx.createLinearGradient(0, -1100, 0, 350);
  g.addColorStop(0, '#111427'); g.addColorStop(1, '#1F2342');
  ctx.fillStyle = g; ctx.fillRect(-2400, -1600, 4800, 1950);
  ctx.fillStyle = 'rgba(255,255,255,0.016)';
  for (let x = -2400; x < 2400; x += 90) ctx.fillRect(x, -1600, 40, 1950);
  ctx.fillStyle = '#181B33'; ctx.fillRect(-2400, 334, 4800, 22);
  g = ctx.createLinearGradient(0, 356, 0, 1300);
  g.addColorStop(0, '#1A1C34'); g.addColorStop(1, '#0B0C18');
  ctx.fillStyle = g; ctx.fillRect(-2400, 356, 4800, 1300);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 2;
  for (let y = 410; y < 1300; y += 64) { ctx.beginPath(); ctx.moveTo(-2400, y); ctx.lineTo(2400, y); ctx.stroke(); }
  ctx.fillStyle = '#20233F'; ctx.beginPath(); ctx.ellipse(-80, 470, 560, 48, 0, 0, TAU); ctx.fill();
}

function drawWindow(t) {
  const { x, y, w, h } = WIN;
  ctx.save();
  rr(x, y, w, h, 8); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0A0E2A'); g.addColorStop(1, '#25306A');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const r = rng(42);
  for (let i = 0; i < 22; i++) {
    const sx = x + r() * w, sy = y + r() * h * 0.6, ph = r() * 6, sz = 1 + r() * 1.8;
    ctx.fillStyle = `rgba(255,255,240,${0.3 + 0.5 * Math.abs(Math.sin(t * 1.7 + ph))})`;
    circ(sx, sy, sz); ctx.fill();
  }
  glow(x + 180, y + 62, 90, '#F7E9B8', 0.25);
  ctx.fillStyle = '#F7E9B8'; circ(x + 180, y + 62, 24); ctx.fill();
  ctx.fillStyle = '#10153A'; circ(x + 192, y + 54, 21); ctx.fill();
  const r2 = rng(9);
  let bx = x - 10;
  while (bx < x + w) {
    const bw = 26 + r2() * 36, bh = 50 + r2() * 90;
    ctx.fillStyle = '#0B0D20'; ctx.fillRect(bx, y + h - bh, bw, bh);
    for (let wy = y + h - bh + 10; wy < y + h - 8; wy += 14)
      for (let wx = bx + 5; wx < bx + bw - 6; wx += 10)
        if (r2() < 0.28) { ctx.fillStyle = 'rgba(255,210,120,0.55)'; ctx.fillRect(wx, wy, 4, 6); }
    bx += bw + 4;
  }
  ctx.restore();
  ctx.strokeStyle = '#2C3157'; ctx.lineWidth = 12; rr(x, y, w, h, 8); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.fillStyle = '#2C3157'; rr(x - 18, y + h + 2, w + 36, 14, 4); ctx.fill();
}

function drawClock(t) {
  const { x, y } = CLK;
  ctx.fillStyle = '#0C0E1B'; rr(x - 100, y - 44, 200, 88, 18); ctx.fill();
  ctx.strokeStyle = '#2B2F55'; ctx.lineWidth = 5; ctx.stroke();
  let hh = '02', mm = '00', ft = -1;
  if (t < T.minuteFlip) { hh = '01'; mm = '59'; }
  else if (t < T.clockFlip) ft = T.minuteFlip;
  else { mm = '07'; ft = T.clockFlip; }
  const fu = ft < 0 ? 1 : E.outBack(seg(t, ft, ft + 0.2));
  ctx.save();
  ctx.shadowColor = 'rgba(255,80,70,0.85)'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#FF5A4E';
  setFont(700, 58, MONO); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const dig = (s, dx, flip) => {
    ctx.save(); ctx.translate(x + dx, y + 3);
    if (flip) ctx.scale(1, Math.max(0.05, fu));
    ctx.fillText(s, 0, 0); ctx.restore();
  };
  dig(hh, -50, ft === T.minuteFlip);
  if (Math.floor(t * 2) % 2 === 0) dig(':', 0, false);
  dig(mm, 50, ft >= 0);
  ctx.restore();
}

function drawDecor() {
  // 가로 화면에서만 보이는 소품: 포스터와 책장
  ctx.save(); ctx.translate(-790, -290); ctx.rotate(-0.03);
  ctx.fillStyle = '#2F2E44'; rr(-115, -125, 230, 260, 6); ctx.fill();
  ctx.fillStyle = '#3C3A55'; rr(-100, -110, 200, 230, 4); ctx.fill();
  setFont(900, 30); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C47A5E'; ctx.fillText('IT WORKS', 0, -50);
  ctx.fillStyle = '#9A97B8'; ctx.fillText('ON MY', 0, -8); ctx.fillText('MACHINE', 0, 34);
  setFont(700, 16, MONO); ctx.fillStyle = '#6E6B8A'; ctx.fillText('¯\\_(ツ)_/¯', 0, 84);
  ctx.restore();
  const r = rng(3);
  const sx = 640, sw = 270;
  ctx.fillStyle = '#231F33'; ctx.fillRect(sx, -300, sw, 640);
  const cols = ['#5A4E7A', '#3F5A7A', '#7A4E4E', '#4E7A62', '#7A6A4E', '#4E4E7A'];
  for (let s = 0; s < 4; s++) {
    const sy = -290 + s * 160;
    let bx = sx + 12;
    while (bx < sx + sw - 30) {
      const bw = 18 + r() * 18, bh = 90 + r() * 40;
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.fillRect(bx, sy + 140 - bh, bw, bh);
      bx += bw + 3;
    }
    ctx.fillStyle = '#2E2944'; ctx.fillRect(sx, sy + 140, sw, 14);
  }
}

function drawMonitor(t) {
  const M = MON;
  ctx.fillStyle = '#262A40';
  ctx.beginPath();
  ctx.moveTo(SC.x - 18, M.y + M.h + M.b); ctx.lineTo(SC.x + 18, M.y + M.h + M.b);
  ctx.lineTo(SC.x + 26, 146); ctx.lineTo(SC.x - 26, 146); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2E3350'; rr(SC.x - 95, 138, 190, 10, 5); ctx.fill();
  ctx.fillStyle = '#0A0B12'; rr(M.x - M.b, M.y - M.b, M.w + 2 * M.b, M.h + 2 * M.b + 6, 16); ctx.fill();
  ctx.strokeStyle = '#2B2F48'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save();
  rr(M.x, M.y, M.w, M.h, 6); ctx.clip();
  drawScreen(t, M);
  const g = ctx.createLinearGradient(M.x, M.y, M.x + M.w, M.y + M.h);
  g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(M.x, M.y, M.w, M.h);
  ctx.restore();
  const on = !(t >= T.press && t < T.end);
  ctx.fillStyle = on ? '#4ADE80' : '#3A3F5A';
  circ(M.x + M.w - 6, M.y + M.h + M.b - 1, 4); ctx.fill();
}

function drawChair() {
  ctx.fillStyle = '#262A47'; rr(-430, -90, 50, 312, 22); ctx.fill();
  ctx.fillStyle = '#2E3356'; rr(-412, 214, 240, 28, 12); ctx.fill();
  ctx.fillStyle = '#1B1E34'; ctx.fillRect(-300, 242, 16, 138);
  ctx.fillStyle = '#1E2138'; rr(-392, 378, 200, 12, 6); ctx.fill();
  ctx.fillStyle = '#15172A'; circ(-382, 398, 10); ctx.fill(); circ(-202, 398, 10); ctx.fill();
}

function drawDesk() {
  ctx.fillStyle = '#2A2131'; ctx.fillRect(-222, 170, 20, 268); ctx.fillRect(512, 170, 20, 268);
  ctx.fillStyle = '#5B4650'; rr(-240, 142, 792, 12, 5); ctx.fill();
  ctx.fillStyle = '#3F313C'; rr(-240, 152, 792, 22, 5); ctx.fill();
}

function drawKeyboard() {
  ctx.fillStyle = '#262A43'; rr(-128, 127, 262, 16, 5); ctx.fill();
  ctx.fillStyle = '#3A3F63';
  for (let i = 0; i < 12; i++) { rr(-120 + i * 21, 130, 17, 5, 2); ctx.fill(); }
}

function drawCups(t) {
  const cups = [[300, '#E8E1D3'], [352, '#C9785C'], [408, '#7C8CD8']];
  for (const [x, col] of cups) {
    ctx.fillStyle = col; rr(x - 19, 96, 38, 46, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x + 20, 118, 10, -PI / 2, PI / 2); ctx.stroke();
    ctx.fillStyle = '#2A1A12'; ctx.beginPath(); ctx.ellipse(x, 99, 15, 4, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(220,220,255,0.25)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const off = (t * 0.9 + k * 0.5) % 1;
    ctx.save(); ctx.globalAlpha = Math.sin(PI * off) * 0.8;
    const sx = 408 + (k ? 8 : -6), sy = 88 - off * 40;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx + 8, sy - 10, sx - 8, sy - 20, sx, sy - 30); ctx.stroke();
    ctx.restore();
  }
}

function drawPlant() {
  ctx.fillStyle = '#2F6A55';
  for (const [a, l] of [[-2.1, 52], [-1.75, 64], [-1.4, 58], [-1.05, 50], [-2.45, 40], [-0.75, 38]]) {
    ctx.save(); ctx.translate(484, 104); ctx.rotate(a + PI / 2);
    ctx.beginPath(); ctx.ellipse(0, -l / 2, 11, l / 2, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = '#8A5A44'; rr(462, 100, 44, 42, 6); ctx.fill();
  ctx.fillStyle = '#9C6A52'; rr(458, 98, 52, 10, 4); ctx.fill();
}

// ---------- room: screen contents ----------
function termLine(x, y, parts, fs) {
  let cx = x;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const [s, c, w] of parts) {
    setFont(w || 400, fs, MONO); ctx.fillStyle = c; ctx.fillText(s, cx, y);
    cx += ctx.measureText(s).width;
  }
  return cx;
}
function badge(x, y, label, bg, fs) {
  setFont(700, fs, MONO);
  const w = ctx.measureText(label).width + fs * 0.8;
  ctx.fillStyle = bg; rr(x, y - fs * 0.72, w, fs * 1.44, 3); ctx.fill();
  ctx.fillStyle = '#0B0C12'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + fs * 0.4, y + 1);
  return x + w;
}
function cursorBlock(x, y, fs, t) {
  if (Math.floor(t * 2.4) % 2) return;
  ctx.fillStyle = C.termFg; ctx.fillRect(x + 2, y - fs * 0.62, fs * 0.58, fs * 1.24);
}

function drawScreen(t, M) {
  ctx.fillStyle = C.termBg; ctx.fillRect(M.x, M.y, M.w, M.h);
  if (t < T.clear) screenFail(t, M);
  else if (t < 12.7) screenClaude(t, M);
  else if (t < T.press) screenPass(t, M);
  else screenOff(t, M);
}

function screenFail(t, M) {
  const fs = 15, lh = 22, x0 = M.x + 18;
  let y = M.y + 24;
  const rows = [
    () => termLine(x0, y, [['$ ', '#6EE7A0', 700], ['npm test', C.termFg]], fs),
    null,
    () => { const e = badge(x0, y, 'FAIL', C.red, fs); termLine(e + 10, y, [['src/auth.test.ts', C.termFg]], fs); },
    () => { iconCross(x0 + 24, y, 8, C.red, 2.4); termLine(x0 + 38, y, [['verify() rejects null token', C.termDim]], fs); },
    () => { iconCross(x0 + 24, y, 8, C.red, 2.4); termLine(x0 + 38, y, [['login returns a session', C.termDim]], fs); },
    () => { const e = badge(x0, y, 'FAIL', C.red, fs); termLine(e + 10, y, [['src/user.test.ts', C.termFg]], fs); },
    () => { iconCross(x0 + 24, y, 8, C.red, 2.4); termLine(x0 + 38, y, [['creates a new user', C.termDim]], fs); },
    () => { const e = badge(x0, y, 'FAIL', C.red, fs); termLine(e + 10, y, [['src/api.test.ts', C.termFg]], fs); },
    () => { iconCross(x0 + 24, y, 8, C.red, 2.4); termLine(x0 + 38, y, [['GET /me returns 200', C.termDim]], fs); },
  ];
  rows.forEach((fn, i) => { if (fn && t >= 0.1 + i * 0.11) fn(); y += lh; });
  if (t >= 1.15) {
    const p = E.outBack(seg(t, 1.15, 1.45));
    const by = M.y + M.h - 44;
    ctx.save(); ctx.translate(x0, by); ctx.scale(p, p);
    glow(80, 0, 160, C.red, 0.25 + 0.1 * Math.sin(t * 6));
    iconCross(16, 0, 22, C.red, 6);
    const e = termLine(42, 0, [['47 failed', C.red, 700]], 36);
    termLine(e + 12, 4, [[', 3 passed', C.termDim]], 18);
    ctx.restore();
  }
}

function screenClaude(t, M) {
  const fs = 15, x0 = M.x + 18;
  const y = M.y + 26;
  const end = termLine(x0, y, [['$ ', '#6EE7A0', 700], [typed(TY1, t), C.termFg]], fs);
  if (t < T.enter1) cursorBlock(end, y, fs, t);
  if (t >= T.enter1) {
    const bx = x0, by = y + 22, bw = M.w - 36, bh = 96;
    ctx.save();
    ctx.globalAlpha = seg(t, T.welcome, T.welcome + 0.2);
    ctx.strokeStyle = C.orange; ctx.lineWidth = 1.6; rr(bx, by, bw, bh, 8); ctx.stroke();
    iconAst(bx + 22, by + 24, 7, C.orange, 0, 2.6);
    termLine(bx + 38, by + 24, [['Welcome to ', C.termFg, 700], ['Claude Code', C.orange, 700], ['!', C.termFg, 700]], fs + 1);
    termLine(bx + 18, by + 52, [['/help for help, /status for setup', C.termDim]], fs - 2);
    termLine(bx + 18, by + 74, [['cwd: ~/my-app', C.termDim]], fs - 2);
    ctx.restore();
  }
  if (t >= T.inputBox) {
    const by = y + 22 + 96 + 16;
    if (t < T.enter2) {
      ctx.save();
      ctx.globalAlpha = seg(t, T.inputBox, T.inputBox + 0.15);
      ctx.strokeStyle = '#4A4F70'; ctx.lineWidth = 1.6; rr(x0, by, M.w - 36, 42, 8); ctx.stroke();
      const e = termLine(x0 + 14, by + 21, [['> ', C.termDim, 700], [typed(TY2, t), C.termFg]], fs + 1);
      cursorBlock(e, by + 21, fs + 1, t);
      termLine(x0 + 4, by + 60, [['? for shortcuts', C.termDim]], fs - 3);
      ctx.restore();
    } else {
      termLine(x0, by + 12, [['> ', C.termDim, 700], [TY2.s, C.termDim]], fs);
      if (t >= T.reply) {
        iconAst(x0 + 7, by + 44, 7, C.orange, t * 5, 2.6);
        const dots = '.'.repeat(1 + (Math.floor(t * 4) % 3));
        termLine(x0 + 22, by + 44, [['Clauding' + dots, C.orange, 700]], fs);
      }
    }
  }
  // 스파크가 튀어나오기 직전의 주황 서지
  const surge = seg(t, 8.3, T.pop) * (1 - seg(t, T.pop, T.pop + 0.5));
  if (surge > 0) glow(SC.x, SC.y, 420, '#FF9A66', 0.9 * surge);
  // 화면 속으로 빨려 들어가는 소용돌이
  const sw = seg(t, 11.7, 12.25);
  if (sw > 0) {
    ctx.save();
    ctx.globalAlpha = sw;
    ctx.fillStyle = '#1A0F0C'; ctx.fillRect(M.x, M.y, M.w, M.h);
    ctx.translate(SC.x, SC.y); ctx.rotate(t * 2.2);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.fillStyle = i % 2 ? '#D97757' : '#F2A27F';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 600, -0.13, 0.13); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    glow(SC.x, SC.y, 200, '#FFF1E6', sw);
  }
}

function screenPass(t, M) {
  const fs = 15, x0 = M.x + 18;
  let y = M.y + 26;
  const t0 = T.flash1;
  const rows = [
    () => { iconAst(x0 + 7, y, 7, C.orange, 0, 2.6); termLine(x0 + 22, y, [['auth.ts:12  ', C.termFg, 700], ['=', C.red, 700], ['  →  ', C.termDim], ['===', C.green, 700]], fs); },
    null,
    () => { const e = badge(x0, y, 'PASS', C.green, fs); termLine(e + 10, y, [['src/auth.test.ts', C.termFg]], fs); },
    () => { const e = badge(x0, y, 'PASS', C.green, fs); termLine(e + 10, y, [['src/user.test.ts', C.termFg]], fs); },
    () => { const e = badge(x0, y, 'PASS', C.green, fs); termLine(e + 10, y, [['src/api.test.ts', C.termFg]], fs); },
  ];
  rows.forEach((fn, i) => { if (fn && t >= t0 + i * 0.05) fn(); y += 24; });
  const p = E.outBack(seg(t, t0 + 0.1, t0 + 0.4));
  if (p > 0) {
    const by = M.y + M.h - 70;
    ctx.save(); ctx.translate(x0, by); ctx.scale(p, p);
    glow(110, 0, 200, C.green, 0.3);
    iconCheck(22, 2, 34, C.green, 7);
    const e = termLine(54, 0, [['50 passed', C.green, 700]], 44);
    termLine(e + 12, 6, [['in 7m', C.termDim]], 18);
    ctx.restore();
  }
}

function screenOff(t, M) {
  ctx.fillStyle = '#05060A'; ctx.fillRect(M.x, M.y, M.w, M.h);
  const u = seg(t, T.press, T.press + 0.12);
  const v = seg(t, T.press + 0.12, T.press + 0.24);
  if (u < 1) {
    ctx.save();
    ctx.translate(SC.x, SC.y); ctx.scale(1, Math.max(0.01, 1 - u)); ctx.translate(-SC.x, -SC.y);
    screenPass(t, M);
    ctx.fillStyle = `rgba(255,255,255,${u})`; ctx.fillRect(M.x, M.y, M.w, M.h);
    ctx.restore();
  } else if (v < 1) {
    ctx.fillStyle = '#fff';
    const lw = M.w * (1 - v);
    ctx.fillRect(SC.x - lw / 2, SC.y - 2, lw, 4);
    glow(SC.x, SC.y, 80, '#ffffff', 1 - v);
  }
}

// ---------- characters ----------
const ARM_POSES = {
  type: { f: [-58, 126, 0, 46], n: [36, 130, 0, 50] },
  lift: { f: [-150, 30, -10, 40], n: [-70, 20, 0, 45] },
  rest: { f: [-95, 138, 0, 28], n: [-5, 141, 0, 30] },
  joy: { f: [-395, -262, -60, 10], n: [-140, -300, 70, 10] },
  hifive: { f: [-95, 138, 0, 28], n: [-112, -262, 80, 20] },
  stretch: { f: [-360, -305, -40, 0], n: [-190, -325, 50, 0] },
  relax: { f: [-120, 142, 0, 26], n: [-30, 144, 0, 28] },
};
const ARM_TL = [
  [0, 'type'], [8.85, 'lift', 0.12], [9.45, 'type', 0.3], [10.95, 'rest', 0.5],
  [21.55, 'lift', 0.12], [21.98, 'joy', 0.14], [22.7, 'hifive', 0.25], [23.55, 'stretch', 0.3], [24.2, 'relax', 0.45],
];
function armPose(t) {
  const cp = p => ({ f: p.f.slice(), n: p.n.slice() });
  let res = cp(ARM_POSES[ARM_TL[0][1]]);
  for (let i = 1; i < ARM_TL.length; i++) {
    const [t0, name, dur] = ARM_TL[i];
    if (t < t0) break;
    const u = E.out(seg(t, t0, t0 + dur));
    const tg = ARM_POSES[name];
    res = { f: res.f.map((v, j) => lerp(v, tg.f[j], u)), n: res.n.map((v, j) => lerp(v, tg.n[j], u)) };
  }
  return res;
}
const LEAN = [[0, 0.03], [3.0, 0.03], [3.35, 0.12], [4.3, 0.05], [8.85, 0.05], [9.0, -0.09, E.out], [9.5, 0], [10.95, 0], [11.5, 0.2],
  [T.wake, 0.2], [T.wake + 0.15, -0.1, E.out], [T.joy - 0.05, -0.02], [23.6, -0.03], [24.0, -0.1], [24.35, 0.06], [25.5, 0.12]];
const TILT = [[0, 0.08], [3.0, 0.08], [3.35, 0.2], [4.3, 0.12], [8.85, 0.12], [9.0, -0.14, E.out], [9.5, -0.02], [10.95, 0], [11.5, 0.34],
  [T.wake, 0.34], [T.wake + 0.15, -0.16, E.out], [T.joy - 0.05, -0.05], [23.6, -0.05], [24.0, -0.22], [24.35, 0.1], [25.5, 0.18]];
function devExpr(t) {
  if (t < T.pop) return 'tired';
  if (t < 9.5) return 'shock';
  if (t < 10.95) return 'hopeful';
  if (t < 11.35) return 'drowsy';
  if (t < T.wake) return 'asleep';
  if (t < T.joy) return 'shock';
  if (t < T.yawn0) return 'joy';
  if (t < T.press - 0.05) return 'yawn';
  return 'content';
}
function devPose(t) {
  const d = {};
  d.lean = kf(t, LEAN); d.tilt = kf(t, TILT);
  d.expr = devExpr(t);
  if (d.expr === 'asleep') d.tilt += Math.sin(t * 1.7) * 0.03;
  if (d.expr === 'joy') d.tilt += Math.sin(t * 13) * 0.05;
  d.bounce = 50 * Math.sin(PI * seg(t, T.joy, T.joy + 0.42)) + 18 * Math.sin(PI * seg(t, T.joy + 0.42, T.joy + 0.66));
  d.breath = Math.sin(t * 2.1) * 1.6;
  d.blink = blinkAt(t, [1.75, 3.95, 10.3, 23.0]);
  d.arms = armPose(t);
  d.ahoge = decaySin(t, T.pop, 0.5) + decaySin(t, T.wake, 0.6) + decaySin(t, T.joy, 0.5) + decaySin(t, T.hiHit, 0.4) + Math.sin(t * 2.3) * 0.05;
  d.glassY = -9 * Math.sin(PI * seg(t, T.wake, T.wake + 0.22));
  d.sweat = seg(t, 3.3, 3.6) * (1 - seg(t, 4.1, 4.4));
  d.yawn = d.expr === 'yawn' ? Math.sin(PI * seg(t, T.yawn0, T.press - 0.05)) : 0;
  d.lensC = glowState(t).c;
  return d;
}
const hipPos = d => ({ x: HIP.x, y: HIP.y - d.bounce + d.breath });
function shoulderW(d, rel) { const h = hipPos(d), r = rotP(rel[0], rel[1], d.lean); return { x: h.x + r.x, y: h.y + r.y }; }
function headW(d) {
  const h = hipPos(d), n = rotP(18, -224, d.lean), hc = rotP(0, -84, d.lean + d.tilt);
  return { x: h.x + n.x + hc.x, y: h.y + n.y + hc.y };
}

function drawLegs() {
  ctx.strokeStyle = C.pants; ctx.lineWidth = 56; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(HIP.x + 5, HIP.y - 5); ctx.lineTo(-128, 212); ctx.lineTo(-112, 396); ctx.stroke();
  ctx.fillStyle = '#D9D4CB'; rr(-150, 394, 94, 30, 14); ctx.fill();
  ctx.fillStyle = '#B9B2A6'; ctx.fillRect(-146, 414, 86, 6);
}

function drawArm(d, which) {
  const rel = which === 'f' ? [2, -200] : [52, -192];
  const sh = shoulderW(d, rel);
  const [hx, hy, ex, ey] = d.arms[which];
  const mx = (sh.x + hx) / 2 + ex, my = (sh.y + hy) / 2 + ey;
  ctx.strokeStyle = which === 'f' ? C.hoodieD : C.hoodie;
  ctx.lineWidth = 30; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
  ctx.fillStyle = which === 'f' ? C.skinD : C.skin;
  circ(hx, hy, 17); ctx.fill();
}

function torsoPath() {
  ctx.beginPath();
  ctx.moveTo(-88, 0);
  ctx.bezierCurveTo(-100, -110, -88, -196, -44, -220);
  ctx.quadraticCurveTo(8, -244, 58, -214);
  ctx.bezierCurveTo(92, -190, 98, -90, 86, 0);
  ctx.closePath();
}

function drawTorsoHead(t, d) {
  const h = hipPos(d);
  ctx.save();
  ctx.translate(h.x, h.y); ctx.rotate(d.lean);
  ctx.fillStyle = C.hoodieD; ctx.beginPath(); ctx.ellipse(-26, -218, 50, 26, -0.35, 0, TAU); ctx.fill();
  torsoPath(); ctx.fillStyle = C.hoodie; ctx.fill();
  ctx.save(); torsoPath(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-120, -260, 55, 270); ctx.restore();
  ctx.strokeStyle = C.hoodieD; ctx.lineWidth = 4; rr(0, -86, 78, 46, 14); ctx.stroke();
  ctx.strokeStyle = '#E8E4F5'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(36, -206); ctx.lineTo(33, -165); ctx.moveTo(52, -203); ctx.lineTo(54, -163); ctx.stroke();
  ctx.fillStyle = C.skinD; rr(6, -248, 28, 32, 8); ctx.fill();
  ctx.translate(18, -224); ctx.rotate(d.tilt);
  ctx.translate(0, -84);
  drawHead(t, d);
  ctx.restore();
}

function drawHead(t, d) {
  ctx.fillStyle = C.skin; circ(0, 0, 82); ctx.fill();
  ctx.save(); circ(0, 0, 82); ctx.clip();
  ctx.fillStyle = 'rgba(160,90,70,0.12)'; circ(-60, 10, 70); ctx.fill();
  ctx.restore();
  // 머리카락
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.moveTo(-84, 10);
  ctx.bezierCurveTo(-96, -70, -30, -110, 30, -98);
  ctx.bezierCurveTo(70, -88, 90, -50, 84, -26);
  ctx.quadraticCurveTo(66, -46, 52, -36);
  ctx.quadraticCurveTo(40, -56, 18, -44);
  ctx.quadraticCurveTo(-2, -62, -22, -42);
  ctx.quadraticCurveTo(-40, -30, -46, -6);
  ctx.quadraticCurveTo(-60, -14, -70, 24);
  ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.translate(8, -100); ctx.rotate(d.ahoge + Math.sin(t * 5) * 0.06);
  ctx.strokeStyle = C.hair; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -30, 30, -34); ctx.stroke();
  ctx.restore();
  // 귀
  ctx.fillStyle = C.skin; circ(-60, 8, 15); ctx.fill();
  ctx.fillStyle = C.skinD; circ(-60, 8, 8); ctx.fill();
  drawFace(t, d);
  // 코
  ctx.strokeStyle = C.skinD; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(66, 4); ctx.quadraticCurveTo(76, 14, 66, 20); ctx.stroke();
  drawGlasses(d);
  if (d.expr === 'asleep') {
    const r = 5 + 9 * (0.5 + 0.5 * Math.sin(t * 3));
    ctx.fillStyle = 'rgba(200,230,255,0.35)'; circ(76 + r * 0.7, 24, r); ctx.fill();
    ctx.strokeStyle = 'rgba(230,245,255,0.75)'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (d.sweat > 0) {
    ctx.save(); ctx.globalAlpha = d.sweat;
    const sy = -64 + d.sweat * 10;
    ctx.fillStyle = '#8EC9FF';
    ctx.beginPath(); ctx.moveTo(80, sy - 16); ctx.quadraticCurveTo(92, sy, 80, sy + 6); ctx.quadraticCurveTo(68, sy, 80, sy - 16); ctx.fill();
    ctx.restore();
  }
}

function drawFace(t, d) {
  const ink = '#1E1A22';
  const eyes = [[14, -6], [52, -6]];
  const ex = d.expr;
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ex === 'tired' || ex === 'drowsy') {
    const ry = ex === 'tired' ? 5.5 * (1 - d.blink) + 0.6 : 2.4;
    const lid = ex === 'drowsy' ? 3 : -1;
    for (const [x, y] of eyes) {
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, y + 3, 7.5, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(x - 10, y + lid); ctx.lineTo(x + 10, y + lid); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,80,140,0.55)'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 13); ctx.quadraticCurveTo(x, y + 18, x + 8, y + 13); ctx.stroke();
    }
  } else if (ex === 'hopeful') {
    for (const [x, y] of eyes) {
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, y, 7.5, 9.5 * (1 - d.blink) + 0.6, 0, 0, TAU); ctx.fill();
      if (d.blink < 0.5) { ctx.fillStyle = '#fff'; circ(x + 2.5, y - 3.5, 2.6); ctx.fill(); }
    }
  } else if (ex === 'shock') {
    for (const [x, y] of eyes) {
      ctx.fillStyle = '#fff'; circ(x, y, 12.5); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = ink; circ(x + 1.5, y, 4.6); ctx.fill();
    }
  } else if (ex === 'asleep') {
    ctx.lineWidth = 3.4;
    for (const [x, y] of eyes) { ctx.beginPath(); ctx.moveTo(x - 9, y + 1); ctx.quadraticCurveTo(x, y + 8, x + 9, y + 1); ctx.stroke(); }
  } else if (ex === 'joy' || ex === 'content') {
    ctx.lineWidth = 3.6;
    for (const [x, y] of eyes) { ctx.beginPath(); ctx.moveTo(x - 9, y + 4); ctx.quadraticCurveTo(x, y - 8, x + 9, y + 4); ctx.stroke(); }
  } else if (ex === 'yawn') {
    ctx.lineWidth = 3.4;
    for (const [x, y] of eyes) { ctx.beginPath(); ctx.moveTo(x - 9, y - 1); ctx.quadraticCurveTo(x, y + 3, x + 9, y - 1); ctx.stroke(); }
  }
  const mx = 40, my = 34;
  ctx.strokeStyle = ink; ctx.lineWidth = 3.4;
  if (ex === 'tired') {
    ctx.beginPath(); ctx.moveTo(mx - 12, my); ctx.quadraticCurveTo(mx - 5, my - 4, mx, my); ctx.quadraticCurveTo(mx + 5, my + 4, mx + 11, my); ctx.stroke();
  } else if (ex === 'drowsy') {
    ctx.beginPath(); ctx.moveTo(mx - 8, my + 1); ctx.lineTo(mx + 8, my + 1); ctx.stroke();
  } else if (ex === 'hopeful' || ex === 'content') {
    ctx.beginPath(); ctx.arc(mx, my - 8, 12, 0.2 * PI, 0.8 * PI); ctx.stroke();
  } else if (ex === 'shock') {
    ctx.fillStyle = '#5B2730'; ctx.beginPath(); ctx.ellipse(mx, my + 2, 7, 9.5, 0, 0, TAU); ctx.fill();
  } else if (ex === 'asleep') {
    ctx.fillStyle = '#5B2730'; ctx.beginPath(); ctx.ellipse(mx, my + 2, 5, 4, 0, 0, TAU); ctx.fill();
  } else if (ex === 'joy') {
    ctx.fillStyle = '#5B2730';
    ctx.beginPath(); ctx.moveTo(mx - 17, my - 6); ctx.lineTo(mx + 17, my - 6);
    ctx.quadraticCurveTo(mx + 16, my + 20, mx, my + 20); ctx.quadraticCurveTo(mx - 16, my + 20, mx - 17, my - 6); ctx.fill();
    ctx.fillStyle = '#F28B8B'; ctx.beginPath(); ctx.ellipse(mx, my + 13, 8, 5, 0, 0, TAU); ctx.fill();
  } else if (ex === 'yawn') {
    ctx.fillStyle = '#5B2730'; ctx.beginPath(); ctx.ellipse(mx, my + 6, 11, 6 + 16 * d.yawn, 0, 0, TAU); ctx.fill();
  }
  if (ex === 'joy' || ex === 'hopeful' || ex === 'content' || ex === 'shock') {
    ctx.fillStyle = 'rgba(255,120,120,0.32)';
    ctx.beginPath(); ctx.ellipse(2, 24, 12, 7, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(66, 26, 10, 6, 0, 0, TAU); ctx.fill();
  }
}

function drawGlasses(d) {
  const gy = -6 + d.glassY;
  ctx.fillStyle = hexA(d.lensC, 0.16);
  circ(14, gy, 20); ctx.fill(); circ(52, gy, 19); ctx.fill();
  ctx.strokeStyle = '#15131C'; ctx.lineWidth = 3.6;
  circ(14, gy, 20); ctx.stroke(); circ(52, gy, 19); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, gy - 2); ctx.lineTo(-54, gy + 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(14, gy, 14, -2.4, -1.7); ctx.stroke();
  ctx.beginPath(); ctx.arc(52, gy, 13, -2.4, -1.7); ctx.stroke();
}

function drawSpark(x, y, s, o) {
  o = o || {};
  if (s <= 0.002) return;
  const t = o.t || 0;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.tilt || 0); ctx.scale(s * (o.sx || 1), s * (o.sy || 1));
  const rot = o.rot || 0;
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? C.orange : C.orangeD;
    for (let i = 0; i < 8; i++) {
      const a = rot + i * PI / 4 - PI / 2;
      const L = (i % 2 ? 44 : 60) + Math.sin(t * 7 + i * 1.7) * 3;
      ctx.lineWidth = (i % 2 ? 22 : 27) + (pass ? 0 : 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.stroke();
    }
    ctx.fillStyle = pass ? C.orange : C.orangeD;
    circ(0, 0, pass ? 40 : 43); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; circ(-12, -14, 15); ctx.fill();
  const ink = '#2A170F', ex = 13, ey = -3, bl = o.blink || 0;
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round';
  const smile = () => { ctx.lineWidth = 3.6; ctx.beginPath(); ctx.arc(0, 9, 8, 0.15 * PI, 0.85 * PI); ctx.stroke(); };
  switch (o.expr || 'happy') {
    case 'wow':
      for (const sx of [-ex, ex]) { ctx.fillStyle = ink; circ(sx, ey - 1, 8); ctx.fill(); ctx.fillStyle = '#fff'; circ(sx + 2.5, ey - 4, 2.8); ctx.fill(); }
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(0, 15, 5, 6.5, 0, 0, TAU); ctx.fill();
      break;
    case 'closed':
      ctx.lineWidth = 3.6;
      for (const sx of [-ex, ex]) { ctx.beginPath(); ctx.moveTo(sx - 6, ey + 1); ctx.quadraticCurveTo(sx, ey - 6, sx + 6, ey + 1); ctx.stroke(); }
      smile();
      break;
    case 'focus':
      for (const sx of [-ex, ex]) { ctx.beginPath(); ctx.ellipse(sx, ey + 1, 5.5, 4.5, 0, 0, TAU); ctx.fill(); }
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-19, -14); ctx.lineTo(-8, -11); ctx.moveTo(19, -14); ctx.lineTo(8, -11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(5, 13); ctx.stroke();
      break;
    default:
      for (const sx of [-ex, ex]) {
        ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(sx, ey, 5.5, 8 * (1 - bl) + 0.8, 0, 0, TAU); ctx.fill();
        if (bl < 0.5) { ctx.fillStyle = '#fff'; circ(sx + 2, ey - 3.2, 2.2); ctx.fill(); }
      }
      smile();
  }
  ctx.fillStyle = 'rgba(255,170,160,0.55)';
  ctx.beginPath(); ctx.ellipse(-25, 9, 6, 3.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(25, 9, 6, 3.5, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function sparkRoom(t) {
  const o = { vis: false, x: HOVER.x, y: HOVER.y, s: 0.85, tilt: 0, rot: Math.sin(t * 1.3) * 0.08, sx: 1, sy: 1, expr: 'happy', glow: 0, t };
  o.blink = blinkAt(t, [10.25, 22.45, 25.0]);
  const bob = Math.sin(t * 3.2) * 7;
  const popOut = t0 => {
    const u = seg(t, t0, t0 + 0.45);
    if (u >= 1) return false;
    o.x = lerp(SC.x, HOVER.x, E.out(u));
    o.y = lerp(SC.y, HOVER.y, E.out(u)) - Math.sin(PI * u) * 60;
    o.s = 0.85 * E.outBack(u);
    o.rot += (1 - u) * 3;
    o.sx = 1 + 0.25 * Math.sin(PI * u * 2) * (1 - u); o.sy = 2 - o.sx;
    o.expr = 'wow';
    return true;
  };
  if (t >= T.pop && t < T.dive1) {
    o.vis = true;
    if (!popOut(T.pop)) o.y += bob;
    if (t > 9.35 && t < 10.1) o.tilt += Math.sin((t - 9.35) * 16) * 0.22 * (1 - seg(t, 9.35, 10.1));
    if (t >= T.dive0) {
      const a = seg(t, T.dive0, T.dive0 + 0.15), b = E.in(seg(t, T.dive0 + 0.15, T.dive1));
      o.y -= 30 * E.out(a) * (1 - b);
      o.x = lerp(o.x, SC.x, b); o.y = lerp(o.y, SC.y, b);
      o.s *= 1 - b * 0.95; o.rot += b * 6; o.expr = 'focus';
    }
  }
  if (t >= T.pop2 && t < T.end) {
    o.vis = true;
    if (!popOut(T.pop2)) {
      let x = HOVER.x, y = HOVER.y + bob, s = 0.85;
      o.rot += 2 * TAU * E.inOut(seg(t, T.joy, T.joy + 0.7));
      y -= 30 * Math.sin(PI * seg(t, T.joy, T.joy + 0.4));
      if (t >= T.hi0 && t < T.hi1) {
        const go = E.inOut(seg(t, T.hi0, T.hiHit)), back = E.out(seg(t, T.hiHit, T.hi1));
        const k = go * (1 - back);
        x = lerp(x, -40, k); y = lerp(y, -262, k) - Math.sin(PI * go) * 50 * (1 - back);
        o.tilt = -0.4 * k;
        if (t >= T.hiHit) { o.expr = 'closed'; const sq = pulse(t, T.hiHit, 0.18); o.sx = 1 - 0.25 * sq; o.sy = 1 + 0.25 * sq; }
      }
      const btn = { x: MON.x + MON.w - 6, y: MON.y + MON.h + MON.b - 36 };
      if (t >= T.yawn0) {
        const g1 = E.inOut(seg(t, T.yawn0, T.press - 0.1));
        x = lerp(x, btn.x, g1); y = lerp(y, btn.y, g1) - Math.sin(PI * g1) * 80; s = lerp(0.85, 0.5, g1);
      }
      if (t >= T.press - 0.12) { const sq = pulse(t, T.press - 0.1, 0.22); o.sy = 1 - 0.3 * sq; o.sx = 1 + 0.3 * sq; y += 8 * sq; }
      if (t >= T.press + 0.15) {
        const g2 = E.inOut(seg(t, T.press + 0.15, T.press + 0.6));
        x = lerp(btn.x, 290, g2); y = lerp(btn.y, -70 + bob * 0.6, g2); s = lerp(0.5, 0.8, g2);
        o.glow = 0.55 * g2;
      }
      o.x = x; o.y = y; o.s = s;
    }
  }
  return o;
}

// ---------- effects ----------
function bubble(t, b) {
  const [t0, t1, text, x, y, tx, ty] = b;
  if (t < t0 || t > t1) return;
  const pin = seg(t, t0, t0 + 0.28), out = seg(t, t1 - 0.15, t1);
  const fs = 34;
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(x, y);
  const sc = E.outBack(pin);
  ctx.scale(sc, sc);
  setFont(800, fs);
  const tw = ctx.measureText(text).width, w = tw + fs * 1.3, h = fs * 1.8;
  const ddx = tx - x, ddy = ty - y;
  const tail = () => { ctx.beginPath(); ctx.moveTo(-14 + ddx * 0.15, h / 2 - 4); ctx.lineTo(ddx, ddy); ctx.lineTo(14 + ddx * 0.15, h / 2 - 4); ctx.closePath(); };
  ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
  tail(); ctx.stroke(); rr(-w / 2, -h / 2, w, h, h / 2); ctx.stroke();
  ctx.fillStyle = C.cream;
  tail(); ctx.fill(); rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

function drawZzz(t, x, y, amt) {
  if (amt <= 0) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.75 + i / 3) % 1;
    setFont(900, 22 + ph * 26);
    ctx.fillStyle = hexA('#DDE3FF', Math.sin(PI * ph) * amt);
    ctx.fillText('Z', x + ph * 60 + Math.sin(ph * 6) * 8, y - ph * 110);
  }
}

function drawBurst(t, t0, x, y, seed, n, col, dist) {
  const u = seg(t, t0, t0 + 0.6);
  if (u <= 0 || u >= 1) return;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.4, d = dist * (0.6 + r() * 0.6) * E.out(u), s = (1 - u) * (6 + r() * 8);
    star4(x + Math.cos(a) * d, y + Math.sin(a) * d, s * 1.6, a);
    ctx.fillStyle = i % 2 ? col : C.cream; ctx.fill();
  }
  ctx.strokeStyle = hexA(col, (1 - u) * 0.8); ctx.lineWidth = 6 * (1 - u);
  circ(x, y, dist * 0.9 * E.out(u)); ctx.stroke();
}

function drawConfetti(t, t0, ox, oy, seed, n) {
  const dt = t - t0;
  if (dt < 0 || dt > 2.4) return;
  const r = rng(seed);
  const cols = [C.orange, C.green, '#F5C451', C.cream, '#7C8CFF', '#FF7AB6'];
  for (let i = 0; i < n; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.6, sp = 500 + r() * 800;
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
    const k = 1.6, e = Math.exp(-k * dt), g = 900;
    const x = ox + (vx * (1 - e)) / k + Math.sin(dt * 4 + i) * 14;
    const y = oy + (vy * (1 - e)) / k + (g / k) * (dt - (1 - e) / k);
    const rot = r() * TAU + dt * (r() * 10 - 5);
    const w = 8 + r() * 8, h = 12 + r() * 8;
    ctx.save();
    ctx.globalAlpha = 1 - seg(dt, 1.6, 2.4);
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.cos(dt * 8 + i), 1);
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawHighFive(t) {
  const u = seg(t, T.hiHit, T.hiHit + 0.45);
  if (u <= 0 || u >= 1) return;
  const x = -88, y = -262;
  ctx.save();
  ctx.strokeStyle = hexA('#FFE7A3', 1 - u); ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, d0 = 30 + 70 * E.out(u), d1 = d0 + 30 * (1 - u);
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); ctx.stroke();
  }
  const p = E.outBack(seg(t, T.hiHit, T.hiHit + 0.2));
  ctx.globalAlpha = 1 - seg(u, 0.7, 1);
  ctx.translate(x + 10, y - 95); ctx.scale(p, p); ctx.rotate(-0.12);
  setFont(900, 60); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.strokeText('짝!', 0, 0);
  ctx.fillStyle = '#FFD76A'; ctx.fillText('짝!', 0, 0);
  ctx.restore();
}

// ---------- room scene ----------
function drawRoom(t) {
  const cam = roomCam(t);
  applyCam(cam);
  const d = devPose(t);
  drawWall(); drawWindow(t); drawClock(t);
  if (!V && !IS_THUMB) drawDecor();
  drawMonitor(t);
  drawChair(); drawLegs(); drawKeyboard();
  drawArm(d, 'f');
  drawTorsoHead(t, d);
  drawDesk(); drawCups(t); drawPlant();
  drawArm(d, 'n');
  const gl = glowState(t);
  glow(SC.x, SC.y, 950, gl.c, gl.a);
  const dk = t >= 20 ? seg(t, T.press, T.press + 0.35) : 0;
  if (dk > 0) { ctx.fillStyle = `rgba(4,5,14,${0.62 * dk})`; ctx.fillRect(-4000, -4000, 8000, 8000); }
  const hw = headW(d);
  const zAmt = (t > 11.4 && t < T.wake ? seg(t, 11.4, 11.8) : 0) + (t > 24.6 ? seg(t, 24.6, 25.0) * 0.8 : 0);
  drawZzz(t, hw.x + 70, hw.y - 70, zAmt);
  drawBurst(t, T.wake, hw.x + 80, hw.y + 20, 21, 8, '#BFE3FF', 50);
  const sp = sparkRoom(t);
  if (sp.vis) {
    if (sp.glow > 0) glow(sp.x, sp.y, 460, '#FF9A66', sp.glow);
    drawSpark(sp.x, sp.y, sp.s, sp);
  }
  drawBurst(t, T.pop, HOVER.x - 40, HOVER.y + 20, 3, 14, C.orange, 150);
  drawBurst(t, T.pop2, HOVER.x - 40, HOVER.y + 20, 4, 14, C.green, 150);
  if (!IS_THUMB) drawConfetti(t, T.joy + 0.05, SC.x, SC.y - 40, 99, 110);
  drawHighFive(t);
  for (const b of BUBBLES) bubble(t, b);
}

// ---------- code world ----------
const NODES = V ? {
  auth: { x: 0, y: -145, l: 'auth.ts' }, test: { x: -250, y: -335, l: 'auth.test.ts' }, db: { x: 255, y: -320, l: 'db.ts' },
  api: { x: -262, y: 45, l: 'api.ts' }, user: { x: 250, y: 55, l: 'user.ts' },
} : {
  auth: { x: -150, y: 30, l: 'auth.ts' }, test: { x: -560, y: -180, l: 'auth.test.ts' }, db: { x: 180, y: -190, l: 'db.ts' },
  api: { x: -560, y: 225, l: 'api.ts' }, user: { x: 170, y: 255, l: 'user.ts' },
};
const CW = V ? 236 : 250, CH = V ? 66 : 72;
const EDGES = [['test', 'api'], ['api', 'user'], ['user', 'db'], ['db', 'auth'], ['test', 'auth'], ['api', 'auth'], ['user', 'auth']];
const VISITS = [['test', 13.3], ['api', 13.7], ['user', 14.1], ['db', 14.5], ['auth', 14.95]];
const OKT = { test: 18.5, api: 18.75, user: 19.0, db: 19.25 };
const DIFF = V ? { x: 0, y: -150, w: 960, h: 290, fs: 30, lh: 46, gut: 70 } : { x: -140, y: 25, w: 1040, h: 320, fs: 36, lh: 54, gut: 84 };
const KW = '#E58A6A', FN = '#7FB4FF', ID = '#D7DAE6', PU = '#8C93B8', LI = '#F2C46D';
const CODE = [
  [11, [['export ', KW], ['function ', KW], ['verify', FN], ['(', PU], ['token', ID], [') {', PU]]],
  [12, [['  if ', KW], ['(', PU], ['token ', ID], ['=', null], [' null', LI], [') ', PU], ['return ', KW], ['false', LI], [';', PU]]],
  [13, [['  return ', KW], ['check', FN], ['(', PU], ['token', ID], [');', PU]]],
  [14, [['}', PU]]],
];
const RAIN = (() => {
  const r = rng(77);
  const toks = ['const', '=>', '{ }', 'await', 'if', 'return', 'null', '===', 'fn()', '[]', 'import', 'export', 'true', '0x1F', '//', 'async', 'let', 'try', 'catch', '()'];
  const cols = [];
  for (let i = 0; i < 40; i++) {
    cols.push({ x: -1100 + i * 58 + r() * 20, sp: 18 + r() * 40, off: r() * 2400, a: 0.05 + r() * 0.07,
      toks: Array.from({ length: 8 }, () => toks[Math.floor(r() * toks.length)]) });
  }
  return cols;
})();

function above(k) { const n = NODES[k]; return { x: n.x + CW / 2 - 14, y: n.y - 58 }; }
const diffK = t => E.out(seg(t, T.diffOpen0, T.diffOpen1)) * (1 - E.in(seg(t, T.diffClose0, T.diffClose1)));
const diffCorner = () => ({ x: DIFF.x + DIFF.w / 2 - 60, y: DIFF.y - DIFF.h / 2 - 16 });

function sparkCode(t) {
  const o = { x: 0, y: 0, s: 0.75, tilt: 0, rot: t * 0.8, sx: 1, sy: 1, expr: 'happy', t, moving: false };
  const C0 = { x: 0, y: V ? -150 : 0 };
  if (t < 13.0) {
    o.x = C0.x; o.y = C0.y; o.s = lerp(4, 0.75, E.out(seg(t, 12.55, 13.0)));
    return o;
  }
  const pts = [[13.0, C0], ...VISITS.map(([k, tv]) => [tv, above(k)])];
  for (let i = 1; i < pts.length; i++) {
    const [tb, B] = pts[i], [ta, A] = pts[i - 1];
    if (t < tb) {
      const dep = Math.max(ta, tb - 0.32), u = E.inOut(seg(t, dep, tb));
      o.x = lerp(A.x, B.x, u); o.y = lerp(A.y, B.y, u) - Math.sin(PI * u) * 40;
      o.tilt = Math.sin(PI * u) * 0.3 * Math.sign(B.x - A.x);
      o.moving = u > 0 && u < 1;
      return o;
    }
  }
  const au = above('auth');
  o.x = au.x; o.y = au.y + Math.sin(t * 4) * 5;
  if (t >= T.alert && t < T.diffOpen0) { o.expr = 'wow'; o.y -= 14 * pulse(t, T.alert, 0.25); }
  const pk = diffK(t);
  if (pk > 0) {
    const c = diffCorner();
    o.x = lerp(au.x, c.x, pk); o.y = lerp(au.y, c.y, pk); o.s = lerp(0.75, 0.7, pk);
    o.expr = t >= T.fixed ? 'happy' : 'focus';
    o.y -= 14 * pulse(t, T.ins1 - 0.08, 0.16) + 14 * pulse(t, T.ins2 - 0.08, 0.16);
  }
  if (t >= T.passed) {
    o.y -= 40 * Math.sin(PI * seg(t, T.passed, T.passed + 0.4));
    o.rot += 6 * E.out(seg(t, T.passed, T.passed + 0.6));
  }
  if (t >= T.exit0) {
    const u = E.in(seg(t, T.exit0, T.flash0 + 0.1));
    o.x = lerp(o.x, 0, u); o.y = lerp(o.y, 0, u); o.s = lerp(o.s, 16, u);
    o.moving = true;
  }
  return o;
}

function drawGrid(t) {
  ctx.strokeStyle = 'rgba(120,130,220,0.06)'; ctx.lineWidth = 1.5;
  const s = 64, off = (t * 12) % s;
  ctx.beginPath();
  for (let x = -VW / 2 - s; x < VW / 2 + s; x += s) { ctx.moveTo(x + off, -VH / 2); ctx.lineTo(x + off, VH / 2); }
  for (let y = -VH / 2 - s; y < VH / 2 + s; y += s) { ctx.moveTo(-VW / 2, y + off); ctx.lineTo(VW / 2, y + off); }
  ctx.stroke();
}
function drawRain(t) {
  setFont(400, 18, MONO); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of RAIN) {
    for (let j = 0; j < c.toks.length; j++) {
      const y = (((c.off + j * 300 - t * c.sp * 3) % 2400) + 2400) % 2400 - 1200;
      ctx.fillStyle = hexA('#8C95E8', c.a); ctx.fillText(c.toks[j], c.x, y);
    }
  }
}
function edgeLine(A, B, u) {
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(lerp(A.x, B.x, u), lerp(A.y, B.y, u)); ctx.stroke();
}
function drawEdges(t) {
  const ap = E.inOut(seg(t, 12.95, 13.4));
  if (ap <= 0) return;
  ctx.lineCap = 'round';
  for (const [a, b] of EDGES) {
    ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 40;
    ctx.strokeStyle = 'rgba(130,140,220,0.28)'; ctx.lineWidth = 3;
    edgeLine(NODES[a], NODES[b], ap);
    ctx.setLineDash([]);
  }
  for (let i = 1; i < VISITS.length; i++) {
    const [ka] = VISITS[i - 1], [kb, tb] = VISITS[i];
    const u = seg(t, tb - 0.32, tb), fade = 1 - seg(t, tb, tb + 0.5);
    if (u > 0 && fade > 0) { ctx.strokeStyle = hexA(C.orange, 0.85 * fade); ctx.lineWidth = 4; edgeLine(NODES[ka], NODES[kb], E.inOut(u)); }
  }
  for (const k of Object.keys(OKT)) {
    const u = seg(t, OKT[k] - 0.45, OKT[k]);
    if (u <= 0) continue;
    const A = NODES.auth, B = NODES[k], e = E.inOut(u);
    ctx.strokeStyle = hexA(C.green, 0.8); ctx.lineWidth = 4; edgeLine(A, B, e);
    if (u < 1) {
      const px = lerp(A.x, B.x, e), py = lerp(A.y, B.y, e);
      glow(px, py, 60, C.green, 0.9);
      ctx.fillStyle = '#CFFFE0'; circ(px, py, 7); ctx.fill();
    }
  }
  for (const [a, b] of EDGES) {
    if (a === 'auth' || b === 'auth') continue;
    const tt = Math.max(OKT[a], OKT[b]), u = seg(t, tt, tt + 0.3);
    if (u > 0) { ctx.strokeStyle = hexA(C.green, 0.55 * u); ctx.lineWidth = 3; edgeLine(NODES[a], NODES[b], 1); }
  }
}

function drawCard(key, t) {
  const n = NODES[key];
  const order = ['auth', 'test', 'db', 'api', 'user'], i = order.indexOf(key);
  const ap = seg(t, 12.8 + i * 0.09, 12.8 + i * 0.09 + 0.35);
  if (ap <= 0) return;
  let scan = 0, visited = false, err = false, ok = false, okP = 0, sx = 0;
  const v = VISITS.find(vv => vv[0] === key);
  if (v) {
    if (t >= v[1] - 0.05 && t < v[1] + 0.3) scan = seg(t, v[1] - 0.05, v[1] + 0.3);
    if (t >= v[1] + 0.3) visited = true;
  }
  if (key === 'auth') {
    if (t >= T.alert && t < T.diffClose1) { err = true; sx = shakeAt(t, T.alert, 12, 0.4).x; }
    if (t >= T.diffClose1) { ok = true; okP = seg(t, T.diffClose1, T.diffClose1 + 0.3); }
  } else if (t >= OKT[key]) { ok = true; okP = seg(t, OKT[key], OKT[key] + 0.3); }
  let border = '#2C3052', bg = '#171A2E', gc = null;
  if (visited) border = hexA(C.orange, 0.55);
  if (scan > 0) { border = C.orange; gc = C.orange; }
  if (err) { border = C.red; gc = C.red; bg = '#2A1620'; }
  if (ok) { border = C.green; gc = C.green; bg = '#132A22'; }
  ctx.save();
  ctx.translate(n.x + sx, n.y);
  const sc = E.outBack(ap) * (1 + 0.08 * pulse(t, OKT[key] || T.diffClose1, 0.25));
  ctx.scale(sc, sc);
  if (gc) { ctx.shadowColor = gc; ctx.shadowBlur = 26; }
  ctx.fillStyle = bg; rr(-CW / 2, -CH / 2, CW, CH, 14); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.stroke();
  const isTest = key === 'test';
  ctx.fillStyle = isTest ? '#C792EA' : '#4F8CFF'; rr(-CW / 2 + 16, -14, 28, 28, 6); ctx.fill();
  setFont(700, 13, MONO); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TS', -CW / 2 + 30, 1);
  setFont(700, V ? 22 : 24, MONO); ctx.fillStyle = C.termFg; ctx.textAlign = 'left';
  ctx.fillText(n.l, -CW / 2 + 56, 1);
  if (scan > 0 && scan < 1) {
    ctx.save(); rr(-CW / 2, -CH / 2, CW, CH, 14); ctx.clip();
    const g = ctx.createLinearGradient(-CW / 2 + CW * scan - 60, 0, -CW / 2 + CW * scan, 0);
    g.addColorStop(0, hexA(C.orange, 0)); g.addColorStop(1, hexA(C.orange, 0.45));
    ctx.fillStyle = g; ctx.fillRect(-CW / 2 + CW * scan - 60, -CH / 2, 60, CH);
    ctx.restore();
  }
  if (ok) {
    const p = E.outBack(okP);
    ctx.save(); ctx.translate(CW / 2 - 6, -CH / 2 + 6); ctx.scale(p, p);
    ctx.fillStyle = C.green; circ(0, 0, 16); ctx.fill();
    iconCheck(0, 1, 16, '#0D1F14', 4);
    ctx.restore();
  }
  if (err) {
    const p = E.outBack(seg(t, T.alert, T.alert + 0.25));
    ctx.save(); ctx.translate(-CW / 2 + 6, -CH / 2 + 6); ctx.scale(p, p);
    ctx.fillStyle = C.red; circ(0, 0, 16); ctx.fill();
    setFont(900, 22); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('!', 0, 1);
    ctx.restore();
  }
  ctx.restore();
}

function drawCounter(t) {
  const pos = V ? { x: 0, y: -580 } : { x: 0, y: -420 };
  const ap = seg(t, 12.85, 13.2);
  if (ap <= 0) return;
  const failN = t < T.run0 ? 47 : Math.round(47 * (1 - E.inOutQuad(seg(t, T.run0, T.run1))));
  const passed = t >= T.passed;
  const fs = V ? 52 : 50;
  const label = passed ? '50 passed' : `${failN} failed`;
  const col = passed ? C.green : C.red;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  const sc = E.outBack(ap) * (1 + 0.25 * pulse(t, T.passed, 0.3));
  ctx.scale(sc, sc);
  setFont(700, fs, MONO);
  const tw = ctx.measureText(label).width, w = tw + fs * 2.3, h = fs * 1.7;
  ctx.shadowColor = col; ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(15,16,30,0.92)'; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  if (passed) iconCheck(-w / 2 + fs * 0.95, 2, fs * 0.6, col, 7);
  else iconCross(-w / 2 + fs * 0.95, 0, fs * 0.42, col, 7);
  ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, -w / 2 + fs * 1.65, 2);
  ctx.restore();
  const dy = pos.y + (V ? 80 : 78);
  const green = passed ? 50 : 3 + (47 - failN);
  for (let i = 0; i < 50; i++) {
    const dp = E.outBack(seg(t, 13.0 + i * 0.006, 13.25 + i * 0.006));
    if (dp <= 0) continue;
    const isG = i < green;
    const bump = isG && i === green - 1 && !passed ? 1.35 : 1;
    ctx.fillStyle = isG ? C.green : hexA(C.red, 0.85);
    circ((i % 25 - 12) * 28, dy + Math.floor(i / 25) * 26, 9 * dp * bump); ctx.fill();
  }
}

function drawTodos(t) {
  const L = V ? { x: -400, y: 200, w: 800, h: 350, fs: 36, lh: 70, top: 84 } : { x: 430, y: -190, w: 450, h: 390, fs: 30, lh: 72, top: 86 };
  const ap = E.out(seg(t, 13.0, 13.4));
  if (ap <= 0) return;
  ctx.save();
  ctx.globalAlpha = ap;
  ctx.translate(V ? 0 : (1 - ap) * 80, V ? (1 - ap) * 80 : 0);
  ctx.fillStyle = 'rgba(20,22,40,0.92)'; rr(L.x, L.y, L.w, L.h, 22); ctx.fill();
  ctx.strokeStyle = '#2C3052'; ctx.lineWidth = 3; ctx.stroke();
  const active = TODOS.some(([, a, b]) => t >= a && t < b);
  iconAst(L.x + 40, L.y + 45, 12, C.orange, active ? t * 4 : 0, 4.5);
  setFont(800, L.fs * 0.85); ctx.fillStyle = C.cream; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Todos', L.x + 64, L.y + 46);
  TODOS.forEach(([label, a, b], i) => {
    const y = L.y + L.top + i * L.lh + L.lh / 2;
    const bs = L.fs * 0.95, bx = L.x + 28;
    const st = t < a ? 0 : t < b ? 1 : 2;
    if (st === 1) { ctx.fillStyle = hexA(C.orange, 0.1); rr(L.x + 12, y - L.lh / 2 + 5, L.w - 24, L.lh - 10, 12); ctx.fill(); }
    if (st === 2) {
      const p = E.outBack(seg(t, b, b + 0.25));
      ctx.save(); ctx.translate(bx + bs / 2, y); ctx.scale(p, p);
      ctx.fillStyle = C.green; rr(-bs / 2, -bs / 2, bs, bs, 7); ctx.fill();
      ctx.restore();
      iconCheck(bx + bs / 2, y, bs * 0.62, '#0D1F14', 4, seg(t, b, b + 0.2));
    } else {
      ctx.strokeStyle = st === 1 ? C.orange : '#4A4F70'; ctx.lineWidth = 3; rr(bx, y - bs / 2, bs, bs, 7); ctx.stroke();
      if (st === 1) iconAst(bx + bs / 2, y, bs * 0.28, C.orange, t * 5, 3);
    }
    setFont(st === 1 ? 800 : 700, L.fs);
    ctx.fillStyle = st === 0 ? '#6E7393' : st === 1 ? C.cream : '#7D8299';
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + bs + 20, y + 1);
    if (st === 2) {
      const w = ctx.measureText(label).width * E.out(seg(t, b, b + 0.3));
      ctx.strokeStyle = '#7D8299'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bx + bs + 20, y + 1); ctx.lineTo(bx + bs + 20 + w, y + 1); ctx.stroke();
    }
  });
  ctx.restore();
}

function drawDiff(t) {
  const k = diffK(t);
  if (k <= 0.001) return;
  const D = DIFF, a = NODES.auth;
  const sc = lerp(0.22, 1, t < T.diffClose0 ? E.outBack(seg(t, T.diffOpen0, T.diffOpen1)) : k);
  ctx.save();
  ctx.translate(lerp(a.x, D.x, k), lerp(a.y, D.y, k)); ctx.scale(sc, sc);
  ctx.globalAlpha = clamp(k * 1.4);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40;
  ctx.fillStyle = '#14162A'; rr(-D.w / 2, -D.h / 2, D.w, D.h, 22); ctx.fill();
  ctx.shadowBlur = 0;
  const fixed = t >= T.fixed;
  ctx.strokeStyle = t >= T.ring ? (fixed ? C.green : C.red) : '#33385E'; ctx.lineWidth = 3; ctx.stroke();
  const hy = -D.h / 2 + 34;
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; circ(-D.w / 2 + 32 + i * 24, hy, 7); ctx.fill(); });
  setFont(700, D.fs * 0.62, MONO); ctx.fillStyle = '#8B90AE'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('src/auth.ts', -D.w / 2 + 120, hy + 1);
  ctx.fillStyle = '#262A48'; ctx.fillRect(-D.w / 2, -D.h / 2 + 64, D.w, 2);
  setFont(400, D.fs, MONO);
  const cw = ctx.measureText('M').width;
  const x0 = -D.w / 2 + D.gut + 20, y0 = -D.h / 2 + 64 + D.lh * 0.5 + 18;
  CODE.forEach(([ln, toks], i) => {
    const yy = y0 + i * D.lh;
    if (ln === 12 && t >= T.ring) {
      ctx.fillStyle = fixed ? 'rgba(74,222,128,0.12)' : 'rgba(255,95,87,0.13)';
      ctx.fillRect(-D.w / 2 + 3, yy - D.lh / 2 + 2, D.w - 6, D.lh - 4);
    }
    setFont(400, D.fs, MONO); ctx.fillStyle = '#4A4F72'; ctx.textAlign = 'right';
    ctx.fillText(String(ln), -D.w / 2 + D.gut, yy + 1);
    ctx.textAlign = 'left';
    let x = x0;
    for (const [s, col] of toks) {
      if (col === null) {
        const n = t >= T.ins2 ? 3 : t >= T.ins1 ? 2 : 1;
        setFont(700, D.fs, MONO);
        ctx.fillStyle = fixed ? C.green : t >= T.ring ? C.red : ID;
        ctx.fillText('='.repeat(n), x, yy + 1);
        if (t >= T.ring) {
          const rp = E.outBack(seg(t, T.ring, T.ring + 0.3));
          ctx.save();
          ctx.translate(x + (cw * n) / 2, yy); ctx.scale(rp, rp);
          ctx.strokeStyle = fixed ? C.green : C.red; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(0, 0, (cw * n) / 2 + 16 + (fixed ? 0 : Math.sin(t * 14) * 2), D.fs * 0.78, 0, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        x += cw * n;
      } else {
        setFont(400, D.fs, MONO); ctx.fillStyle = col; ctx.fillText(s, x, yy + 1);
        x += cw * s.length;
      }
    }
    if (ln === 12 && fixed) {
      const p = E.outBack(seg(t, T.fixed, T.fixed + 0.3));
      ctx.save(); ctx.translate(x + 40, yy); ctx.scale(p, p);
      ctx.fillStyle = C.green; circ(0, 0, 18); ctx.fill();
      iconCheck(0, 1, 18, '#0D1F14', 4);
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawCodeSpark(t) {
  const o = sparkCode(t);
  for (const [k, tv] of VISITS) {
    const u = seg(t, tv - 0.05, tv + 0.3);
    if (u <= 0 || u >= 1) continue;
    const n = NODES[k], a = Math.sin(PI * u) * 0.35;
    const g = ctx.createLinearGradient(0, o.y, 0, n.y - CH / 2);
    g.addColorStop(0, hexA(C.orange, a)); g.addColorStop(1, hexA(C.orange, a * 0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(o.x - 10, o.y + 20); ctx.lineTo(o.x + 10, o.y + 20);
    ctx.lineTo(n.x + CW / 2 - 10, n.y - CH / 2); ctx.lineTo(n.x - CW / 2 + 10, n.y - CH / 2); ctx.closePath(); ctx.fill();
  }
  if (t > 13.0 && t < T.flash0) {
    for (let i = 6; i >= 1; i--) {
      const p = sparkCode(t - i * 0.018);
      if (Math.hypot(p.x - o.x, p.y - o.y) < 4) continue;
      ctx.fillStyle = hexA(C.orange, 0.18 * (7 - i) / 6);
      circ(p.x, p.y, 42 * p.s * (1 - i / 9)); ctx.fill();
    }
  }
  glow(o.x, o.y, 230 * o.s, C.orange, 0.35);
  drawSpark(o.x, o.y, o.s, o);
  if (t >= T.alert && t < T.diffOpen0 + 0.1) {
    const p = E.outBack(seg(t, T.alert, T.alert + 0.25)) * (1 - seg(t, T.diffOpen0 - 0.1, T.diffOpen0 + 0.1));
    ctx.save(); ctx.translate(o.x + 42, o.y - 62); ctx.scale(p, p);
    ctx.fillStyle = C.red; circ(0, 0, 24); ctx.fill();
    setFont(900, 34); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 2);
    ctx.restore();
  }
}

function drawCode(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0C0D1B'; ctx.fillRect(0, 0, W, H);
  overlay();
  drawGrid(t); drawRain(t);
  const z = lerp(1.4, 1, E.out(seg(t, T.codeFade0, 13.1)));
  const sh = shakeAt(t, T.alert, 10, 0.35);
  ctx.translate(sh.x, sh.y); ctx.scale(z, z);
  ctx.save();
  ctx.globalAlpha = 1 - 0.6 * diffK(t);
  drawEdges(t);
  for (const k of ['test', 'api', 'user', 'db', 'auth']) drawCard(k, t);
  ctx.restore();
  drawCounter(t); drawTodos(t); drawDiff(t);
  drawCodeSpark(t);
  overlay();
  const R = Math.max(VW, VH) * 0.75;
  const g = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(-VW / 2, -VH / 2, VW, VH);
}

// ---------- end card ----------
function drawBell(x, y, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.7, y + s * 0.45);
  ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.3, x - s * 0.6, y - s * 0.1);
  ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.75, x, y - s * 0.78);
  ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.75, x + s * 0.6, y - s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.3, x + s * 0.7, y + s * 0.45);
  ctx.closePath(); ctx.fill();
  circ(x, y + s * 0.62, s * 0.18); ctx.fill();
  circ(x, y - s * 0.85, s * 0.1); ctx.fill();
}
function drawCursor(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.3, s * 1.3);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.lineTo(9, 26); ctx.lineTo(15, 39); ctx.lineTo(21, 36); ctx.lineTo(15, 23); ctx.lineTo(26, 23);
  ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}
function drawSubscribe(t, y) {
  const ap = seg(t, T.sub0, T.sub0 + 0.4);
  if (ap <= 0) return;
  const e = E.outBack(ap);
  const clicked = t >= T.click;
  const bw = V ? 250 : 240, bh = V ? 84 : 80, bx = -48;
  ctx.save();
  ctx.translate(0, y + (1 - e) * 60); ctx.globalAlpha = clamp(ap * 2);
  ctx.save();
  ctx.translate(bx, 0);
  const pr = 1 - 0.1 * pulse(t, T.click - 0.06, 0.2);
  ctx.scale(pr, pr);
  ctx.fillStyle = clicked ? '#DCD5C9' : '#E62E2E'; rr(-bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
  setFont(800, V ? 38 : 36); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = clicked ? '#4A4540' : '#fff';
  ctx.fillText(clicked ? '구독중' : '구독', 0, 2);
  ctx.restore();
  const bellX = bx + bw / 2 + 18 + bh / 2;
  ctx.save();
  ctx.translate(bellX, 0);
  ctx.fillStyle = '#E4DDD1'; circ(0, 0, bh / 2); ctx.fill();
  const wig = t >= T.bell0 ? Math.sin((t - T.bell0) * 32) * 0.45 * Math.exp(-(t - T.bell0) * 3) : 0;
  ctx.rotate(wig);
  drawBell(0, 0, 24, clicked ? C.orange : '#4A4540');
  ctx.restore();
  if (clicked) {
    const u = seg(t, T.click, T.click + 0.5);
    ctx.strokeStyle = hexA(C.orange, 1 - u); ctx.lineWidth = 4;
    rr(bx - bw / 2 - 20 * u, -bh / 2 - 20 * u, bw + 40 * u, bh + 40 * u, bh / 2 + 20 * u); ctx.stroke();
  }
  ctx.restore();
  if (t >= T.sub0 + 0.2) {
    const cu = E.inOut(seg(t, T.sub0 + 0.2, T.click - 0.05));
    const cx = lerp(V ? 380 : 520, bx + 30, cu), cy = lerp(y + (V ? 260 : 210), y + 12, cu) + 30 * E.inOut(seg(t, T.click + 0.25, T.click + 0.8));
    drawCursor(cx, cy, 1 - 0.15 * pulse(t, T.click - 0.06, 0.2));
  }
}

function drawEnd(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
  overlay();
  ctx.fillStyle = 'rgba(217,119,87,0.10)';
  const off = (t * 10) % 48;
  for (let x = -VW / 2 - 48; x < VW / 2 + 48; x += 48)
    for (let y = -VH / 2; y < VH / 2 + 48; y += 48) { circ(x + off, y, 2.2); ctx.fill(); }
  const L = V ? { sp: -380, ti: -150, tg: -45, cm: 70, sb: 250 } : { sp: -235, ti: -35, tg: 66, cm: 160, sb: 318 };
  const sp = seg(t, T.end + 0.05, T.end + 0.5);
  const wave = t > 26.6 && t < 27.5 ? Math.sin((t - 26.6) * 11) * 0.22 * (1 - seg(t, 26.6, 27.5)) : 0;
  const halo = ctx.createRadialGradient(0, L.sp, 0, 0, L.sp, 240);
  halo.addColorStop(0, hexA(C.orange, 0.22 * sp)); halo.addColorStop(1, hexA(C.orange, 0));
  ctx.fillStyle = halo; ctx.fillRect(-240, L.sp - 240, 480, 480);
  drawSpark(0, L.sp + Math.sin(t * 3) * 8, 1.35 * E.outBack(sp), { t, rot: Math.sin(t * 1.3) * 0.1, tilt: wave, expr: 'happy', blink: blinkAt(t, [27.9, 29.1]) });
  setFont(900, V ? 112 : 128);
  const full = 'Claude Code', fw = ctx.measureText(full).width, s = typed(TY3, t), sw = ctx.measureText(s).width;
  ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(s, -fw / 2, L.ti);
  const lastKey = TY3.k[TY3.k.length - 1];
  if (t >= T.endIris1 - 0.1 && t < T.cmd0 && (t < lastKey + 0.05 || Math.floor(t * 2.5) % 2 === 0)) {
    ctx.fillStyle = C.orange; ctx.fillRect(-fw / 2 + sw + 8, L.ti - (V ? 50 : 56), V ? 10 : 12, V ? 100 : 112);
  }
  const tp = E.out(seg(t, T.tag0, T.tag0 + 0.4));
  if (tp > 0) {
    ctx.save(); ctx.globalAlpha = tp;
    setFont(700, V ? 48 : 46); ctx.fillStyle = '#5E5852'; ctx.textAlign = 'center';
    ctx.fillText('버그는 맡기고, 잠은 자자.', 0, L.tg + (1 - tp) * 20);
    ctx.restore();
  }
  const cp = E.outBack(seg(t, T.cmd0, T.cmd0 + 0.35));
  if (cp > 0) {
    ctx.save(); ctx.translate(0, L.cm); ctx.scale(cp, cp);
    setFont(700, V ? 40 : 38, MONO);
    const w1 = ctx.measureText('$ ').width, w2 = ctx.measureText('claude').width;
    const pw = w1 + w2 + 70, ph = V ? 80 : 76;
    ctx.fillStyle = C.ink; rr(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = C.orange; ctx.fillText('$ ', -pw / 2 + 35, 2);
    ctx.fillStyle = C.cream; ctx.fillText('claude', -pw / 2 + 35 + w1, 2);
    ctx.restore();
  }
  drawSubscribe(t, L.sb);
}

// ---------- overlays ----------
function drawWarp(t) {
  const a = Math.sin(PI * seg(t, 12.15, 12.95));
  if (a <= 0) return;
  overlay();
  const r = rng(5);
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const ang = r() * TAU, sp = 1.2 + r() * 1.6, off = r(), lw = 2 + r() * 3, ln = 60 + r() * 200;
    const d = (t * sp + off) % 1;
    const d0 = 80 + d * 1100, len = ln * a * (0.4 + d);
    ctx.strokeStyle = i % 3 ? hexA(C.cream, 0.55 * a) : hexA(C.orange, 0.75 * a);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * d0, Math.sin(ang) * d0);
    ctx.lineTo(Math.cos(ang) * (d0 + len), Math.sin(ang) * (d0 + len));
    ctx.stroke();
  }
}
function iris(cx, cy, r) {
  overlay();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(-VW, -VH, 2 * VW, 2 * VH);
  ctx.arc(cx, cy, Math.max(0, r), 0, TAU, true);
  ctx.fill('evenodd');
}
function captions(t) {
  for (const [a, b, txt] of CAPS) {
    if (t < a || t > b) continue;
    const pin = seg(t, a, a + 0.25), pout = seg(t, b - 0.2, b);
    const alpha = E.out(pin) * (1 - pout);
    const y = (V ? -700 : 440) + (1 - E.out(pin)) * 20;
    const fs = V ? 66 : 56;
    const parts = txt.split('`').map((s, i) => ({ s, code: i % 2 === 1 }));
    let total = 0;
    for (const p of parts) { setFont(p.code ? 700 : 800, fs, p.code ? MONO : SANS); p.w = ctx.measureText(p.s).width; total += p.w; }
    overlay();
    ctx.save();
    ctx.globalAlpha = alpha;
    const ph = fs * 1.6, pw = total + fs * 1.3;
    ctx.fillStyle = 'rgba(10,11,22,0.78)'; rr(-pw / 2, y - ph / 2, pw, ph, ph / 2); ctx.fill();
    let x = -total / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const p of parts) {
      if (p.code) {
        setFont(700, fs, MONO);
        ctx.fillStyle = hexA(C.orange, 0.2); rr(x - 6, y - fs * 0.62, p.w + 12, fs * 1.24, 10); ctx.fill();
        ctx.fillStyle = C.orange;
      } else { setFont(800, fs); ctx.fillStyle = C.cream; }
      ctx.fillText(p.s, x, y + 3);
      x += p.w;
    }
    ctx.restore();
  }
}

// ---------- frame ----------
function frame(t) {
  ctx = mainCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (t < T.codeFade1 || (t >= T.flash1 && t < T.end)) drawRoom(t);
  if (t >= T.codeFade0 && t < T.flash1) {
    ctx = offCtx;
    drawCode(t);
    ctx = mainCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = t < T.codeFade1 ? E.inOut(seg(t, T.codeFade0, T.codeFade1)) : 1;
    ctx.drawImage(offCv, 0, 0);
    ctx.globalAlpha = 1;
  }
  if (t >= T.end) drawEnd(t);
  drawWarp(t);
  if (t >= T.flash0 && t < T.flash1 + 0.3) {
    const fl = t < T.flash1 ? seg(t, T.flash0, T.flash0 + 0.15) : 1 - seg(t, T.flash1, T.flash1 + 0.3);
    overlay(); ctx.fillStyle = `rgba(255,250,240,${fl})`; ctx.fillRect(-VW / 2, -VH / 2, VW, VH);
  }
  if (t >= T.iris0 && t < T.end) {
    const c = roomCam(t), sp = sparkRoom(t), p = toOverlay(c, sp.x, sp.y);
    iris(p.x, p.y, lerp(1700, 0, E.inOut(seg(t, T.iris0, T.iris1))));
  }
  if (t >= T.end && t < T.endIris1) iris(0, 0, lerp(0, 1700, E.out(seg(t, T.end, T.endIris1))));
  if (!IS_THUMB) captions(t);
  const fa = Math.max(1 - seg(t, 0, 0.45), seg(t, T.fade0, DUR));
  if (fa > 0) { overlay(); ctx.fillStyle = `rgba(0,0,0,${fa})`; ctx.fillRect(-VW / 2, -VH / 2, VW, VH); }
}

// ---------- thumbnail ----------
function drawThumb() {
  CAM_OVERRIDE = { x: -330, y: -95, z: 1.18 };
  IS_THUMB = true;
  frame(22.4);
  IS_THUMB = false;
  CAM_OVERRIDE = null;
  overlay();
  const lx = -VW / 2 + 70;
  const vg = ctx.createLinearGradient(-VW / 2, 0, 0, 0);
  vg.addColorStop(0, 'rgba(8,9,20,0.9)'); vg.addColorStop(1, 'rgba(8,9,20,0)');
  ctx.fillStyle = vg; ctx.fillRect(-VW / 2, -VH / 2, VW * 0.5, VH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  const line = (s, y, size, fill) => {
    setFont(900, size);
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#0A0B14'; ctx.strokeText(s, lx, y);
    ctx.fillStyle = fill; ctx.fillText(s, lx, y);
  };
  line('버그 47개', -110, 150, '#FFFFFF');
  line('자는 동안', 50, 132, C.orange);
  line('끝났다', 195, 132, C.orange);
  setFont(800, 44, MONO);
  ctx.fillStyle = '#F4EFE6'; ctx.fillText('$ claude', lx + 6, 310);
}

// ---------- audio cue export ----------
function cues() {
  const c = [];
  const add = (t, type, extra) => c.push(Object.assign({ t: +t.toFixed(4), type }, extra || {}));
  [0.55, 1.55, 2.55, 3.55].forEach(x => add(x, 'tick'));
  add(T.minuteFlip, 'flip');
  add(1.15, 'error');
  add(3.3, 'sigh');
  add(T.zoomIn0, 'whoosh', { dur: 0.6 });
  add(T.clear, 'blip', { f: 440 });
  TY1.k.forEach(k => add(k, 'key'));
  add(T.enter1, 'enter');
  add(T.welcome, 'chime');
  TY2.k.forEach(k => add(k, 'key'));
  add(T.enter2, 'enter');
  add(8.3, 'riser', { dur: 0.55 });
  add(T.pop, 'pop'); add(T.pop + 0.03, 'sparkle');
  add(9.45, 'boing'); add(10.15, 'blip', { f: 520 });
  add(11.35, 'snore');
  add(T.dive0 + 0.12, 'whoosh', { dur: 0.45 });
  add(11.8, 'riser', { dur: 0.75 });
  add(12.85, 'impact');
  for (let i = 0; i < 5; i++) add(12.8 + i * 0.09, 'blip', { f: 620 + i * 110 });
  VISITS.forEach(([, tv], i) => { add(tv - 0.3, 'zip', { up: i % 2 === 0 }); add(tv, 'scan'); });
  add(T.alert, 'alert');
  add(T.diffOpen0, 'whoosh', { dur: 0.35 });
  add(T.ring, 'ring');
  add(T.ins1, 'key'); add(T.ins2, 'key'); add(T.fixed, 'good');
  add(T.diffClose0, 'whoosh', { dur: 0.3 });
  TODOS.forEach(([, , b]) => add(b, 'check'));
  let prev = 47;
  for (let f = 0; f <= 200; f++) {
    const t = T.run0 + (f / 200) * (T.run1 - T.run0);
    const n = Math.round(47 * (1 - E.inOutQuad(seg(t, T.run0, T.run1))));
    if (n !== prev && n % 2 === 0) add(t, 'count', { k: 47 - n });
    prev = n;
  }
  add(T.passed, 'success');
  add(T.exit0, 'riser', { dur: 0.5 });
  add(T.flash1, 'hit');
  add(T.clockFlip, 'flip');
  add(T.pop2, 'pop'); add(T.pop2 + 0.05, 'ding');
  add(T.wake, 'bubblepop'); add(T.wake + 0.02, 'boing');
  add(T.joy + 0.05, 'confetti');
  add(22.05, 'blip', { f: 700 });
  add(T.hi0 + 0.1, 'whoosh', { dur: 0.3 });
  add(T.hiHit, 'clap');
  add(T.yawn0, 'yawn');
  add(T.press, 'click'); add(T.press + 0.02, 'crt');
  add(24.65, 'blip', { f: 600 });
  add(T.iris0, 'whoosh', { dur: 0.5 });
  add(T.end + 0.05, 'sting');
  TY3.k.forEach(k => add(k, 'keysoft'));
  add(T.tag0, 'blip', { f: 880 });
  add(T.cmd0, 'pop', { soft: true });
  add(T.sub0, 'whoosh', { dur: 0.3 });
  add(T.click, 'click');
  add(T.bell0, 'bell');
  return c.sort((a, b) => a.t - b.t);
}

// ---------- boot ----------
window.renderAt = t => frame(t);
window.renderThumb = () => drawThumb();
window.getCues = cues;
window.DUR = DUR;
(async () => {
  const faces = ['400 20px Pretendard', '700 20px Pretendard', '800 20px Pretendard', '900 20px Pretendard', '400 20px JBM', '700 20px JBM'];
  await Promise.all(faces.map(f => document.fonts.load(f, '가A')));
  await document.fonts.ready;
  window.READY = true;
  if (MODE === 'thumb') { drawThumb(); return; }
  if (MODE === 'preview') {
    document.body.classList.add('preview');
    let start = performance.now(), paused = false, pt = 0;
    cv.addEventListener('click', () => { paused = !paused; if (!paused) start = performance.now() - pt * 1000; });
    const loop = () => {
      if (!paused) pt = ((performance.now() - start) / 1000) % DUR;
      frame(pt);
      requestAnimationFrame(loop);
    };
    const tq = parseFloat(P.get('t'));
    if (!isNaN(tq)) { pt = tq; paused = true; start = performance.now() - pt * 1000; }
    loop();
  }
})();
