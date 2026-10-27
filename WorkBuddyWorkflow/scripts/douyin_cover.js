// 接管已打开的抖音上传页，处理封面。先探结构，再操作。
const path = require('path');
const puppeteer = require('puppeteer-core');
const PORT = process.argv[2];
const MODE = process.argv[3] || 'probe';   // probe | upload
const IMG = process.argv[4];
const OUT = process.argv[5];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[cover]', ...a);

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('creator.douyin.com')) || pages[0];
  log('页面：' + page.url());

  if (MODE === 'probe') {
    // 找到"设置封面"区域里的第一个"选择封面"按钮并点击
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('div,button,span')]
        .filter(e => (e.innerText || '').trim() === '选择封面');
      if (!btns.length) return false;
      // 取最靠上的那个（竖版 3:4 在前）
      btns.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      btns[0].click();
      return true;
    });
    log('点击"选择封面"：' + clicked);
    await sleep(2500);
    const info = await page.evaluate(() => {
      const files = [...document.querySelectorAll('input[type=file]')]
        .map((e, i) => ({ i, accept: e.accept, hidden: e.offsetParent === null }));
      const btns = [...document.querySelectorAll('button,div[role=button],span')]
        .map(e => (e.innerText || '').trim())
        .filter(t => t && t.length <= 8)
        .slice(0, 60);
      return { files, btns: [...new Set(btns)] };
    });
    log(JSON.stringify(info, null, 2));
    await page.screenshot({ path: path.join(OUT, '_cover_modal.png') });
    log('截图：_cover_modal.png');
  }

  if (MODE === 'upload') {
    const inputs = await page.$$('input[type=file]');
    log('当前 file input 数：' + inputs.length);
    let done = false;
    for (const inp of inputs) {
      const accept = await page.evaluate(el => el.getAttribute('accept') || '', inp);
      log('  accept=' + accept.slice(0, 60));
      if (accept.includes('image') || accept.includes('png') || accept.includes('jpg')) {
        await inp.uploadFile(path.resolve(IMG));
        log('✔ 已选择封面图');
        done = true;
        break;
      }
    }
    if (!done) log('✖ 没找到图片 input');
    await sleep(3000);
    await page.screenshot({ path: path.join(OUT, '_cover_after.png') });
    log('截图：_cover_after.png');
  }

  browser.disconnect();   // 只断开，不关浏览器
})().catch(e => { console.error('✖', e.message); process.exit(1); });
