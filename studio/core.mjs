export const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const slug=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function validateItems(items,catalog){
  if(!Array.isArray(items)||items.length<4||items.length>200)throw Error('Use 4–200 items.');
  const used=new Set((catalog.packs||[]).flatMap(p=>p.items.flatMap(i=>[i.key,i.en,i.it,...(i.aliases||[])])).map(normalize));
  const seen=new Set();
  for(const a of items){
    for(const k of ['key','en','it','prompt_en','prompt_it'])if(typeof a[k]!=='string'||!a[k].trim()||a[k].length>300)throw Error('Every item needs a key, English and Italian names, and both questions.');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.key))throw Error('Invalid item key: '+a.key);
    const names=new Set([a.key,a.en,a.it,...(a.aliases||[])].map(normalize));
    if([...names].some(n=>!n||used.has(n)||seen.has(n)))throw Error('Name already used in this list or an existing pack: '+a.en);
    names.forEach(n=>seen.add(n));
  }
  return items;
}
export function validatePackId(id,catalog){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))throw Error('Use lowercase letters, numbers and hyphens for the pack ID.');
  if(catalog.packs.some(p=>p.id===id))throw Error('That pack ID already exists. Choose a new one.');
}
