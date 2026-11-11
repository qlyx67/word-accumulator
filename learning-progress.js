/* Local, deterministic review schedule. No account and no network required. */
(function(root) {
  'use strict';
  const dayKey = (time = Date.now()) => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const intervals = [1,3,7,14,30,60];
  function updateEntry(previous, rating, now) {
    const old = previous || {};
    const sameDay = old.lastSuccess && dayKey(old.lastSuccess) === dayKey(now);
    const stage = rating === 3 ? Math.min(intervals.length, (old.stage || 0) + (sameDay ? 0 : 1)) : 0;
    const delay = rating === 1 ? 10*60000 : rating === 2 ? 60*60000 : intervals[Math.max(0,stage-1)]*86400000;
    return { stage, due:now+delay, last:now, lastSuccess:rating===3?now:old.lastSuccess||0, reviews:(old.reviews||0)+1, lapses:(old.lapses||0)+(rating===1?1:0) };
  }
  const api = {dayKey,updateEntry};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  const key = deckStorageKey('word-accumulator.learning.v1');
  let state;
  function read() { try { const s=JSON.parse(localStorage.getItem(key)); return s?.version===1 && s.entries && s.days ? s : {version:1,goal:20,entries:{},days:{}}; } catch { return {version:1,goal:20,entries:{},days:{}}; } }
  state=read();
  function save() {
    try { localStorage.setItem(key,JSON.stringify(state)); } catch { byId('save-note').textContent='当前浏览器无法保存，请及时导出学习备份。'; }
    document.dispatchEvent(new Event('learning-updated'));
  }
  Object.assign(api, {
    getState(){return state;},
    entry(word){return state.entries[wordKey(word)];},
    checkpoint(word){const k=wordKey(word),d=dayKey();return {key:k,day:d,entry:state.entries[k]&&{...state.entries[k]},daily:state.days[d]?.[k]&&{...state.days[d][k]}};},
    restore(saved){if(!saved)return;state=read(); if(saved.entry)state.entries[saved.key]=saved.entry;else delete state.entries[saved.key];if(saved.daily)(state.days[saved.day]||={})[saved.key]=saved.daily;else if(state.days[saved.day])delete state.days[saved.day][saved.key];save();},
    record(word,rating,source='card') {
      if(!word)return;state=read();const now=Date.now(),k=wordKey(word),d=dayKey(now);
      state.entries[k]=updateEntry(state.entries[k],rating,now);
      const day=state.days[d]||={};const old=day[k]||{attempts:0,correct:0};
      day[k]={attempts:old.attempts+1,correct:old.correct+(rating===3?1:0),source};save();
    },
    goal(value){state=read();state.goal=[10,20,30,50].includes(Number(value))?Number(value):20;save();},
    due(){return words.filter(w=>state.entries[wordKey(w)]?.due<=Date.now()).sort((a,b)=>state.entries[wordKey(a)].due-state.entries[wordKey(b)].due);},
    today(){return state.days[dayKey()]||{};},
    stats(){const today=api.today();let attempts=0,correct=0;Object.values(today).forEach(v=>{attempts+=v.attempts;correct+=v.correct;});return {count:Object.keys(today).length,attempts,correct,goal:state.goal,reviewed:Object.keys(state.entries).length};},
    week(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=dayKey(d);return {key,label:['日','一','二','三','四','五','六'][d.getDay()],count:Object.keys(state.days[key]||{}).length};});},
    plan(){const size=Math.max(0,state.goal-Object.keys(api.today()).length);const done=new Set(Object.keys(api.today()));const due=api.due().filter(w=>!done.has(wordKey(w)));const fresh=words.filter(w=>!state.entries[wordKey(w)]&&!isMastered(w)&&!done.has(wordKey(w)));const included=new Set([...due,...fresh]);const remaining=words.filter(w=>!done.has(wordKey(w))&&!included.has(w));return [...due,...fresh,...remaining].slice(0,size);}
  });
  root.LearningProgress=api;
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){state=read();document.dispatchEvent(new Event('learning-updated'));}});
})(globalThis);
