const EQ_FREQS=[60,170,310,600,1000,3000,6000,12000,14000,16000];
const EQ_LABELS=['60','170','310','600','1k','3k','6k','12k','14k','16k'];

const state={files:[],index:-1,loop:'none',shuffle:false,
  order:[],pos:0,url:null,ctx:null,src:null,filters:[]};

const audio=document.getElementById('audio');
const els={
  title:document.getElementById('trackTitle'), sub:document.getElementById('trackSub'),
  seek:document.getElementById('seek'), cur:document.getElementById('curTime'),
  dur:document.getElementById('durTime'), play:document.getElementById('playBtn'),
  prev:document.getElementById('prevBtn'), next:document.getElementById('nextBtn'),
  loop:document.getElementById('loopBtn'), shuffle:document.getElementById('shuffleBtn'),
  rate:document.getElementById('rateSelect'), fav:document.getElementById('favBtn'),
  add:document.getElementById('addBtn'), pl:document.getElementById('playlist'),
  clear:document.getElementById('clearPl'), picker:document.getElementById('filePicker'),
  eqToggle:document.getElementById('eqToggle'), eqPanel:document.getElementById('eqPanel'),
  eqClose:document.getElementById('eqClose'), eqBands:document.getElementById('eqBands'),
  eqReset:document.getElementById('eqReset'),
};

async function load(){
  const all=await getAllFiles('audio');
  const saved=getPlaylistState();
  // Respetamos orden guardado si existe
  state.files=[];
  if(saved.ids?.length){
    for(const id of saved.ids){const f=all.find(x=>x.id===id);if(f)state.files.push(f);}
    for(const f of all) if(!state.files.find(x=>x.id===f.id))state.files.push(f);
  } else state.files=all.slice();
  state.loop=saved.loop||'none';
  state.shuffle=!!saved.shuffle;
  if(state.shuffle)buildShuffle();
  updateLoop();updateShuffle();

  // Prioridad: ?play=N (viene del lobby con autoplay) > ?id=X > último guardado > 0
  const p=new URLSearchParams(location.search);
  const wantsAutoplay = p.get('play')!=null;
  if(wantsAutoplay){
    state.index=parseInt(p.get('play'))||0;
  } else if(p.get('id')){
    const i=state.files.findIndex(f=>f.id==p.get('id'));
    if(i>=0)state.index=i;
  } else if(saved.current!=null && saved.current>=0 && saved.current<state.files.length){
    state.index=saved.current;
  }
  if(state.index<0)state.index=0;
  renderPl();
  if(state.files.length)loadTrack(state.index, wantsAutoplay);
}

function buildShuffle(){
  state.order=state.files.map((_,i)=>i);
  for(let i=state.order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[state.order[i],state.order[j]]=[state.order[j],state.order[i]];}
  state.pos=0;
}
async function loadTrack(i,autoplay=true){
  if(i<0||i>=state.files.length)return;
  state.index=i;
  const f=state.files[i];
  if(state.url)URL.revokeObjectURL(state.url);
  state.url=URL.createObjectURL(f.blob);
  audio.src=state.url;
  els.title.textContent=f.name;
  els.sub.textContent=`${i+1} / ${state.files.length}`;
  els.fav.textContent=f.favorite?'♥':'♡';
  renderPl();
  save(); // persiste la pista actual entre sesiones
  if('mediaSession' in navigator){
    navigator.mediaSession.metadata=new MediaMetadata({title:f.name,artist:'MediaPlay',album:'Local'});
    navigator.mediaSession.setActionHandler('play',()=>audio.play());
    navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack',prev);
    navigator.mediaSession.setActionHandler('nexttrack',next);
  }
  if(autoplay){try{await audio.play()}catch(e){}}
}
function save(){setPlaylistState({ids:state.files.map(f=>f.id),current:state.index,loop:state.loop,shuffle:state.shuffle});}
function renderPl(){
  els.pl.innerHTML='';
  state.files.forEach((f,i)=>{
    const li=document.createElement('li');
    li.className=i===state.index?'active':'';
    li.innerHTML=`<span class="pl-fav">${f.favorite?'♥':'♪'}</span>
      <span class="pl-name">${escapeHtml(f.name)}</span>
      <button class="pl-del" aria-label="Quitar">✕</button>`;
    li.onclick=e=>{
      if(e.target.classList.contains('pl-del')){e.stopPropagation();removeTrack(i);}
      else loadTrack(i);
    };
    els.pl.appendChild(li);
  });
}
async function removeTrack(i){
  const f=state.files[i];
  if(!confirm(`¿Quitar "${f.name}" de la lista?`))return;
  state.files.splice(i,1);
  if(!state.files.length){audio.pause();audio.removeAttribute('src');state.index=-1;els.title.textContent='Sin pista';els.sub.textContent='—';}
  else if(i===state.index)loadTrack(Math.min(i,state.files.length-1));
  else if(i<state.index)state.index--;
  save();renderPl();
}
function next(){
  if(!state.files.length)return;
  if(state.shuffle){
    state.pos=(state.pos+1)%(state.order.length||1);
    loadTrack(state.order[state.pos]??0);
  } else {
    const n=(state.index+1)%state.files.length;
    if(n===0 && state.loop==='none' && state.index===state.files.length-1){audio.pause();return;}
    loadTrack(n);
  }
}
function prev(){
  if(!state.files.length)return;
  if(audio.currentTime>3){audio.currentTime=0;return;}
  if(state.shuffle){
    state.pos=(state.pos-1+state.order.length)%state.order.length;
    loadTrack(state.order[state.pos]??0);
  } else loadTrack((state.index-1+state.files.length)%state.files.length);
}

/* Audio context (EQ) — debe crearse desde gesto del usuario */
function ensureCtx(){
  if(state.ctx){if(state.ctx.state==='suspended')state.ctx.resume();return;}
  const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx)return;
  try{
    state.ctx=new Ctx();
    state.src=state.ctx.createMediaElementSource(audio);
    state.filters=EQ_FREQS.map((freq,i)=>{
      const f=state.ctx.createBiquadFilter();
      f.type=i===0?'lowshelf':i===EQ_FREQS.length-1?'highshelf':'peaking';
      f.frequency.value=freq; f.Q.value=1; f.gain.value=0; return f;
    });
    let prev=state.src;
    state.filters.forEach(f=>{prev.connect(f);prev=f;});
    prev.connect(state.ctx.destination);
  }catch(e){console.error('EQ',e);}
}

/* Play/pause */
els.play.onclick=async()=>{
  if(audio.paused){ensureCtx();try{await audio.play()}catch(e){console.error(e)}}
  else audio.pause();
};
audio.addEventListener('play',()=>els.play.textContent='⏸');
audio.addEventListener('pause',()=>els.play.textContent='▶');

els.prev.onclick=prev; els.next.onclick=next;

/* Loop & shuffle */
els.loop.onclick=()=>{
  const ord=['none','one','all'];
  state.loop=ord[(ord.indexOf(state.loop)+1)%3];
  updateLoop(); save();
};
function updateLoop(){
  els.loop.classList.toggle('active',state.loop!=='none');
  els.loop.textContent=state.loop==='one'?'🔂':'🔁';
}
els.shuffle.onclick=()=>{
  state.shuffle=!state.shuffle;
  if(state.shuffle)buildShuffle();
  updateShuffle(); save();
};
function updateShuffle(){els.shuffle.classList.toggle('active',state.shuffle);}

audio.addEventListener('ended',()=>{
  if(state.loop==='one'){audio.currentTime=0;audio.play();return;}
  if(state.loop==='all'||state.shuffle){next();return;}
  if(state.index<state.files.length-1)next();
  else audio.pause();
});

/* Seek */
audio.addEventListener('timeupdate',()=>{
  if(!audio.duration)return;
  els.seek.value=(audio.currentTime/audio.duration)*100;
  els.cur.textContent=formatTime(audio.currentTime);
});
audio.addEventListener('loadedmetadata',()=>{els.dur.textContent=formatTime(audio.duration)});
els.seek.oninput=()=>{if(audio.duration)audio.currentTime=(els.seek.value/100)*audio.duration};

els.rate.onchange=()=>{audio.playbackRate=parseFloat(els.rate.value)};

els.fav.onclick=async()=>{
  const f=state.files[state.index]; if(!f)return;
  f.favorite=await toggleFavorite(f.id);
  els.fav.textContent=f.favorite?'♥':'♡';
  renderPl();
};

els.add.onclick=()=>els.picker.click();
els.picker.onchange=async()=>{
  for(const f of els.picker.files){try{await addFile(f,'audio')}catch(e){console.error(e)}}
  els.picker.value=''; await load(); save();
};
els.clear.onclick=()=>{
  if(!confirm('¿Vaciar la lista? (no borra los archivos)'))return;
  state.files=[];state.index=-1;audio.pause();audio.removeAttribute('src');
  els.title.textContent='Sin pista';els.sub.textContent='—';
  save();renderPl();
};

/* EQ UI */
function buildEQ(){
  els.eqBands.innerHTML='';
  EQ_FREQS.forEach((_,i)=>{
    const wrap=document.createElement('div');wrap.className='eq-band';
    const s=document.createElement('input');
    s.type='range';s.min='-12';s.max='12';s.value='0';s.step='1';
    s.oninput=()=>{if(state.filters[i])state.filters[i].gain.value=parseFloat(s.value)};
    const label=document.createElement('span');label.textContent=EQ_LABELS[i];
    wrap.appendChild(s);wrap.appendChild(label);
    els.eqBands.appendChild(wrap);
  });
}
buildEQ();
els.eqToggle.onclick=async()=>{
  els.eqPanel.hidden=!els.eqPanel.hidden;
  if(!els.eqPanel.hidden){
    ensureCtx();
    if(state.ctx?.state==='suspended'){try{await state.ctx.resume()}catch(e){}}
  }
};
els.eqClose.onclick=()=>els.eqPanel.hidden=true;
els.eqReset.onclick=()=>{
  state.filters.forEach(f=>f.gain.value=0);
  els.eqBands.querySelectorAll('input').forEach(s=>s.value=0);
};

load();