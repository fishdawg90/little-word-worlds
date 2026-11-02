(async()=>{try{
  const query=new URLSearchParams(location.search);
  let pack,resolve;
  if(query.has('local')){
    pack=await (await import(new URL('shared/local-packs.mjs',location.href).href)).loadLocalPack(query.get('local'));
    resolve=p=>p;
  }else{
    const catalog=await fetch('packs/catalog.json').then(r=>{if(!r.ok)throw Error('Cannot load catalogue');return r.json()});
    const id=query.get('pack')||'animals';
    const entry=catalog.packs.find(p=>p.id===id);
    if(!entry)throw Error('Unknown pack: '+id);
    const url=new URL(entry.path,location.href);
    pack=await fetch(url).then(r=>{if(!r.ok)throw Error('Cannot load pack');return r.json()});
    const base=new URL('.',url);
    resolve=p=>new URL(p,base).href;
  }
  const animals=pack.items.map(a=>({...a,image:resolve(a.image),audio_en:resolve(a.audio_en),audio_it:resolve(a.audio_it)}));
  if(animals.length<4)throw Error('A pack needs at least four items');
  pack.shared={...pack.shared,praise:(pack.shared?.praise||[]).map(resolve)};
const grid=document.getElementById('animalGrid');
const promptText=document.getElementById('promptText');
const promptSmall=document.getElementById('promptSmall');
const progressText=document.getElementById('progressText');
const repeatBtn=document.getElementById('repeatBtn');
const resetBtn=document.getElementById('resetBtn');
const feedback=document.getElementById('feedback');
const startScreen=document.getElementById('startScreen');
const startBtn=document.getElementById('startBtn');
const sessionFinish=document.getElementById('sessionFinish');
const finishText=document.getElementById('finishText');
const startTitle=document.getElementById('startTitle');
const startCopy=document.getElementById('startCopy');
const tinyText=document.getElementById('tinyText');
const noticeBox=document.getElementById('noticeBox');
const packStatus=document.getElementById('packStatus');
const langEnBtn=document.getElementById('langEnBtn');
const langItBtn=document.getElementById('langItBtn');
const count4Btn=document.getElementById('count4Btn');
const count6Btn=document.getElementById('count6Btn');

let state={lang:'en',choiceCount:4};
let unaskedTargets=[];
let choices=[];
let target=null;
let previousChoices=new Set();
let locked=false;
let audioCtx=null;
let playbackToken=0;
let repeatTimer=null;
let activeAudio=null;
let noNoEnAudio=null;
let noNoItAudio=null;
let bravaItAudio=null;
let bravaVariantAudios=[];
let hasStarted=false;
let activeUtterance=null;
let roundTimer=null;
const CORRECT_DELAY_MS=1500;
const FINISH_DELAY_MS=900;

function makeAudio(src){const a=new Audio(src);a.preload='auto';a.load();return a;}
function prepareAssets(){
  for(const animal of animals){
    animal._audioEn=makeAudio(animal.audio_en);
    animal._audioIt=makeAudio(animal.audio_it);
  }
  bravaVariantAudios=(pack.shared?.praise||[]).map(makeAudio);
}
prepareAssets();
function updateSplashTexts(){
  const itMode = state.lang==='it';
  langEnBtn.classList.toggle('active', !itMode);
  langItBtn.classList.toggle('active', itMode);
  count4Btn.classList.toggle('active', state.choiceCount===4);
  count6Btn.classList.toggle('active', state.choiceCount===6);

  startTitle.textContent=pack.title[state.lang] || pack.title.en;
  document.title=startTitle.textContent;
  document.querySelector('.start-animals').textContent=pack.emoji || '🌟';
  startCopy.textContent=itMode ? 'Prima ascolta, poi tocca la carta giusta. Ogni parola viene chiesta una volta prima di ripetersi.' : 'Listen, then tap the right picture. Every word gets a turn before any repeats.';
  startBtn.textContent=itMode?'GIOCA':'PLAY';
  count4Btn.textContent=itMode?'4 carte':'4 cards';
  count6Btn.textContent=itMode?'6 carte':'6 cards';
  count6Btn.disabled=animals.length<6;
  tinyText.textContent=itMode?'Voci generate con IA · ripete dopo 5 secondi':'AI-generated voices · repeats after 5 seconds';
  promptSmall.textContent=itMode?'Ascolta e trova':'Listen and find';
  finishText.textContent=itMode?'Li hai trovati tutti!':'You found them all!';
  noticeBox.textContent=itMode?'Le carte compaiono dopo la domanda.':'The cards appear after the question finishes.';
  packStatus.textContent=animals.length+(itMode?' parole · Inglese e italiano':' words · English and Italian');
  if(target) render();
}

function getLabel(animal){ return state.lang==='en' ? animal.en : animal.it; }
function getPrompt(animal){ return state.lang==='en' ? animal.prompt_en : animal.prompt_it; }
function clearRepeatTimer(){ if(repeatTimer){ clearTimeout(repeatTimer); repeatTimer=null; } }

function shuffle(array){
  const out=[].concat(array);
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const temp=out[i]; out[i]=out[j]; out[j]=temp;
  }
  return out;
}
function getAnimalByKey(key){ return animals.find(a=>a.key===key); }

function stopVoice(){
  playbackToken++;
  clearRepeatTimer();
  if(activeAudio){
    try{ activeAudio.pause(); activeAudio.currentTime=0; activeAudio.onended=null; }catch(_){}
  }
  if(window.speechSynthesis){
    try{ window.speechSynthesis.cancel(); }catch(_){}
  }
  activeAudio=null;
  activeUtterance=null;
}
function scheduleRepeat(token){
  clearRepeatTimer();
  repeatTimer=setTimeout(()=>{
    if(token!==playbackToken || locked || !target) return;
    playPromptThenReveal();
  },5000);
}
function getItalianVoice(){
  if(!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith('it')) || null;
}
function speakText(text, langCode, onEnded){
  if(!window.speechSynthesis){ if(onEnded) onEnded(); return; }
  const utter = new SpeechSynthesisUtterance(text);
  activeUtterance = utter;
  utter.lang = langCode;
  utter.rate = 0.9;
  utter.pitch = 1.0;
  const voice = langCode.indexOf('it')===0 ? getItalianVoice() : null;
  if(voice) utter.voice = voice;
  utter.onend = ()=>{ if(activeUtterance===utter){ activeUtterance=null; if(onEnded) onEnded(); } };
  utter.onerror = ()=>{ if(activeUtterance===utter){ activeUtterance=null; if(onEnded) onEnded(); } };
  window.speechSynthesis.speak(utter);
}
function overlayText(){
  return state.lang==='it' ? 'Ascolta…' : 'Listen…';
}
function setGridGated(gated,message){
  if(gated) clearChoicePointers();
  grid.classList.toggle('gated', !!gated);
  grid.setAttribute('data-overlay', gated ? (message || overlayText()) : '');
}
function applyChoiceLayout(){
  grid.classList.toggle('choices-6', state.choiceCount===6);
}
function showChoices(token){
  if(token!==playbackToken) return;
  setGridGated(false);
  locked=false;
  scheduleRepeat(token);
}
function playAnimalPrompt(key,onFinished){
  stopVoice();
  const token = playbackToken;
  const animal = getAnimalByKey(key);
  if(!animal) return;
  const done = ()=>{ if(token!==playbackToken) return; if(onFinished) onFinished(token); else scheduleRepeat(token); };
  if(state.lang==='en'){
    const a = animal._audioEn;
    activeAudio=a;
    a.onended=done;
    try{ a.currentTime=0; }catch(_){}
    a.play().catch(()=>{ done(); });
    return;
  }
  if(animal._audioIt){
    const a = animal._audioIt;
    activeAudio=a;
    a.onended=done;
    try{ a.currentTime=0; }catch(_){}
    a.play().catch(()=>{ done(); });
    return;
  }
  speakText(animal.prompt_it,'it-IT',done);
}
function playPromptThenReveal(){
  if(!target) return;
  locked=true;
  setGridGated(true, overlayText());
  playAnimalPrompt(target.key, showChoices);
}
function replayPromptAfterWrong(){
  stopVoice();
  locked=true;
  clearChoicePointers();
  setGridGated(true, overlayText());
  setTimeout(()=>{
    if(!target) return;
    playAnimalPrompt(target.key, showChoices);
  },180);
}
function ensureFirstPromptPlayback(){
  let tries=0;
  const tryAgain=()=>{
    if(!target || !locked) return;
    const currentlySpeaking = !!(window.speechSynthesis && window.speechSynthesis.speaking);
    const audioStarted = !!(activeAudio && !activeAudio.paused && activeAudio.currentTime > 0);
    if(currentlySpeaking || audioStarted) return;
    playPromptThenReveal();
    tries++;
    if(tries<5) setTimeout(tryAgain,250);
  };
  setTimeout(tryAgain,120);
}
function resetSession(){
  clearTimeout(roundTimer);
  unaskedTargets=shuffle(animals.map(a=>a.key));
  previousChoices=new Set();
}
function makeChoices(targetKey){
  const distractorCount = Math.max(3, state.choiceCount - 1);
  const preferred=animals.filter(a=>a.key!==targetKey && !previousChoices.has(a.key));
  const fallback=animals.filter(a=>a.key!==targetKey);
  let distractors=shuffle(preferred).slice(0,distractorCount);
  if(distractors.length<distractorCount){
    const already=new Set(distractors.map(a=>a.key));
    distractors=distractors.concat(shuffle(fallback.filter(a=>!already.has(a.key))).slice(0,distractorCount-distractors.length));
  }
  const targetAnimal=getAnimalByKey(targetKey);
  const round=shuffle([targetAnimal].concat(distractors));
  previousChoices=new Set(round.map(a=>a.key));
  return round;
}
function updateProgress(){
  const left=unaskedTargets.length;
  progressText.textContent=state.lang==='it' ? left+' parole ancora da trovare' : left+' words still to find';
}
function chooseRound(autoplay=true){
  clearChoicePointers();
  locked=true;
  if(unaskedTargets.length===0) resetSession();
  target=getAnimalByKey(unaskedTargets.pop());
  choices=makeChoices(target.key);
  render();
  updateProgress();
  if(autoplay) playPromptThenReveal();
  else { setGridGated(false); locked=false; }
}
function render(){
  applyChoiceLayout();
  if(target) promptText.textContent = getPrompt(target);
  grid.innerHTML='';
  for(const animal of choices){
    const button=document.createElement('button');
    button.type='button';
    button.className='animal-card';
    button.dataset.key=animal.key;
    button.setAttribute('aria-label', getLabel(animal));
    const wrap=document.createElement('div');
    wrap.className='animal-picture-wrap';
    const img=document.createElement('img');
    img.className='animal-picture';
    img.alt='';
    img.src=animal.image;
    img.draggable=false;
    const label=document.createElement('span');
    label.className='animal-label';
    label.textContent=getLabel(animal);
    wrap.appendChild(img);
    button.appendChild(wrap);
    button.appendChild(label);
    grid.appendChild(button);
  }
}
// Each physical contact is tracked independently. A finger that stays down becomes
// a harmless "holding" contact; any other short poke can still select a card.
const choicePointers=new Map();
const TAP_MAX_MS=650;
const TAP_MAX_MOVE=42;
const TAP_MIN_MS=20;

function gameTouchActive(){
  return hasStarted && document.documentElement.classList.contains('game-active');
}
function activateGameTouchMode(){
  document.documentElement.classList.add('game-active');
  document.body.classList.add('game-active');
  clearChoicePointers();
}
function cardAtPoint(x,y){
  const el=document.elementFromPoint(x,y);
  const card=el && el.closest ? el.closest('.animal-card') : null;
  return card && grid.contains(card) ? card : null;
}
function recordPointerDown(e){
  if(!gameTouchActive()) return;
  if(e.pointerType==='mouse' && e.button!==0) return;
  choicePointers.set(e.pointerId,{
    x:e.clientX,
    y:e.clientY,
    t:performance.now(),
    pointerType:e.pointerType
  });
  // Prevent Chrome from turning a held first finger + second finger into a
  // scroll/pinch gesture. Every pointer remains independent for the game.
  if(e.pointerType!=='mouse') e.preventDefault();
}
function finishPointer(e){
  if(!gameTouchActive()) return;
  const g=choicePointers.get(e.pointerId);
  choicePointers.delete(e.pointerId);
  if(e.pointerType!=='mouse') e.preventDefault();
  if(!g || locked) return;

  const dt=performance.now()-g.t;
  const moved=Math.hypot(e.clientX-g.x,e.clientY-g.y);
  // Long contacts are treated as fingers holding the phone, never as guesses.
  if(dt<TAP_MIN_MS || dt>TAP_MAX_MS || moved>TAP_MAX_MOVE) return;

  // Decide based on the release point, not the element that received pointerdown.
  // This is more tolerant of toddler pokes and fingers starting near a card edge.
  const button=cardAtPoint(e.clientX,e.clientY);
  if(!button) return;
  const animal=getAnimalByKey(button.dataset.key);
  if(animal) handleChoice(button,animal);
}
function cancelPointer(e){ choicePointers.delete(e.pointerId); }
function clearChoicePointers(){ choicePointers.clear(); }

document.addEventListener('pointerdown',recordPointerDown,{capture:true,passive:false});
document.addEventListener('pointerup',finishPointer,{capture:true,passive:false});
document.addEventListener('pointercancel',cancelPointer,{capture:true,passive:false});
window.addEventListener('blur',clearChoicePointers);
function getAudioContext(){
  if(!audioCtx){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(Ctx) audioCtx=new Ctx();
  }
  if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq,start,duration,gain=.10,type='sine'){
  const ctx=getAudioContext();
  if(!ctx) return;
  const osc=ctx.createOscillator();
  const amp=ctx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(freq,ctx.currentTime+start);
  amp.gain.setValueAtTime(.0001,ctx.currentTime+start);
  amp.gain.exponentialRampToValueAtTime(gain,ctx.currentTime+start+.015);
  amp.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+start+duration);
  osc.connect(amp); amp.connect(ctx.destination);
  osc.start(ctx.currentTime+start);
  osc.stop(ctx.currentTime+start+duration+.02);
}
function successSound(){ tone(523.25,0,.14,.08); tone(659.25,.10,.17,.09); tone(783.99,.21,.22,.10); tone(1046.5,.37,.30,.08); }
function wrongSound(){ tone(170,0,.09,.028,'triangle'); }
function burstFrom(element){
  const rect=element.getBoundingClientRect();
  const cx=rect.left+rect.width/2;
  const cy=rect.top+rect.height/2;
  const pieces=22;
  for(let i=0;i<pieces;i++){
    const dot=document.createElement('i');
    dot.className='spark';
    const angle=Math.PI*2*i/pieces+Math.random()*.24;
    const distance=60+Math.random()*115;
    const size=8+Math.random()*10;
    dot.style.width=size+'px';
    dot.style.height=size+'px';
    dot.style.left=(cx-size/2)+'px';
    dot.style.top=(cy-size/2)+'px';
    dot.style.setProperty('--dx',(Math.cos(angle)*distance)+'px');
    dot.style.setProperty('--dy',(Math.sin(angle)*distance)+'px');
    dot.style.background=i%3===0?'var(--good)':(i%3===1?'var(--accent)':'#ffd166');
    feedback.appendChild(dot);
    setTimeout(()=>dot.remove(),900);
  }
}
function showPraise(){
  const el=document.createElement('div');
  el.className='praise-pop';
  el.textContent='⭐ Brava! ⭐';
  feedback.appendChild(el);
  setTimeout(()=>el.remove(),1350);
}
function speakPraise(){
  if(bravaVariantAudios.length){
    try{
      const a=bravaVariantAudios[Math.floor(Math.random()*bravaVariantAudios.length)];
      a.pause();
      a.currentTime=0;
      a.play().catch(()=>{});
      return;
    }catch(_){ }
  }
  if(!window.speechSynthesis) return;
  try{
    window.speechSynthesis.cancel();
    const utter=new SpeechSynthesisUtterance('Brava!');
    utter.lang='it-IT';
    utter.rate=.92;
    utter.pitch=1.08;
    const v=getItalianVoice();
    if(v) utter.voice=v;
    activeUtterance=utter;
    utter.onend=()=>{ if(activeUtterance===utter) activeUtterance=null; };
    utter.onerror=()=>{ if(activeUtterance===utter) activeUtterance=null; };
    setTimeout(()=>{ try{ window.speechSynthesis.speak(utter); }catch(_){ } },120);
  }catch(_){ }
}
function finishSessionThenRestart(){
  stopVoice();
  sessionFinish.classList.add('show');
  setTimeout(()=>{
    sessionFinish.classList.remove('show');
    resetSession();
    chooseRound(true);
  },1450);
}
function handleChoice(button,animal){
  if(locked) return;
  clearChoicePointers();
  getAudioContext();
  if(animal.key===target.key){
    locked=true;
    stopVoice();
    button.classList.add('correct');
    successSound();
    burstFrom(button);
    showPraise();
    speakPraise();
    if('vibrate' in navigator){ try{ navigator.vibrate([30,35,45]); }catch(_){} }
    if(unaskedTargets.length===0) roundTimer=setTimeout(finishSessionThenRestart,Math.max(FINISH_DELAY_MS,1450));
    else roundTimer=setTimeout(()=>chooseRound(true),CORRECT_DELAY_MS);
  }else{
    locked=true;
    button.classList.remove('wrong');
    void button.offsetWidth;
    button.classList.add('wrong');
    wrongSound();
    if('vibrate' in navigator){ try{ navigator.vibrate(22); }catch(_){} }
    setTimeout(()=>button.classList.remove('wrong'),330);
    setTimeout(()=>replayPromptAfterWrong(),190);
  }
}
async function enterFullscreen(){
  const el=document.documentElement;
  try{ if(!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen(); }catch(_){ }
}
function setLanguage(lang){
  state.lang=lang;
  updateSplashTexts();
  if(hasStarted && target){
    choices=makeChoices(target.key);
    render();
    updateProgress();
    playPromptThenReveal();
  }
}
function setChoiceCount(count){
  state.choiceCount=count===6 ? 6 : 4;
  updateSplashTexts();
  applyChoiceLayout();
  if(hasStarted && target){
    choices=makeChoices(target.key);
    render();
    updateProgress();
    playPromptThenReveal();
  }
}
langEnBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); setLanguage('en'); });
langItBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); setLanguage('it'); });
count4Btn.addEventListener('pointerdown',e=>{ e.preventDefault(); setChoiceCount(4); });
count6Btn.addEventListener('pointerdown',e=>{ e.preventDefault(); if(animals.length>=6) setChoiceCount(6); });
repeatBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); getAudioContext(); if(target) playPromptThenReveal(); });
resetBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); getAudioContext(); stopVoice(); resetSession(); chooseRound(true); ensureFirstPromptPlayback(); });

startBtn.addEventListener('pointerdown',async e=>{
  e.preventDefault();
  if(hasStarted) return;
  hasStarted=true;
  activateGameTouchMode();
  getAudioContext();
  tone(440,0,.025,.001);
  await enterFullscreen();
  startScreen.classList.add('hidden');
  resetSession();
  chooseRound(true);
  ensureFirstPromptPlayback();
});

if(window.speechSynthesis && window.speechSynthesis.addEventListener){
  window.speechSynthesis.addEventListener('voiceschanged', ()=>{ updateSplashTexts(); });
}

(async ()=>{

  resetSession();
  target=getAnimalByKey(unaskedTargets[unaskedTargets.length-1]);
  choices=makeChoices(target.key);
  render();
  setGridGated(true, overlayText());
  updateSplashTexts();
  updateProgress();
})();

}catch(err){document.getElementById('packStatus').textContent=err.message;document.getElementById('startBtn').disabled=true;}
})();
