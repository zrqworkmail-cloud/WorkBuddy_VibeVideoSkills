const path=require('path'); const puppeteer=require('puppeteer-core');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless:true,args:['--allow-file-access-from-files','--disable-gpu','--no-sandbox']});
  const p=await b.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.goto('file:///'+path.join(ROOT,'src','index.html').replace(/\\/g,'/')+'?ov=1',{waitUntil:'load'});
  await p.evaluate(()=>document.fonts.ready);
  await p.waitForFunction('window.__ready===true',{timeout:20000});
  console.log('ready | DUR', await p.evaluate(()=>window.__DUR));
  console.log('\nS3 存款（应单调上升到接近100%）:');
  for(const lt of [0.5,3,6,9,12,15,17]){
    await p.evaluate(t=>window.__seek(t), 17.0899+lt);
    const v=await p.evaluate(()=>document.querySelector('#s3-pct').textContent);
    console.log(`  lt=${String(lt).padStart(4)} → ${v}`);
  }
  console.log('\nS9 存款（应 99%→0%，4.7s 归零）:');
  for(const lt of [2.4,3.2,3.8,4.4,4.8,6,8]){
    await p.evaluate(t=>window.__seek(t), 126.04+lt);
    const v=await p.evaluate(()=>document.querySelector('#s9-pct').textContent);
    console.log(`  lt=${String(lt).padStart(4)} → ${v}`);
  }
  console.log('\nERRORS:', errs.length?errs:'none');
  await b.close();
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
