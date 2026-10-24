const path = require('path'); const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--allow-file-access-from-files', '--disable-gpu', '--no-sandbox']
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push({ msg: e.message, stack: (e.stack || '').split('\n').slice(0, 5) }));
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'src', 'index.html').replace(/\\/g, '/') + '?ov=1', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2500));
  const st = await p.evaluate(() => ({
    ready: window.__ready, dur: window.__DUR, drive: typeof window.DRIVE,
    s3: !!(window.DRIVE && window.DRIVE.s3), scenes: document.querySelectorAll('section.scene').length
  }));
  console.log('状态:', JSON.stringify(st));
  for (const e of errs.slice(0, 6)) {
    console.log('\n✖', e.msg);
    e.stack.forEach(s => console.log('   ', s));
  }
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
