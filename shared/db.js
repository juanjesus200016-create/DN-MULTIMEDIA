const DB_NAME='MediaPlayDB', DB_VERSION=1;
function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('files')){
        const s=db.createObjectStore('files',{keyPath:'id',autoIncrement:true});
        s.createIndex('type','type'); s.createIndex('name','name');
      }
    };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
}
async function addFile(file,type){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const req=db.transaction('files','readwrite').objectStore('files').add({
      name:file.name, type, mime:file.type, size:file.size,
      blob:file, favorite:false, addedAt:Date.now()
    });
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function getAllFiles(type){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const store=db.transaction('files','readonly').objectStore('files');
    const req=type?store.index('type').getAll(type):store.getAll();
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function getFile(id){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const req=db.transaction('files','readonly').objectStore('files').get(id);
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function updateFile(rec){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const req=db.transaction('files','readwrite').objectStore('files').put(rec);
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function deleteFile(id){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const req=db.transaction('files','readwrite').objectStore('files').delete(id);
    req.onsuccess=()=>res(); req.onerror=()=>rej(req.error);
  });
}
async function toggleFavorite(id){
  const f=await getFile(id); if(!f)return;
  f.favorite=!f.favorite; await updateFile(f); return f.favorite;
}
function getPlaylistState(){
  try{return JSON.parse(localStorage.getItem('playlistState')||'{}')||{}}
  catch{return{}}
}
function setPlaylistState(s){
  localStorage.setItem('playlistState',JSON.stringify(s));
}