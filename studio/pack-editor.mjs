import {cleanAuthoring,cleanGeneration,cleanSettings} from './pack-authoring.mjs';
export const GAME_URL='https://fishdawg90.github.io/little-word-worlds/';
function base64(bytes){let out='';for(let n=0;n<bytes.length;n+=8192)out+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(out)}
export async function publishedBundle(entry,{fetcher=fetch,onProgress=()=>{}}={}){
  const packURL=new URL(entry.path,GAME_URL);if(!packURL.href.startsWith(GAME_URL+'packs/'))throw Error('Invalid published pack path');
  const response=await fetcher(packURL,{cache:'no-store'});if(!response.ok)throw Error('Could not load this pack');const pack=await response.json();
  if(pack.id!==entry.id||!Array.isArray(pack.items)||pack.items.length>200)throw Error('Invalid published pack');
  const requests=pack.items.flatMap(i=>['image','audio_en','audio_it'].map(kind=>({i,kind,path:i[kind]}))),files={};let completed=0,next=0;
  await Promise.all(Array.from({length:Math.min(4,requests.length)},async()=>{while(next<requests.length){const req=requests[next++];
    const expected=req.kind==='image'?`images/${req.i.key}.webp`:`audio/${req.kind==='audio_en'?'en':'it'}/${req.i.key}.`;
    if(typeof req.path!=='string'||!(req.kind==='image'?req.path===expected:req.path===expected+'mp3'||req.path===expected+'wav'))throw Error('Unexpected pack media path');
    const url=new URL(req.path,new URL('.',packURL));const r=await fetcher(url);if(!r.ok)throw Error('Could not load '+req.path);
    const data=new Uint8Array(await r.arrayBuffer());files[req.path]={mime:req.kind==='image'?'image/webp':req.path.endsWith('.wav')?'audio/wav':'audio/mpeg',base64:base64(data),generation:cleanGeneration(req.i.generation?.[req.kind])};onProgress(++completed,requests.length);
  }}));
  return {format:'vocabulary-pack-bundle',version:1,ready:true,pack:{...pack,shared:{},authoring:cleanAuthoring(pack.authoring)},files,settings:cleanSettings(pack.authoring?.settings)};
}
// Pack Studio ZIPs contain exactly one JSON file. Bound sizes before decompression.
export async function readPackFile(file){
  if(!file||file.size>350*1024*1024)throw Error('Choose a JSON or ZIP smaller than 350 MB.');
  if(!/\.zip$/i.test(file.name||''))return JSON.parse(await file.text());
  const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0||view.getUint16(end+10,true)!==1||view.getUint16(end+8,true)!==1)throw Error('Choose a Pack Studio ZIP containing one JSON file.');
  const central=view.getUint32(end+16,true);if(central+46>end||view.getUint32(central,true)!==0x02014b50)throw Error('Invalid ZIP directory');
  const flags=view.getUint16(central+8,true),method=view.getUint16(central+10,true),size=view.getUint32(central+20,true),unpacked=view.getUint32(central+24,true),nameSize=view.getUint16(central+28,true),offset=view.getUint32(central+42,true);
  const name=new TextDecoder().decode(bytes.subarray(central+46,central+46+nameSize));if(!/\.json$/i.test(name)||flags&1||unpacked>350*1024*1024||offset+30>central||view.getUint32(offset,true)!==0x04034b50)throw Error('Unsupported or oversized ZIP file');
  const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+size>central)throw Error('Invalid ZIP data');
  let blob=new Blob([bytes.subarray(start,start+size)]);
  if(method===8){let decompressor;try{decompressor=new DecompressionStream('deflate-raw')}catch{throw Error('This browser cannot open compressed ZIPs. Use the JSON file or load the pack from the game list.');}
    const reader=blob.stream().pipeThrough(decompressor).getReader(),chunks=[];let count=0;
    while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>unpacked||count>350*1024*1024){await reader.cancel();throw Error('ZIP expands beyond its declared size');}chunks.push(value)}blob=new Blob(chunks);
  }else if(method!==0)throw Error('Unsupported ZIP compression');
  if(blob.size!==unpacked)throw Error('ZIP file is incomplete');return JSON.parse(await blob.text());
}
