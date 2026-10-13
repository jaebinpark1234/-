// 사용법
//   node render.js frames <w> <h> <outDir> <t1,t2,...>   지정한 시각의 프레임을 PNG로 저장
//   node render.js video  <w> <h> <fps> <out.mp4> [workers]  무음 영상 렌더
//   node render.js thumb  <w> <h> <out.png>               썸네일
//   node render.js cues   <out.json>                      효과음 큐 내보내기
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
let DUR = 30;

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port, w, h, mode) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene.html?w=${w}&h=${h}&mode=${mode}`);
  await page.waitForFunction('window.READY === true');
  DUR = await page.evaluate(() => window.DUR);
  return page;
}

const shot = (page, w, h) => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });

async function renderRange(browser, port, w, h, fps, f0, f1, out) {
  const page = await openPage(browser, port, w, h, 'render');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderAt(t), f / fps);
    const buf = await shot(page, w, h);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  await page.close();
}

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch();
  try {
    if (cmd === 'frames') {
      const [w, h, dir, list] = [+a[0], +a[1], a[2], a[3]];
      fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, port, w, h, 'render');
      for (const t of list.split(',').map(Number)) {
        await page.evaluate(tt => window.renderAt(tt), t);
        fs.writeFileSync(path.join(dir, `f_${t.toFixed(2)}.png`), await shot(page, w, h));
      }
    } else if (cmd === 'video') {
      const [w, h, fps, out] = [+a[0], +a[1], +a[2], a[3]];
      const workers = +(a[4] || 4);
      await (await openPage(browser, port, w, h, 'render')).close();
      const total = Math.round(DUR * fps);
      const per = Math.ceil(total / workers);
      const tmp = out + '.parts';
      fs.mkdirSync(tmp, { recursive: true });
      const t0 = Date.now();
      const parts = [];
      for (let i = 0; i < workers; i++) {
        const f0 = i * per, f1 = Math.min(total, f0 + per);
        if (f0 >= f1) break;
        parts.push({ file: path.join(tmp, `p${i}.mp4`), f0, f1 });
      }
      await Promise.all(parts.map(p => renderRange(browser, port, w, h, fps, p.f0, p.f1, p.file)));
      fs.writeFileSync(path.join(tmp, 'list.txt'), parts.map(p => `file '${path.resolve(p.file)}'`).join('\n'));
      await new Promise((res, rej) => {
        const c = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', out], { stdio: 'inherit' });
        c.on('close', code => (code === 0 ? res() : rej(new Error('concat ' + code))));
      });
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
    } else if (cmd === 'thumb') {
      const [w, h, out] = [+a[0], +a[1], a[2]];
      const page = await openPage(browser, port, w, h, 'thumb');
      fs.writeFileSync(out, await shot(page, w, h));
    } else if (cmd === 'cues') {
      const page = await openPage(browser, port, 1920, 1080, 'render');
      fs.writeFileSync(a[0], JSON.stringify(await page.evaluate(() => window.getCues()), null, 1));
    } else {
      console.error('unknown command');
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    srv.close();
  }
})();
