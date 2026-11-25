window.addEventListener('hashchange',()=>location.reload());
(async()=>{
 const status=document.getElementById('status'),gate=document.getElementById('gate'),frame=document.getElementById('room');
 try{
  const token=new URLSearchParams(location.hash.slice(1)).get('k');
  if(!token){status.textContent='Please open the complete invitation link. This room is not public.';return;}
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('The invitation key is incomplete.');
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Please open the invitation in a recent Safari, Chrome or Edge browser.');
  const bytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  const response=await fetch('museum.dat',{credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('The private room could not be downloaded.');
  const packet=new Uint8Array(await response.arrayBuffer()),magic=new TextDecoder().decode(packet.slice(0,4));
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