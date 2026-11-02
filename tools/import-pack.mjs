import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBundle} from '../shared/pack-format.mjs';
export {validateBundle} from '../shared/pack-format.mjs';
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
