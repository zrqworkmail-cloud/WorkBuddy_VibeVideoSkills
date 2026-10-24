// 隔离实验：哪组启动参数能让 Chrome 截图保留 alpha 通道
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { execSync } = require('child_process');

const CASES = {
  '无参数': [],
  'disable-gpu': ['--disable-gpu'],
  'headless=old': ['--headless=old'],
  'old+disable-gpu': ['--headless=old', '--disable-gpu'],
  'swiftshader': ['--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu'],
  'force-color': ['--force-color-profile=srgb', '--disable-gpu'],
};

// PNG: 8B 签名 | 4B 长 | 'IHDR' | 4B 宽 | 4B 高 | 位深@24 | 颜色类型@25
function struct_ct(d) {
  return d.readUInt8(25);
}

(async () => {
  for (const [name, args] of Object.entries(CASES)) {
    try {
      const b = await puppeteer.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true, args
      });
      const p = await b.newPage();
      await p.setViewport({ width: 400, height: 400 });
      await p.setContent(
        '<body style="margin:0;background:transparent">' +
        '<div style="width:200px;height:200px;background:red;position:absolute;left:0;top:0"></div></body>');
      const buf = await p.screenshot({
        type: 'png', omitBackground: true,
        clip: { x: 0, y: 0, width: 400, height: 400 }
      });
      fs.writeFileSync('out/qc/ta.png', buf);
      await b.close();
      const ct = struct_ct(fs.readFileSync('out/qc/ta.png'));
      const names = { 0: '灰度', 2: 'RGB无Alpha', 3: '调色板', 4: '灰度+A', 6: 'RGBA有Alpha' };
      console.log(name.padEnd(20), `colorType=${ct}`, names[ct] || '?', `(${(buf.length / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(name.padEnd(20), '启动失败', e.message.slice(0, 80));
    }
  }
})();
