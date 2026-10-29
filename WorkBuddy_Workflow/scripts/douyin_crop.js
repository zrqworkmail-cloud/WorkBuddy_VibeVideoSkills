const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2], OUT = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[crop]', ...a);
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const page = (await browser.pages()).find(p => p.url().includes('creator.douyin.com'));
  await page.bringToFront();

  // 量出裁剪框与图片的实际位置
  const box = await page.evaluate(() => {
    // 裁剪框通常是带 8 个 handle 的容器；退而求其次：找含 border 的虚线框
    const cands = [...document.querySelectorAll('div')].filter(e => {
      const s = getComputedStyle(e);
      return s.borderStyle.includes('dashed') && e.offsetWidth > 100 && e.offsetHeight > 80;
    }).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    return cands.slice(0, 5);
  });
  log('候选裁剪框：' + JSON.stringify(box.map(b => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }))));

  if (!box.length) { log('✖ 没找到裁剪框'); browser.disconnect(); return; }
  const b = box[0];
  // 从底边中点往下拖，尝试把框拉高到覆盖文字
  const cx = b.x + b.w / 2;
  const y0 = b.y + b.h;
  await page.mouse.move(cx, y0);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(cx, y0 + i * 14);
  await page.mouse.up();
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, '_crop3.png') });
  log('已拖拽，截图 _crop3.png');
  browser.disconnect();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
