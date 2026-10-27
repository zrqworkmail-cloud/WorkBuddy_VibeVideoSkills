const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2], OUT = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const page = (await browser.pages()).find(p => p.url().includes('creator.douyin.com'));
  await page.goto('https://creator.douyin.com/creator-micro/content/manage',
    { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('goto:', e.message));
  await sleep(4000);
  const items = await page.evaluate(() => {
    const txt = document.body.innerText;
    return txt.slice(0, 1200);
  });
  console.log('=== 内容管理页文字 ===');
  console.log(items.replace(/\n{2,}/g, '\n'));
  await page.screenshot({ path: path.join(OUT, '_content_manage.png') });
  console.log('\n截图已存');
  browser.disconnect();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
