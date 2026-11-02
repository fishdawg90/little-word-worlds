export const SETTING_KEYS=['topic','count','packId','emoji','titleEn','titleIt','imagePrompt','quality','speechModel','voiceEn','voiceIt','voiceInstructions','textModel','imageModel'];
const GENERATION_KEYS=['model','quality','prompt','voice','language','text','instructions'];
function strings(value,keys){if(!value||typeof value!=='object')return{};return Object.fromEntries(keys.filter(k=>typeof value[k]==='string').map(k=>[k,value[k].slice(0,['prompt','imagePrompt'].includes(k)?16000:['instructions','voiceInstructions'].includes(k)?6000:400)]))}
export function cleanSettings(value){return strings(value,SETTING_KEYS)}
export function cleanGeneration(value){return strings(value,GENERATION_KEYS)}
export function cleanAuthoring(value){
  const out={version:1,settings:cleanSettings(value?.settings)};
  if(typeof value?.source?.id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.source.id))out.source={id:value.source.id,itemKeys:Array.isArray(value.source.itemKeys)?value.source.itemKeys.filter(k=>typeof k==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(k)).slice(0,200):[]};
  if(typeof value?.notes==='string')out.notes=value.notes.slice(0,1000);
  return out;
}
