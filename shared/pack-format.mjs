import {validateItems,validatePackId} from '../studio/core.mjs';
// Shared by the browser importer and repository importer. No code or remote asset URLs are accepted.
export function validateBundle(b,catalog){
  if(b?.format!=='vocabulary-pack-bundle'||b.version!==1||b.ready!==true)throw Error('Choose a finished .pack.json exported from Pack Studio, rather than a draft.');
  const p=b.pack;if(p?.format!=='vocabulary-pack'||p.version!==1)throw Error('Unsupported pack format');
  validatePackId(p.id,catalog);validateItems(p.items,catalog);
  if(typeof p.title?.en!=='string'||typeof p.title?.it!=='string'||!p.title.en.trim()||!p.title.it.trim()||p.title.en.length>200||p.title.it.length>200)throw Error('Missing or invalid pack titles');
  const required=new Set();let size=0;
  for(const i of p.items)for(const kind of ['image','audio_en','audio_it']){
    const n=i[kind],expected=kind==='image'?`images/${i.key}.webp`:`audio/${kind==='audio_en'?'en':'it'}/${i.key}.`;
    if(typeof n!=='string'||!(kind==='image'?n===expected:n===expected+'mp3'||n===expected+'wav'))throw Error('Unexpected media path');
    const f=b.files?.[n];if(!f||typeof f.base64!=='string'||!f.base64.length||f.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64))throw Error('Missing or invalid media: '+n);
    const length=f.base64.length/4*3-(f.base64.endsWith('==')?2:f.base64.endsWith('=')?1:0);size+=length;
    if(length<16||size>250*1024*1024)throw Error('Invalid media size');
    const head=atob(f.base64.slice(0,32));
    const webp=head.slice(0,4)==='RIFF'&&head.slice(8,12)==='WEBP',wav=head.slice(0,4)==='RIFF'&&head.slice(8,12)==='WAVE',mp3=head.slice(0,3)==='ID3'||head.charCodeAt(0)===255&&(head.charCodeAt(1)&224)===224;
    if(kind==='image'?(f.mime!=='image/webp'||!webp):n.endsWith('.wav')?(f.mime!=='audio/wav'||!wav):(f.mime!=='audio/mpeg'||!mp3))throw Error('Media format does not match filename: '+n);
    required.add(n);
  }
  if(Object.keys(b.files).some(n=>!required.has(n)))throw Error('Unexpected extra media in bundle');
  return p;
}
export function sanitizeBundle(b){
  const p=b.pack;
  return {format:'vocabulary-pack-bundle',version:1,ready:true,pack:{format:'vocabulary-pack',version:1,id:p.id,title:{en:p.title.en,it:p.title.it},topic:String(p.topic||'').slice(0,300),emoji:String(p.emoji||'🌟').slice(0,40),ai_generated_voice:true,items:p.items.map(i=>({key:i.key,en:i.en,it:i.it,prompt_en:i.prompt_en,prompt_it:i.prompt_it,aliases:Array.isArray(i.aliases)?i.aliases:[],image:i.image,audio_en:i.audio_en,audio_it:i.audio_it})),shared:{}},files:Object.fromEntries(Object.entries(b.files).map(([n,f])=>[n,{mime:f.mime,base64:f.base64}]))};
}
