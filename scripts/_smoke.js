// 冒烟测试：加载 overlay，逐镜 seek，确认无 JS 错误且动效字段可读
const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--allow-file-access-from-files', '--disable-gpu', '--no-sandbox']
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'src', 'index.html').replace(/\\/g, '/') + '?ov=1', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction('window.__ready===true', { timeout: 20000 });
  const dur = await p.evaluate(() => window.__DUR);
  console.log('DUR =', dur);
  for (const t of [0.02, 8.6, 20, 40, 60, 90, 105, 118]) {
    await p.evaluate(tt => window.__seek(tt), t);
    const s = await p.evaluate(() => {
      const ch = document.querySelectorAll('.ch').length;
      const wipe = document.querySelectorAll('.wipe').length;
      const tc = document.querySelectorAll('.termcard').length;
      const vis = [...document.querySelectorAll('section.scene')].filter(e =>
        +getComputedStyle(e).opacity > 0.5).map(e => e.id);
      return { ch, wipe, tc, vis: vis.join(',') };
    });
    console.log(`t=${String(t).padStart(6)}  字符${String(s.ch).padStart(4)}  荧光笔${String(s.wipe).padStart(3)}  名词卡${String(s.tc).padStart(3)}  可见:${s.vis}`);
  }
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
