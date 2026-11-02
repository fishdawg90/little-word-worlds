import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateItems,validatePackId} from '../studio/core.mjs';
export function validateBundle(b,catalog){
  if(b.format!=='vocabulary-pack-bundle'||b.version!==1||b.ready!==true)throw Error('Export a finished Pack Studio pack first.');
  const p=b.pack;if(p?.format!=='vocabulary-pack'||p.version!==1)throw Error('Unsupported pack format');
  validatePackId(p.id,catalog);validateItems(p.items,catalog);
  if(!p.title?.en?.trim()||!p.title?.it?.trim())throw Error('Missing pack titles');
  const required=new Set();let size=0;
  for(const i of p.items){for(const kind of ['image','audio_en','audio_it']){
    const n=i[kind];const expected=kind==='image'?`images/${i.key}.webp`:`audio/${kind==='audio_en'?'en':'it'}/${i.key}.`;
    if(typeof n!=='string'||!(kind==='image'?n===expected:n===expected+'mp3'||n===expected+'wav'))throw Error('Unexpected media path');
    const f=b.files?.[n];if(!f||typeof f.base64!=='string'||!f.base64.length||f.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64))throw Error('Missing or invalid media: '+n);
    const data=Buffer.from(f.base64,'base64');size+=data.length;if(data.length<16||size>250*1024*1024)throw Error('Invalid media size');
    const webp=data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
    const wav=data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WAVE';
    const mp3=data.toString('ascii',0,3)==='ID3'||data[0]===255&&(data[1]&224)===224;
    if(kind==='image'?(f.mime!=='image/webp'||!webp):n.endsWith('.wav')?(f.mime!=='audio/wav'||!wav):(f.mime!=='audio/mpeg'||!mp3))throw Error('Media format does not match filename: '+n);
    required.add(n);
  }}
  if(Object.keys(b.files).some(n=>!required.has(n)))throw Error('Unexpected extra media in bundle');
  return p;
}
export function importPack(file,root=process.cwd()){
  const catalogPath=path.join(root,'packs/catalog.json');const catalog=JSON.parse(fs.readFileSync(catalogPath));const b=JSON.parse(fs.readFileSync(file));const p=validateBundle(b,catalog);
  const dest=path.join(root,'packs',p.id);if(fs.existsSync(dest))throw Error('Pack directory already exists');
  const stage=dest+'.importing';if(fs.existsSync(stage))throw Error('Previous import staging directory exists; inspect it before retrying.');
  fs.mkdirSync(stage,{recursive:true});
  for(const [n,f]of Object.entries(b.files)){const target=path.join(stage,n);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(f.base64,'base64'));}
  // Reuse the original Brava recordings for every new pack.
  p.shared={praise:Array.from({length:6},(_,i)=>`../animals/audio/it/brava-${i+1}.mp3`)};
  fs.writeFileSync(path.join(stage,'pack.json'),JSON.stringify(p,null,2));fs.renameSync(stage,dest);
  catalog.packs.push({id:p.id,title:p.title,topic:p.topic,emoji:p.emoji,path:`packs/${p.id}/pack.json`,items:p.items.map(({key,en,it,aliases})=>({key,en,it,aliases:aliases||[]}))});
  fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2));return p.id;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Usage: node tools/import-pack.mjs path/to/topic.pack.json');
  console.log('Imported pack: '+importPack(process.argv[2]));
}
