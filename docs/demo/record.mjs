import {record} from './studio.mjs';
import {fileURLToPath} from 'node:url';
const tour={async tour(f){
  const p=f.page,button=name=>p.getByRole('button',{name,exact:true});
  f.mark('Text input and reading speed');await f.camera(720,660,1.22);await f.type(p.locator('#reader-text'),'A good reading rhythm starts with clear text. Choose your pace, press play, and follow one word at a time.');
  await f.camera(720,470,1.22);await f.click(p.locator('input[type=number]'));await p.locator('input[type=number]').fill('180');await p.keyboard.press('Tab');await f.beat(.35);
  f.mark('Playback and focal letter');await f.click(button('Play'));await f.camera(720,320,1.45);await f.beat(2.4);await f.click(button('Pause'));await f.camera();
  f.mark('Scrub through the text');await f.click(p.getByRole('tab',{name:'Scrub',exact:true}));await f.drag(p.getByRole('slider'),.6);await f.camera(720,620,1.22);await f.beat(.55);await f.camera();
  f.mark('Reader settings');await f.click(button('Open settings'));await f.camera(720,410,1.25);await f.click(button('Appearance'));await f.click(p.locator('#font-size'));await f.click(p.getByRole('option',{name:'Large',exact:true}));await p.keyboard.press('Escape');await f.beat(.3);
  await f.assert(()=>p.locator('body').innerText().then(t=>t.includes('Text to read')),'Reader controls and text rendered');
 }}.tour;
await record({name:"wordflash",url:"https://wordflashreader.vercel.app",tour,output:fileURLToPath(new URL('../images/',import.meta.url))});
