export type RewardedResult = 'rewarded' | 'skipped' | 'unavailable';

/**
 * 광고 SDK 하나를 감싸는 어댑터. Poki, CrazyGames, AdMob(Capacitor)마다 하나씩 만든다.
 * 포털 SDK는 gameplayStart/Stop 신호를 요구하므로 인터페이스에 넣어 두었다.
 */
export interface AdProvider {
  readonly name: string;
  init(): Promise<void>;
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<void>;
  showRewarded(): Promise<RewardedResult>;
}

export interface AdPolicy {
  /** 이 레벨 전에는 전면 광고를 띄우지 않는다. */
  interstitialFromLevel: number;
  /** 전면 광고 사이 최소 간격(초). */
  interstitialMinGapSec: number;
  /** maybeShowInterstitial 호출(= 이긴 판) N번마다 한 번만 전면 광고 후보가 된다. */
  interstitialEveryNRounds: number;
}

export const DEFAULT_AD_POLICY: AdPolicy = {
  interstitialFromLevel: 8,
  interstitialMinGapSec: 120,
  interstitialEveryNRounds: 3,
};

export interface AdHooks {
  /** 광고가 뜨기 직전. 소리를 끄고 입력을 막는다. */
  onPause?: () => void;
  /** 광고가 닫힌 직후. */
  onResume?: () => void;
}

/**
 * 광고 빈도 규칙은 전부 여기서 정한다. 씬 코드는 "지금 띄워도 되나?"를 고민하지 않고
 * maybeShowInterstitial()만 부르면 된다.
 */
export class AdService {
  private roundsSinceInterstitial = 0;
  private lastInterstitialAt = Number.NEGATIVE_INFINITY;
  private busy = false;
  removeAds = false;

  constructor(
    private readonly provider: AdProvider,
    private readonly policy: AdPolicy = DEFAULT_AD_POLICY,
    private readonly now: () => number = () => Date.now(),
    private readonly hooks: AdHooks = {},
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async init(): Promise<void> {
    try {
      await this.provider.init();
    } catch (err) {
      console.warn('[ads] init failed', err);
    }
  }

  loadingFinished(): void {
    this.provider.loadingFinished();
  }

  gameplayStart(): void {
    this.provider.gameplayStart();
  }

  gameplayStop(): void {
    this.provider.gameplayStop();
  }

  /** 판이 끝날 때마다 호출. 규칙에 맞을 때만 실제로 광고를 띄운다. */
  async maybeShowInterstitial(level: number): Promise<boolean> {
    this.roundsSinceInterstitial++;
    if (!this.canShowInterstitial(level)) return false;
    this.busy = true;
    this.hooks.onPause?.();
    try {
      await this.provider.showInterstitial();
    } catch (err) {
      console.warn('[ads] interstitial failed', err);
    } finally {
      this.busy = false;
      this.roundsSinceInterstitial = 0;
      this.lastInterstitialAt = this.now();
      this.hooks.onResume?.();
    }
    return true;
  }

  canShowInterstitial(level: number): boolean {
    if (this.removeAds || this.busy) return false;
    if (level < this.policy.interstitialFromLevel) return false;
    if (this.roundsSinceInterstitial < this.policy.interstitialEveryNRounds) return false;
    const gapSec = (this.now() - this.lastInterstitialAt) / 1000;
    return gapSec >= this.policy.interstitialMinGapSec;
  }

  /** 보상형 광고는 광고 제거 구매자에게도 보여준다. 본인이 눌러서 보는 광고라서다. */
  async showRewarded(): Promise<RewardedResult> {
    if (this.busy) return 'unavailable';
    this.busy = true;
    this.hooks.onPause?.();
    try {
      const result = await this.provider.showRewarded();
      if (result === 'rewarded') {
        // 보상형을 본 직후에 전면 광고가 또 뜨면 이탈이 커서 타이머를 리셋한다.
        this.lastInterstitialAt = this.now();
      }
      return result;
    } catch (err) {
      console.warn('[ads] rewarded failed', err);
      return 'unavailable';
    } finally {
      this.busy = false;
      this.hooks.onResume?.();
    }
  }
}

/** 개발용 가짜 광고. 화면에 회색 막을 띄워 흐름을 눈으로 확인할 수 있게 한다. */
export class MockAdProvider implements AdProvider {
  readonly name = 'mock';

  constructor(private readonly durationMs = 1200) {}

  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}

  showInterstitial(): Promise<void> {
    return this.overlay('전면 광고 (테스트)').then(() => undefined);
  }

  showRewarded(): Promise<RewardedResult> {
    return this.overlay('보상형 광고 (테스트)').then(() => 'rewarded' as const);
  }

  private overlay(label: string): Promise<void> {
    if (typeof document === 'undefined') {
      return new Promise((resolve) => setTimeout(resolve, 10));
    }
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.dataset.testid = 'mock-ad';
      el.textContent = label;
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20,20,20,0.92)',
        color: '#fff',
        font: '600 22px system-ui, sans-serif',
        zIndex: '9999',
      });
      document.body.appendChild(el);
      setTimeout(() => {
        el.remove();
        resolve();
      }, this.durationMs);
    });
  }
}

/** 광고가 없는 빌드(예: 스토어 심사용 무광고 버전)에 쓴다. */
export class NoAdProvider implements AdProvider {
  readonly name = 'none';
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  async showInterstitial(): Promise<void> {}
  async showRewarded(): Promise<RewardedResult> {
    return 'unavailable';
  }
}
