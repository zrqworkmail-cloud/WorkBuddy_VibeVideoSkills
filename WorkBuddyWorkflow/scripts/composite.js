// 合成渲染：透明覆盖层(PNG alpha) + AI 底板视频 + BGM → 一次成片
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const { FILM, SRC, OUT } = require('./_film');
const FFMPEG = 'D:/tools/ffmpeg/bin/ffmpeg.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const FPS = Number(process.argv[2] || 30);
const DUR = process.argv[3] ? Number(process.argv[3]) : null;
// 成片名默认取 timeline.json 的 title，避免各片同名互相覆盖
const OUTNAME = process.argv[4] || (() => {
  try { return require(path.join(SRC, 'timeline.json')).title + '.mp4'; }
  catch (e) { return 'output.mp4'; }
})();

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars',
      '--mute-audio', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(SRC, 'index.html').replace(/\\/g, '/') + '?ov=1',
    { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.__ready === true', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));

  const dur = DUR || await page.evaluate(() => window.__DUR);
  const total = Math.round(dur * FPS);
  console.log(`覆盖层 ${total} 帧 @ ${FPS}fps，与底板 + BGM 合成`);

  const ff = spawn(FFMPEG, [
    '-y',
    '-i', path.join(OUT, 'base.mp4'),                       // 0: AI 底板
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', // 1: 透明覆盖层
    '-i', path.join(OUT, 'audio', 'bgm_final.m4a'),          // 2: BGM
    '-filter_complex',
    '[0:v]format=yuva420p[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a:0',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-c:a', 'copy',
    // 注意：不要用 -shortest。BGM 时长与视频时长存在 AAC 帧粒度误差，
    // -shortest 会按较短的一轨裁掉另一轨尾部（曾裁掉最后 3 帧）。
    '-movflags', '+faststart',
    path.join(OUT, OUTNAME)
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let errBuf = '';
  ff.stderr.on('data', d => { errBuf += d.toString(); });

  const write = (buf) => new Promise((res) => {
    if (!ff.stdin.write(buf)) ff.stdin.once('drain', res);
    else res();
  });

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.__seek(t), i / FPS);
    const buf = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
      captureBeyondViewport: false,
      optimizeForSpeed: true
    });
    await write(buf);
    if (i % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      const eta = (el / (i + 1)) * (total - i - 1);
      process.stdout.write(`\r  frame ${i}/${total}  ${(i / el).toFixed(1)}fps  eta ${eta.toFixed(0)}s   `);
    }
  }
  ff.stdin.end();
  await new Promise((res, rej) => {
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + errBuf.slice(-1500))));
  });
  await browser.close();
  console.log(`\n✔ ${OUTNAME}  ${(fs.statSync(path.join(OUT, OUTNAME)).size / 1048576).toFixed(1)} MB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch(e => { console.error('\n✖', e.message); process.exit(1); });
