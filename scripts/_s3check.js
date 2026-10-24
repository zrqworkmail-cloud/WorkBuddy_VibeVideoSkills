// 验证 s3 的像素驱动：在不同时刻读取被驱动元素的真实值
const fs = require('fs'), path = require('path');
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
  const info = await p.evaluate(() => ({
    dur: window.__DUR,
    drive: window.DRIVE ? Object.keys(window.DRIVE) : null,
    n3: window.DRIVE && window.DRIVE.s3 ? window.DRIVE.s3.n : null
  }));
  console.log('DUR', info.dur, '| DRIVE 镜头', info.drive, '| s3 帧数', info.n3);

  const start = 17.0899;   // s3 起点
  console.log('\n 本地t | 百分比 | 进度条 | 追踪线y | 阈值透明度');
  for (const lt of [0.3, 2, 5, 8, 11, 14, 16.5]) {
    await p.evaluate(tt => window.__seek(tt), start + lt);
    const s = await p.evaluate(() => {
      const pct = document.querySelector('#s3-pct');
      const bar = document.querySelector('#s3-bar');
      const tr = document.querySelector('#s3-track');
      const th = document.querySelector('#s3-thr');
      return {
        pct: pct ? pct.textContent : '-',
        bar: bar ? bar.style.transform : '-',
        tr: tr ? (tr.getAttribute('transform') || '-') : '-',
        thr: th ? th.getAttribute('opacity') : '-'
      };
    });
    console.log(` ${String(lt).padStart(5)} | ${String(s.pct).padStart(6)} | ${String(s.bar).padStart(18)} | ${String(s.tr).padStart(22)} | ${s.thr}`);
  }

  // 导出目检帧
  for (const lt of [1.0, 6.0, 12.0, 16.5]) {
    await p.evaluate(tt => window.__seek(tt), start + lt);
    fs.writeFileSync(path.join(ROOT, 'out', 'qc', `s3v_${lt}.png`),
      await p.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 1080, height: 1920 } }));
  }
  console.log('\n目检帧: s3v_1/s3v_6/s3v_12/s3v_16.5.png');
  console.log('ERRORS:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
