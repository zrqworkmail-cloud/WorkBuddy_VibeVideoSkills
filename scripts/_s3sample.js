// 只渲染 s3 的样片：叠加层 410 帧 + 对应底板分段 + 对应音乐片段
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const FFMPEG = 'D:/tools/ffmpeg/bin/ffmpeg.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = 24;
const START = 17.0899;          // s3 起点
const DUR = 17.09;              // s3 时长
const NAME = process.argv[2] || '样片_腺苷.mp4';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars',
      '--mute-audio', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(ROOT, 'src', 'index.html').replace(/\\/g, '/') + '?ov=1',
    { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.__ready === true', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));

  const total = Math.round(DUR * FPS);
  console.log(`s3 样片 ${total} 帧 @ ${FPS}fps`);

  const ff = spawn(FFMPEG, [
    '-y',
    '-i', path.join(OUT, 'base', 'base_s3.mp4'),
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-ss', String(START), '-t', String(DUR), '-i', path.join(OUT, 'audio', 'bgm_final.m4a'),
    '-filter_complex',
    '[0:v]format=yuva420p[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a:0',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    path.join(OUT, NAME)
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let err = '';
  ff.stderr.on('data', d => { err += d.toString(); });
  const write = (buf) => new Promise(res => {
    if (!ff.stdin.write(buf)) ff.stdin.once('drain', res); else res();
  });
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.__seek(t), START + i / FPS);
    const buf = await page.screenshot({
      type: 'png', omitBackground: true,
      clip: { x: 0, y: 0, width: 1080, height: 1920 }, optimizeForSpeed: true
    });
    await write(buf);
    if (i % 60 === 0) process.stdout.write(`\r  ${i}/${total}  `);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c + '\n' + err.slice(-1200)))));
  await browser.close();
  console.log(`\n✔ ${NAME}  ${(fs.statSync(path.join(OUT, NAME)).size / 1048576).toFixed(1)} MB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch(e => { console.error('\n✖', e.message); process.exit(1); });
