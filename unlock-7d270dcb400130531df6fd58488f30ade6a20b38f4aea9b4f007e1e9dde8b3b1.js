(function runCityGate(open, workerFile, installHelp) {
  const element = id => document.getElementById(id);
  const status = element('status'), gate = element('gate'), frame = element('room');
  const form = element('city-invitation'), input = element('city-invite-input'), paste = element('city-paste');
  const scope = new URL('./', location.href);
  const index = new URL('index.html', scope).pathname;
  const noKey = 'Please open the complete invitation link. This room is not public.';
  const tokenPattern = /^#k=([A-Za-z0-9_-]{43})$/;
  let generation = 0, clipboardGeneration = 0, roomURL, activeUnlock;
  installHelp(element, frame);

  function clearRoom() {
    frame.hidden = true;
    gate.hidden = false;
    document.title = 'Private memory room';
    if (roomURL) {
      frame.removeAttribute('src');
      URL.revokeObjectURL(roomURL);
      roomURL = undefined;
    }
  }

  function invalidateRoom() {
    ++generation;
    activeUnlock?.abort();
    activeUnlock = undefined;
    clearRoom();
    return generation;
  }

  async function unlock(token, missingMessage = noKey) {
    const current = invalidateRoom();
    const say = message => { if (current === generation) status.textContent = message; };
    if (!token) { say(missingMessage); return; }
    const controller = new AbortController();
    activeUnlock = controller;
    say('Opening your room…');
    try {
      const html = await open(token, say, controller.signal);
      if (current !== generation) return;
      roomURL = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      frame.src = roomURL;
    } catch (error) {
      say(error.name === 'OperationError' ? 'This invitation key does not open this room. Please use the full original link.' : error.message);
    } finally {
      if (activeUnlock === controller) activeUnlock = undefined;
    }
  }

  frame.addEventListener('load', () => {
    // An initial about:blank or superseded navigation is not the decrypted room.
    if (!roomURL || !frame.hidden || frame.contentWindow?.location.href !== roomURL) return;
    gate.hidden = true;
    frame.hidden = false;
    document.title = 'Your private museum';
  });

  function usePastedInvitation(value) {
    const text = value.trim();
    let fragment = text.startsWith('#') ? text : '';
    if (!fragment) {
      try {
        const url = new URL(text);
        if (url.origin === scope.origin && !url.username && !url.password &&
            (url.pathname === scope.pathname || url.pathname === index)) fragment = url.hash;
      } catch { /* Not an absolute invitation URL. */ }
    }
    const token = tokenPattern.exec(fragment)?.[1];
    return unlock(token, 'Paste the complete invitation for this same room or its private #k=… fragment.');
  }

  function takeFragment() {
    const url = new URL(location.href), fragment = url.hash;
    if (fragment) {
      url.hash = '';
      history.replaceState(history.state, '', url.href);
    }
    return fragment;
  }

  function useLocationFragment(event) {
    // Ignore a queued hash event for a URL a more recent action has already replaced.
    if (event?.newURL && event.newURL !== location.href) return;
    ++clipboardGeneration;
    input.value = '';
    const fragment = takeFragment();
    return unlock(tokenPattern.exec(fragment)?.[1], fragment.startsWith('#k=') ? 'The invitation key is incomplete.' : noKey);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    ++clipboardGeneration;
    takeFragment();
    const text = input.value;
    input.value = '';
    return usePastedInvitation(text);
  });
  paste.hidden = typeof navigator.clipboard?.readText !== 'function';
  paste.addEventListener('click', async () => {
    const current = ++clipboardGeneration;
    invalidateRoom();
    takeFragment();
    status.textContent = 'Reading your invitation…';
    let text;
    try { text = await navigator.clipboard.readText(); }
    catch {
      if (current === clipboardGeneration) {
        status.textContent = 'Clipboard access was unavailable. Paste into the invitation field instead.';
        input.focus();
      }
      return;
    }
    if (current !== clipboardGeneration) return;
    input.value = '';
    return usePastedInvitation(text);
  });
  form.hidden = false;
  window.addEventListener('hashchange', useLocationFragment);
  window.addEventListener('pagehide', () => {
    ++clipboardGeneration;
    input.value = '';
    return unlock(undefined);
  });
  const opening = useLocationFragment();
  if (window.isSecureContext && navigator.serviceWorker) {
    navigator.serviceWorker.register(new URL(workerFile, scope).href, { scope: scope.href, updateViaCache: 'none' }).catch(() => {});
  }
  return opening;
})((token,say,signal)=>(async function openEncryptedRoom(token,say,download,signal){
  signal?.throwIfAborted();
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('The invitation key is incomplete.');
  if(!globalThis.crypto?.subtle||typeof DecompressionStream==='undefined')throw Error('Please open the invitation in a recent Safari, Chrome or Edge browser.');
  const bytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  const packet=await download(say);
  signal?.throwIfAborted();
  say('Opening your room…');const magic=new TextDecoder().decode(packet.slice(0,4));
  if(magic!=='BMM1'||packet.length<32)throw Error('This invitation copy is incomplete.');
  const key=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt']);
  signal?.throwIfAborted();
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:packet.slice(4,16),additionalData:new TextEncoder().encode('private-memory-museum-v1'),tagLength:128},key,packet.slice(16));
  signal?.throwIfAborted();
  const stream=new Blob([plaintext]).stream().pipeThrough(new DecompressionStream('gzip'),{signal});
  const reader=stream.getReader(),decoder=new TextDecoder();let html='';
  const cancel=()=>reader.cancel(signal.reason).catch(()=>{});
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    for(;;){
      const {done,value}=await reader.read();
      signal?.throwIfAborted();
      if(done)break;
      html+=decoder.decode(value,{stream:true});
    }
    html+=decoder.decode();
  }finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
  if(!/^<!doctype|^<html/i.test(html.trim()))throw Error('This private room is not a complete document.');
  return html;
})(token,say,report=>(async function downloadPacket(size, digest, say, {fileName='museum.dat',signal} = {}) {
  signal?.throwIfAborted();
  const partSize=512*1024;
  const file=new URL(fileName,location.href);file.search='';file.hash='';
  const cacheKey=file.href+'?release='+digest;
  const valid=async data=>data.length===size && Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('')===digest;
  let cache;
  try {
    cache=await caches.open('encrypted-museum-'+file.pathname);
    signal?.throwIfAborted();
    const hit=await cache.match(cacheKey);
    signal?.throwIfAborted();
    if(hit){
      if(hit.body){
        const data=new Uint8Array(size),reader=hit.body.getReader();let length=0;
        const cancel=()=>reader.cancel(signal?.reason).catch(()=>{});
        signal?.addEventListener('abort',cancel,{once:true});
        try{
          for(;;){
            const {done,value}=await reader.read();
            signal?.throwIfAborted();
            if(done)break;
            length+=value.byteLength;
            if(length>size){cancel();break;}
            data.set(value,length-value.byteLength);
          }
        }finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
        const matches=length===size && await valid(data);
        signal?.throwIfAborted();
        if(matches)return data;
      }
      await cache.delete(cacheKey);
    }
  } catch {} // Storage may be disabled in private browsing; playback still works.
  signal?.throwIfAborted();
  const packet=new Uint8Array(size),controllers=new Set(),waiters=new Set();let stopped=false,loaded=0,next=partSize;
  const stop=()=>{
    stopped=true;
    for(const abort of controllers)abort.abort();
    for(const wake of waiters)wake();
  };
  const checkRunning=()=>{signal?.throwIfAborted();if(stopped)throw Error('Download stopped');};
  const delay=ms=>new Promise(resolve=>{
    const wake=()=>{clearTimeout(timer);waiters.delete(wake);resolve();};
    const timer=setTimeout(wake,ms);waiters.add(wake);
  });
  const progress=()=>say('Downloading the private museum: '+Math.floor(100*loaded/size)+'%');
  signal?.addEventListener('abort',stop,{once:true});
  async function range(start){
    const end=Math.min(start+partSize,size)-1;
    for(let attempt=0;attempt<4;attempt++){
      checkRunning();
      const abort=new AbortController();controllers.add(abort);const timer=setTimeout(()=>abort.abort(),90000);
      try {
        const response=await fetch(cacheKey+'&part='+start,{headers:{Range:'bytes='+start+'-'+end},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:abort.signal});
        checkRunning();
        const full=response.status===200&&start===0;
        if(!full&&(response.status!==206||response.headers.get('Content-Range')!=='bytes '+start+'-'+end+'/'+size))throw Error('Unexpected museum download interval');
        const data=new Uint8Array(await response.arrayBuffer());
        checkRunning();
        if(data.length!==(full?size:end-start+1))throw Error('Incomplete museum download interval');
        packet.set(data,start);loaded+=data.length;progress();return;
      }catch{checkRunning();if(attempt===3)throw Error('Download interrupted. Check your connection and reopen the invitation.');}
      finally{clearTimeout(timer);abort.abort();controllers.delete(abort);}
      checkRunning();
      await delay(250*2**attempt);
    }
  }
  try {
    progress();
    await range(0);
    if(loaded<size){const worker=async()=>{while(!stopped&&next<size){const start=next;next+=partSize;await range(start);}};await Promise.all(Array.from({length:4},worker));}
    checkRunning();
    say('Checking the download…');const matches=await valid(packet);
    checkRunning();
    if(!matches)throw Error('The download did not match this invitation. Please reload.');
    try{if(cache)await cache.put(cacheKey,new Response(packet));}catch{}
    checkRunning();
    return packet;
  }finally{signal?.removeEventListener('abort',stop);stop();}
})(34219681,"f315cfe635c9ad362dceecc76c14f9e9038573cb2b28ab6b3372b6ac42b05047",report,{fileName:"museum-f315cfe635c9ad362dceecc76c14f9e9038573cb2b28ab6b3372b6ac42b05047.dat",signal}),signal),"city-sw.js",function setupInstallHelp(element, frame) {
  const gateButton = element('city-install'), dialog = element('city-install-help');
  const help = element('city-install-text'), native = element('city-install-native');
  const mode = window.matchMedia('(display-mode: standalone)');
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const manual = ios
    ? 'In Safari, tap Share, choose Add to Home Screen, turn on Open as Web App, then tap Add.'
    : android ? 'In Chrome, open the browser menu and choose Install app or Add to Home screen.'
      : 'Use Install app in your browser’s address bar or menu, if available.';
  let promptEvent, installed = false;

  function getInstallStatus() {
    if (mode.matches || navigator.standalone === true) return 'standalone';
    if (installed) return 'installed';
    if (!window.isSecureContext || typeof dialog.showModal !== 'function') return 'unavailable';
    return promptEvent ? 'prompt' : 'manual';
  }

  function render() {
    const state = getInstallStatus();
    gateButton.hidden = state !== 'prompt' && state !== 'manual';
    native.hidden = state !== 'prompt';
    help.textContent = state === 'prompt' ? 'Install Memory City to open it from your home screen.' : manual;
    if (gateButton.hidden && dialog.open) dialog.close();
  }

  function show() {
    render();
    if (gateButton.hidden) return false;
    if (!dialog.open) dialog.showModal();
    return true;
  }

  window.__PRIVATE_APP_SHELL__ = Object.freeze({
    getInstallStatus,
    showInstallHelp() {
      return !frame.hidden && navigator.userActivation?.isActive !== false && show();
    },
  });
  gateButton.addEventListener('click', show);
  element('city-install-close').addEventListener('click', () => dialog.close());
  native.addEventListener('click', async () => {
    if (!promptEvent) return;
    const chosen = promptEvent;
    promptEvent = undefined;
    try { await chosen.prompt(); } catch { /* Fall back to the browser menu. */ }
    render();
  });
  window.addEventListener('beforeinstallprompt', event => {
    if (gateButton.hidden) return;
    event.preventDefault();
    promptEvent = event;
    render();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    promptEvent = undefined;
    render();
  });
  mode.addEventListener?.('change', render);
  window.addEventListener('pagehide', () => { if (dialog.open) dialog.close(); });
  render();
});
