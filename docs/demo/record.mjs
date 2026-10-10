import {record} from './studio.mjs';
import {fileURLToPath} from 'node:url';
const tour={async tour(f){
  const p=f.page,button=name=>p.getByRole('button',{name,exact:true});
  f.mark('Text input and reading speed');await f.camera(720,660,1.22);await f.type(p.locator('#reader-text'),'A good reading rhythm starts with clear text. Choose your pace, press play, and follow one word at a time.');
  await f.camera(720,470,1.22);await f.click(p.locator('input[type=number]'));await p.locator('input[type=number]').fill('180');await p.keyboard.press('Tab');await f.beat(.35);
  f.mark('Playback and focal letter');await f.click(button('Play'));await f.camera(720,320,1.45);await f.beat(2.4);await f.click(button('Pause'));await f.camera();
  f.mark('Click words in Scrub mode');
  await f.click(p.getByRole('tab',{name:'Scrub',exact:true}));await f.camera(720,450,1.2);
  const scrub=p.locator('#reader-scrub-panel'),slider=p.getByRole('slider');
  async function verifyPosition(index){
   await f.assert(async()=>Number(await slider.getAttribute('aria-valuenow'))===index&&
    await scrub.locator(`[data-word-index="${index}"]`).evaluate(el=>el.classList.contains('reader-highlight')),
    `Position ${index+1} is selected in the slider and highlighted in Scrub mode`);
  }
  await f.click(scrub.locator('[data-word-index="3"]'));await verifyPosition(3);await f.beat(.65);
  await f.click(scrub.locator('[data-word-index="14"]'));await verifyPosition(14);await f.beat(.65);
  f.mark('Drag the reading-position slider forward and backward');
  const track=p.locator('[data-slot="slider-track"]');
  async function seek(ratio){
   const thumb=await slider.boundingBox(),rail=await track.boundingBox();
   const before=Number(await slider.getAttribute('aria-valuenow'));
   await f.move(thumb.x+thumb.width/2,thumb.y+thumb.height/2,.8);
   await p.mouse.down();await f.beat(.15);
   await f.move(rail.x+rail.width*ratio,rail.y+rail.height/2,1.7);
   await p.mouse.up();await f.beat(.65);
   const after=Number(await slider.getAttribute('aria-valuenow'));
   await f.assert(()=>Promise.resolve(after!==before),`Dragging to ${Math.round(ratio*100)}% changes the reading position`);
   await verifyPosition(after);
  }
  await seek(.25);await seek(.85);await f.camera();
  f.mark('Reader settings');await f.click(button('Open settings'));await f.camera(720,410,1.25);await f.click(button('Appearance'));await f.click(p.locator('#font-size'));await f.click(p.getByRole('option',{name:'Large',exact:true}));await p.keyboard.press('Escape');await f.beat(.3);
  await f.assert(()=>p.locator('body').innerText().then(t=>t.includes('Text to read')),'Reader controls and text rendered');
  await f.camera();
  f.mark('Load a real article URL');
  await f.click(p.getByRole('link',{name:'Article Reader',exact:true}));
  await f.type(p.getByPlaceholder('Enter article URL...'),'https://science.nasa.gov/moon/facts/');
  const extraction=p.waitForResponse(r=>r.url().endsWith('/api/extract')&&r.request().method()==='POST');
  await f.click(button('Read'));
  const response=await extraction,data=await response.json();
  await f.assert(()=>Promise.resolve(response.ok()&&data.title?.includes('Moon Facts')&&data.content?.length>1000),'The live extractor returned NASA Moon Facts article content');
  const article=p.locator('.reader-article');
  await article.waitFor({state:'visible'});await f.beat(.6);
  await f.assert(()=>p.getByRole('heading',{name:'Moon Facts - NASA Science',exact:true}).isVisible(),'The extracted article title is visible');
  f.mark('Read with the full article and synchronized highlighting');
  await f.camera(720,490,1.1);
  const articleSlider=p.getByRole('slider');
  const beforePlay=Number(await articleSlider.getAttribute('aria-valuenow'));
  await f.click(button('Play'));await f.beat(2.8);await f.click(button('Pause'));
  const afterPlay=Number(await articleSlider.getAttribute('aria-valuenow'));
  async function verifyArticlePosition(index){
   await f.assert(async()=>Number(await articleSlider.getAttribute('aria-valuenow'))===index&&
    await article.locator(`[data-word-index="${index}"]`).evaluate(el=>el.classList.contains('reader-highlight')),
    `Article word ${index+1} matches the player position and highlight`);
  }
  await f.assert(()=>Promise.resolve(afterPlay>beforePlay),'Article playback advances the reading position');
  await verifyArticlePosition(afterPlay);
  f.mark('Click an article word to jump the player');
  await f.click(article.locator('[data-word-index="30"]'));await verifyArticlePosition(30);await f.beat(.65);
  await f.camera();await f.scroll(180,1.2);
  const laterWord=article.locator('[data-word-index]').filter({hasText:/^colonization$/}).first();
  const laterIndex=Number(await laterWord.getAttribute('data-word-index'));
  await f.click(laterWord);await verifyArticlePosition(laterIndex);await f.beat(.6);
  await f.click(button('Play'));await f.beat(2);await f.click(button('Pause'));
  await f.assert(async()=>Number(await articleSlider.getAttribute('aria-valuenow'))>laterIndex,'Article playback resumes from the clicked word');
 }}.tour;
await record({name:"wordflash",url:"https://wordflashreader.vercel.app",tour,output:fileURLToPath(new URL('../images/',import.meta.url))});
