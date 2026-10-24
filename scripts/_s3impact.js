// 单帧覆盖层捕获（透明PNG）: node _s3impact.js <globalT> <outPng>
const path=require('path');const puppeteer=require('puppeteer-core');
const ROOT=path.resolve(__dirname,'..');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const t=parseFloat(process.argv[2]), out=process.argv[3];
(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME,headless:true,
    args:['--allow-file-access-from-files','--font-render-hinting=none','--mute-audio','--no-sandbox']});
  const p=await b.newPage();
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.goto('file:///'+path.join(ROOT,'src','index.html').replace(/\\/g,'/')+'?ov=1',{waitUntil:'load',timeout:60000});
  await p.evaluate(()=>document.fonts.ready);
  await p.waitForFunction('window.__ready === true',{timeout:20000});
  await p.evaluate(tt=>window.__seek(tt),t);
  await new Promise(r=>setTimeout(r,100));
  await p.screenshot({path:out,clip:{x:0,y:0,width:1080,height:1920},omitBackground:true,optimizeForSpeed:true});
  await b.close();
  console.log('captured',out,'at t='+t);
})().catch(e=>{console.error(e.message);process.exit(1);});
