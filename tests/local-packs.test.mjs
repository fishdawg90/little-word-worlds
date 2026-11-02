import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {importLocalPack,listLocalPacks,loadLocalPack} from '../shared/local-packs.mjs';
test('browser import persists packs, plays bundled media, rejects duplicates and strips credentials',async()=>{
  const stored=new Map();let writes=0,onHide;const priorDb=globalThis.indexedDB,priorListener=globalThis.addEventListener;
  globalThis.addEventListener=(event,fn)=>{if(event==='pagehide')onHide=fn};
  globalThis.indexedDB={open(){const r={result:{close(){},transaction(){const t={objectStore(){const operation=fn=>{const req={};queueMicrotask(()=>{req.result=fn();req.onsuccess?.();t.oncomplete?.()});return req};return{getAll:()=>operation(()=>structuredClone([...stored.values()])),get:id=>operation(()=>structuredClone(stored.get(id))),add:b=>operation(()=>{if(stored.has(b.pack.id))throw Error('Duplicate');stored.set(b.pack.id,structuredClone(b));writes++;return b.pack.id}),put:b=>operation(()=>{stored.set(b.pack.id,structuredClone(b));writes++;return b.pack.id})}}};return t}}};queueMicrotask(()=>r.onsuccess());return r}};
  const names=['apple','pear','orange','banana'],image=fs.readFileSync('packs/animals/images/zebra.webp').toString('base64'),audio=fs.readFileSync('packs/animals/audio/en/zebra.mp3').toString('base64');
  const items=names.map(key=>({key,en:key,it:'it-'+key,prompt_en:'Where is the '+key+'?',prompt_it:'Dov’è '+key+'?',image:`images/${key}.webp`,audio_en:`audio/en/${key}.mp3`,audio_it:`audio/it/${key}.mp3`}));
  const files={};for(const i of items){files[i.image]={mime:'image/webp',base64:image,generation:{unused:'metadata'}};for(const k of ['audio_en','audio_it'])files[i[k]]={mime:'audio/mpeg',base64:audio}}
  const bundle={format:'vocabulary-pack-bundle',version:1,ready:true,pack:{format:'vocabulary-pack',version:1,id:'fruit',title:{en:'Fruit',it:'Frutta'},items,shared:{praise:['https://untrusted.example/file.mp3']}},files,settings:{key:'do-not-store'}};
  const file={size:5000,text:async()=>JSON.stringify(bundle)},catalog=({packs:JSON.parse(fs.readFileSync('packs/catalog.json')).packs.filter(p=>p.id==='animals')});
  try{
    assert.equal((await importLocalPack(file,catalog)).id,'fruit');assert.equal(writes,1);assert.ok(!JSON.stringify([...stored.values()]).includes('do-not-store'));assert.ok(!JSON.stringify([...stored.values()]).includes('untrusted.example'));
    const all=await listLocalPacks();assert.equal(all.length,1);assert.equal(all[0].local,true);
    const playable=await loadLocalPack('fruit');assert.ok(playable.items[0].image.startsWith('blob:'));assert.ok(playable.items[0].audio_it.startsWith('blob:'));assert.equal(playable.shared.praise.length,6);assert.ok(!playable.shared.praise[0].includes('untrusted'));onHide({persisted:false});
    await assert.rejects(importLocalPack(file,catalog),/already exists/);assert.equal(writes,1);
    await assert.rejects(loadLocalPack('missing'),/not saved in this browser/);
    await assert.rejects(importLocalPack({size:5000,text:async()=>'{invalid'},catalog),/Could not read/);
    const extension=structuredClone(bundle);extension.pack.authoring={settings:{imagePrompt:'Soft {item}',key:'secret'},source:{id:'fruit',itemKeys:names}};const extra={...items[0],key:'carrot',en:'carrot',it:'carota',image:'images/carrot.webp',audio_en:'audio/en/carrot.mp3',audio_it:'audio/it/carrot.mp3'};extension.pack.items.push(extra);extension.files[extra.image]=extension.files[items[0].image];for(const k of ['audio_en','audio_it'])extension.files[extra[k]]=extension.files[items[0][k]];await importLocalPack({size:9000,text:async()=>JSON.stringify(extension)},catalog);assert.equal((await listLocalPacks()).length,1);assert.equal((await listLocalPacks())[0].items.length,5);assert.equal(writes,2);assert.ok(!JSON.stringify([...stored.values()]).includes('secret'));
    stored.clear();const invalid=structuredClone(bundle);invalid.pack.id='bad';invalid.files['images/apple.webp'].mime='text/html';await assert.rejects(importLocalPack({size:5000,text:async()=>JSON.stringify(invalid)},catalog),/format/);assert.equal(writes,2);
  }finally{globalThis.indexedDB=priorDb;globalThis.addEventListener=priorListener;}
});
