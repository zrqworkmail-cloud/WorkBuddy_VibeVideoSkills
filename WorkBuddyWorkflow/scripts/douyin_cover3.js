const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2], OUT = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[cover]', ...a);
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('creator.douyin.com')) || pages[0];

  // 1) 取消当前裁剪弹窗
  const cancel = await page.evaluate(() => {
    const b = [...document.querySelectorAll('div,button,span')].filter(e => (e.innerText||'').trim() === '取消');
    if (!b.length) return false;
    b.sort((a,c)=>b.length)[0].click(); return true;
  });
  log('取消裁剪：' + cancel);
  await sleep(1500);

  // 2) 切到"设置竖封面"标签
  const tab = await page.evaluate(() => {
    const t = [...document.querySelectorAll('div,span,button')]
      .filter(e => (e.innerText||'').trim() === '设置竖封面');
    if (!t.length) return false;
    t[0].click(); return true;
  });
  log('切到竖封面标签：' + tab);
  await sleep(2000);

  await page.screenshot({ path: path.join(OUT, '_tab_vertical.png') });
  log('截图：_tab_vertical.png');
  browser.disconnect();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
