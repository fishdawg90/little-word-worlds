import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateBundle,sanitizeBundle} from '../shared/pack-format.mjs';
export {validateBundle} from '../shared/pack-format.mjs';
export function importPack(file,root=process.cwd(),{update=false}={}){
  root=path.resolve(root);const catalogPath=path.join(root,'packs/catalog.json'),originalCatalog=fs.readFileSync(catalogPath,'utf8'),catalog=JSON.parse(originalCatalog),raw=JSON.parse(fs.readFileSync(file));
  const existing=catalog.packs.find(p=>p.id===raw.pack?.id);
  if(update&&(!existing||raw.pack?.authoring?.source?.id!==existing.id))throw Error('Updates must extend the same existing pack. Load it in Pack Studio first.');
  validateBundle(raw,{packs:catalog.packs.filter(p=>!(update&&p.id===existing.id))});
  const b=sanitizeBundle(raw),p=b.pack,dest=path.resolve(root,'packs',p.id),stage=dest+'.importing';
  if(!dest.startsWith(path.join(root,'packs')+path.sep))throw Error('Invalid pack destination');
  if(!update&&fs.existsSync(dest))throw Error('Pack directory already exists');
  if(fs.existsSync(stage))throw Error('An import staging directory exists; inspect it before retrying.');
  if(update){
    const old=JSON.parse(fs.readFileSync(path.join(dest,'pack.json')));
    for(const before of old.items){const after=p.items.find(i=>i.key===before.key);
      if(!after||['en','it','prompt_en','prompt_it'].some(k=>after[k]!==before[k]))throw Error('An extension must keep every original word and question: '+before.key);
      for(const k of ['image','audio_en','audio_it'])if(!fs.readFileSync(path.join(dest,before[k])).equals(Buffer.from(b.files[after[k]].base64,'base64')))throw Error('An extension must keep the original media: '+before.key);
    }
  }
  fs.mkdirSync(stage,{recursive:true});for(const [n,f]of Object.entries(b.files)){const target=path.join(stage,n);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(f.base64,'base64'));}
  p.shared={praise:Array.from({length:6},(_,i)=>`../animals/audio/it/brava-${i+1}.mp3`)};
  if(p.id==='animals')p.shared.praise=Array.from({length:6},(_,i)=>`audio/it/brava-${i+1}.mp3`);
  // Original shared recordings remain available when extending Animals.
  if(update&&p.id==='animals')for(const n of fs.readdirSync(path.join(dest,'audio/it')))if(n.startsWith('brava-'))fs.copyFileSync(path.join(dest,'audio/it',n),path.join(stage,'audio/it',n));
  fs.writeFileSync(path.join(stage,'pack.json'),JSON.stringify(p,null,2));
  const entry={id:p.id,title:p.title,topic:p.topic,emoji:p.emoji,path:`packs/${p.id}/pack.json`,items:p.items.map(({key,en,it,aliases})=>({key,en,it,aliases:aliases||[]}))};
  const index=catalog.packs.findIndex(e=>e.id===p.id);if(index>=0)catalog.packs[index]=entry;else catalog.packs.push(entry);
  let backup;
  if(update){const backupRoot=path.resolve(root,'test-output','pack-backups');fs.mkdirSync(backupRoot,{recursive:true});backup=path.join(backupRoot,p.id+'-'+Date.now());if(!backup.startsWith(root+path.sep))throw Error('Invalid backup path');fs.renameSync(dest,backup);}
  try{fs.renameSync(stage,dest);const temp=catalogPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(catalog,null,2));fs.renameSync(temp,catalogPath);}
  catch(e){if(backup){if(fs.existsSync(dest))fs.renameSync(dest,stage);fs.renameSync(backup,dest);fs.writeFileSync(catalogPath,originalCatalog);}throw e}
  return p.id;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Usage: node tools/import-pack.mjs path/to/pack.json [--update]');
  console.log('Imported pack: '+importPack(process.argv[2],process.cwd(),{update:process.argv.includes('--update')}));
}
