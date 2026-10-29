// 抖音创作者平台半自动填表：上传视频 → 填标题/简介 → 截图 → 停下（不点发布）
//
// 关键教训：
//   1) 扫码登录后页面会跳到**创作者首页**，不是上传页 —— 必须在找不到上传控件时重新导航
//   2) 用 networkidle2 等页面渲染完，domcontentloaded 时控件还没挂上
//   3) 封面上传在弹窗里，自动化很脆，留给人工点
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const UPLOAD_URL = 'https://creator.douyin.com/creator-micro/content/upload';
const PROFILE = 'C:/Users/Admin/AppData/Local/Temp/douyin-upload-profile';

const VIDEO = process.argv[2];
const TITLE = process.argv[3] || '';
const DESC_FILE = process.argv[4];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[douyin]', ...a);

async function findVideoInput(page) {
  const inputs = await page.$$('input[type=file]');
  for (const inp of inputs) {
    const accept = await page.evaluate((el) => el.getAttribute('accept') || '', inp);
    if (accept.includes('video')) return inp;
  }
  return null;
}

async function main() {
  if (!VIDEO || !fs.existsSync(VIDEO)) throw new Error('视频不存在：' + VIDEO);

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, defaultViewport: null,
    userDataDir: PROFILE,
    args: ['--start-maximized', '--no-first-run', '--no-default-browser-check',
           '--disable-blink-features=AutomationControlled'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();

  log('打开上传页…');
  await page.goto(UPLOAD_URL, { waitUntil: 'networkidle2', timeout: 60000 })
    .catch((e) => log('goto 警告：' + e.message));
  await sleep(3500);
  log('当前 URL：' + page.url());

  // 找不到就重新导航（登录后可能被重定向到首页）
  let input = await findVideoInput(page);
  for (let i = 0; i < 6 && !input; i++) {
    log('没找到上传控件，重新导航（第 ' + (i + 1) + ' 次）…');
    await page.goto(UPLOAD_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await sleep(3000);
    input = await findVideoInput(page);
  }
  if (!input) throw new Error('仍找不到视频上传控件（可能未登录）');

  log('开始上传视频：' + path.basename(VIDEO));
  await input.uploadFile(path.resolve(VIDEO));

  // 等进入编辑页：出现标题输入框
  log('等待转码 / 进入编辑页…');
  let titleBox = null;
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    titleBox = await page.$('input[placeholder*="标题"]');
    if (!titleBox) titleBox = await page.$('textarea[placeholder*="标题"]');
    if (!titleBox) titleBox = await page.$('input[placeholder*="作品"]');
    if (titleBox) break;
    if (i % 10 === 9) log('  仍在等待…（' + (i + 1) * 2 + 's）');
  }
  if (!titleBox) {
    await page.screenshot({ path: path.join(path.dirname(VIDEO), '_douyin_stuck.png') });
    throw new Error('没等到标题输入框，已截图 _douyin_stuck.png');
  }
  log('✔ 已进入编辑页');

  // 标题
  if (TITLE) {
    await titleBox.click({ clickCount: 3 }).catch(() => {});
    await page.keyboard.press('Backspace');
    await titleBox.type(TITLE, { delay: 25 });
    log('✔ 标题：' + TITLE);
  }

  // 简介：取面积最大的 contenteditable
  if (DESC_FILE && fs.existsSync(DESC_FILE)) {
    const desc = fs.readFileSync(DESC_FILE, 'utf8').trim();
    const eds = await page.$$('[contenteditable="true"]');
    let best = null, bestArea = 0;
    for (const e of eds) {
      const b = await e.boundingBox();
      const area = b ? b.width * b.height : 0;
      if (area > bestArea) { bestArea = area; best = e; }
    }
    if (best) {
      await best.click();
      await sleep(300);
      for (const line of desc.split('\n')) {
        if (line) await page.keyboard.type(line, { delay: 1 });
        await page.keyboard.down('Shift');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Shift');
      }
      log('✔ 简介已填（' + desc.length + ' 字）');
    } else {
      log('· 没找到正文编辑器，简介请手动粘贴（' + path.basename(DESC_FILE) + '）');
    }
  }

  const shot = path.join(path.dirname(VIDEO), '_douyin_ready.png');
  await page.screenshot({ path: shot });
  log('截图：' + shot);
  log('');
  log('==== 表单已填好，未点发布 ====');
  log('请手动完成：① 封面 ② 自主声明「内容由 AI 生成」 ③ 章节时间码 ④ 点发布');
  log('浏览器保持打开，别关。');
  // 常驻：不退出进程，否则 puppeteer 会把浏览器一起关掉，表单状态全丢（踩过一次）
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => { console.error('✖ ' + e.message); process.exit(1); });
