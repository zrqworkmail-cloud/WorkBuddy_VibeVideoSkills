const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2], IMG = process.argv[3], OUT = process.argv[4];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[cover]', ...a);
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const page = (await browser.pages()).find(p => p.url().includes('creator.douyin.com'));
  await page.bringToFront();

  // 列出所有"上传封面"按钮位置，选 y 最大的（弹窗底部那个）
  const pos = await page.evaluate(() => [...document.querySelectorAll('div,button,span')]
    .filter(e => (e.innerText || '').trim() === '上传封面')
    .map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }));
  log('上传封面按钮位置：' + JSON.stringify(pos));

  await page.evaluate(() => {
    const c = [...document.querySelectorAll('div,button,span')]
      .filter(e => (e.innerText || '').trim() === '上传封面');
    c.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y);
    c[0].click();
  });
  await sleep(2000);

  const inputs = await page.$$('input[type=file]');
  for (const inp of inputs) {
    const acc = await page.evaluate(el => el.getAttribute('accept') || '', inp);
    if (acc.includes('image')) { await inp.uploadFile(path.resolve(IMG)); log('✔ 上传'); break; }
  }
  await sleep(4500);
  await page.screenshot({ path: path.join(OUT, '_crop2.png') });
  log('截图：_crop2.png');
  browser.disconnect();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
