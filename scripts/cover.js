// 封面合成：底板真实画面(裁成 3:4) + 透明图形层
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const FF = 'D:/tools/ffmpeg/bin/ffmpeg.exe';

(async () => {
  // 1. 从底板取一帧，中心裁成 3:4
  // 取 s3 段的"半睁眼"帧（全局 28.6s）—— 眼睛半开最有信息量，
  // 也能一眼看懂主题；早先用的 5.2s 落在 S2 的暗场，封面几乎全黑。
  const COVER_T = process.env.COVER_T || '28.6';
  const frame = path.join(ROOT, 'out', 'qc', 'cover_base.png');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', COVER_T,
    '-i', path.join(ROOT, 'out', 'base.mp4'),
    '-frames:v', '1', '-vf', 'crop=1080:1440:0:240', frame]);

  // 2. 渲染透明图形层
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu', '--no-sandbox']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1440, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'src', 'cover.html').replace(/\\/g, '/') + '?ov=1',
    { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 700));
  const ov = path.join(ROOT, 'out', 'qc', 'cover_ov.png');
  fs.writeFileSync(ov, await p.screenshot({
    type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 1080, height: 1440 }
  }));
  await b.close();

  // 3. 叠加出封面
  const out = path.join(ROOT, 'out', 'cover.png');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', frame, '-i', ov,
    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p', '-frames:v', '1', out]);
  console.log('✔ cover.png', (fs.statSync(out).size / 1024).toFixed(0), 'KB');
})().catch(e => { console.error('✖', e.message); process.exit(1); });
