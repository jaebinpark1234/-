import { AdService, MockAdProvider, type AdProvider } from './ads';
import { Analytics, ConsoleSink } from './analytics';
import { I18n, detectLang } from './i18n';
import { detectPlatform, type Platform } from './platform';
import { SaveService } from './save';
import { BrowserStore } from './storage';

export interface Services {
  platform: Platform;
  save: SaveService;
  ads: AdService;
  analytics: Analytics;
  i18n: I18n;
}

let current: Services | null = null;

export function getServices(): Services {
  if (!current) throw new Error('services not initialised: call initServices() in main.ts first');
  return current;
}

export function setServices(services: Services): void {
  current = services;
}

function createAdProvider(platform: Platform): AdProvider {
  // TODO(ads): 플랫폼별 실제 SDK 어댑터로 교체. docs/TASKS.md의 ADS-* 항목 참고.
  switch (platform) {
    case 'poki':
    case 'crazygames':
    case 'android':
    case 'ios':
    case 'web':
    default:
      return new MockAdProvider();
  }
}

export function initServices(opts: {
  search: string;
  buildPlatform: unknown;
  navigatorLang: string | undefined;
  hooks?: { onPause?: () => void; onResume?: () => void };
}): Services {
  const platform = detectPlatform(opts.search, opts.buildPlatform);
  const save = new SaveService(new BrowserStore());
  const ads = new AdService(createAdProvider(platform), undefined, undefined, opts.hooks);
  ads.removeAds = save.get().removeAds;
  const analytics = new Analytics(import.meta.env.DEV ? [new ConsoleSink()] : []);
  const i18n = new I18n(save.get().settings.lang ?? detectLang(opts.navigatorLang));
  const services = { platform, save, ads, analytics, i18n };
  setServices(services);
  return services;
}
