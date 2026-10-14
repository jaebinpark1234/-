import Phaser from 'phaser';
import { getServices } from './index';

/** 효과음 재생. 설정에서 꺼져 있으면 아무것도 하지 않는다. 파일이 아직 없으면 WebAudio로 합성한 소리를 낸다. */
export function playSfx(scene: Phaser.Scene, key: string, volume = 1): void {
  if (!getServices().save.get().settings.sound) return;
  if (scene.cache.audio.exists(key)) {
    scene.sound.play(key, { volume });
    return;
  }
  synth(scene, key, volume);
}

/** 진동. 지원하지 않는 기기나 설정에서 끈 경우 무시한다. Capacitor 빌드에서는 Haptics 플러그인으로 바꾼다. */
export function haptic(ms = 15): void {
  if (!getServices().save.get().settings.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 일부 iframe에서는 막혀 있다.
  }
}

/** f: 시작 주파수, to: 끝 주파수(미끄러짐), at: 시작 시각(초), d: 길이(초), v: 음량 */
type Note = { f: number; to?: number; at: number; d: number; v?: number; wave?: OscillatorType };

// 효과음 파일(AUDIO-1)이 들어오기 전까지 쓰는 합성음. 파일이 생기면 그쪽이 우선이다.
const SYNTH: Record<string, Note[]> = {
  'sfx.tap': [{ f: 720, at: 0, d: 0.05, v: 0.25, wave: 'triangle' }],
  'sfx.park': [
    { f: 300, to: 220, at: 0, d: 0.08, v: 0.3, wave: 'triangle' },
    { f: 180, at: 0.06, d: 0.05, v: 0.2, wave: 'square' },
  ],
  'sfx.launch': [
    { f: 420, to: 1200, at: 0, d: 0.22, v: 0.22, wave: 'sine' },
    { f: 1600, at: 0.18, d: 0.06, v: 0.1, wave: 'triangle' },
  ],
  'sfx.chain': [
    { f: 660, at: 0, d: 0.08, v: 0.25, wave: 'triangle' },
    { f: 880, at: 0.07, d: 0.08, v: 0.25, wave: 'triangle' },
    { f: 1320, at: 0.14, d: 0.14, v: 0.25, wave: 'triangle' },
  ],
  'sfx.blocked': [{ f: 150, to: 110, at: 0, d: 0.18, v: 0.25, wave: 'square' }],
  'sfx.coin': [
    { f: 1320, at: 0, d: 0.06, v: 0.2, wave: 'square' },
    { f: 1760, at: 0.06, d: 0.12, v: 0.2, wave: 'square' },
  ],
  'sfx.wrong': [{ f: 240, to: 180, at: 0, d: 0.25, v: 0.22, wave: 'sawtooth' }],
  'sfx.win': [
    { f: 523, at: 0, d: 0.14, v: 0.25, wave: 'triangle' },
    { f: 659, at: 0.12, d: 0.14, v: 0.25, wave: 'triangle' },
    { f: 784, at: 0.24, d: 0.14, v: 0.25, wave: 'triangle' },
    { f: 1047, at: 0.36, d: 0.5, v: 0.3, wave: 'triangle' },
    { f: 1568, at: 0.36, d: 0.5, v: 0.1, wave: 'sine' },
  ],
  'sfx.lose': [
    { f: 392, at: 0, d: 0.18, v: 0.25, wave: 'triangle' },
    { f: 330, at: 0.16, d: 0.18, v: 0.25, wave: 'triangle' },
    { f: 262, at: 0.32, d: 0.4, v: 0.25, wave: 'triangle' },
  ],
};

function synth(scene: Phaser.Scene, key: string, volume: number): void {
  const notes = SYNTH[key];
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context as AudioContext | undefined;
  if (!notes || !ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const t0 = ctx.currentTime + 0.01;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = t0 + n.at;
    osc.type = n.wave ?? 'sine';
    osc.frequency.setValueAtTime(n.f, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.d);
    const peak = (n.v ?? 0.2) * volume;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + n.d + 0.02);
  }
}
