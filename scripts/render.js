// 逐帧渲染：Puppeteer 驱动时间轴 → PNG 帧 → 管道给 FFmpeg
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'out');
const FFMPEG = 'D:/tools/ffmpeg/bin/ffmpeg.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PAGE = process.argv[2] || 'index.html';
const FPS = Number(process.argv[3] || 30);
const DURATION = process.argv[4] ? Number(process.argv[4]) : null; // 秒，缺省读页面
const OUTNAME = process.argv[5] || 'video_only.mp4';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--allow-file-access-from-files',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(SRC, PAGE).replace(/\\/g, '/'), {
    waitUntil: 'load', timeout: 60000
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.__ready === true', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));

  const dur = DURATION || await page.evaluate(() => window.__DUR);
  const total = Math.round(dur * FPS);
  console.log(`duration=${dur}s  fps=${FPS}  frames=${total}`);

  const outPath = path.join(OUT, OUTNAME);
  const ff = spawn(FFMPEG, [
    '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-movflags', '+faststart',
    outPath
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let errBuf = '';
  ff.stderr.on('data', d => { errBuf += d.toString(); });

  const write = (buf) => new Promise((res) => {
    if (!ff.stdin.write(buf)) ff.stdin.once('drain', res);
    else res();
  });

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.__seek(tt), t);
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
      captureBeyondViewport: false,
      optimizeForSpeed: true
    });
    await write(buf);

    if (i % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      const eta = (el / (i + 1)) * (total - i - 1);
      process.stdout.write(`\r  frame ${i}/${total}  ${(i / el).toFixed(1)} fps  eta ${eta.toFixed(0)}s   `);
    }
  }

  ff.stdin.end();
  await new Promise((res, rej) => {
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + errBuf.slice(-1500))));
  });
  await browser.close();

  const size = (fs.statSync(outPath).size / 1048576).toFixed(1);
  console.log(`\n✔ ${OUTNAME}  ${size} MB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch(e => { console.error('\n✖', e.message); process.exit(1); });
