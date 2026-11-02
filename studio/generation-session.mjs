// A wake lock helps while the page is visible. It cannot override a phone's lock button.
export class GenerationSession{
  constructor({doc=globalThis.document,nav=globalThis.navigator,onStatus=()=>{}}={}){
    this.doc=doc;this.nav=nav;this.onStatus=onStatus;this.active=false;this.enabled=false;this.lock=null;this.pending=null;this.waiters=new Set();
    doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState!=='hidden'){for(const fn of this.waiters)fn();if(this.active)this.acquire()}else if(this.active)this.onStatus('Page hidden. New requests wait until you return; the phone may suspend a request already in progress.');});
  }
  async start(enabled=true){this.active=true;this.enabled=enabled;await this.acquire()}
  async acquire(){
    if(!this.active||!this.enabled){this.onStatus('Screen-awake option is off. Keep this page open while generating.');return}
    if(this.doc.visibilityState==='hidden')return;
    if(this.lock&&!this.lock.released)return;
    if(this.pending)return this.pending;
    if(!this.nav?.wakeLock?.request){this.onStatus('This browser cannot keep the screen awake. Keep it unlocked and this page open.');return}
    this.pending=(async()=>{try{
      const lock=await this.nav.wakeLock.request('screen');
      if(!this.active){await lock.release();return}
      this.lock=lock;this.onStatus('Keeping the screen awake while generating. Please leave this page open.');
      lock.addEventListener('release',()=>{if(this.lock===lock)this.lock=null;if(this.active)this.onStatus('Screen-awake lock released by the device. Keep the phone unlocked; returning to this page will request it again.');});
    }catch{this.onStatus('The device did not allow screen-awake mode. Keep the phone unlocked and this page open.');}finally{this.pending=null}})();return this.pending;
  }
  async waitUntilVisible(){if(this.doc.visibilityState!=='hidden')return;this.onStatus('Paused between requests. Return to this page to continue.');await new Promise(resolve=>this.waiters.add(resolve));this.waiters.clear()}
  cancelWait(){for(const fn of this.waiters)fn();this.waiters.clear()}
  async stop(){this.active=false;this.cancelWait();const lock=this.lock;this.lock=null;if(lock)try{await lock.release()}catch{}this.onStatus('Generation is not running. Phone locking can suspend browser work.');}
}
