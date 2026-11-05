function formatTime(s){
  if(!isFinite(s)||s<0)return'0:00';
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
  return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
           :`${m}:${String(sec).padStart(2,'0')}`;
}
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid=/Android/.test(navigator.userAgent);