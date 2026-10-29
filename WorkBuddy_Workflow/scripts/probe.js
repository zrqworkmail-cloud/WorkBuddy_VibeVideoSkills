// 量一下所有文字块的真实位置，确认都在抖音安全区内
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.join(ROOT, 'src', 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.__ready === true');
  await new Promise(r => setTimeout(r, 300));

  const t = Number(process.argv[2] || 8.5);
  const rep = await page.evaluate((tt) => {
    window.__seek(tt);
    const out = [];
    document.querySelectorAll('.scene').forEach(sc => {
      if (+getComputedStyle(sc).opacity < 0.05) return;
      sc.querySelectorAll('.tag,.txt,.gauge,.rulerlbl,.ruler,.pct,.plot,.clockbox,.bigtime').forEach(el => {
        const r = el.getBoundingClientRect();
        out.push({
          scene: sc.id,
          cls: (el.getAttribute && el.getAttribute('class')) || el.tagName,
          top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right)
        });
      });
    });
    return out;
  }, t);
  console.log(`t=${t}s   安全区: y∈[240,1460]  x∈[90,990]`);
  console.log('scene  el        left  right   top  bottom   ' + 'FATAL');
  rep.forEach(r => {
    const bad = (r.bottom > 1462 ? ' ⛔ 超出安全区' : '');
    const wide = (r.right > 992 ? ' ⛔ 超宽' : '');
    console.log(`${r.scene.padEnd(6)} ${r.cls.padEnd(10)} ${String(r.left).padStart(4)} ${String(r.right).padStart(6)} ${String(r.top).padStart(5)} ${String(r.bottom).padStart(7)}   ${r.left<88?'⛔偏左':''}${bad}${wide}`);
  });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
