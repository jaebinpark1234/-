import { describe, expect, it } from 'vitest';
import { AdService, type AdProvider, type RewardedResult } from '../src/services/ads';
import { I18n, detectLang } from '../src/services/i18n';
import { detectPlatform } from '../src/services/platform';
import { SAVE_KEY, SaveService, defaultSave, migrate } from '../src/services/save';
import { MemoryStore } from '../src/services/storage';
import { Rng, hashSeed, localDateKey } from '../src/core/rng';

class FakeProvider implements AdProvider {
  readonly name = 'fake';
  interstitials = 0;
  rewarded: RewardedResult = 'rewarded';
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  async showInterstitial(): Promise<void> {
    this.interstitials++;
  }
  async showRewarded(): Promise<RewardedResult> {
    return this.rewarded;
  }
}

describe('AdService', () => {
  const policy = { interstitialFromLevel: 3, interstitialMinGapSec: 60, interstitialEveryNRounds: 2 };

  it('레벨 기준 전에는 전면 광고를 띄우지 않는다', async () => {
    const p = new FakeProvider();
    const ads = new AdService(p, policy, () => 0);
    await ads.maybeShowInterstitial(1);
    await ads.maybeShowInterstitial(2);
    expect(p.interstitials).toBe(0);
  });

  it('N판마다, 최소 간격을 지켜서 띄운다', async () => {
    const p = new FakeProvider();
    let now = 1_000_000;
    const ads = new AdService(p, policy, () => now);
    expect(await ads.maybeShowInterstitial(5)).toBe(false); // 1판째
    expect(await ads.maybeShowInterstitial(5)).toBe(true); // 2판째
    now += 10_000;
    await ads.maybeShowInterstitial(5);
    expect(await ads.maybeShowInterstitial(5)).toBe(false); // 2판 지났지만 10초밖에 안 됨
    now += 60_000;
    await ads.maybeShowInterstitial(5);
    expect(p.interstitials).toBe(2);
  });

  it('광고 제거를 사면 전면 광고는 없고 보상형은 남는다', async () => {
    const p = new FakeProvider();
    const ads = new AdService(p, policy, () => 1e9);
    ads.removeAds = true;
    for (let i = 0; i < 5; i++) await ads.maybeShowInterstitial(10);
    expect(p.interstitials).toBe(0);
    expect(await ads.showRewarded()).toBe('rewarded');
  });

  it('보상형 광고 직후에는 전면 광고 타이머가 리셋된다', async () => {
    const p = new FakeProvider();
    const now = 1e9;
    const ads = new AdService(p, policy, () => now);
    await ads.showRewarded();
    await ads.maybeShowInterstitial(10);
    expect(await ads.maybeShowInterstitial(10)).toBe(false);
  });

  it('pause/resume 훅을 부른다', async () => {
    const calls: string[] = [];
    const ads = new AdService(new FakeProvider(), policy, () => 0, {
      onPause: () => calls.push('pause'),
      onResume: () => calls.push('resume'),
    });
    await ads.showRewarded();
    expect(calls).toEqual(['pause', 'resume']);
  });
});

describe('SaveService', () => {
  it('저장한 값을 다시 읽는다', () => {
    const store = new MemoryStore();
    const a = new SaveService(store);
    a.update((d) => {
      d.level = 7;
      d.coins = 120;
    });
    const b = new SaveService(store);
    expect(b.get().level).toBe(7);
    expect(b.get().coins).toBe(120);
  });

  it('깨진 저장 데이터는 기본값으로 시작한다', () => {
    const store = new MemoryStore();
    store.set(SAVE_KEY, '{not json');
    expect(new SaveService(store).get()).toEqual(defaultSave());
  });

  it('빠진 필드는 기본값으로 채운다', () => {
    const migrated = migrate({ level: 3, settings: { sound: false } });
    expect(migrated.level).toBe(3);
    expect(migrated.settings.sound).toBe(false);
    expect(migrated.settings.music).toBe(true);
    expect(migrated.daily.streak).toBe(0);
  });
});

describe('I18n', () => {
  it('변수를 채운다', () => {
    expect(new I18n('ko').t('menu.level', { n: 12 })).toBe('레벨 12');
    expect(new I18n('en').t('menu.level', { n: 12 })).toBe('Level 12');
  });

  it('브라우저 언어로 기본 언어를 정한다', () => {
    expect(detectLang('ko-KR')).toBe('ko');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });
});

describe('platform', () => {
  it('URL이 빌드 변수보다 우선한다', () => {
    expect(detectPlatform('?platform=poki', 'android')).toBe('poki');
    expect(detectPlatform('', 'android')).toBe('android');
    expect(detectPlatform('?platform=bogus', undefined)).toBe('web');
  });
});

describe('Rng', () => {
  it('같은 시드는 같은 수열을 만든다', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('int는 범위를 벗어나지 않는다', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('날짜 키와 해시가 안정적이다', () => {
    expect(localDateKey(new Date(2026, 9, 3))).toBe('2026-10-03');
    expect(hashSeed('daily-2026-10-03')).toBe(hashSeed('daily-2026-10-03'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});
