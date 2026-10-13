"""Score and sound effects for "Bug Hunt", synthesized from scratch (numpy + scipy).

usage: python3 audio.py cues.json out.wav
cues.json comes from `node render.js cues cues.json` and holds the SFX timings from scene.js.
The music runs at 96 BPM (bar = 2.5 s) so its sections line up with the scene timeline.
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * (DUR + 0.5))
rng = np.random.default_rng(7)
music = np.zeros((2, N))
sfx = np.zeros((2, N))
send = np.zeros((2, N))

BAR = 2.5
STEP = BAR / 16
BEAT = BAR / 4
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(n):
    return 440.0 * 2 ** ((NOTE[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


def tt(d):
    return np.arange(int(SR * d)) / SR


def filt(x, kind, f, order=2):
    f = [min(v, SR / 2 - 100) for v in f] if isinstance(f, (list, tuple)) else min(f, SR / 2 - 100)
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def noise(d):
    return rng.standard_normal(int(SR * d))


def env(n, a, d, s, r):
    a, d, r = max(1, int(a * SR)), max(1, int(d * SR)), max(1, int(r * SR))
    sus = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a), np.linspace(1, s, d), np.full(sus, s), np.linspace(s, 0, r)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def place(bus, x, t, gain=1.0, pan=0.0, rev=0.0):
    i = int(t * SR)
    if i < 0 or i >= N:
        return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    st = x[:, : N - i] if x.ndim == 2 else np.stack([x[: N - i] * l, x[: N - i] * r])
    st = st * gain
    n = st.shape[1]
    bus[:, i:i + n] += st
    if rev:
        send[:, i:i + n] += st * rev


# ---------------- instruments ----------------
def ep(f, d, bright=1.0):
    """soft electric piano: sine + a little FM bell on the attack"""
    t = tt(d)
    mod = np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 18) * 1.4 * bright
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.1) + 0.25 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3)
    return x * env(len(t), 0.004, 0.2, 0.8, 0.25)


def marimba(f, d=0.6):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.4 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 22)
    return x * np.minimum(1, t * 900)


def pluck(f, d=0.5, decay=3.0, harm=8):
    t = tt(d)
    x = sum(np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (decay + k * 2.2)) for k in range(1, harm + 1))
    return x * np.minimum(1, t * 500)


def pizz(f, d=0.35):
    t = tt(d)
    x = sum(np.sin(2 * np.pi * f * k * t) / (k ** 1.3) * np.exp(-t * (9 + k * 4)) for k in range(1, 7))
    return x * np.minimum(1, t * 800)


def tine(f, d=1.4):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.5) + 0.35 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 7)
    x += 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    return x * np.minimum(1, t * 600)


def bass(f, d):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.3 * filt(2 * ((f * t) % 1) - 1, 'low', 600)
    return x * env(len(t), 0.005, 0.08, 0.7, 0.05)


def pad(freqs, d, cutoff=1300):
    t = tt(d)
    out = np.zeros((2, len(t)))
    for f in freqs:
        for ch, det in ((0, -0.005), (1, 0.005)):
            for dd in (det, -det * 0.6):
                out[ch] += 2 * ((f * (1 + dd) * t + rng.random()) % 1) - 1
    out = np.stack([filt(out[0], 'low', cutoff), filt(out[1], 'low', cutoff)])
    return out * env(len(t), 0.5, 0.3, 0.8, 0.8) / (len(freqs) * 4)


def kick(g=1.0):
    t = tt(0.35)
    f = 48 + 80 * np.exp(-t * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    return x * g


def snare():
    t = tt(0.22)
    return (filt(noise(0.22), 'band', [1500, 6000]) * np.exp(-t * 22) * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4)


def rim():
    t = tt(0.06)
    return (np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90) + filt(noise(0.06), 'band', [2000, 5000]) * np.exp(-t * 120) * 0.4) * 0.5


def shaker():
    t = tt(0.07)
    return filt(noise(0.07), 'high', 6000) * np.sin(np.pi * t / 0.07) ** 2 * 0.3


def hat():
    t = tt(0.05)
    return filt(noise(0.05), 'high', 7500) * np.exp(-t * 70) * 0.4


def crash():
    t = tt(2.0)
    return filt(noise(2.0), 'high', 3500) * np.exp(-t * 2.4) * 0.45


def chord(names):
    return [hz(n) for n in names]


ARP = [0, 1, 2, 3, 2, 1, 2, 3]


def bar_t(b):
    return b * BAR


# ---------------- score ----------------
# bars 0-1: intro (EP chords + marimba motif)
for b, ch in [(0, ['C3', 'E3', 'G3', 'B3']), (1, ['A2', 'E3', 'G3', 'C4'])]:
    for f in chord(ch):
        place(music, ep(f, BAR + 0.4), bar_t(b), 0.11, rng.uniform(-0.3, 0.3), 0.4)
for t0, n in [(0.625, 'E5'), (0.9375, 'G5'), (1.25, 'C6'), (3.125, 'B5'), (3.4375, 'A5'), (3.75, 'E5'), (4.375, 'G5')]:
    place(music, marimba(hz(n)), t0, 0.16, 0.2, 0.4)

# bars 2-5: reading groove
READ = [['C3', 'E3', 'G3', 'C4'], ['G2', 'D3', 'G3', 'B3'], ['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3']]
for j, ch in enumerate(READ):
    b = 2 + j
    t0 = bar_t(b)
    f = chord(ch)
    for x in f[1:]:
        place(music, ep(x, BAR + 0.3, 0.7), t0, 0.08, rng.uniform(-0.4, 0.4), 0.35)
    for s in range(16):
        ts = t0 + s * STEP
        if s % 8 == 0:
            place(music, kick(0.7), ts, 0.7)
        if s % 8 == 4:
            place(music, rim(), ts, 0.6, 0.1, 0.2)
        if s % 2 == 0:
            place(music, shaker(), ts, 0.5 if s % 4 else 0.3, 0.35)
            place(music, marimba(f[ARP[(s // 2) % 8]] * 2, 0.4), ts, 0.13, -0.25 if s % 4 else 0.25, 0.3)
        if s in (0, 6, 8, 14):
            place(music, bass(f[0] / 2 if s < 8 else f[0], STEP * 1.6), ts, 0.32)

# bars 6-8: sneaky pizzicato in A minor
SNEAK = [['A2', 'C3', 'E3', 'C3'], ['D3', 'F3', 'A3', 'F3'], ['E2', 'G#2', 'B2', 'D3']]
for j, notes in enumerate(SNEAK):
    t0 = bar_t(6 + j)
    for k, n in enumerate(notes):
        place(music, pizz(hz(n)), t0 + k * BEAT, 0.42, -0.1, 0.25)
        place(music, pizz(hz(n) * 2, 0.2), t0 + k * BEAT + BEAT / 2, 0.12, 0.3, 0.3)
    for s in range(0, 16, 2):
        place(music, shaker(), t0 + s * STEP, 0.25, 0.4)
    place(music, tine(hz(['E6', 'F6', 'E6'][j]), 1.0), t0 + BEAT * 3.5, 0.06, 0.4, 0.6)
place(music, pad(chord(['A3', 'C4', 'E4']), 7.5, 900), bar_t(6), 0.25, 0, 0.3)

# bars 9-10: chase
t0 = bar_t(9)
for s in range(32):
    ts = t0 + s * STEP
    if ts >= 26.25:
        break
    root = hz('A2') if s < 16 else hz('C3')
    place(music, bass(root * (2 if s % 4 == 2 else 1), STEP * 0.9), ts, 0.4)
    if s % 4 == 0:
        place(music, kick(), ts, 0.85)
    if s % 8 == 4:
        place(music, snare(), ts, 0.7, 0.05, 0.25)
    place(music, hat(), ts, 0.22 if s % 2 else 0.35, 0.4)
    run = ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5']
    place(music, pluck(hz(run[s % 8]), 0.25, 8), ts, 0.12, -0.3 if s % 2 else 0.3, 0.25)
place(music, crash(), 26.25, 0.6, 0.0, 0.3)
place(music, kick(), 26.25, 0.9)

# bars 11-14: fix groove in C
FIX = [['F2', 'C3', 'F3', 'A3'], ['G2', 'D3', 'G3', 'B3'], ['C3', 'E3', 'G3', 'C4'], ['C3', 'E3', 'G3', 'B3']]
for j, ch in enumerate(FIX):
    t0 = bar_t(11 + j)
    f = chord(ch)
    place(music, pad([x * 2 for x in f], BAR + 0.4, 1500), t0, 0.22, 0, 0.3)
    for s in range(16):
        ts = t0 + s * STEP
        if s % 4 == 0:
            place(music, kick(0.8), ts, 0.7)
        if s % 8 == 4:
            place(music, snare(), ts, 0.45, 0.05, 0.25)
        if s % 2 == 0:
            place(music, hat(), ts, 0.22, 0.4)
            place(music, bass(f[0] / 2 * (2 if s % 4 == 2 else 1), STEP * 1.7), ts, 0.3)
        if j >= 2 and s % 2 == 0:
            place(music, marimba(f[ARP[(s // 2) % 8]] * 4, 0.35), ts, 0.1, -0.3 if s % 4 else 0.3, 0.3)
place(music, crash(), 32.5, 0.4, 0.2, 0.3)

# bars 15-18: tests (Am, F, Fm tension, C payoff)
TEST = [['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3'], ['F2', 'C3', 'F3', 'Ab3'], ['C3', 'E3', 'G3', 'C4']]
for j, ch in enumerate(TEST):
    t0 = bar_t(15 + j)
    f = chord(ch)
    place(music, pad([x * 2 for x in f], BAR + 0.4, 1400 if j < 3 else 2200), t0, 0.24, 0, 0.3)
    for s in range(16):
        ts = t0 + s * STEP
        tense = j == 2
        if not tense and s % 4 == 0:
            place(music, kick(0.8), ts, 0.7)
        if not tense and s % 8 == 4:
            place(music, snare(), ts, 0.45, 0.05, 0.25)
        if s % 2 == 0:
            place(music, hat(), ts, 0.18 if not tense else 0.12, 0.4)
        if s % 2 == 0 and not tense:
            place(music, bass(f[0] / 2 * (2 if s % 4 == 2 else 1), STEP * 1.7), ts, 0.3)
        if tense and s == 0:
            place(music, bass(f[0] / 2, BAR - 0.1), ts, 0.32)
place(music, crash(), 45.0, 0.6, -0.2, 0.3)

# bars 19-21: ship (F, G, C)
SHIP = [['F2', 'C3', 'F3', 'A3'], ['G2', 'D3', 'G3', 'B3'], ['C3', 'E3', 'G3', 'C4']]
for j, ch in enumerate(SHIP):
    t0 = bar_t(19 + j)
    f = chord(ch)
    place(music, pad([x * 2 for x in f], BAR + 0.5, 1800), t0, 0.22, 0, 0.35)
    for s in range(16):
        ts = t0 + s * STEP
        if s % 8 == 0:
            place(music, kick(0.7), ts, 0.6)
        if s % 8 == 4:
            place(music, rim(), ts, 0.5, 0.1, 0.2)
        if s % 2 == 0:
            place(music, shaker(), ts, 0.35, 0.35)
            place(music, pluck(f[ARP[(s // 2) % 8]] * 4, 0.35, 6), ts, 0.11, -0.3 if s % 4 else 0.3, 0.35)
        if s in (0, 8):
            place(music, bass(f[0] / 2, STEP * 6), ts, 0.3)

# bars 22-23: lullaby
for f in chord(['C3', 'G3', 'D4', 'E4']):
    place(music, ep(f, 5.0, 0.4), bar_t(22), 0.1, rng.uniform(-0.3, 0.3), 0.5)
for t0, n in [(55.3, 'G5'), (55.94, 'E5'), (56.56, 'D5'), (57.19, 'C5'), (57.81, 'D5'), (58.44, 'C5')]:
    place(music, tine(hz(n), 1.6), t0, 0.14, 0.15, 0.6)


# ---------------- sound effects ----------------
def s_pencil(d=1.1):
    t = tt(d)
    x = filt(noise(d), 'band', [2500, 7000]) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * t)))
    return x * env(len(t), 0.05, 0.1, 0.8, 0.2) * 0.08


def s_skitter():
    t = tt(0.02)
    return filt(noise(0.02), 'band', [3000, 8000]) * np.exp(-t * 300) * 0.25


def s_peep():
    t = tt(0.16)
    f = 1800 + 900 * np.sin(np.pi * t / 0.16)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.16) * 0.18


def s_step():
    t = tt(0.12)
    return (np.sin(2 * np.pi * 90 * t) * np.exp(-t * 40) + filt(noise(0.12), 'low', 900) * np.exp(-t * 50) * 0.4) * 0.5


def s_land():
    t = tt(0.25)
    return (np.sin(2 * np.pi * 70 * t) * np.exp(-t * 18) + filt(noise(0.25), 'low', 700) * np.exp(-t * 25) * 0.5) * 0.7


def s_key():
    t = tt(0.05)
    f = 160 + rng.random() * 60
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * 0.6 + filt(noise(0.05), 'band', [2000, 7000]) * np.exp(-t * 220)) * 0.35


def s_task():
    return tine(hz('G5'), 0.5) * 0.18


def s_paper():
    d = 0.25
    t = tt(d)
    return filt(noise(d), 'band', [1200, 6000]) * np.sin(np.pi * t / d) ** 2 * 0.12


def s_thud():
    t = tt(0.08)
    return filt(noise(0.08), 'low', 1500) * np.exp(-t * 60) * 0.25


def s_poof():
    d = 0.5
    t = tt(d)
    return filt(noise(d), 'low', 1800) * np.exp(-t * 7) * 0.5


def s_idea():
    out = np.zeros(int(0.9 * SR))
    for i, n in enumerate(['C6', 'G6']):
        x = tine(hz(n), 0.8) * 0.2
        i0 = int(i * 0.1 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_check():
    t = tt(0.12)
    return (np.sin(2 * np.pi * 1760 * t) + 0.6 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 40) * 0.22


def s_pop():
    t = tt(0.1)
    f = 350 + 900 * (1 - np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * 0.5


def s_tiptoe():
    t = tt(0.05)
    return np.sin(2 * np.pi * 900 * t) * np.exp(-t * 120) * 0.15


def s_turn():
    d = 0.18
    t = tt(d)
    return filt(noise(d), 'band', [800, 3000]) * np.sin(np.pi * t / d) * 0.25


def s_bang():
    t = tt(0.5)
    out = np.zeros_like(t)
    for f in (hz('E4'), hz('G#4'), hz('B4')):
        out += filt(2 * ((f * 1.01 * t) % 1) - 1 + 2 * ((f * 0.99 * t) % 1) - 1, 'low', 2500)
    return out * env(len(t), 0.005, 0.1, 0.5, 0.25) * 0.09


def s_run():
    d = 0.6
    t = tt(d)
    fc = 600 + 2000 * t / d
    x = np.zeros_like(t)
    n = noise(d)
    for a, b in ((0, 0.5), (0.5, 1.0)):
        i0, i1 = int(a * len(t)), int(b * len(t))
        x[i0:i1] = filt(n, 'band', [fc[(i0 + i1) // 2] * 0.6, fc[(i0 + i1) // 2] * 1.5])[i0:i1]
    return x * np.sin(np.pi * t / d) ** 2 * 0.35


def s_skid():
    d = 0.5
    t = tt(d)
    f = 1400 - 800 * t / d
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 60 * t))
    return (x * 0.08 + filt(noise(d), 'band', [1500, 5000]) * 0.15) * np.sin(np.pi * t / d)


def s_fall():
    d = 0.3
    t = tt(d)
    f = 2200 - 1500 * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.12 * np.minimum(1, t * 20)


def s_jar():
    t = tt(0.9)
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, a, dcy in ((1320, 0.5, 6), (2210, 0.35, 8), (3480, 0.25, 11), (4700, 0.15, 14)))
    x += np.sin(2 * np.pi * 80 * t) * np.exp(-t * 20) * 0.8
    return x * 0.4


def s_rise():
    d = 0.4
    t = tt(d)
    f = 200 + 500 * t / d
    return filt(2 * ((np.cumsum(f) / SR) % 1) - 1, 'low', 1200) * np.sin(np.pi * t / d) * 0.12


def s_clank(up=0):
    t = tt(0.7)
    base = 620 * (1.12 if up else 1)
    x = sum(a * np.sin(2 * np.pi * base * r * t) * np.exp(-t * dcy) for r, a, dcy in ((1, 0.6, 7), (2.32, 0.4, 9), (4.25, 0.3, 12), (6.63, 0.2, 16)))
    x += filt(noise(0.7), 'band', [1500, 6000]) * np.exp(-t * 60) * 0.6
    return x * 0.45


def s_fixed():
    out = np.zeros(int(1.4 * SR))
    for i, n in enumerate(['C6', 'E6', 'G6', 'C7']):
        x = tine(hz(n), 1.1) * 0.2
        i0 = int(i * 0.07 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_phew():
    t = tt(0.6)
    f = 900 * np.exp(-t * 2)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.6) * 0.1


def s_sink():
    d = 0.4
    t = tt(d)
    f = 500 - 300 * t / d
    return filt(2 * ((np.cumsum(f) / SR) % 1) - 1, 'low', 1000) * np.sin(np.pi * t / d) * 0.1


def s_jingle():
    out = np.zeros(int(0.9 * SR))
    for i in range(6):
        x = tine(3000 + rng.random() * 2000, 0.4) * 0.07
        i0 = int(i * 0.05 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_button():
    t = tt(0.2)
    x = filt(noise(0.2), 'band', [1500, 5000]) * np.exp(-t * 200) * 0.6 + np.sin(2 * np.pi * 120 * t) * np.exp(-t * 30) * 0.6
    return x * 0.6


SCALE = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G6', 'C7']


def s_bulb(i=0):
    return tine(hz(SCALE[min(i, 12)]), 0.5) * 0.2


def s_buzz():
    t = tt(0.35)
    x = (np.sign(np.sin(2 * np.pi * 110 * t)) + np.sign(np.sin(2 * np.pi * 113 * t))) * 0.5
    return filt(x, 'low', 1800) * env(len(t), 0.005, 0.05, 0.7, 0.1) * 0.16


def s_flicker():
    out = np.zeros(int(0.8 * SR))
    for k in range(10):
        x = filt(noise(0.03), 'band', [2000, 8000]) * np.exp(-tt(0.03) * 150) * 0.2
        i0 = int(k * 0.08 * SR)
        out[i0:i0 + len(x)] += x
    return out


def s_party():
    out = filt(noise(0.15), 'band', [500, 5000]) * np.exp(-tt(0.15) * 30) * 0.6
    out = np.pad(out, (0, int(1.0 * SR)))
    for _ in range(40):
        i0 = int(rng.random() ** 1.5 * 1.0 * SR)
        x = filt(noise(0.008), 'high', 3000) * np.exp(-tt(0.008) * 500) * 0.2
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


def s_fold():
    d = 0.2
    t = tt(d)
    x = filt(noise(d), 'band', [1500, 7000]) * (np.abs(np.sin(2 * np.pi * 25 * t)) ** 3)
    return x * np.sin(np.pi * t / d) * 0.25


def s_throw():
    d = 0.5
    t = tt(d)
    return filt(noise(d), 'band', [600, 3500]) * np.sin(np.pi * t / d) ** 2 * 0.35


def s_ding():
    t = tt(1.4)
    f = hz('E6')
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5)
    return x * np.minimum(1, t * 800) * 0.22


def s_boing():
    t = tt(0.35)
    f = 300 + 120 * np.sin(2 * np.pi * 13 * t) * np.exp(-t * 8)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.3


def s_sleep():
    d = 1.2
    t = tt(d)
    return filt(noise(d), 'band', [200, 700]) * np.sin(np.pi * t / d) ** 2 * 0.12


def s_title():
    out = np.zeros(int(1.8 * SR))
    for i, n in enumerate(['C5', 'G5', 'C6', 'E6']):
        x = tine(hz(n), 1.6) * 0.14
        i0 = int(i * 0.09 * SR)
        out[i0:i0 + len(x)] += x[: len(out) - i0]
    return out


FX = {
    'pencil': (lambda c: s_pencil(c.get('dur', 1.1)), 1.0, 0.0, 0.1),
    'skitter': (lambda c: s_skitter(), 0.8, 0.0, 0.05),
    'peep': (lambda c: s_peep(), 0.9, 0.0, 0.2),
    'step': (lambda c: s_step(), 0.9, -0.1, 0.05),
    'land': (lambda c: s_land(), 0.9, 0.0, 0.1),
    'key': (lambda c: s_key(), 0.8, -0.3, 0.05),
    'task': (lambda c: s_task(), 0.8, -0.4, 0.3),
    'paper': (lambda c: s_paper(), 0.9, 0.3, 0.1),
    'thud': (lambda c: s_thud(), 0.8, -0.4, 0.05),
    'poof': (lambda c: s_poof(), 0.9, -0.4, 0.2),
    'idea': (lambda c: s_idea(), 1.0, 0.0, 0.4),
    'check': (lambda c: s_check(), 0.9, -0.4, 0.2),
    'pop': (lambda c: s_pop(), 0.8, 0.2, 0.2),
    'tiptoe': (lambda c: s_tiptoe(), 0.8, 0.1, 0.1),
    'turn': (lambda c: s_turn(), 0.9, 0.0, 0.1),
    'bang': (lambda c: s_bang(), 1.0, 0.0, 0.3),
    'run': (lambda c: s_run(), 0.9, 0.0, 0.1),
    'skid': (lambda c: s_skid(), 0.9, -0.1, 0.1),
    'fall': (lambda c: s_fall(), 0.9, -0.3, 0.2),
    'jar': (lambda c: s_jar(), 1.0, -0.3, 0.3),
    'rise': (lambda c: s_rise(), 0.8, 0.3, 0.1),
    'clank': (lambda c: s_clank(c.get('up', 0)), 1.0, 0.3, 0.3),
    'fixed': (lambda c: s_fixed(), 1.0, 0.2, 0.4),
    'phew': (lambda c: s_phew(), 0.9, -0.2, 0.2),
    'sink': (lambda c: s_sink(), 0.8, 0.3, 0.1),
    'jingle': (lambda c: s_jingle(), 0.9, 0.0, 0.3),
    'button': (lambda c: s_button(), 1.0, 0.3, 0.1),
    'bulb': (lambda c: s_bulb(c.get('i', 0)), 1.0, 0.0, 0.3),
    'buzz': (lambda c: s_buzz(), 1.0, 0.1, 0.2),
    'flicker': (lambda c: s_flicker(), 0.9, 0.1, 0.1),
    'party': (lambda c: s_party(), 0.9, 0.0, 0.3),
    'fold': (lambda c: s_fold(), 0.9, 0.2, 0.1),
    'throw': (lambda c: s_throw(), 0.9, 0.3, 0.2),
    'ding': (lambda c: s_ding(), 1.0, 0.5, 0.4),
    'boing': (lambda c: s_boing(), 0.8, 0.0, 0.2),
    'sleep': (lambda c: s_sleep(), 0.9, 0.0, 0.2),
    'title': (lambda c: s_title(), 1.0, 0.0, 0.5),
}


def main():
    for c in json.load(open(sys.argv[1])):
        if c['type'] not in FX:
            print('unknown cue', c['type'])
            continue
        fn, g, pan, rev = FX[c['type']]
        place(sfx, fn(c), c['t'], g, pan, rev)
    ir_t = tt(1.6)
    ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))]) * np.exp(-ir_t * 3.5)
    ir = np.stack([filt(ir[0], 'low', 5000), filt(ir[1], 'low', 5000)]) * 0.03
    wet = np.stack([fftconvolve(send[i], ir[i])[:N] for i in range(2)])
    mix = music * 0.6 + sfx * 0.85 + wet
    t = np.arange(N) / SR
    mix *= np.clip(t / 0.3, 0, 1) * np.clip((DUR - t) / 0.7, 0, 1)
    mix = np.tanh(mix * 1.1) / 1.1
    peak = np.max(np.abs(mix))
    mix = mix / peak * 0.89
    wavfile.write(sys.argv[2], SR, (mix.T[: int(SR * DUR)] * 32767).astype(np.int16))
    print('wrote', sys.argv[2], 'peak', round(float(peak), 3))


if __name__ == '__main__':
    main()
