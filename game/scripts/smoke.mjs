// 실제 브라우저로 빌드 결과를 띄워 메뉴 → 게임 → 결과 흐름이 돌아가는지 확인하고 스크린샷을 남긴다.
// 사용법: npm run build && npm run smoke
// CHROMIUM_PATH로 브라우저 경로를 바꿀 수 있다.
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const OUT = 'artifacts';
await mkdir(OUT, { recursive: true });

const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'warn' });
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:4173/';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
});

const activeScenes = () => page.evaluate(() => window.__game?.scene.getScenes(true).map((s) => s.scene.key) ?? []);

async function waitForScene(key, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((await activeScenes()).includes(key)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`scene ${key} not active; active=${JSON.stringify(await activeScenes())}`);
}

/** 게임 좌표(720x1280 기준)를 화면 좌표로 바꿔 클릭한다. */
async function tapGame(x, y) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  await page.mouse.click(box.x + (x / 720) * box.width, box.y + (y / 1280) * box.height);
}

try {
  await page.goto(`${url}?platform=web`);
  await waitForScene('Menu');
  await page.screenshot({ path: `${OUT}/01-menu.png` });

  await tapGame(360, 760);
  await waitForScene('Game');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/02-game-start.png` });

  // GameScene이 노출하는 자동 플레이 훅(봇)으로 끝까지 둔다. 중간에 한 장 찍는다.
  const hasAutoplay = await page.evaluate(() => typeof window.__smoke?.autoplay === 'function');
  if (!hasAutoplay) throw new Error('window.__smoke.autoplay missing');
  await page.evaluate(() => {
    window.__smoke.autoplay(220);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/03-playing.png` });
  await waitForScene('Result', 30000);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/04-result.png` });

  if (errors.length) throw new Error(`browser errors:\n${errors.join('\n')}`);
  console.log('SMOKE OK', url);
} catch (err) {
  await page.screenshot({ path: `${OUT}/fail.png` }).catch(() => {});
  console.error('SMOKE FAILED:', err.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.httpServer.close();
}
