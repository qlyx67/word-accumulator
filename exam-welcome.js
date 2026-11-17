/* A disposable exercise helps visitors understand before importing. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),C=StudyPackCore;
 const words={
  cloze:{kind:'word',term:'address',meaning:'处理；解决',example:'We need to address this problem.',alternatives:[],enabled:true},
  listen:{kind:'word',term:'capture',meaning:'拍摄；记录',example:'I want to capture the light.',alternatives:[],enabled:true},
  'zh-en':{kind:'sentence',term:'We need more time.',meaning:'我们需要更多时间。',example:'',alternatives:[],enabled:true}
 };
 let mode='cloze';
 function reset(next=mode){
  stopSpeech();mode=next;
  const item=words[mode],q=C.question(item,mode);
  document.querySelectorAll('[data-demo-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.demoMode===mode));
  $('demo-card').dataset.mode=mode;$('demo-card').classList.remove('solved');
  $('demo-instruction').textContent=mode==='cloze'?'根据中文意思，填入完整单词':mode==='listen'?'点击播放，把听到的单词写下来':'试着用英文表达这句话';
  $('demo-prompt').textContent=q.prompt;$('demo-prompt').lang=mode==='zh-en'?'zh-CN':'en';
  $('demo-prompt').hidden=mode==='listen';$('demo-play').hidden=mode!=='listen';$('demo-clue').textContent=q.clue;
  $('demo-answer').placeholder=mode==='zh-en'?'用英文表达，不必一字不差':'输入完整单词';
  $('demo-answer').value='';$('demo-answer').disabled=false;$('demo-check').disabled=false;$('demo-form').hidden=false;
  for(const id of ['demo-feedback','demo-self','demo-success','demo-reset','demo-original'])$(id).hidden=true;
  $('demo-speech-status').textContent='';$('demo-source').setAttribute('aria-expanded','false');$('demo-source').textContent='卡住了？看原文';
  $('demo-original-word').textContent=item.term+' · '+item.meaning;
  $('demo-original-text').textContent=item.example||'双语句子可以练英译中，也可以反过来练中译英。';
 }
 function message(text,kind){$('demo-feedback').hidden=false;$('demo-feedback').className=kind;$('demo-feedback').textContent=text;}
 function success(self=false){
  $('demo-card').classList.add('solved');$('demo-answer').disabled=true;$('demo-check').disabled=true;
  $('demo-self').hidden=true;$('demo-success').hidden=false;$('demo-reset').hidden=false;
  message(self?'✓ 已按你的自评通过。其他表达也能留下来。':'✓ 答对了！这个表达，你已经用过一次了。','good');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('demo-card').animate([{transform:'translateY(0)'},{transform:'translateY(-5px)'},{transform:'translateY(0)'}],{duration:360,easing:'ease-out'});
 }
 $('demo-form').onsubmit=event=>{
  event.preventDefault();const answer=$('demo-answer').value;
  if(!answer.trim()){message('先写下你的答案，卡住了可以点下方「看原文」。','tip');$('demo-answer').focus();return;}
  const result=C.grade(words[mode],mode,answer);
  if(result.status==='correct')success();
  else if(result.status==='review'){message('参考表达：We need more time. 如果你的意思相同，可以对照自评通过。','tip');$('demo-self').hidden=false;}
  else{message('还差一点。可以再试一次，或点「看原文」找提示。','tip');$('demo-answer').focus();}
 };
 $('demo-source').onclick=()=>{const opened=$('demo-original').hidden;$('demo-original').hidden=!opened;$('demo-source').setAttribute('aria-expanded',String(opened));$('demo-source').textContent=opened?'收起原文 ↑':'卡住了？看原文';};
 $('demo-play').onclick=()=>{prepareStudySpeech();speakStudy({term:words[mode].term},$('demo-speech-status'),'en-US');};
 $('demo-accept').onclick=()=>success(true);
 $('demo-again').onclick=()=>{$('demo-self').hidden=true;$('demo-feedback').hidden=true;$('demo-answer').focus();};
 $('demo-reset').onclick=()=>reset();
 document.querySelectorAll('[data-demo-mode]').forEach(b=>b.onclick=()=>reset(b.dataset.demoMode));
 $('try-demo').onclick=()=>{
  if($('demo-answer').disabled)reset();
  $('demo-answer').focus({preventScroll:true});
  const top=window.scrollY+$('demo-card').getBoundingClientRect().top-24;
  window.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 reset();
})();
