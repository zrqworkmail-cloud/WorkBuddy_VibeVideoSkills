const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2], OUT = process.argv[3];
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const page = (await browser.pages()).find(p => p.url().includes('creator.douyin.com'));
  if (!page) { console.log('没找到创作者页面'); browser.disconnect(); return; }
  console.log('URL:', page.url());
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('页面文字：', txt.replace(/\n+/g, ' | ').slice(0, 300));
  await page.screenshot({ path: path.join(OUT, '_after_publish.png') });
  console.log('截图已存');
  browser.disconnect();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
