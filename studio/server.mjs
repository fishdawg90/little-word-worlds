import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {validateItems} from './core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||8777), origin=`http://127.0.0.1:${port}`;
const catalogFile=path.join(root,'packs/catalog.json');
const deployedCatalog='https://fishdawg90.github.io/little-word-worlds/packs/catalog.json';
async function catalog(){
  const local=JSON.parse(await fs.readFile(catalogFile,'utf8'));
  try{const r=await fetch(deployedCatalog+'?t='+Date.now(),{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('HTTP '+r.status);const latest=await r.json();if(!Array.isArray(latest.packs))throw Error('Invalid catalogue');return {...latest,source:'live',checked_at:new Date().toISOString()};}
  catch{return {...local,source:'bundled',checked_at:new Date().toISOString()};}
}
async function api(key,endpoint,body){
  const r=await fetch('https://api.openai.com/v1/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});
  if(!r.ok){let e;try{e=await r.json()}catch{}throw Error(`OpenAI ${r.status}: ${e?.error?.message||r.statusText}`)}
  return r;
}
function wav(pcm){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(24000,24);h.writeUInt32LE(48000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);}
export function realtimeSpeech(key,b,Socket=WebSocket){
  return new Promise((resolve,reject)=>{
    const ws=new Socket('wss://api.openai.com/v1/realtime?model='+encodeURIComponent(b.model||'gpt-realtime-2.1-mini'),{headers:{Authorization:'Bearer '+key}});
    const chunks=[];let settled=false,transcript='';
    const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);ws.close();err?reject(err):resolve(value)};
    const timer=setTimeout(()=>finish(Error('Voice request timed out.')),120000);
    ws.on('error',()=>finish(Error('Could not connect to the OpenAI voice service. Check your key, model access and connection.')));
    ws.on('close',()=>{if(!settled)finish(Error('Voice connection closed before audio finished.'))});
    ws.on('message',raw=>{try{
      const e=JSON.parse(raw.toString());
      if(e.type==='session.created')ws.send(JSON.stringify({type:'session.update',session:{type:'realtime',output_modalities:['audio'],audio:{output:{voice:b.voice,format:{type:'audio/pcm',rate:24000}}},instructions:'You are a recording artist. Read the supplied text verbatim, without introductions, extra words or responses. '+b.instructions}}));
      if(e.type==='session.updated')ws.send(JSON.stringify({type:'response.create',response:{output_modalities:['audio'],input:[],instructions:'Read exactly this text in '+(b.language==='it'?'Italian':'English')+'. Do not translate, answer, or add words. '+b.instructions+'\nText to read: '+JSON.stringify(b.text)}}));
      if(e.type==='response.output_audio.delta')chunks.push(Buffer.from(e.delta,'base64'));
      if(e.type==='response.output_audio_transcript.delta')transcript+=e.delta;
      if(e.type==='error')finish(Error(e.error?.message||'Voice generation failed'));
      if(e.type==='response.done'){
        if(e.response?.status!=='completed'||!chunks.length)finish(Error(e.response?.status_details?.error?.message||'Voice generation did not complete.'));
        else finish(null,{mime:'audio/wav',base64:wav(Buffer.concat(chunks)).toString('base64'),transcript});
      }
    }catch(err){finish(err)}});
  });
}
export function createServer(){return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  try{
    if(req.headers.host!==`127.0.0.1:${port}`)throw Error('Use '+origin);
    const url=new URL(req.url,origin);
    if(req.method==='POST'){
      if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){res.writeHead(403);return res.end('Same-origin JSON requests only.');}
      let raw='';for await(const c of req){raw+=c;if(raw.length>2000000)throw Error('Request too large');}
      const b=JSON.parse(raw),key=b.key||process.env.OPENAI_API_KEY;
      if(!key)throw Error('Enter your OpenAI API key first.');
      let result;
      if(url.pathname==='/api/names'){
        const count=Number(b.count);if(!Number.isInteger(count)||count<4||count>52)throw Error('Choose 4–52 items');
        if(typeof b.topic!=='string'||!b.topic.trim()||b.topic.length>300)throw Error('Enter a topic (maximum 300 characters).');
        const c=await catalog();
        if(Array.isArray(b.catalog?.packs)){
          const merged=new Map(c.packs.map(p=>[p.id,p]));
          for(const p of b.catalog.packs)if(typeof p.id==='string'&&Array.isArray(p.items)&&!merged.has(p.id))merged.set(p.id,p);
          c.packs=[...merged.values()];
        }
        const avoid=c.packs.flatMap(p=>p.items.flatMap(i=>[i.en,i.it,...(i.aliases||[])]));
        const prompt=`Create exactly ${count} distinct, easily pictured vocabulary items about ${JSON.stringify(b.topic)} for a toddler learning English and Italian. Exclude these existing names AND their synonyms: ${JSON.stringify(avoid)}. Use singular nouns where natural, correct Italian articles in full questions, and visually unambiguous items. Return ONLY JSON with an items array of objects with key (English lowercase hyphenated ID), en, it, prompt_en, prompt_it, aliases (array of common English and Italian synonyms, include plurals if useful). English question: Where is the ...? Italian: Dov'è ...? No markup.`;
        const r=await api(key,'responses',{model:b.model||'gpt-6-luna',input:prompt,text:{format:{type:'json_object'}}});
        const data=await r.json();const out=data.output?.flatMap(o=>o.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
        const parsed=JSON.parse(out);validateItems(parsed.items,c);if(parsed.items.length!==count)throw Error('The model returned a different item count. Try again or edit the list.');
        result={items:parsed.items,catalog:c};
      }else if(url.pathname==='/api/image'){
        if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>16000)throw Error('Invalid image prompt');
        const r=await api(key,'images/generations',{model:b.model||'gpt-image-2.5-flare',prompt:b.prompt,size:'1024x1024',quality:b.quality||'low',output_format:'webp',n:1});
        const data=await r.json();if(!data.data?.[0]?.b64_json)throw Error('No image was returned.');result={mime:'image/webp',base64:data.data[0].b64_json};
      }else if(url.pathname==='/api/speech'){
        if(typeof b.text!=='string'||!b.text.trim()||b.text.length>1000)throw Error('Invalid recording text');
        if(b.model?.startsWith('gpt-realtime'))result=await realtimeSpeech(key,b);
        else {const r=await api(key,'audio/speech',{model:b.model||'gpt-4o-mini-tts',voice:b.voice,input:b.text,instructions:b.instructions,response_format:'mp3'});result={mime:'audio/mpeg',base64:Buffer.from(await r.arrayBuffer()).toString('base64')};}
      }else {res.writeHead(404);return res.end('Not found');}
      res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
    }
    if(req.method!=='GET'){res.writeHead(405);return res.end();}
    if(url.pathname==='/api/catalog'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(await catalog()));}
    const name=url.pathname==='/'?'/studio/pack-studio.html':decodeURIComponent(url.pathname);
    // Only serve game, studio UI, catalogue and pack media. Never expose arbitrary local files.
    if(!(name==='/index.html'||name==='/game.html'||['/studio/pack-studio.html','/studio/core.mjs','/studio/zip.mjs','/studio/generation-session.mjs'].includes(name)||/^\/(?:shared|packs)\/[a-zA-Z0-9/_.-]+$/.test(name))) {res.writeHead(404);return res.end('Not found');}
    const target=path.resolve(root,'.'+name);if(!target.startsWith(root+path.sep))throw Error('Invalid path');
    const data=await fs.readFile(target);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav'}[path.extname(target)]||'application/octet-stream';
    res.setHeader('Content-Type',mime);res.end(data);
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createServer().listen(port,'127.0.0.1',()=>console.log('Pack Studio: '+origin+' (Ctrl+C to stop)'));
