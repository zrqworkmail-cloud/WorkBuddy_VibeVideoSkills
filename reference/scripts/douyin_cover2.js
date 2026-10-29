const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2];
const IMG = process.argv[3];
const OUT = process.argv[4];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[cover]', ...a);

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('creator.douyin.com')) || pages[0];

  // 点"上传封面"（弹窗底部那个按钮）
  const clicked = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('div,button,span')]
      .filter(e => (e.innerText || '').trim() === '上传封面');
    if (!cands.length) return 0;
    // 取最靠下的（弹窗底部主按钮）
    cands.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    cands[0].click();
    return cands.length;
  });
  log('找到"上传封面"按钮数：' + clicked);
  await sleep(2000);

  // 上传图片
  const inputs = await page.$$('input[type=file]');
  let ok = false;
  for (const inp of inputs) {
    const accept = await page.evaluate(el => el.getAttribute('accept') || '', inp);
    if (accept.includes('image')) {
      await inp.uploadFile(path.resolve(IMG)).catch(e => log('uploadFile 失败：' + e.message));
      log('✔ 已提交封面图');
      ok = true;
      break;
    }
  }
  if (!ok) log('✖ 没找到可用的图片 input');
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, '_cover_crop.png') });
  log('截图：_cover_crop.png（此时应进入裁剪界面）');
  browser.disconnect();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
