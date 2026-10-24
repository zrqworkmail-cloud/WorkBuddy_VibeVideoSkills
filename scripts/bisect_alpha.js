// 在真实页面上二分：逐个移除元素，找出把 alpha 抹平的那个
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu',
      '--hide-scrollbars', '--mute-audio', '--no-sandbox']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto('file:///' + require('path').resolve('src/index.html').replace(/\\/g, '/') + '?ov=1',
    { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction('window.__ready === true');
  await p.evaluate(() => window.__seek(8.5));
  await new Promise(r => setTimeout(r, 400));

  const check = async (label) => {
    const buf = await p.screenshot({ type: 'png', omitBackground: true,
      clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    fs.writeFileSync('out/qc/bisect.png', buf);
    console.log(label.padEnd(26), 'colorType =', buf.readUInt8(25),
      `(${(buf.length / 1024).toFixed(0)}KB)`);
  };

  await check('原始');
  await p.evaluate(() => document.querySelector('.ov-grain').remove());
  await check('去掉 ov-grain');
  await p.evaluate(() => { const s = document.querySelector('.ov-scrim'); if (s) s.remove(); });
  await check('再去掉 ov-scrim');
  await p.evaluate(() => document.querySelectorAll('svg').forEach(e => e.remove()));
  await check('再去掉所有 svg');
  await p.evaluate(() => document.querySelectorAll('.scene').forEach(e => e.remove()));
  await check('再去掉所有 scene');
  await p.evaluate(() => { document.getElementById('stage').style.background = 'transparent'; });
  await check('stage 背景透明');
  await b.close();
})();
