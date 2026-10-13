"""8-bit chiptune score and SFX for "World 1-1" (square / triangle / noise channels, numpy only).

usage: python3 audio.py cues.json out.wav
Melodies are original. Overworld and boss themes run at 150 BPM (8th note = 0.2 s).
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * (DUR + 0.5))
rng = np.random.default_rng(3)
mus = np.zeros((2, N))
fx = np.zeros((2, N))
E8 = 0.2  # 8th note at 150 BPM

NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def hz(n):
    return 440.0 * 2 ** ((NOTE[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


def tt(d):
    return np.arange(max(1, int(SR * d))) / SR


def lp(x, f):
    return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)


def place(bus, x, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N:
        return
    x = x[: N - i] * g
    bus[0, i:i + len(x)] += x * (1 - max(0, pan))
    bus[1, i:i + len(x)] += x * (1 + min(0, pan))


# ---------------- channels ----------------
def sq(f, d, duty=0.5, decay=0.0, sweep=None, vib=0.0):
    t = tt(d)
    fr = np.full_like(t, f) if sweep is None else np.linspace(f, sweep, len(t))
    if vib:
        fr = fr * (1 + vib * np.sin(2 * np.pi * 6 * t) * np.clip(t * 4, 0, 1))
    ph = np.cumsum(fr) / SR
    x = np.where((ph % 1) < duty, 1.0, -1.0)
    env = np.exp(-t * decay) if decay else np.ones_like(t)
    env *= np.clip((d - t) / 0.012, 0, 1) * np.clip(t / 0.002, 0, 1)
    return lp(x * env, 9000)


def tri(f, d, decay=0.0, sweep=None):
    t = tt(d)
    fr = np.full_like(t, f) if sweep is None else np.linspace(f, sweep, len(t))
    ph = np.cumsum(fr) / SR
    x = 4 * np.abs((ph % 1) - 0.5) - 1
    x = np.round(x * 7.5) / 7.5            # 4-bit steps like the NES triangle
    env = np.exp(-t * decay) if decay else np.ones_like(t)
    env *= np.clip((d - t) / 0.01, 0, 1)
    return x * env


def nz(d, period=1, decay=20.0, hp=None):
    n = max(1, int(SR * d))
    held = np.repeat(rng.choice([-1.0, 1.0], n // period + 1), period)[:n]
    t = tt(d)
    x = held * np.exp(-t * decay)
    if hp:
        x = sosfilt(butter(2, hp, 'high', fs=SR, output='sos'), x)
    return x


def kick():
    return tri(140, 0.12, decay=25, sweep=40) * 1.0


def snare():
    return nz(0.12, 2, 28) * 0.5


def hat():
    return nz(0.04, 1, 90, hp=6000) * 0.35


def seq(bus, notes, t0, step, fn, g, pan=0.0):
    for i, n in enumerate(notes):
        if n and n != '.':
            ln = 1
            while i + ln < len(notes) and notes[i + ln] == '-':
                ln += 1
            if n != '-':
                place(bus, fn(hz(n), step * ln), t0 + i * step, g, pan)


def lead(f, d):
    return sq(f, d * 0.92, 0.25, decay=2.0, vib=0.004)


def lead2(f, d):
    return sq(f, d * 0.9, 0.5, decay=4.0)


def bassf(f, d):
    return tri(f, d * 0.9)


def drums(t0, bars, kind='walk'):
    for b in range(bars):
        for s in range(8):
            ts = t0 + b * 8 * E8 + s * E8
            if ts >= DUR:
                return
            if kind == 'boss':
                place(mus, hat(), ts, 0.5, 0.3)
                place(mus, hat(), ts + E8 / 2, 0.3, 0.3)
                if s % 2 == 0:
                    place(mus, kick(), ts, 0.9)
                if s in (2, 6):
                    place(mus, snare(), ts, 0.8)
            else:
                place(mus, hat(), ts, 0.4, 0.3)
                if s in (0, 4):
                    place(mus, kick(), ts, 0.8)
                if s in (2, 6):
                    place(mus, snare(), ts, 0.6)


# ---------------- score ----------------
def jingle(t0, g=1.0):
    for i, (dt, n, d) in enumerate([(0, 'C5', .08), (.08, 'E5', .08), (.16, 'G5', .08), (.24, 'C6', .3), (.6, 'G5', .1), (.7, 'C6', .55)]):
        place(mus, lead2(hz(n), d), t0 + dt, 0.28 * g, -0.1)
        place(mus, sq(hz(n) / 2, d * 0.9, 0.125, decay=3), t0 + dt, 0.12 * g, 0.2)
    place(mus, bassf(hz('C3'), 0.6), t0 + 0.24, 0.5 * g)
    place(mus, bassf(hz('G2'), 0.1), t0 + 0.6, 0.5 * g)
    place(mus, bassf(hz('C3'), 0.6), t0 + 0.7, 0.5 * g)


# title
jingle(1.6)
seq(mus, ['C4', 'E4', 'G4', 'E4'] * 2 + ['F4', 'A4', 'C5', 'A4'] * 2, 2.5, E8, lambda f, d: sq(f, d * 0.8, 0.125, decay=6), 0.10, 0.2)
for dt, n in [(0, 'G5'), (0.12, 'E5'), (0.24, 'C6')]:
    place(mus, lead2(hz(n), 0.14 if n != 'C6' else 0.4), 4.5 + dt, 0.25)

# overworld 6.0 - 17.2 (7 bars)
OW_LEAD = ['C5', '.', 'E5', 'G5', '.', 'E5', 'A5', 'G5',
           'F5', '.', 'A5', 'C6', '.', 'A5', 'G5', 'E5',
           'D5', '.', 'F5', 'A5', '.', 'G5', 'F5', 'E5',
           'D5', 'E5', 'F5', 'G5', '-', '.', 'C5', '.']
OW_BASS = ['C3', 'G3', 'C3', 'G3', 'C3', 'G3', 'C3', 'G3',
           'F2', 'C3', 'F2', 'C3', 'F2', 'C3', 'F2', 'C3',
           'G2', 'D3', 'G2', 'D3', 'G2', 'D3', 'G2', 'D3',
           'G2', 'D3', 'G2', 'D3', 'C3', 'G2', 'C3', 'G2']
OW_HARM = ['E4', '.', 'G4', 'C5', '.', 'G4', 'C5', 'C5',
           'A4', '.', 'C5', 'F5', '.', 'C5', 'C5', 'C5',
           'B4', '.', 'D5', 'F5', '.', 'D5', 'D5', 'C5',
           'B4', 'C5', 'D5', 'D5', '-', '.', 'E4', '.']


def overworld(t0, bars):
    n = bars * 8
    lead_ = (OW_LEAD * 4)[:n]
    seq(mus, lead_, t0, E8, lead, 0.26, -0.15)
    seq(mus, (OW_HARM * 4)[:n], t0, E8, lambda f, d: sq(f, d * 0.85, 0.125, decay=3), 0.10, 0.25)
    seq(mus, (OW_BASS * 4)[:n], t0, E8, bassf, 0.55)
    drums(t0, bars)


overworld(6.0, 7)

# boss 18.0 - 26.4
BOSS_CH = [['A4', 'C5', 'E5', 'A5'], ['F4', 'A4', 'C5', 'F5'], ['G4', 'B4', 'D5', 'G5'], ['E4', 'G#4', 'B4', 'E5']]
BOSS_B = ['A2', 'F2', 'G2', 'E2']
t = 18.0
b = 0
while t < 26.4 - 0.01:
    ch = BOSS_CH[b % 4]
    for s in range(16):
        ts = t + s * E8 / 2
        if ts >= 26.4:
            break
        idx = [0, 1, 2, 3, 2, 1, 2, 3][s % 8]
        place(mus, sq(hz(ch[idx]), E8 / 2 * 0.85, 0.5, decay=6), ts, 0.16, 0.2)
        if s % 2 == 0:
            place(mus, bassf(hz(BOSS_B[b % 4]) * (2 if s % 4 == 2 else 1), E8 * 0.9), ts, 0.6)
    top = [['A5', '.', '.', 'C6', 'B5', '.', 'A5', '.'], ['F5', '.', 'A5', '.', 'G5', '.', 'F5', '.'],
           ['G5', '.', '.', 'B5', 'D6', '.', 'B5', '.'], ['G#5', '.', 'B5', '.', 'E6', '-', '-', '.']][b % 4]
    if b >= 1:
        seq(mus, top, t, E8, lead, 0.2, -0.2)
    drums(t, 1, 'boss')
    t += 8 * E8
    b += 1

# victory 26.5
for i, n in enumerate(['C5', 'E5', 'G5', 'C6', 'E6', 'G6']):
    place(mus, lead2(hz(n), 0.08), 26.5 + i * 0.07, 0.26)
place(mus, lead2(hz('C7'), 0.6), 26.5 + 6 * 0.07, 0.24)
place(mus, bassf(hz('C3'), 0.8), 26.5, 0.5)

# walk to the bridge 28.0 - 30.2: bass and hats only
seq(mus, ['C3', 'G2', 'C3', 'G2'] * 3, 27.8, E8, bassf, 0.45)
for s in range(12):
    place(mus, hat(), 27.8 + s * E8, 0.35, 0.3)

# tests 30.2 - 36.5: tense pulse; the tile dings carry the melody
for s in range(15):
    ts = 30.2 + s * E8
    place(mus, bassf(hz('C3'), E8 * 0.6), ts, 0.45)
    place(mus, hat(), ts, 0.3, 0.3)
for s in range(8):
    ts = 34.2 + s * 0.22
    place(mus, hat(), ts, 0.25, 0.3)
for s in range(10):  # drum roll into the ground pound
    place(mus, snare(), 36.0 + s * 0.05, 0.2 + s * 0.05)
# fanfare after the pound
for i, (dt, n, d) in enumerate([(0, 'G5', .1), (.1, 'C6', .1), (.2, 'E6', .1), (.3, 'G6', .5)]):
    place(mus, lead2(hz(n), d), 36.55 + dt, 0.26)
    place(mus, sq(hz(n) / 2, d, 0.125, decay=3), 36.55 + dt, 0.1)
place(mus, bassf(hz('C3'), 0.8), 36.55, 0.55)

# happy reprise 37.6 - 41.2
overworld(37.6, 2)
seq(mus, ['C3', 'G2', 'E3', 'G2', 'C3', 'G2'], 40.8, E8, bassf, 0.45)

# stage clear 43.1
CLEAR = [(0, 'C5', .12), (.12, 'E5', .12), (.24, 'G5', .12), (.36, 'C6', .12), (.48, 'E6', .12), (.6, 'G6', .45), (1.05, 'E6', .45),
         (1.5, 'F6', .15), (1.65, 'G6', .15), (1.8, 'A6', .15), (1.95, 'C7', .9)]
for dt, n, d in CLEAR:
    place(mus, lead2(hz(n), d), 43.1 + dt, 0.26, -0.1)
    place(mus, sq(hz(n) * 0.75, d * 0.9, 0.25, decay=3), 43.1 + dt, 0.08, 0.2)
for dt, n, d in [(0, 'C3', .55), (.6, 'G2', .45), (1.05, 'C3', .45), (1.5, 'F2', .45), (1.95, 'C3', .9)]:
    place(mus, bassf(hz(n), d), 43.1 + dt, 0.55)

# night lullaby 45.4 - 48.6
NIGHT = ['E5', '-', 'D5', 'C5', 'D5', '-', '-', '.', 'C5', '-', 'A4', 'G4', 'C5', '-', '-', '.']
seq(mus, NIGHT, 45.4, 0.2, lambda f, d: tri(f, d * 0.95) * 0.9, 0.35)
seq(mus, ['C4', 'E4', 'G4', 'E4'] * 2 + ['F4', 'A4', 'C5', 'A4'] * 2, 45.4, 0.2, lambda f, d: sq(f, d * 0.7, 0.125, decay=5), 0.06, 0.2)

# cheeky bass under the dialogue
for i, n in enumerate(['C2', '.', 'C2', '.', 'D#2', '.', 'D2', '.', 'C2', '.', 'C2', '.', 'G1', '.', 'C2', '.']):
    if n != '.':
        place(mus, bassf(hz(n), 0.15), 51.0 + i * 0.18, 0.5)

# chase burst 54.3
for s in range(8):
    place(mus, sq(hz(['A4', 'C5', 'E5', 'A5'][s % 4]), 0.08, 0.5, decay=8), 54.3 + s * 0.09, 0.2)
    place(mus, bassf(hz('A2'), 0.08), 54.3 + s * 0.09, 0.5)

# ending 55.1
jingle(55.1)
seq(mus, ['C4', 'E4', 'G4', 'E4'] * 4 + ['F4', 'A4', 'C5', 'A4'] * 2 + ['C4', 'E4', 'G4', 'C5'] * 2, 56.0, E8,
    lambda f, d: sq(f, d * 0.8, 0.125, decay=6), 0.10, 0.2)
seq(mus, ['C3', '-', '-', '-', 'G2', '-', '-', '-', 'F2', '-', '-', '-', 'C3', '-', '-', '-'], 56.0, 0.2, bassf, 0.45)


# ---------------- sound effects ----------------
SCALE = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G6', 'C7']


def cat(*xs):
    return np.concatenate(xs)


def M(*xs):
    """sum signals of different lengths"""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[:len(x)] += x
    return out


SFX = {
    'blip': lambda c: sq(1200, 0.025, 0.5) * 0.25,
    'enter': lambda c: cat(sq(880, 0.04, 0.5), sq(1320, 0.06, 0.5)) * 0.3,
    'jingle': lambda c: np.zeros(10),
    'world': lambda c: np.zeros(10),
    'logo': lambda c: np.zeros(10),
    'pipe': lambda c: cat(sq(700, 0.06, 0.5, sweep=300), sq(500, 0.06, 0.5, sweep=200), sq(400, 0.08, 0.5, sweep=150)) * 0.25,
    'jump': lambda c: sq(320, 0.16, 0.25, decay=6, sweep=760) * 0.3,
    'jumpbig': lambda c: sq(260, 0.22, 0.25, decay=4, sweep=950) * 0.32,
    'bump': lambda c: M(tri(140, 0.07, decay=30), nz(0.03, 3, 60) * 0.5) * 0.6,
    'coin': lambda c: cat(sq(hz('B5'), 0.07, 0.5), sq(hz('E6'), 0.32, 0.5, decay=8)) * 0.24,
    'tick': lambda c: sq(2000, 0.02, 0.5) * 0.12,
    'stomp': lambda c: M(sq(600, 0.1, 0.5, decay=10, sweep=200), nz(0.05, 2, 40) * 0.5) * 0.35,
    'roar': lambda c: M(lp(nz(0.7, 6, 3), 1500) * 0.8, sq(70, 0.7, 0.5, decay=2, vib=0.08) * 0.3) * 0.45,
    'spawn': lambda c: sq(900, 0.1, 0.25, sweep=400) * 0.2,
    'thud': lambda c: M(tri(90, 0.25, decay=12, sweep=40), nz(0.25, 8, 18) * 0.4) * 0.7,
    'power': lambda c: cat(sq(hz('C6'), 0.05), sq(hz('E6'), 0.05), sq(hz('G6'), 0.05), sq(hz('C7'), 0.15, decay=8)) * 0.22,
    'hit': lambda c: M(sq(hz('G6'), 0.35, 0.5, decay=6, vib=0.03) * 0.25, nz(0.12, 2, 25) * 0.3),
    'dash': lambda c: lp(nz(0.4, 3, 4), 3000) * 0.3,
    'dizzy': lambda c: sq(900, 0.8, 0.25, decay=2, vib=0.12) * 0.12,
    'fixed': lambda c: M(sq(hz('C6'), 0.6, 0.5, decay=4), sq(hz('E6'), 0.6, 0.25, decay=4), sq(hz('G6'), 0.6, 0.125, decay=4)) * 0.12,
    'boom': lambda c: M(lp(nz(0.9, 10, 4), 2500) * 0.9, sq(200, 0.6, 0.5, decay=4, sweep=40) * 0.3) * 0.6,
    'tile': lambda c: sq(hz(SCALE[min(c.get('i', 0), 12)]), 0.16, 0.25, decay=9) * 0.25,
    'error': lambda c: cat(sq(160, 0.12, 0.5), sq(120, 0.2, 0.5, decay=4)) * 0.25,
    'huh': lambda c: cat(sq(hz('E5'), 0.08, 0.25), sq(hz('A5'), 0.16, 0.25, decay=6)) * 0.22,
    'pound': lambda c: M(tri(120, 0.3, decay=10, sweep=35), nz(0.3, 6, 12) * 0.5) * 0.8,
    'launch': lambda c: sq(400, 0.35, 0.125, decay=2, sweep=1400) * 0.1,
    'firework': lambda c: nz(0.5, 4, 9) * 0.35,
    'slide': lambda c: cat(*[sq(f, 0.06, 0.5) for f in np.linspace(1400, 500, 18)]) * 0.15,
    'clear': lambda c: np.zeros(10),
    'door': lambda c: M(tri(100, 0.15, decay=20), nz(0.15, 4, 30) * 0.3) * 0.5,
    'off': lambda c: cat(sq(600, 0.03, 0.5), sq(300, 0.08, 0.5, decay=10)) * 0.2,
    'scuttle': lambda c: cat(*[cat(sq(2400, 0.008, 0.5), np.zeros(int(0.03 * SR))) for _ in range(14)]) * 0.15,
    'talk': lambda c: sq(680 + 60 * (int(c['t'] * 1000) % 3), 0.035, 0.25) * 0.14,
    'alarm': lambda c: cat(sq(hz('A6'), 0.07, 0.5), np.zeros(int(0.04 * SR)), sq(hz('A6'), 0.12, 0.5, decay=8)) * 0.25,
}


def main():
    for c in json.load(open(sys.argv[1])):
        f = SFX.get(c['type'])
        if f is None:
            print('unknown cue', c['type'])
            continue
        place(fx, f(c), c['t'], 1.0, 0.0)
    mix = mus * 0.75 + fx * 0.9
    # small room so the square waves are not bone dry
    d1, d2 = int(0.045 * SR), int(0.073 * SR)
    wet = np.zeros_like(mix)
    wet[0, d1:] += mix[1, :-d1] * 0.12
    wet[1, d2:] += mix[0, :-d2] * 0.12
    mix = mix + wet
    t = np.arange(N) / SR
    mix *= np.clip((DUR - t) / 0.55, 0, 1)
    mix = np.stack([lp(mix[0], 12000), lp(mix[1], 12000)])
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.89
    wavfile.write(sys.argv[2], SR, (mix.T[: int(SR * DUR)] * 32767).astype(np.int16))
    print('wrote', sys.argv[2], 'peak', round(float(peak), 3))


if __name__ == '__main__':
    main()
