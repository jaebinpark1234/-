// 사용법
//   node render.js frames <L|V> <outDir> <t1,t2,...>     지정한 시각의 프레임을 3배 확대 PNG로 저장
//   node render.js video  <L|V> <fps> <out.mp4> [workers] 무음 영상 (1920x1080 또는 1080x1920)
//   node render.js thumb  <out.png>                       썸네일 (1920x1080)
//   node render.js cues   <out.json>                      효과음 큐
// 픽셀 아트라 원본 해상도(240x135/180x320)로 찍고 ffmpeg가 nearest-neighbor로 키운다(8배/6배).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const UP = o => (o === 'V' ? 6 : 8);

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

async function openPage(browser, port, o, mode) {
  const [w, h] = o === 'V' ? [180, 320] : [240, 135];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene.html?o=${o}&mode=${mode}`);
  await page.waitForFunction('window.READY === true');
  page.size = [w, h];
  page.dur = await page.evaluate(() => window.DUR);
  return page;
}
const shot = page => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: page.size[0], height: page.size[1] } });

function ffmpeg(args, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    if (input) input(p.stdin);
  });
}

async function renderRange(browser, port, o, fps, f0, f1, out) {
  const page = await openPage(browser, port, o, 'render');
  const [w, h] = page.size;
  await ffmpeg(['-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-vf', `scale=${w * UP(o)}:${h * UP(o)}:flags=neighbor`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '12',
    '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(fps), out], async stdin => {
    for (let f = f0; f < f1; f++) {
      await page.evaluate(t => window.renderAt(t), f / fps);
      if (!stdin.write(await shot(page))) await new Promise(r => stdin.once('drain', r));
    }
    stdin.end();
  });
  await page.close();
}

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch();
  try {
    if (cmd === 'frames') {
      const [o, dir, list] = a;
      fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, port, o, 'render');
      const [w, h] = page.size;
      for (const t of list.split(',').map(Number)) {
        await page.evaluate(tt => window.renderAt(tt), t);
        const raw = path.join(dir, `raw_${t.toFixed(2)}.png`);
        fs.writeFileSync(raw, await shot(page));
        await ffmpeg(['-i', raw, '-vf', `scale=${w * 3}:${h * 3}:flags=neighbor`, path.join(dir, `f_${t.toFixed(2)}.png`)]);
        fs.unlinkSync(raw);
      }
    } else if (cmd === 'video') {
      const [o, fps, out] = [a[0], +a[1], a[2]];
      const workers = +(a[3] || 4);
      const probe = await openPage(browser, port, o, 'render');
      const total = Math.round(probe.dur * fps);
      await probe.close();
      const per = Math.ceil(total / workers), tmp = out + '.parts', t0 = Date.now();
      fs.mkdirSync(tmp, { recursive: true });
      const parts = [];
      for (let i = 0; i < workers; i++) {
        const f0 = i * per, f1 = Math.min(total, f0 + per);
        if (f0 < f1) parts.push({ file: path.join(tmp, `p${i}.mp4`), f0, f1 });
      }
      await Promise.all(parts.map(p => renderRange(browser, port, o, fps, p.f0, p.f1, p.file)));
      fs.writeFileSync(path.join(tmp, 'list.txt'), parts.map(p => `file '${path.resolve(p.file)}'`).join('\n'));
      await ffmpeg(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', out]);
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
    } else if (cmd === 'thumb') {
      const page = await openPage(browser, port, 'L', 'thumb');
      const raw = a[0] + '.raw.png';
      fs.writeFileSync(raw, await shot(page));
      await ffmpeg(['-i', raw, '-vf', 'scale=1920:1080:flags=neighbor', a[0]]);
      fs.unlinkSync(raw);
    } else if (cmd === 'cues') {
      const page = await openPage(browser, port, 'L', 'render');
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
