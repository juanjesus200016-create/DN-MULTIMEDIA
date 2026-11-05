const state={files:[],index:-1,url:null,skip:10,brightness:1,loop:'none',
  g:null,gs:null,seekTarget:null,cues:[],ccOn:false};

const video=document.getElementById('video');
const stage=document.getElementById('stage');
const els={
  seek:document.getElementById('seek'), cur:document.getElementById('curTime'),
  dur:document.getElementById('durTime'), play:document.getElementById('playVid'),
  prev:document.getElementById('prevVid'), next:document.getElementById('nextVid'),
  skipBack:document.getElementById('skipBack'), skipFwd:document.getElementById('skipFwd'),
  skipBackLbl:document.getElementById('skipBackLabel'), skipFwdLbl:document.getElementById('skipFwdLabel'),
  loop:document.getElementById('loopBtn'), rate:document.getElementById('rateSel'),
  cc:document.getElementById('ccBtn'), full:document.getElementById('fullBtn'),
  pip:document.getElementById('pipBtn'), fav:document.getElementById('favVid'),
  name:document.getElementById('vidName'), counter:document.getElementById('vidCounter'),
  add:document.getElementById('addBtn'), picker:document.getElementById('filePicker'),
  hudL:document.getElementById('hudLeft'), hudR:document.getElementById('hudRight'),
  hudC:document.getElementById('hudCenter'), subtitle:document.getElementById('subtitle'),
  subFile:document.getElementById('subtitleFile'), loadSub:document.getElementById('loadSub'),
};

async function load(){
  state.files=(await getAllFiles('video')).sort((a,b)=>a.name.localeCompare(b.name));
  const id=new URLSearchParams(location.search).get('id');
  if(id){const i=state.files.findIndex(f=>f.id==id);if(i>=0)state.index=i;}
  if(state.index<0)state.index=0;
  if(state.files.length)loadVideo(state.index,false);
}
async function loadVideo(i,autoplay=true){
  if(i<0||i>=state.files.length)return;
  state.index=i;
  const f=state.files[i];
  if(state.url)URL.revokeObjectURL(state.url);
  state.url=URL.createObjectURL(f.blob);
  video.src=state.url;
  video.style.filter=`brightness(${state.brightness})`; // mantiene el brillo elegido
  els.name.textContent=f.name;
  els.counter.textContent=`${i+1} / ${state.files.length}`;
  els.fav.textContent=f.favorite?'♥':'♡';
  clearSubs();
  if(autoplay)video.play().catch(()=>{});
  video.addEventListener('loadedmetadata',()=>{
    const d=video.duration||0;
    state.skip=d<60?5:d<600?10:30;
    els.skipBackLbl.textContent=state.skip;
    els.skipFwdLbl.textContent=state.skip;
    els.dur.textContent=formatTime(d);
  },{once:true});
}
function next(){if(state.files.length)loadVideo((state.index+1)%state.files.length);}
function prev(){if(state.files.length)loadVideo((state.index-1+state.files.length)%state.files.length);}

els.play.onclick=()=>{ video.paused?video.play().catch(()=>{}):video.pause(); };
video.addEventListener('play',()=>els.play.textContent='⏸');
video.addEventListener('pause',()=>els.play.textContent='▶');

els.prev.onclick=prev; els.next.onclick=next;
els.skipBack.onclick=()=>{video.currentTime=Math.max(0,video.currentTime-state.skip)};
els.skipFwd.onclick=()=>{video.currentTime=Math.min(video.duration||0,video.currentTime+state.skip)};

video.addEventListener('timeupdate',()=>{
  if(!video.duration)return;
  els.seek.value=(video.currentTime/video.duration)*100;
  els.cur.textContent=formatTime(video.currentTime);
  updateSubs(video.currentTime);
});
els.seek.oninput=()=>{if(video.duration)video.currentTime=(els.seek.value/100)*video.duration};

els.loop.onclick=()=>{
  const ord=['none','one','all'];
  state.loop=ord[(ord.indexOf(state.loop)+1)%3];
  els.loop.classList.toggle('active',state.loop!=='none');
  els.loop.textContent=state.loop==='one'?'🔂':'🔁';
  video.loop=state.loop==='one';
};
video.addEventListener('ended',()=>{
  if(state.loop==='one'){video.currentTime=0;video.play();return;}
  if(state.loop==='all'){next();return;}
  if(state.index<state.files.length-1)next();
});

els.rate.onchange=()=>{video.playbackRate=parseFloat(els.rate.value)};

/* EL CAMBIO ESTÁ AQUÍ: Solicitamos pantalla completa para TODO el main, no solo el stage */
els.full.onclick=()=>{
  const mainPlayer = document.querySelector('.video-main');
  if(document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    mainPlayer.requestFullscreen?.().catch(()=>{});
  }
};

els.pip.onclick=async()=>{
  if(!document.pictureInPictureEnabled){alert('PiP no disponible');return;}
  try{
    if(document.pictureInPictureElement)await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  }catch(e){console.error(e);}
};
els.fav.onclick=async()=>{
  const f=state.files[state.index]; if(!f)return;
  f.favorite=await toggleFavorite(f.id);
  els.fav.textContent=f.favorite?'♥':'♡';
};
els.add.onclick=()=>els.picker.click();
els.picker.onchange=async()=>{
  for(const f of els.picker.files){try{await addFile(f,'video')}catch(e){console.error(e)}}
  els.picker.value='';await load();
};

/* ===== Gestos (toque único) ===== */
stage.addEventListener('touchstart',e=>{
  if(e.touches.length!==1)return;
  const t=e.touches[0], r=stage.getBoundingClientRect();
  const relX=(t.clientX-r.left)/r.width;
  state.g=relX<.35?'bright':relX>.65?'vol':'seek';
  state.gs={x:t.clientX,y:t.clientY,b:state.brightness,v:video.volume,t:video.currentTime,w:r.width,h:r.height,moved:false};
},{passive:true});

stage.addEventListener('touchmove',e=>{
  if(!state.g||e.touches.length!==1)return;
  const t=e.touches[0],gs=state.gs;
  const dx=t.clientX-gs.x, dy=t.clientY-gs.y;
  if(Math.abs(dx)>10||Math.abs(dy)>10)gs.moved=true;
  if(state.g==='bright'){
    state.brightness=Math.min(2,Math.max(.2,gs.b-dy/gs.h*2));
    video.style.filter=`brightness(${state.brightness})`;
    hud(els.hudL,`☀️ ${Math.round(state.brightness*100)}%`);
    e.preventDefault();
  } else if(state.g==='vol'){
    video.volume=Math.min(1,Math.max(0,gs.v-dy/gs.h*2));
    hud(els.hudR,`🔊 ${Math.round(video.volume*100)}%`);
    e.preventDefault();
  } else {
    const d=dx/gs.w, target=Math.min(video.duration||0,Math.max(0,gs.t+d*(video.duration||0)));
    state.seekTarget=target;
    const diff=target-video.currentTime;
    hud(els.hudC,`${diff>=0?'+':''}${Math.round(diff)}s`);
    e.preventDefault();
  }
},{passive:false});

stage.addEventListener('touchend',()=>{
  if(state.g==='seek'&&state.seekTarget!=null){
    video.currentTime=state.seekTarget; state.seekTarget=null;
  }
  const wasMoved=state.gs?.moved;
  setTimeout(()=>{
    els.hudL.classList.remove('show');
    els.hudR.classList.remove('show');
    els.hudC.classList.remove('show');
  },600);
  if(state.g&&!wasMoved){
    video.paused?video.play().catch(()=>{}):video.pause();
  }
  state.g=null;state.gs=null;
});
function hud(el,txt){el.textContent=txt;el.classList.add('show');}

/* ===== Subtítulos ===== */
els.loadSub.onclick=()=>els.subFile.click();
els.subFile.onchange=async()=>{
  const f=els.subFile.files[0];if(!f)return;
  const txt=await f.text();
  state.cues=f.name.toLowerCase().endsWith('.vtt')?parseVTT(txt):parseSRT(txt);
  state.ccOn=true;els.cc.classList.add('active');
  els.subFile.value='';
};
els.cc.onclick=()=>{
  if(!state.cues.length){els.subFile.click();return;}
  state.ccOn=!state.ccOn;
  els.cc.classList.toggle('active',state.ccOn);
  if(!state.ccOn)els.subtitle.hidden=true;
};
function clearSubs(){state.cues=[];state.ccOn=false;els.subtitle.hidden=true;els.cc.classList.remove('active');}
function parseVTT(txt){
  const cues=[];let cur=null;
  txt.split(/\r?\n/).forEach(line=>{
    if(line.includes('-->')){const m=line.match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
      if(m){cur={start:pt(m[1]),end:pt(m[2]),text:''};cues.push(cur);}}
    else if(!line.trim())cur=null;
    else if(cur)cur.text+=(cur.text?' ':'')+line;
  });
  return cues;
}
function parseSRT(txt){
  return txt.trim().split(/\r?\n\r?\n+/).map(b=>{
    const lines=b.split(/\r?\n/), tl=lines.find(l=>l.includes('-->'));
    if(!tl)return null;
    const m=tl.match(/([\d:,]+)\s*-->\s*([\d:,]+)/);if(!m)return null;
    return {start:pt(m[1].replace(',','.')),end:pt(m[2].replace(',','.')),
      text:lines.slice(lines.indexOf(tl)+1).join(' ')};
  }).filter(Boolean);
}
function pt(t){
  const p=t.split(':').map(Number);
  return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];
}
function updateSubs(t){
  if(!state.ccOn||!state.cues.length){els.subtitle.hidden=true;return;}
  const a=state.cues.find(c=>t>=c.start&&t<=c.end);
  if(a){els.subtitle.textContent=a.text;els.subtitle.hidden=false;}
  else els.subtitle.hidden=true;
}

if('mediaSession' in navigator){
  navigator.mediaSession.setActionHandler('play',()=>video.play());
  navigator.mediaSession.setActionHandler('pause',()=>video.pause());
  navigator.mediaSession.setActionHandler('previoustrack',prev);
  navigator.mediaSession.setActionHandler('nexttrack',next);
  navigator.mediaSession.setActionHandler('seekbackward',()=>{video.currentTime=Math.max(0,video.currentTime-state.skip)});
  navigator.mediaSession.setActionHandler('seekforward',()=>{video.currentTime=Math.min(video.duration||0,video.currentTime+state.skip)});
}
load();