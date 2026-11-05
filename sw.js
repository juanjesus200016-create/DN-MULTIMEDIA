const CACHE='mediaplay-v3';
const PRECACHE=[
  './','./index.html','./lobby.css','./lobby.js','./manifest.json',
  './shared/common.css','./shared/db.js','./shared/utils.js',
  './photos/photos.html','./photos/photos.css','./photos/photos.js',
  './audio/audio.html','./audio/audio.css','./audio/audio.js',
  './video/video.html','./video/video.css','./video/video.js',
  './icons/icon.svg'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  e.respondWith(
    caches.match(req).then(cached=>cached||
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        return res;
      }).catch(()=>caches.match('./index.html'))
    )
  );
});