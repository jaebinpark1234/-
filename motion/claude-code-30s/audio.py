"""30초 영상용 음악과 효과음을 합성한다. 외부 음원 없이 numpy/scipy만 쓴다.

사용법: python3 audio.py cues.json out.wav
cues.json은 `node render.js cues`가 scene.js 타임라인에서 뽑아낸 효과음 목록이다.
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 30.0
N = int(SR * (DUR + 0.5))
rng = np.random.default_rng(1234)

music = np.zeros((2, N))
sfx = np.zeros((2, N))
rev_send = np.zeros((2, N))

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


def tt(dur):
    return np.arange(int(SR * dur)) / SR


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        f = [min(v, SR / 2 - 100) for v in f]
    else:
        f = min(f, SR / 2 - 100)
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def env_adsr(n, a, d, s, r, sus_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sus = max(0, n - a - d - r) if sus_len is None else int(sus_len * SR)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sus, s), np.linspace(s, 0, max(r, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def place(bus, x, t, gain=1.0, pan=0.0, send=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    st = x[:, : N - i] if x.ndim == 2 else np.stack([x[: N - i] * l, x[: N - i] * r])
    st = st * gain
    n = st.shape[1]
    bus[:, i:i + n] += st
    if send:
        rev_send[:, i:i + n] += st * send


def noise(dur):
    return rng.standard_normal(int(SR * dur))


# ---------------- 악기 ----------------
def pad(freqs, dur, bright=1400):
    t = tt(dur)
    out = np.zeros((2, len(t)))
    for f in freqs:
        for ch, det in ((0, -0.006), (1, 0.006)):
            for d in (det, -det * 0.5):
                ph = rng.random()
                out[ch] += 2 * ((f * (1 + d) * t + ph) % 1) - 1
    out = np.stack([filt(out[0], 'low', bright), filt(out[1], 'low', bright)])
    e = env_adsr(len(t), 0.5, 0.2, 0.85, 0.7)
    return out * e / (len(freqs) * 3)


def pluck(f, dur=0.5, decay=3.0, harm=8):
    t = tt(dur)
    x = np.zeros_like(t)
    for k in range(1, harm + 1):
        x += np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (decay + k * 2.2))
    x *= np.minimum(1, t * 400)
    return x


def tine(f, dur=1.4):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.5)
    x += 0.35 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 7)
    x += 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    return x * np.minimum(1, t * 600)


def bass(f, dur):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.35 * filt(2 * ((f * t) % 1) - 1, 'low', 500)
    return x * env_adsr(len(t), 0.005, 0.08, 0.7, 0.06)


def kick(g=1.0):
    t = tt(0.4)
    f = 45 + 85 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    x[:200] += noise(200 / SR) * np.linspace(0.4, 0, 200)
    return x * g


def clap():
    t = tt(0.3)
    n = filt(noise(0.3), 'band', [900, 3200])
    e = np.zeros_like(t)
    for off in (0, 0.011, 0.022):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) * (60 if off < 0.02 else 14))
    return n * e * 0.6


def hat(open_=False):
    d = 0.25 if open_ else 0.05
    t = tt(d)
    return filt(noise(d), 'high', 7000) * np.exp(-t * (12 if open_ else 70)) * 0.5


def crash():
    t = tt(2.0)
    return filt(noise(2.0), 'high', 3500) * np.exp(-t * 2.2) * 0.5


# ---------------- 음악 ----------------
def chord(names):
    return [hz(n) for n in names]


B0 = 8.85        # 경쾌한 파트가 시작되는 마디 (스파크 등장)
BAR = 2.0        # 120 BPM, 4/4
STEP = BAR / 16  # 16분음표

# 파트 A: 새벽, 고요하고 쓸쓸하게
place(music, pad(chord(['A2', 'E3', 'A3', 'C4', 'E4']), 4.7, 900), 0.0, 0.55, 0, 0.3)
place(music, pad(chord(['F2', 'C3', 'F3', 'A3', 'E4']), 2.6, 1000), 4.45, 0.5, 0, 0.3)
place(music, pad(chord(['G2', 'D3', 'G3', 'B3', 'F4']), 2.2, 1100), 6.85, 0.5, 0, 0.3)
for t0, n in [(0.55, 'E5'), (1.55, 'C5'), (2.55, 'A4'), (3.55, 'B4'), (4.05, 'G4'), (4.55, 'A4')]:
    place(music, tine(hz(n)), t0, 0.22, 0.15, 0.5)
for i, n in enumerate(['F3', 'A3', 'C4', 'E4', 'F3', 'A3', 'C4', 'E4', 'G3', 'B3', 'D4', 'F4', 'G3', 'B3', 'D4', 'G4']):
    place(music, pluck(hz(n), 0.6, 4), 5.0 + i * 0.25, 0.13, -0.2 + 0.4 * (i % 2), 0.4)

# 파트 B: 스파크 등장부터 성공까지 6마디
PROG = [
    ['C3', 'E3', 'G3', 'C4'],
    ['G2', 'D3', 'G3', 'B3'],
    ['A2', 'E3', 'A3', 'C4'],
    ['F2', 'C3', 'F3', 'Ab3'],   # Fm: 버그 발견 긴장
    ['C3', 'E3', 'G3', 'C4'],    # 수정 순간 해결
    ['G2', 'D3', 'G3', 'B3'],
]
ARP = [0, 1, 2, 3, 2, 1, 2, 3]
for b, ch in enumerate(PROG):
    t0 = B0 + b * BAR
    f = chord(ch)
    place(music, pad([x * 2 for x in f], BAR + 0.3, 1800), t0, 0.32, 0, 0.25)
    root = f[0] / 2
    for s in range(16):
        ts = t0 + s * STEP
        beat = s // 4
        tension = b == 3 and ts >= 15.05
        # 베이스
        if s % 2 == 0 and not tension:
            place(music, bass(root * (2 if s % 4 == 2 else 1), STEP * 1.8), ts, 0.38)
        if tension and s == 2:
            place(music, bass(root, BAR - 0.3), ts, 0.38)
        # 아르페지오
        if b >= 2 and not (tension and s % 2):
            place(music, pluck(f[ARP[s % 8]] * 2, 0.35, 6), ts, 0.16, -0.35 if s % 2 else 0.35, 0.35)
        elif b < 2 and s % 2 == 0:
            place(music, pluck(f[ARP[(s // 2) % 8]] * 2, 0.4, 5), ts, 0.13, -0.3 if s % 4 else 0.3, 0.35)
        # 드럼
        if not tension:
            if (b < 2 and s % 8 == 0) or (b >= 2 and s % 4 == 0):
                place(music, kick(), ts, 0.85)
            if s % 8 == 4:
                place(music, clap(), ts, 0.5, 0.05, 0.3)
            if (b >= 2 and True) or s % 2 == 0:
                place(music, hat(s % 4 == 2 and b >= 2), ts, 0.16 if s % 2 == 0 else 0.1, 0.4)
        elif s % 2 == 0:
            place(music, hat(), ts, 0.14, 0.4)
    if b == 4:
        place(music, crash(), t0, 0.5, -0.2, 0.3)
# 마지막 박의 스네어 롤
for i in range(12):
    ts = B0 + 5 * BAR + 1.25 + i * 0.0625
    place(music, clap(), ts, 0.18 + 0.03 * i, 0.0, 0.2)

# 파트 C: 성공, 하이파이브, 불 끄기 전까지
B1 = 20.85
for b, ch in enumerate([['C3', 'E3', 'G3', 'C4'], ['F2', 'C3', 'F3', 'A3']]):
    t0 = B1 + b * BAR
    f = chord(ch)
    place(music, pad([x * 2 for x in f], BAR + 0.3, 2200), t0, 0.32, 0, 0.25)
    for s in range(16):
        ts = t0 + s * STEP
        if ts >= 24.2:
            break
        quiet = ts >= 23.6
        g = 0.45 if quiet else 1.0
        if s % 2 == 0:
            place(music, bass(f[0] / 2 * (2 if s % 4 == 2 else 1), STEP * 1.8), ts, 0.36 * g)
        place(music, pluck(f[ARP[s % 8]] * 4, 0.3, 7), ts, 0.13 * g, -0.35 if s % 2 else 0.35, 0.35)
        if not quiet:
            if s % 4 == 0:
                place(music, kick(), ts, 0.85)
            if s % 8 == 4:
                place(music, clap(), ts, 0.5, 0.05, 0.3)
            place(music, hat(s % 4 == 2), ts, 0.15 if s % 2 == 0 else 0.09, 0.4)
place(music, crash(), B1, 0.7, 0.2, 0.3)

# 불 끈 뒤 자장가
place(music, pad(chord(['C3', 'G3', 'C4', 'E4', 'B4']), 2.0, 700), 24.2, 0.3, 0, 0.5)
for t0, n in [(24.45, 'G5'), (24.75, 'E5'), (25.05, 'C5'), (25.35, 'D5'), (25.65, 'C5')]:
    place(music, tine(hz(n), 1.6), t0, 0.2, 0.1, 0.6)

# 파트 D: 엔딩 카드
for i, n in enumerate(['C5', 'E5', 'G5', 'C6', 'E6', 'G6']):
    place(music, tine(hz(n), 1.5), 26.05 + i * 0.06, 0.18, -0.3 + 0.12 * i, 0.5)
END = [(26.05, ['C3', 'G3', 'C4', 'E4']), (26.85, ['F2', 'C3', 'F3', 'A3']), (27.85, ['G2', 'D3', 'G3', 'B3']), (28.85, ['C3', 'G3', 'C4', 'E4'])]
for k, (t0, ch) in enumerate(END):
    dur = (END[k + 1][0] if k + 1 < len(END) else 30.0) - t0
    f = chord(ch)
    place(music, pad([x * 2 for x in f], dur + 0.4, 1600), t0, 0.3, 0, 0.3)
    for s in range(int(dur / STEP)):
        ts = t0 + s * STEP
        if ts > 29.5:
            break
        if s % 2 == 0:
            place(music, pluck(f[ARP[(s // 2) % 8]] * 2, 0.4, 5), ts, 0.12, -0.3 if s % 4 else 0.3, 0.4)
        if t0 >= 26.85:
            if s % 8 == 0:
                place(music, kick(0.7), ts, 0.6)
            if s % 2 == 0:
                place(music, hat(), ts, 0.1, 0.4)
    if t0 >= 26.85:
        place(music, bass(f[0] / 2, min(dur, 1.0)), t0, 0.32)


# ---------------- 효과음 ----------------
def s_tick():
    t = tt(0.04)
    return (np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 180) + filt(noise(0.04), 'high', 4000) * np.exp(-t * 300) * 0.4) * 0.5


def s_key(soft=False):
    d = 0.06
    t = tt(d)
    f = 150 + rng.random() * 60
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * 0.7
    x += filt(noise(d), 'band', [1800 + rng.random() * 800, 6000]) * np.exp(-t * 220)
    return x * (0.35 if soft else 0.6)


def s_enter():
    t = tt(0.12)
    x = np.sin(2 * np.pi * 110 * t) * np.exp(-t * 40)
    x += filt(noise(0.12), 'band', [1000, 5000]) * np.exp(-t * 120) * 1.2
    return x * 0.8


def s_whoosh(dur=0.5):
    n = noise(dur)
    t = tt(dur)
    fc = 400 + 3000 * np.sin(np.pi * t / dur) ** 2
    out = np.zeros_like(n)
    for a, b in ((0, 0.33), (0.33, 0.66), (0.66, 1.0)):
        i0, i1 = int(a * len(n)), int(b * len(n))
        f0 = fc[(i0 + i1) // 2]
        out[i0:i1] = filt(n, 'band', [f0 * 0.6, f0 * 1.6])[i0:i1]
    return out * np.sin(np.pi * t / dur) ** 2 * 0.5


def s_blip(f=880):
    t = tt(0.1)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 35) * 0.45


def s_chime():
    return tine(hz('E6'), 0.9) * 0.4 + np.pad(tine(hz('B6'), 0.9) * 0.35, (int(0.08 * SR), 0))[: int(0.9 * SR)]


def s_riser(dur=0.6):
    t = tt(dur)
    f = 200 + 1600 * (t / dur) ** 2
    x = (2 * ((np.cumsum(f) / SR) % 1) - 1) * 0.2
    x = filt(x, 'low', 3000) + filt(noise(dur), 'high', 2000) * (t / dur) * 0.25
    return x * (t / dur) ** 1.5 * 0.8


def s_pop():
    t = tt(0.12)
    f = 300 + 1100 * (1 - np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.8


def s_sparkle():
    out = np.zeros(int(0.5 * SR))
    for i in range(7):
        x = tine(2000 + rng.random() * 3000, 0.3) * 0.12
        i0 = int(i * 0.05 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_boing():
    t = tt(0.35)
    f = 320 + 120 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 8)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.45


def s_snore():
    t = tt(0.9)
    x = filt(noise(0.9), 'band', [150, 600]) * np.sin(np.pi * t / 0.9) ** 2
    return x * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t)) * 0.25


def s_impact():
    t = tt(0.9)
    f = 40 + 80 * np.exp(-t * 10)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4)
    x += filt(noise(0.9), 'low', 1500) * np.exp(-t * 12) * 0.5
    return x * 0.9


def s_zip(up=True):
    t = tt(0.16)
    f = (600 + 1600 * t / 0.16) if up else (2200 - 1600 * t / 0.16)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.16) * 0.18


def s_scan():
    t = tt(0.25)
    return np.sin(2 * np.pi * 1600 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * t)) * np.exp(-t * 10) * 0.12


def s_alert():
    out = np.zeros(int(0.45 * SR))
    for i, f in enumerate((880, 660)):
        t = tt(0.16)
        x = np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 10) * 0.18
        x = filt(x, 'low', 4000)
        i0 = int(i * 0.17 * SR)
        out[i0:i0 + len(x)] += x
    return out


def s_error():
    out = np.zeros(int(0.6 * SR))
    for i, f in enumerate((233, 220)):
        t = tt(0.25)
        x = (np.sign(np.sin(2 * np.pi * f * t)) + np.sign(np.sin(2 * np.pi * f * 1.01 * t))) * 0.5
        x = filt(x, 'low', 1800) * env_adsr(len(t), 0.005, 0.05, 0.6, 0.08) * 0.22
        i0 = int(i * 0.22 * SR)
        out[i0:i0 + len(x)] += x
    return out


def s_sigh():
    t = tt(0.9)
    f = 330 * np.exp(-t * 0.9) * (1 + 0.02 * np.sin(2 * np.pi * 6 * t))
    x = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR))
    return filt(x, 'low', 1200) * env_adsr(len(t), 0.05, 0.1, 0.8, 0.4) * 0.22


def s_ring():
    t = tt(0.5)
    return (np.sin(2 * np.pi * 1320 * t) + 0.5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t * 9) * 0.25


def s_good():
    return np.concatenate([tine(hz('C6'), 0.12) * 0.35, tine(hz('G6'), 0.7) * 0.35])


def s_check():
    t = tt(0.12)
    return (np.sin(2 * np.pi * 1760 * t) + 0.6 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 40) * 0.28


def s_count(k=0):
    t = tt(0.05)
    f = 520 * 2 ** (k / 47 * 1.6)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 60) * 0.22


def s_success():
    out = np.zeros(int(1.2 * SR))
    for i, n in enumerate(['C6', 'E6', 'G6', 'C7']):
        x = tine(hz(n), 1.0) * 0.28
        i0 = int(i * 0.07 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_hit():
    return crash() * 0.6 + np.pad(kick() * 0.8, (0, int(2.0 * SR) - int(0.4 * SR)))


def s_ding():
    t = tt(1.6)
    f = hz('C6')
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7)
    return x * np.minimum(1, t * 800) * 0.4


def s_bubblepop():
    t = tt(0.05)
    f = 800 + 1600 * t / 0.05
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 60) * 0.4


def s_confetti():
    out = filt(noise(0.15), 'band', [500, 5000]) * np.exp(-tt(0.15) * 30) * 0.7
    out = np.pad(out, (0, int(0.85 * SR)))
    for _ in range(40):
        i0 = int(rng.random() ** 1.5 * 0.9 * SR)
        x = filt(noise(0.008), 'high', 3000) * np.exp(-tt(0.008) * 500) * 0.25
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_clap():
    return (clap() * 1.6 + np.pad(filt(noise(0.04), 'low', 800) * np.exp(-tt(0.04) * 80), (0, int(0.26 * SR)))[: int(0.3 * SR)]) * 0.9


def s_yawn():
    t = tt(0.6)
    x = filt(noise(0.6), 'band', [300, 1400])
    return x * np.sin(np.pi * t / 0.6) ** 2 * 0.12


def s_click():
    out = np.zeros(int(0.08 * SR))
    for off in (0, 0.03):
        x = filt(noise(0.012), 'band', [2000, 7000]) * np.exp(-tt(0.012) * 400) * 0.6
        i0 = int(off * SR)
        out[i0:i0 + len(x)] += x
    return out


def s_crt():
    t = tt(0.3)
    f = 6000 * np.exp(-t * 18) + 120
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) * 0.12
    x += np.sin(2 * np.pi * 60 * t) * np.exp(-t * 14) * 0.5
    return x


def s_bell():
    out = np.zeros(int(1.4 * SR))
    for i in range(3):
        x = (tine(hz('E6'), 0.7) * 0.25 + tine(hz('C7'), 0.7) * 0.2) * (1 - i * 0.25)
        i0 = int(i * 0.14 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


FX = {
    'tick': (lambda c: s_tick(), 0.5, 0.3, 0.1),
    'flip': (lambda c: s_tick(), 0.8, 0.3, 0.1),
    'error': (lambda c: s_error(), 0.8, 0.0, 0.2),
    'sigh': (lambda c: s_sigh(), 0.8, -0.2, 0.3),
    'whoosh': (lambda c: s_whoosh(c.get('dur', 0.5)), 0.9, 0.0, 0.2),
    'blip': (lambda c: s_blip(c.get('f', 880)), 0.7, 0.1, 0.3),
    'key': (lambda c: s_key(), 0.8, 0.0, 0.05),
    'keysoft': (lambda c: s_key(True), 0.6, 0.0, 0.1),
    'enter': (lambda c: s_enter(), 0.8, 0.0, 0.1),
    'chime': (lambda c: s_chime(), 0.8, 0.1, 0.4),
    'riser': (lambda c: s_riser(c.get('dur', 0.6)), 0.8, 0.0, 0.3),
    'pop': (lambda c: s_pop() * (0.5 if c.get('soft') else 1), 0.9, 0.1, 0.2),
    'sparkle': (lambda c: s_sparkle(), 0.9, 0.2, 0.4),
    'boing': (lambda c: s_boing(), 0.8, 0.1, 0.2),
    'snore': (lambda c: s_snore(), 0.9, -0.3, 0.2),
    'impact': (lambda c: s_impact(), 0.9, 0.0, 0.3),
    'zip': (lambda c: s_zip(c.get('up', True)), 0.9, 0.0, 0.2),
    'scan': (lambda c: s_scan(), 0.8, 0.0, 0.2),
    'alert': (lambda c: s_alert(), 0.9, 0.0, 0.2),
    'ring': (lambda c: s_ring(), 0.8, 0.0, 0.3),
    'good': (lambda c: s_good(), 0.9, 0.0, 0.4),
    'check': (lambda c: s_check(), 0.8, 0.3, 0.2),
    'count': (lambda c: s_count(c.get('k', 0)), 0.8, 0.0, 0.1),
    'success': (lambda c: s_success(), 0.9, 0.0, 0.4),
    'hit': (lambda c: s_hit(), 0.6, 0.0, 0.3),
    'ding': (lambda c: s_ding(), 0.9, 0.1, 0.4),
    'bubblepop': (lambda c: s_bubblepop(), 0.8, -0.3, 0.1),
    'confetti': (lambda c: s_confetti(), 0.9, 0.1, 0.3),
    'clap': (lambda c: s_clap(), 1.0, -0.2, 0.4),
    'yawn': (lambda c: s_yawn(), 0.8, -0.3, 0.2),
    'click': (lambda c: s_click(), 0.9, 0.2, 0.2),
    'crt': (lambda c: s_crt(), 0.9, 0.0, 0.2),
    'sting': (lambda c: s_sparkle(), 0.8, 0.0, 0.4),
    'bell': (lambda c: s_bell(), 0.9, 0.2, 0.4),
}


def main():
    cues = json.load(open(sys.argv[1]))
    for c in cues:
        if c['type'] not in FX:
            print('unknown cue', c['type'])
            continue
        fn, g, pan, send = FX[c['type']]
        place(sfx, fn(c), c['t'], g, pan, send)

    # 리버브: 지수 감쇠 노이즈 임펄스
    ir_t = tt(1.4)
    ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))]) * np.exp(-ir_t * 4.0)
    ir = np.stack([filt(ir[0], 'low', 6000), filt(ir[1], 'low', 6000)]) * 0.03
    wet = np.stack([fftconvolve(rev_send[i], ir[i])[:N] for i in range(2)])

    mix = music * 0.55 + sfx * 0.9 + wet
    # 앞뒤 페이드: 시작 0.3초, 끝 29.55~30초
    t = np.arange(N) / SR
    fade = np.clip(t / 0.3, 0, 1) * np.clip((30.0 - t) / 0.45, 0, 1)
    mix *= fade
    mix = np.tanh(mix * 1.1) / 1.1
    peak = np.max(np.abs(mix))
    mix = mix / peak * 0.89
    out = (mix.T[: int(SR * DUR)] * 32767).astype(np.int16)
    wavfile.write(sys.argv[2], SR, out)
    print('wrote', sys.argv[2], 'peak', peak)


if __name__ == '__main__':
    main()
