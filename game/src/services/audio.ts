import type Phaser from 'phaser';
import { getServices } from './index';

/** 효과음 재생. 설정에서 꺼져 있거나 파일이 아직 없으면 아무것도 하지 않는다. */
export function playSfx(scene: Phaser.Scene, key: string, volume = 1): void {
  if (!getServices().save.get().settings.sound) return;
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume });
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
