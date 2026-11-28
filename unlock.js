window.addEventListener('hashchange',()=>location.reload());
(async()=>{
 const status=document.getElementById('status'),gate=document.getElementById('gate'),frame=document.getElementById('room');
 try{
  const token=new URLSearchParams(location.hash.slice(1)).get('k');
  if(!token){status.textContent='Please open the complete invitation link. This room is not public.';return;}
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('The invitation key is incomplete.');
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Please open the invitation in a recent Safari, Chrome or Edge browser.');
  const bytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  const packet=await (async function downloadPacket(size, digest, say) {
  const partSize=512*1024;
  const file=new URL('museum.dat',location.href);file.search='';file.hash='';
  const cacheKey=file.href+'?release='+digest;
  const valid=async data=>data.length===size && Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('')===digest;
  let cache;
  try {
    cache=await caches.open('encrypted-museum-'+file.pathname);
    const hit=await cache.match(cacheKey);
    if(hit){const data=new Uint8Array(await hit.arrayBuffer());if(await valid(data))return data;await cache.delete(cacheKey);}
  } catch {} // Storage may be disabled in private browsing; playback still works.
  const packet=new Uint8Array(size),controllers=new Set();let stopped=false,loaded=0,next=partSize;
  const progress=()=>say('Downloading the private museum: '+Math.floor(100*loaded/size)+'%');progress();
  async function range(start){
    const end=Math.min(start+partSize,size)-1;
    for(let attempt=0;attempt<4&&!stopped;attempt++){
      const abort=new AbortController();controllers.add(abort);const timer=setTimeout(()=>abort.abort(),90000);
      try {
        const response=await fetch(cacheKey+'&part='+start,{headers:{Range:'bytes='+start+'-'+end},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:abort.signal});
        const full=response.status===200&&start===0;
        if(!full&&(response.status!==206||response.headers.get('Content-Range')!=='bytes '+start+'-'+end+'/'+size))throw Error('Unexpected museum download interval');
        const data=new Uint8Array(await response.arrayBuffer());
        if(data.length!==(full?size:end-start+1))throw Error('Incomplete museum download interval');
        if(stopped)throw Error('Download stopped');
        packet.set(data,start);loaded+=data.length;progress();return;
      }catch(err){if(stopped)throw err;if(attempt===3)throw Error('Download interrupted. Check your connection and reopen the invitation.');await new Promise(r=>setTimeout(r,250*2**attempt));}
      finally{clearTimeout(timer);abort.abort();controllers.delete(abort);}
    }
  }
  try {
    await range(0);
    if(loaded<size){const worker=async()=>{while(!stopped&&next<size){const start=next;next+=partSize;await range(start);}};await Promise.all(Array.from({length:4},worker));}
    say('Checking the download…');if(!await valid(packet))throw Error('The download did not match this invitation. Please reload.');
    try{if(cache)await cache.put(cacheKey,new Response(packet));}catch{}
    return packet;
  }finally{stopped=true;for(const abort of controllers)abort.abort();}
})(31475518,"df520b884feb4bc9ad355c99fbbfb345c212716b8a99e14d92eca42041fcf543",s=>{status.textContent=s;});
  status.textContent='Opening your room…';const magic=new TextDecoder().decode(packet.slice(0,4));
  if(magic!=='BMM1'||packet.length<32)throw Error('This invitation copy is incomplete.');
  const key=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt']);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:packet.slice(4,16),additionalData:new TextEncoder().encode('private-memory-museum-v1'),tagLength:128},key,packet.slice(16));
  const stream=new Blob([plaintext]).stream().pipeThrough(new DecompressionStream('gzip'));
  const html=await new Response(stream).text();
  if(!/^<!doctype|^<html/i.test(html.trim()))throw Error('This private room is not a complete document.');
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  frame.addEventListener('load',()=>{gate.hidden=true;frame.hidden=false;document.title='Your private museum';},{once:true});
  frame.src=url;
  window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
 }catch(error){status.textContent=error.name==='OperationError'?'This invitation key does not open this room. Please use the full original link.':error.message;console.error('Private room could not open:',error.message);}
})();