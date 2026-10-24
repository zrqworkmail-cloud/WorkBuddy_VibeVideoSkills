// 单帧校验：把覆盖层精确叠加到真实底板上，输出一张 PNG 供肉眼核对排版/可读性。
// 用法：node scripts/verify_frame.js <sceneId> <localSec> [outName]
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const FFMPEG = 'D:/tools/ffmpeg/bin/ffmpeg.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'timeline.json'), 'utf-8'));
const BEAT = tl.beatSec || 60 / tl.bpm;
let acc = 0;
const starts = {};
for (const sc of tl.scenes) { starts[sc.id] = acc * BEAT; acc += sc.beats; }

const sid = process.argv[2] || 's3';
const lt = Number(process.argv[3] || '3.0');
const outName = process.argv[4] || `verify_${sid}_${lt}.png`;
const T = starts[sid] + lt;
console.log(`scene ${sid} start=${starts[sid].toFixed(2)}s  local=${lt}s  global T=${T.toFixed(2)}s`);

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
  await page.evaluate(t => window.__seek(t), T);
  await new Promise(r => setTimeout(r, 120));
  const buf = await page.screenshot({ type: 'png', omitBackground: true,
    clip: { x: 0, y: 0, width: 1080, height: 1920 }, captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'qc', 'ov.png'), buf);
  await browser.close();

  // 底板对应帧
  const baseP = path.join(OUT, 'qc', 'base.png');
  spawnSync(FFMPEG, ['-y', '-ss', T.toFixed(3), '-i', path.join(OUT, 'base.mp4'),
    '-frames:v', '1', baseP], { stdio: 'ignore' });
  // 叠加
  const dst = path.join(OUT, 'qc', outName);
  const r = spawnSync(FFMPEG, ['-y', '-i', baseP, '-i', path.join(OUT, 'qc', 'ov.png'),
    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p', dst],
    { stdio: 'inherit' });
  console.log('✔', dst, (fs.statSync(dst).size / 1024).toFixed(0), 'KB');
})().catch(e => { console.error('✖', e.message); process.exit(1); });
