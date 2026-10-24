const path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--allow-file-access-from-files','--disable-gpu','--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'src', 'index.html').replace(/\\/g,'/') + '?ov=1', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction('window.__ready===true', { timeout: 20000 });
  const r = await p.evaluate(() => {
    const out = [];
    for (const id of ['s3','s4','s5','s6','s7']) {
      const sc = document.getElementById(id);
      const txt = sc.querySelector('.txt');
      const panelTop = txt.getBoundingClientRect().top - 26;
      let maxBottom = 0, who = '';
      for (const el of sc.querySelectorAll('.plot text, .plot circle[data-t], .plot path[data-t]')) {
        const rr = el.getBoundingClientRect();
        if (rr.height === 0 && rr.width === 0) continue;
        if (rr.bottom > maxBottom) { maxBottom = rr.bottom; who = el.textContent || el.id || el.tagName; }
      }
      out.push({ id, 图文面板顶: Math.round(panelTop), 图表最低元素底: Math.round(maxBottom),
                 最低元素: (who||'').trim().slice(0,12), 被压: maxBottom > panelTop });
    }
    return out;
  });
  for (const x of r) console.log(JSON.stringify(x));
  await b.close();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
