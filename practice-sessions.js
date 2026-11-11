/* A bounded spelling session, with exact-word retry and immediate feedback. */
(() => {
  const panel=byId('spell');
  const meter=document.createElement('div');meter.className='practice-meter';meter.innerHTML='<span id="spell-session-label">本轮 0 / 10</span><progress id="spell-session-progress" max="10" value="0" aria-label="本轮拼写进度"></progress><span id="spell-session-score">答对 0</span>';
  panel.querySelector('.panel-heading').after(meter);
  const summary=document.createElement('div');summary.className='practice-summary';summary.hidden=true;summary.innerHTML='<span class="eyebrow">ROUND COMPLETE</span><h2 id="spell-result-title"></h2><p id="spell-result-detail"></p><div id="spell-result-words"></div><div class="actions"><button type="button" class="primary" id="spell-retry">只练本轮错词</button><button type="button" id="spell-another">再来一轮</button></div>';
  panel.append(summary);
  let total=0,correct=0,target=10,missed=[],finished=false;
  function render(){byId('spell-session-label').textContent=`本轮 ${total} / ${target}`;byId('spell-session-progress').max=target;byId('spell-session-progress').value=total;byId('spell-session-score').textContent='答对 '+correct;}
  function reset(limit=10){total=0;correct=0;target=limit;missed=[];finished=false;summary.hidden=true;for(const id of ['spell-form','spell-clue','spell-hint','spell-feedback'])byId(id).hidden=false;render();}
  function complete(){finished=true;summary.hidden=false;for(const id of ['spell-form','spell-clue','spell-hint','spell-feedback'])byId(id).hidden=true;byId('spell-result-title').textContent=`本轮答对 ${correct} / ${total} 题`;byId('spell-result-detail').textContent=missed.length?'把这些词再练一遍，让这一轮有收获。':'全部答对。明天再回忆一次，检验是否还记得。';byId('spell-result-words').replaceChildren(...missed.map(w=>{const span=document.createElement('span');span.textContent=w.term;return span;}));byId('spell-retry').hidden=!missed.length;byId(missed.length?'spell-retry':'spell-another').focus();}
  document.addEventListener('spelling-answered',e=>{if(finished)return;total++;if(e.detail.correct)correct++;else if(!missed.includes(e.detail.word))missed.push(e.detail.word);render();if(total>=target)byId('submit').textContent='查看本轮总结';});
  byId('spell-form').addEventListener('submit',e=>{if(checked&&total>=target){e.preventDefault();e.stopImmediatePropagation();complete();}},true);
  byId('spell-another').onclick=()=>{reset();spellingQueue=[];nextSpelling();};
  byId('spell-retry').onclick=()=>{const retry=[...missed];reset(retry.length);spellingQueue=shuffle(retry);nextSpelling();};
  document.addEventListener('exercise-reset',()=>{if(mode==='spell')reset();});
  const matchOptions=document.createElement('label');matchOptions.className='match-size-control';matchOptions.innerHTML='每轮 <select id="match-size" aria-label="配对数量"><option value="6">6 对 · 轻量</option><option value="10" selected>10 对 · 标准</option></select>';
  byId('match').querySelector('.muted').after(matchOptions);
  try{byId('match-size').value=localStorage.getItem('word-accumulator.match-size')==='6'?'6':'10';}catch{}
  byId('match-size').onchange=()=>{try{localStorage.setItem('word-accumulator.match-size',byId('match-size').value);}catch{}startMatch();};
})();
