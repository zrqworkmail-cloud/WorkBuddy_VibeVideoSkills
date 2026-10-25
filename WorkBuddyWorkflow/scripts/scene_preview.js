// 单镜快剪预览：只渲染目标分镜的覆盖层，叠到底板对应帧上，秒级 QC 文字/时序/构图。
// 用法：node scene_preview.js s3 [帧数=5] [--base]
//   s3          分镜 id（对应 timeline 里的 id 与 out/base/base_s3.mp4）
//   [帧数]       在该分镜时长内均匀采样几帧（默认 5）
//   --base       额外输出「叠加到底板视频帧」的图（需 base_s<id>.mp4 已存在）
// 不传 --base 时只出深底覆盖层图（纯查文字/排版，最快）。
const fs=require('fs'), path=require('path');
const {spawn}=require('child_process');
const puppeteer=require('puppeteer-core');
const { FILM, SRC, OUT } = require('./_film');
const FF='D:/tools/ffmpeg/bin/ffmpeg.exe';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const sid=process.argv[2];
const N=parseInt(process.argv[3]||'5',10);
const useBase=process.argv.includes('--base');
if(!sid){console.error('用法: node scene_preview.js <s3> [帧数] [--base]');process.exit(1);}

function ff(args){return new Promise((res,rej)=>{const p=spawn(FF,['-hide_banner','-loglevel','error',...args]);let e='';p.stderr.on('data',d=>e+=d);p.on('close',c=>c===0?res():rej(new Error(e.slice(-400))));});}

(async()=>{
  const browser=await puppeteer.launch({executablePath:CHROME,headless:true,
    args:['--allow-file-access-from-files','--force-color-profile=srgb','--font-render-hinting=none',
      '--disable-lcd-text','--hide-scrollbars','--mute-audio','--no-sandbox']});
  const page=await browser.newPage();
  await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await page.goto('file:///'+path.join(SRC,'index.html').replace(/\\/g,'/')+'?ov=1',{waitUntil:'load',timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction('window.__ready === true',{timeout:20000});
  const sc=await page.evaluate(id=>window.TIMELINE.scenes.find(s=>s.id===id),sid);
  if(!sc){console.error('timeline 里找不到分镜',sid);process.exit(1);}
  // 注意：这里绝不能给 body 设不透明底色。
  // 覆盖层必须保持透明，否则叠底板时会把 base 整帧盖掉 ——
  // 预览就会显示成"没有底板的干净画面"，与成片完全不一致（曾因此漏掉 s8 文字压柱子的缺陷）。
  // 纯覆盖层图（不带 --base）在图片查看器里显示为黑底，属正常。
  console.log(`[${FILM||'reference'}] [${sid}] ${sc.start.toFixed(2)}–${sc.end.toFixed(2)}s  采样 ${N} 帧  base=${useBase}`);
  for(let i=0;i<N;i++){
    const t=sc.start+(sc.end-sc.start)*((i+0.5)/N);
    const local=(t-sc.start).toFixed(3);
    await page.evaluate(tt=>window.__seek(tt),t);
    await new Promise(r=>setTimeout(r,90));
    const ovP=path.join(OUT,`_prev_${sid}_${i}_ov.png`);
    await page.screenshot({path:ovP,clip:{x:0,y:0,width:1080,height:1920},omitBackground:true,optimizeForSpeed:true});
    if(useBase){
      const baseSeg=path.join(OUT,'base',`base_${sid}.mp4`);
      if(fs.existsSync(baseSeg)){
        const bf=path.join(OUT,`_prev_${sid}_${i}_base.png`);
        await ff(['-y','-ss',local,'-i',baseSeg,'-frames:v','1',bf]);
        const comp=path.join(OUT,`_prev_${sid}_${i}.png`);
        await ff(['-y','-i',bf,'-i',ovP,'-filter_complex','[0:v][1:v]overlay=0:0:format=auto,scale=540:960','-frames:v','1',comp]);
        console.log(`  t=${t.toFixed(2)}s  -> ${path.basename(comp)}`);
      } else console.log(`  t=${t.toFixed(2)}s  (无 base_${sid}.mp4，仅覆盖层)`);
    } else {
      console.log(`  t=${t.toFixed(2)}s  -> ${path.basename(ovP)}`);
    }
  }
  console.log(errs.length?('JS ERRORS:\n'+errs.slice(0,8).join('\n')):'NO JS ERRORS');
  await browser.close();
})().catch(e=>{console.error('PREVIEW FAIL',e.message);process.exit(1);});
