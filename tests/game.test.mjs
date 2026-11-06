import {test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
test('shared engine preserves listening gate and independent fingers, rejects holds, rotates targets',async()=>{
 const listeners=new Map(),elements=new Map(),timers=new Map();let now=0,point=null,nextTimer=1;
 class Element{constructor(){this.children=[];this.dataset={};this.style={setProperty(){}};this.classes=new Set();this.classList={add:(...c)=>c.forEach(x=>this.classes.add(x)),remove:(...c)=>c.forEach(x=>this.classes.delete(x)),contains:c=>this.classes.has(c),toggle:(c,b)=>{if(b===undefined)b=!this.classes.has(c);b?this.classes.add(c):this.classes.delete(c)}};this.events=new Map()}set innerHTML(v){this.children=[]}get innerHTML(){return''}appendChild(e){this.children.push(e)}setAttribute(){}addEventListener(e,f){this.events.set(e,f)}contains(e){return this.children.includes(e)}closest(){return this}getBoundingClientRect(){return{left:0,top:0,width:100,height:100}}remove(){}}
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},querySelector:()=>new Element(),documentElement:new Element(),body:new Element(),createElement:()=>new Element(),addEventListener:(e,f)=>listeners.set(e,f),elementFromPoint:()=>point};
 class Audio{constructor(src){this.src=src;this.paused=true;this.currentTime=0}load(){}play(){this.paused=false;this.currentTime=1;return Promise.resolve()}pause(){this.paused=true}}
 const pack=JSON.parse(fs.readFileSync('packs/animals/pack.json'));const catalog=JSON.parse(fs.readFileSync('packs/catalog.json'));
 const ctx={document,window:{addEventListener(){}},navigator:{},Audio,URL,URLSearchParams,performance:{now:()=>now},location:{href:'https://example.com/games/game.html?pack=animals',search:'?pack=animals'},setTimeout:(f,ms)=>{const id=nextTimer++;timers.set(id,{f,ms});return id},clearTimeout:id=>timers.delete(id),fetch:async p=>({ok:true,json:async()=>String(p).includes('catalog')?catalog:pack}),console};ctx.globalThis=ctx;
 let src=fs.readFileSync('shared/game.js','utf8');src=src.replace('}catch(err){document.getElementById',"globalThis.debug={get target(){return target},get locked(){return locked},get active(){return activeAudio},get previous(){return previousChoices},chooseRound,resetSession,clearChoicePointers};\n}catch(err){document.getElementById");
 vm.runInNewContext(src,ctx);await new Promise(ok=>setImmediate(ok));assert.ok(ctx.debug);const start=elements.get('startBtn').events.get('pointerdown');await start({preventDefault(){}});assert.equal(ctx.debug.locked,true);assert.ok(elements.get('animalGrid').classList.contains('gated'));
 ctx.debug.active.onended();assert.equal(ctx.debug.locked,false);assert.equal(elements.get('animalGrid').children.length,4);
 const target=ctx.debug.target;point=elements.get('animalGrid').children.find(x=>x.dataset.key===target.key);
 function event(id){return{pointerId:id,pointerType:'touch',clientX:30,clientY:30,preventDefault(){}}}
 now=0;listeners.get('pointerdown')(event(1));now=900;listeners.get('pointerdown')(event(2));now=1000;listeners.get('pointerup')(event(2));assert.equal(ctx.debug.locked,true,'a second finger selects while the first stays down');assert.ok(point.classList.contains('correct'));
 ctx.debug.chooseRound(false);assert.notEqual(ctx.debug.target.key,target.key);point=elements.get('animalGrid').children.find(x=>x.dataset.key===ctx.debug.target.key);now=1100;listeners.get('pointerdown')(event(3));now=2000;listeners.get('pointerup')(event(3));assert.equal(ctx.debug.locked,false,'long contact is ignored');
 const seen=new Set([target.key,ctx.debug.target.key]);for(let i=0;i<50;i++){ctx.debug.chooseRound(false);assert.ok(!seen.has(ctx.debug.target.key));seen.add(ctx.debug.target.key)}assert.equal(seen.size,52);
});

test('a plain game link opens the chooser without loading a default pack',async()=>{
 let destination,requests=0;const src=fs.readFileSync('shared/game.js','utf8');
 await vm.runInNewContext(src,{URLSearchParams,location:{search:'?lang=it',replace:url=>destination=url},fetch:()=>{requests++}});
 assert.equal(destination,'./?lang=it');assert.equal(requests,0);
});

test('the vehicles game respects Italian selection and plays its Italian recordings',async()=>{
 const elements=new Map();class E{constructor(){this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){},toggle(){},contains:()=>true};this.style={setProperty(){}}}appendChild(e){this.children.push(e)}set innerHTML(v){this.children=[]}setAttribute(){}addEventListener(n,f){this.events[n]=f}}
 const get=id=>{if(!elements.has(id))elements.set(id,new E());return elements.get(id)};
 const document={getElementById:get,querySelector:()=>new E(),documentElement:new E(),body:new E(),createElement:()=>new E(),addEventListener(){}};let played;
 class Audio{constructor(src){this.src=src}load(){}pause(){}play(){played=this.src;this.paused=false;this.currentTime=1;return Promise.resolve()}}
 const catalog=JSON.parse(fs.readFileSync('packs/catalog.json')),pack=JSON.parse(fs.readFileSync('packs/transportation/pack.json'));
 const ctx={document,window:{addEventListener(){}},Audio,navigator:{},URL,URLSearchParams,location:{href:'https://example.com/game.html?pack=transportation&lang=it',search:'?pack=transportation&lang=it'},setTimeout:()=>1,clearTimeout(){},fetch:async p=>({ok:true,json:async()=>String(p).includes('catalog')?catalog:pack})};
 await vm.runInNewContext(fs.readFileSync('shared/game.js','utf8'),ctx);
 assert.equal(get('startTitle').textContent,pack.title.it);assert.ok(pack.items.some(i=>i.prompt_it===get('promptText').textContent));assert.equal(get('animalGrid').children.length,4);assert.match(get('allGamesLink').textContent,/Scegli/);
 await get('startBtn').events.pointerdown({preventDefault(){}});assert.ok(played.includes('/packs/transportation/audio/it/'));
});
