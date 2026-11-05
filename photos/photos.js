const state={files:[],index:0,timerOn:false,timerSec:5,fitCover:false,
  handle:null,url:null,scale:1};

const els={
  photo:document.getElementById('photo'),
  name:document.getElementById('photoName'),
  counter:document.getElementById('photoCounter'),
  prev:document.getElementById('prevBtn'), next:document.getElementById('nextBtn'),
  timerSec:document.getElementById('timerSec'), play:document.getElementById('playToggle'),
  fav:document.getElementById('favBtn'), fit:document.getElementById('fitToggle'),
  del:document.getElementById('deleteBtn'), gallery:document.getElementById('gallery'),
  add:document.getElementById('addBtn'), picker:document.getElementById('filePicker'),
  stage:document.getElementById('stage'),
};

async function load(){
  state.files=(await getAllFiles('image')).sort((a,b)=>a.name.localeCompare(b.name));
  const id=new URLSearchParams(location.search).get('id');
  if(id){const i=state.files.findIndex(f=>f.id==id);if(i>=0)state.index=i;}
  if(state.index>=state.files.length)state.index=0;
  renderGallery(); renderCurrent();
}
function renderCurrent(){
  const f=state.files[state.index];
  if(state.url)URL.revokeObjectURL(state.url);
  if(!f){
    els.photo.removeAttribute('src'); els.name.textContent='—';
    els.counter.textContent='0 / 0';
    els.fav.textContent='♡ Favorito'; els.fav.classList.remove('active');
    return;
  }
  state.url=URL.createObjectURL(f.blob);
  els.photo.src=state.url;
  els.photo.classList.toggle('cover',state.fitCover);
  els.name.textContent=f.name;
  els.counter.textContent=`${state.index+1} / ${state.files.length}`;
  els.fav.textContent=f.favorite?'♥ Favorito':'♡ Favorito';
  els.fav.classList.toggle('active',!!f.favorite);
  [...els.gallery.children].forEach((el,i)=>el.classList.toggle('active',i===state.index));
}
async function renderGallery(){
  els.gallery.innerHTML='';
  for(let i=0;i<state.files.length;i++){
    const f=state.files[i];
    const w=document.createElement('div'); w.className='gallery-item';
    if(f.favorite){const s=document.createElement('div');s.className='fav-ind';s.textContent='♥';w.appendChild(s);}
    const img=document.createElement('img');
    const u=URL.createObjectURL(f.blob);
    img.src=u; img.loading='lazy'; img.onload=()=>URL.revokeObjectURL(u);
    w.appendChild(img);
    w.onclick=()=>{state.index=i;renderCurrent();};
    els.gallery.appendChild(w);
  }
}
function next(){if(!state.files.length)return;state.index=(state.index+1)%state.files.length;renderCurrent();}
function prev(){if(!state.files.length)return;state.index=(state.index-1+state.files.length)%state.files.length;renderCurrent();}
function startTimer(){stopTimer();if(state.timerOn)state.handle=setInterval(next,state.timerSec*1000);}
function stopTimer(){if(state.handle){clearInterval(state.handle);state.handle=null;}}

els.play.onclick=()=>{
  state.timerOn=!state.timerOn;
  els.play.textContent=state.timerOn?'⏸ Auto':'▶ Auto';
  els.play.classList.toggle('active',state.timerOn);
  state.timerOn?startTimer():stopTimer();
};
els.timerSec.onchange=()=>{
  state.timerSec=Math.max(1,parseInt(els.timerSec.value)||5);
  if(state.timerOn)startTimer();
};
els.fav.onclick=async()=>{
  const f=state.files[state.index]; if(!f)return;
  f.favorite=await toggleFavorite(f.id);
  els.fav.textContent=f.favorite?'♥ Favorito':'♡ Favorito';
  els.fav.classList.toggle('active',!!f.favorite);
  renderGallery(); renderCurrent();
};
els.fit.onclick=()=>{
  state.fitCover=!state.fitCover;
  els.photo.classList.toggle('cover',state.fitCover);
  els.fit.classList.toggle('active',state.fitCover);
  els.fit.textContent=state.fitCover?'Rellenar':'Ajustar';
};
els.del.onclick=async()=>{
  const f=state.files[state.index]; if(!f)return;
  if(!confirm(`¿Eliminar "${f.name}"?`))return;
  await deleteFile(f.id);
  state.files.splice(state.index,1);
  if(state.index>=state.files.length)state.index=0;
  renderGallery(); renderCurrent();
};
els.prev.onclick=prev; els.next.onclick=next;
els.add.onclick=()=>els.picker.click();
els.picker.onchange=async()=>{
  for(const f of els.picker.files){try{await addFile(f,'image')}catch(e){console.error(e)}}
  els.picker.value=''; await load();
};

/* Gestos: swipe (nav) + pinch (zoom) */
let sx=0,sy=0,pd=0,base=1;
els.stage.addEventListener('touchstart',e=>{
  if(e.touches.length===1){sx=e.touches[0].clientX;sy=e.touches[0].clientY;}
  else if(e.touches.length===2){
    pd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    base=state.scale;
  }
},{passive:true});
els.stage.addEventListener('touchmove',e=>{
  if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    state.scale=Math.min(4,Math.max(1,base*(d/pd)));
    els.photo.style.transform=`scale(${state.scale})`;
    e.preventDefault();
  }
},{passive:false});
els.stage.addEventListener('touchend',e=>{
  if(e.changedTouches.length===1&&state.scale<=1.02){
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)){ dx<0?next():prev(); }
    els.photo.style.transform=''; state.scale=1;
  }
});
load();