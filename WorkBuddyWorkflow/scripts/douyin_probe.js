// 诊断：打开上传页，截图 + 导出页面结构，看登录态和上传控件长什么样
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/Users/Admin/AppData/Local/Temp/douyin-upload-profile';
const OUT = process.argv[2];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, defaultViewport: null,
    userDataDir: PROFILE,
    args: ['--start-maximized', '--no-first-run', '--no-default-browser-check',
           '--disable-blink-features=AutomationControlled'],
  });
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  await page.goto('https://creator.douyin.com/creator-micro/content/upload',
    { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('goto:', e.message));
  await new Promise(r => setTimeout(r, 4000));

  console.log('URL:', page.url());
  const info = await page.evaluate(() => {
    const files = [...document.querySelectorAll('input[type=file]')]
      .map(e => ({ accept: e.accept, name: e.name, hidden: e.offsetParent === null }));
    const btns = [...document.querySelectorAll('button, [role=button], .semi-button')]
      .map(e => (e.innerText || '').trim()).filter(t => t && t.length < 20).slice(0, 40);
    const inputs = [...document.querySelectorAll('input, textarea, [contenteditable=true]')]
      .map(e => ({ tag: e.tagName, ph: e.placeholder || '', ce: e.getAttribute('contenteditable') }))
      .slice(0, 20);
    return { title: document.title, files, btns, inputs, bodyLen: document.body.innerText.length };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(OUT, '_probe.png') });
  console.log('截图：' + path.join(OUT, '_probe.png'));
  await browser.close();
})().catch(e => { console.error('✖', e.message); process.exit(1); });
