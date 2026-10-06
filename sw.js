const CACHE='sino-negro-v1.0.0';
const SHELL=['./','./index.html','./style.css','./manifest.webmanifest','./src/app.js','./src/content.js','./src/engine.js','./src/icons.js','./src/storage.js','./src/audio.js','./src/webmcp.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable.png','./assets/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('sino-negro-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  // Uma versão consistente permanece em cache até o jogador aceitar a atualização.
  event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(req,{ignoreSearch:true});if(cached)return cached;try{return await fetch(req);}catch{if(req.mode==='navigate')return await cache.match('./index.html');throw new Error('Recurso indisponível offline');}})());
});
