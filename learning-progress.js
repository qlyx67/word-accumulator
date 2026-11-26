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
  const base = 'word-accumulator.learning.v1';
  const key = deckStorageKey(base);
  const origins = typeof studyOrigins === 'undefined' ? new Map() : studyOrigins;
  const sourceKeys = origins.size
    ? new Map(selectedDeckIds.map(id => [id, storageKeyForDeck(base, id)]))
    : new Map();
  const watched = new Set([key, ...sourceKeys.values()]);
  function load(storageKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.version === 1 && saved.entries && saved.days) return saved;
    } catch {}
    return {version:1,goal:20,entries:{},days:{}};
  }
  function read() {
    const combined = load(key);
    if (!origins.size) return combined;
    const sources = new Map([...sourceKeys].map(([id, idKey]) => [id, load(idKey)]));
    const keyMaps = new Map([...sourceKeys.keys()].map(id => [id, new Map()]));
    for (const [wordId, {deckId, originalKey}] of origins) {
      keyMaps.get(deckId).set(originalKey, wordId);
      const entry = sources.get(deckId).entries[originalKey];
      if (entry) combined.entries[wordId] = entry;
    }
    for (const [id, source] of sources) {
      const keys = keyMaps.get(id);
      for (const [day, records] of Object.entries(source.days)) {
        for (const [wordId, record] of Object.entries(records)) {
          const mapped = keys.get(wordId);
          if (mapped) (combined.days[day] ||= {})[mapped] = record;
        }
      }
    }
    return combined;
  }
  let state = read();
  function save(storageKey, records) {
    try { localStorage.setItem(storageKey,JSON.stringify(records)); }
    catch { byId('save-note').textContent='当前浏览器无法保存，请及时导出学习备份。'; }
    document.dispatchEvent(new Event('learning-updated'));
  }
  function changeWord(wordId, day, update) {
    state = read();
    const origin = origins.get(wordId);
    const storageKey = origin ? sourceKeys.get(origin.deckId) : key;
    const original = origin ? load(storageKey) : state;
    const originalId = origin?.originalKey ?? wordId;
    update(original, originalId);
    if (origin) {
      if (original.entries[originalId]) state.entries[wordId] = original.entries[originalId];
      else delete state.entries[wordId];
      const record = original.days[day]?.[originalId];
      if (record) (state.days[day] ||= {})[wordId] = record;
      else if (state.days[day]) delete state.days[day][wordId];
    }
    save(storageKey, original);
  }
  Object.assign(api, {
    getState(){return state;},
    entry(word){return state.entries[wordKey(word)];},
    checkpoint(word){const k=wordKey(word),d=dayKey();return {key:k,day:d,entry:state.entries[k]&&{...state.entries[k]},daily:state.days[d]?.[k]&&{...state.days[d][k]}};},
    restore(saved) {
      if (!saved) return;
      changeWord(saved.key, saved.day, (target, id) => {
        if (saved.entry) target.entries[id] = saved.entry;
        else delete target.entries[id];
        if (saved.daily) (target.days[saved.day] ||= {})[id] = saved.daily;
        else if (target.days[saved.day]) delete target.days[saved.day][id];
      });
    },
    record(word, rating, source = 'card') {
      if (!word) return;
      const now = Date.now(), dayKeyNow = dayKey(now);
      changeWord(wordKey(word), dayKeyNow, (target, id) => {
        target.entries[id] = updateEntry(target.entries[id], rating, now);
        const daily = target.days[dayKeyNow] ||= {};
        const old = daily[id] || {attempts:0,correct:0};
        daily[id] = {attempts:old.attempts+1,correct:old.correct+(rating===3?1:0),source};
      });
    },
    goal(value) {
      state = read();
      const stored = origins.size ? load(key) : state;
      stored.goal = state.goal = [10,20,30,50].includes(Number(value)) ? Number(value) : 20;
      save(key, stored);
    },
    due(){return words.filter(w=>state.entries[wordKey(w)]?.due<=Date.now()).sort((a,b)=>state.entries[wordKey(a)].due-state.entries[wordKey(b)].due);},
    today(){return state.days[dayKey()]||{};},
    stats(){const today=api.today();let attempts=0,correct=0;Object.values(today).forEach(v=>{attempts+=v.attempts;correct+=v.correct;});return {count:Object.keys(today).length,attempts,correct,goal:state.goal,reviewed:Object.keys(state.entries).length};},
    week(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=dayKey(d);return {key,label:['日','一','二','三','四','五','六'][d.getDay()],count:Object.keys(state.days[key]||{}).length};});},
    plan(){const size=Math.max(0,state.goal-Object.keys(api.today()).length);const done=new Set(Object.keys(api.today()));const due=api.due().filter(w=>!done.has(wordKey(w)));const fresh=words.filter(w=>!state.entries[wordKey(w)]&&!isMastered(w)&&!done.has(wordKey(w)));const included=new Set([...due,...fresh]);const remaining=words.filter(w=>!done.has(wordKey(w))&&!included.has(w));return [...due,...fresh,...remaining].slice(0,size);}
  });
  root.LearningProgress=api;
  window.addEventListener('storage',e=>{if(watched.has(e.key)||e.key===null){state=read();document.dispatchEvent(new Event('learning-updated'));}});
})(globalThis);
