// 封面渲染：把 cover.html 按指定尺寸截成 PNG
// 用法：node render_cover.js <html> <out.png> <w> <h> [bg]
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [html, out, w, h, bg] = process.argv.slice(2);
const W = Number(w), H = Number(h);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
           '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const qs = `?w=${W}&h=${H}${bg ? '&bg=' + encodeURIComponent(bg) : ''}`;
  await page.goto('file:///' + path.resolve(html).replace(/\\/g, '/') + qs,
    { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
  console.log(`✔ ${out}  ${W}×${H}`);
})().catch(e => { console.error('✖', e.message); process.exit(1); });
