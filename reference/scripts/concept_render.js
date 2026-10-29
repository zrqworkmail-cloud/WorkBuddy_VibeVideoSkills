// 渲染分镜概念首帧：src/cN.html → out/ai/concepts/cN.png（704×1280，供 Wan2.2 I2V 作首帧）
// 用法: node scripts/concept_render.js [要渲染的场景号，逗号分隔]  例: node scripts/concept_render.js 2,3
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const { FILM, SRC, OUT } = require('./_film');

const OUTC = path.join(OUT, 'ai', 'concepts');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 704, H = 1280;

const ids = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);

(async () => {
  fs.mkdirSync(OUTC, { recursive: true });
  console.log(`[${FILM || 'reference'}] 概念帧 → ${OUTC}`);
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--hide-scrollbars', '--no-sandbox', '--disable-gpu']
  });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message)));
  for (const id of ids) {
    const html = `c${id}.html`;
    await p.goto('file:///' + path.join(SRC, html).replace(/\\/g, '/'), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 900));
    const out = path.join(OUTC, `c${id}.png`);
    fs.writeFileSync(out, await p.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } }));
    console.log('✔', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  }
  await b.close();
  if (errs.length) { console.error('页面错误:', errs); process.exit(1); }
})().catch(e => { console.error('✖', e.message); process.exit(1); });
