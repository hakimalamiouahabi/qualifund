let browserPromise;
async function getBrowser(){
  if(!browserPromise){
    browserPromise=import('playwright').then(async({chromium})=>chromium.launch({headless:true,args:['--disable-dev-shm-usage','--no-sandbox']}));
  }
  return browserPromise;
}
export async function browserHtml(url,{timeoutMs=45000,waitForSelector=null,waitAfterMs=900}={}){
  const browser=await getBrowser(),context=await browser.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
    locale:'fr-FR',
    ignoreHTTPSErrors:true
  }),page=await context.newPage();
  try{
    await page.route('**/*',route=>{
      const t=route.request().resourceType();
      if(['image','media','font'].includes(t))route.abort();else route.continue();
    });
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:timeoutMs});
    }catch(e){
      const html=await page.content().catch(()=> '');
      const bodyText=await page.locator('body').innerText({timeout:1500}).catch(()=> '');
      if(html.length<1200||bodyText.trim().length<40)throw e;
    }
    if(waitForSelector){
      await page.waitForSelector(waitForSelector,{state:'attached',timeout:Math.min(20000,timeoutMs)}).catch(()=>null);
    }
    await page.waitForTimeout(waitAfterMs);
    return{html:await page.content(),url:page.url(),title:await page.title()};
  }finally{
    await context.close();
  }
}
export async function closeBrowser(){
  if(browserPromise){
    try{await (await browserPromise).close()}catch{}
    browserPromise=null;
  }
}
