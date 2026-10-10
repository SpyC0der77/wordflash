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
 }}.tour;
await record({name:"wordflash",url:"https://wordflashreader.vercel.app",tour,output:fileURLToPath(new URL('../images/',import.meta.url))});
