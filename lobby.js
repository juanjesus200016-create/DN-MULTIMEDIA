if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);

let deferredPrompt;
const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e; installBtn.hidden=false;
});
installBtn?.addEventListener('click',async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt=null; installBtn.hidden=true;
});

const picker=document.getElementById('filePicker');
document.getElementById('addMediaBtn').onclick=()=>picker.click();
picker.addEventListener('change',async()=>{
  const btn=document.getElementById('addMediaBtn');
  btn.disabled=true; btn.textContent='Importando...';
  for(const f of picker.files){
    let type='image';
    if(f.type.startsWith('audio/')||/\.(mp3|flac|m4a|opus|ogg|wav|aac|aud)$/i.test(f.name))type='audio';
    else if(f.type.startsWith('video/')||/\.(mp4|webm|mkv|avi|mov|m4v)$/i.test(f.name))type='video';
    try{await addFile(f,type)}catch(e){console.error('Import',f.name,e)}
  }
  btn.disabled=false; btn.textContent='+ Añadir medios';
  picker.value=''; await render();
});

async function render(){
  const all=await getAllFiles();
  const recent=all.sort((a,b)=>b.addedAt-a.addedAt).slice(0,10);
  const list=document.getElementById('recentList');
  list.innerHTML='';
  if(!recent.length){list.innerHTML='<div class="empty">Aún no hay medios</div>';}
  else for(const f of recent){
    const icon=f.type==='image'?'🖼️':f.type==='audio'?'🎵':'🎞️';
    const link=f.type==='image'?'photos/photos.html':f.type==='audio'?'audio/audio.html':'video/video.html';
    const a=document.createElement('a');
    a.className='item'; a.href=`${link}?id=${f.id}`;
    a.innerHTML=`<span>${icon} ${escapeHtml(f.name)}</span>`;
    list.appendChild(a);
  }

  const wrap=document.getElementById('quickPlaylist');
  const state=getPlaylistState(); wrap.innerHTML='';
  if(!state.ids||!state.ids.length){wrap.innerHTML='<div class="empty">Sin pistas</div>';return}
  let count=0;
  for(let i=0;i<state.ids.length && count<15;i++){
    const f=await getFile(state.ids[i]); if(!f)continue; count++;
    const a=document.createElement('a');
    a.className='item'; a.href=`audio/audio.html?play=${i}`;
    a.innerHTML=`<span>🎵 ${escapeHtml(f.name)}</span>`;
    wrap.appendChild(a);
  }
  if(!count) wrap.innerHTML='<div class="empty">Sin pistas</div>';
}
render();