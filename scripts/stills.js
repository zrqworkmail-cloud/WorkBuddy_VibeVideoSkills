// 抽取指定时间点的静帧，用于视觉验收
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'out', 'stills');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PAGE = process.argv[2] || 'index.html';
const TIMES = (process.argv[3] || '2,8,15,26,40,52,62,75,86,97').split(',').map(Number);
const W = Number(process.argv[4] || 1080);
const H = Number(process.argv[5] || 1920);
const OUTDIR = process.argv[6] || path.join(ROOT, 'out', 'stills');

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(SRC, PAGE).replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await Promise.race([
    page.waitForFunction('window.__ready === true', { timeout: 20000 }),
    new Promise(r => setTimeout(r, 1500))
  ]);
  await new Promise(r => setTimeout(r, 300));

  for (const t of TIMES) {
    await page.evaluate(tt => { if (window.__seek) window.__seek(tt); }, t);
    const p = path.join(OUTDIR, `t${String(t).replace('.', '_')}.png`);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    fs.writeFileSync(p, buf);
    console.log('→', p);
  }
  await browser.close();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
