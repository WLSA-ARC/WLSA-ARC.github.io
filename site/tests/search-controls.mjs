import assert from 'node:assert/strict';

export async function checkSearchControls(page, base) {
  const geometry=()=>page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    return {search:rect('#searchForm'),filters:rect('#filters'),header:rect('#headerMountPoint'),scrollY,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const sameRect=(actual,expected,keys=['x','y','width','height'])=>{
    for(const key of keys)assert.ok(Math.abs(actual[key]-expected[key])<1,`${key} moved: ${JSON.stringify({actual,expected})}`);
  };
  for(const viewport of [{width:1638,height:1000},{width:1280,height:720},{width:800,height:600},{width:601,height:400},{width:390,height:900},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    for(const query of ['', '?q=physics', '?q=impossiblekeyword']) {
      await page.goto(base+'/search.html'+query);await page.evaluate(()=>document.fonts.ready);
      const mobile=viewport.width<=600;
      const before=await geometry();assert.equal(before.overflow,false,JSON.stringify({viewport,query,before}));
      assert.ok(before.search.y>=before.header.height);
      const wheelX=before.search.x+before.search.width/2;
      for(const delta of [50,650,1800,99999,-99999]) {
        await page.mouse.move(wheelX,Math.min(viewport.height-10,before.search.y+180));
        await page.mouse.wheel(0,delta);await page.waitForTimeout(90);
        const after=await geometry();sameRect(after.search,before.search);
        if(!mobile){
          sameRect(after.filters,before.filters,['x','y','width']);
          assert.ok(after.filters.y+after.filters.height<=viewport.height-23,'Filters extend past viewport: '+JSON.stringify(after));
        }
      }
      if(!mobile) {
        const filter=page.locator('#filters');
        assert.ok(before.filters.y+before.filters.height<=viewport.height-23);
        // The last filter remains reachable on short screens without moving the page.
        const scrollBefore=await page.evaluate(()=>scrollY);
        await page.mouse.move(before.filters.x+40,before.filters.y+Math.min(80,before.filters.height/2));
        await page.mouse.wheel(0,3000);
        if(viewport.height<900)await page.waitForFunction(()=>document.querySelector('#filters').scrollTop>0);
        assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
        await filter.evaluate(el=>el.scrollTop=0);
      } else {
        assert.equal(await page.locator('#filters').isVisible(),false);
        await page.getByRole('button',{name:'Refine results',exact:true}).click();
        assert.equal(await page.locator('#filters').isVisible(),true);
        const opened=await geometry();
        assert.ok(opened.filters.y>=opened.search.y+opened.search.height);
        assert.ok(opened.filters.y+opened.filters.height<=viewport.height-15);
        await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(90);
        const bottom=await geometry();sameRect(bottom.search,before.search);
        assert.ok(bottom.filters.y+bottom.filters.height<=viewport.height-15,'Mobile filters extend past viewport');
        await page.keyboard.press('Escape');assert.equal(await page.locator('#filters').isVisible(),false);
      }
    }
  }
}
