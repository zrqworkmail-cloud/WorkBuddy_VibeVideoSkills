// 名词卡与图表区域重叠检测 + 导出目检帧
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--disable-gpu', '--no-sandbox']
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'src', 'index.html').replace(/\\/g, '/') + '?ov=1', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction('window.__ready===true', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 500));
  console.log('DUR =', await p.evaluate(() => window.__DUR));

  // 布局重叠检测：术语卡镜头里，图表底边 vs 文字块顶边（含 ::before 外扩 26px）
  const geo = await p.evaluate(() => {
    const out = [];
    for (const id of ['s3', 's4', 's5', 's6', 's7', 's8']) {
      const sc = document.getElementById(id);
      const plot = sc.querySelector('.plot');
      const txt = sc.querySelector('.txt');
      if (!plot || !txt) { out.push({ id, note: 'no plot/txt' }); continue; }
      const pr = plot.getBoundingClientRect(), tr = txt.getBoundingClientRect();
      out.push({ id, plotBottom: Math.round(pr.bottom), txtTop: Math.round(tr.top - 26),
                 txtBottom: Math.round(tr.bottom), overlap: Math.round(pr.bottom - (tr.top - 26)) });
    }
    return out;
  });
  console.log('\n布局检测（单位 px，overlap>0 表示文字卡片压住图表）：');
  for (const g of geo) console.log(' ', JSON.stringify(g));

  // 导出目检帧（名词卡全部出现的时刻）
  for (const t of [26.6, 43.0, 60.0, 77.0, 95.5, 108.5]) {
    await p.evaluate(tt => window.__seek(tt), t);
    const has = await p.evaluate(() => {
      const vis = [...document.querySelectorAll('.termcard')].map(n => +getComputedStyle(n).opacity);
      return Math.max(0, ...vis);
    });
    fs.writeFileSync(path.join(ROOT, 'out', 'qc', `term_${t}.png`),
      await p.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 1080, height: 1920 } }));
    console.log(`→ term_${t}.png  最大术语卡透明度 ${has.toFixed(2)}`);
  }
  await b.close();
  console.log('ERRORS:', errs.length ? errs : 'none');
})().catch(e => { console.error('✖', e.message); process.exit(1); });
