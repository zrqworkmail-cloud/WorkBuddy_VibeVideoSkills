// 临时 QC：加载页面，跳到指定时间截图（深底），并打印 console 错误
const path=require('path');
const {spawn}=require('child_process');
const puppeteer=require('puppeteer-core');
const ROOT=path.resolve(__dirname,'..');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const times=process.argv[2]?process.argv[2].split(',').map(Number):[42];
(async()=>{
  const browser=await puppeteer.launch({executablePath:CHROME,headless:true,
    args:['--allow-file-access-from-files','--force-color-profile=srgb','--font-render-hinting=none',
      '--disable-lcd-text','--hide-scrollbars','--mute-audio','--no-sandbox']});
  const page=await browser.newPage();
  await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
  await page.goto('file:///'+path.join(ROOT,'src','index.html').replace(/\\/g,'/')+'?ov=1',{waitUntil:'load',timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction('window.__ready === true',{timeout:20000});
  await page.evaluate(()=>{document.body.style.background='#0b0f14';});
  for(const t of times){
    await page.evaluate(tt=>window.__seek(tt),t);
    await new Promise(r=>setTimeout(r,120));
    const f=`out/ai/_ovqc_${t.toFixed(1)}.png`;
    await page.screenshot({path:path.join(ROOT,f),clip:{x:0,y:0,width:1080,height:1920},optimizeForSpeed:true});
    console.log('shot',t,'->',f);
  }
  console.log(errs.length?('ERRORS:\n'+errs.slice(0,12).join('\n')):'NO JS ERRORS');
  await browser.close();
})().catch(e=>{console.error('PROBE FAIL',e.message);process.exit(1);});
