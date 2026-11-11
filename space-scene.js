/* Optional ambient detail. No animation loop, no compositing large planets. */
(() => {
  const scene=document.querySelector('.space-scene');
  if(!scene)return;
  const station=document.createElement('div');station.className='ambient-station';
  // Twelve separate habitat modules around a structural ring, seen obliquely.
  const modules=Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 50 50)"><rect x="45" y="7" width="10" height="15" rx="1.5" fill="#7c8ca9" stroke="#b7c4da" stroke-width=".6"/><path d="M46 10h8M46 13h8M46 16h8" stroke="#35425b" stroke-width="1"/></g>`).join('');
  station.innerHTML=`<svg viewBox="0 0 100 100"><g transform="translate(10 4) skewX(-13) scale(.84 .94)"><circle cx="50" cy="50" r="35" fill="none" stroke="#687c99" stroke-width="2"/><circle cx="50" cy="50" r="29" fill="none" stroke="#455672" stroke-width=".7"/>${modules}<path d="M50 20v26M50 54v26M20 50h24M56 50h24" stroke="#5e7393" stroke-width=".8"/><rect x="45" y="44" width="10" height="12" rx="1" fill="#92a3bc"/><path d="M47 46v8M52 46v8" stroke="#35445f" stroke-width="1"/></g></svg>`;
  scene.append(station);
  let timer,flight;
  function schedule(){clearTimeout(timer);flight?.cancel();if(document.hidden||document.body.dataset.view!=='home'||!document.body.classList.contains('ambient-enabled')||document.body.classList.contains('no-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;timer=setTimeout(()=>{flight=station.animate([{transform:'translateX(-70px) rotate(-18deg)',opacity:0},{opacity:.22,offset:.15},{opacity:.22,offset:.8},{transform:`translateX(${innerWidth+70}px) rotate(10deg)`,opacity:0}],{duration:27000,easing:'linear'});flight.finished.then(()=>{if(document.body.dataset.view==='home')schedule();}).catch(()=>{});},35000);}
  document.addEventListener('studio-view-changed',schedule);document.addEventListener('visibilitychange',schedule);document.getElementById('ambient-toggle').addEventListener('change',schedule);document.getElementById('space-motion-toggle').addEventListener('change',schedule);schedule();
})();
