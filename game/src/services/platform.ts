export type Platform = 'web' | 'poki' | 'crazygames' | 'android' | 'ios';

const PLATFORMS: readonly Platform[] = ['web', 'poki', 'crazygames', 'android', 'ios'];

function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);
}

/**
 * 우선순위: URL ?platform= → 빌드 변수 VITE_PLATFORM → 'web'.
 * 포털별 빌드는 `VITE_PLATFORM=poki npm run build`처럼 만든다.
 */
export function detectPlatform(search: string, buildValue: unknown): Platform {
  const fromUrl = new URLSearchParams(search).get('platform');
  if (isPlatform(fromUrl)) return fromUrl;
  if (isPlatform(buildValue)) return buildValue;
  return 'web';
}
