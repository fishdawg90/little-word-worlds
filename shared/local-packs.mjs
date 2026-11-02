import {validateBundle,sanitizeBundle} from './pack-format.mjs';
const dbName='little-word-worlds-imported-packs';
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('packs',{keyPath:'pack.id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Browser storage is unavailable. Try a regular browser tab.'))})}
async function transact(mode,action){const db=await openDb();try{return await new Promise((resolve,reject)=>{const t=db.transaction('packs',mode),r=action(t.objectStore('packs'));let result;r.onsuccess=()=>result=r.result;t.oncomplete=()=>resolve(result);t.onabort=t.onerror=()=>reject(Error(t.error?.name==='QuotaExceededError'?'Not enough browser storage for this pack. Free space and try again.':'Could not save or read the pack.'))})}finally{db.close()}}
export async function listLocalPacks(){const all=await transact('readonly',s=>s.getAll());return all.map(b=>({...b.pack,local:true}))}
export async function importLocalPack(file,catalog){
  if(!file||file.size>350*1024*1024)throw Error('Choose a pack file smaller than 350 MB.');
  let b;try{b=JSON.parse(await file.text())}catch{throw Error('Could not read this JSON file. Choose the .pack.json exported by Pack Studio.');}
  const existing=await listLocalPacks();validateBundle(b,{packs:[...catalog.packs,...existing]});const clean=sanitizeBundle(b);
  // add() also prevents a simultaneous import in another tab from overwriting a pack.
  await transact('readwrite',s=>s.add(clean));return clean.pack;
}
export async function loadLocalPack(id){
  const b=await transact('readonly',s=>s.get(id));if(!b)throw Error('This pack is not saved in this browser. Return to the pack chooser and import its .pack.json file here.');
  validateBundle(b,{packs:[]});const urls=new Map();
  function media(name){if(!urls.has(name)){const f=b.files[name],raw=atob(f.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);urls.set(name,URL.createObjectURL(new Blob([bytes],{type:f.mime})))}return urls.get(name)}
  const pack={...b.pack,items:b.pack.items.map(i=>({...i,image:media(i.image),audio_en:media(i.audio_en),audio_it:media(i.audio_it)})),shared:{praise:Array.from({length:6},(_,i)=>new URL(`../packs/animals/audio/it/brava-${i+1}.mp3`,import.meta.url).href)}};
  addEventListener('pagehide',event=>{if(!event.persisted)for(const u of urls.values())URL.revokeObjectURL(u)},{once:true});return pack;
}
