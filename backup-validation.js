/* Validate a local export before any storage is overwritten. */
(function(root){
  function validate(data){
    const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const strings=v=>Array.isArray(v)&&v.every(x=>typeof x==='string');
    const fail=()=>{throw Error('备份中的记录无效，尚未修改当前进度。');};
    if(!obj(data)||data.format!=='word-accumulator-backup'||data.version!==1||!obj(data.storage))fail();
    const entries=Object.entries(data.storage);if(!entries.length)fail();
    for(const [k,v] of entries){
      if(!k.startsWith('word-accumulator.')||k.startsWith('word-accumulator.backup-')||typeof v!=='string')fail();
      if(!/\.(progress|study|learning|sentence-mistakes|sentence-options|decks)\./.test(k))continue;
      const p=JSON.parse(v);if(!p||typeof p!=='object')fail();
      if(/\.decks\./.test(k)&&(!Array.isArray(p)||!p.every(d=>obj(d)&&typeof d.id==='string'&&typeof d.name==='string'&&Array.isArray(d.words)&&d.words.length&&d.words.every(w=>obj(w)&&typeof w.term==='string'&&typeof w.topic==='string'&&['meaning','pos','example'].every(f=>w[f]===undefined||typeof w[f]==='string')))))fail();
      if(/\.progress\./.test(k)&&(!obj(p)||!Object.values(p).every(obj)))fail();
      if(/\.study\./.test(k)&&(!obj(p)||['queue','finished','seen','customKeys'].some(f=>p[f]!==undefined&&!strings(p[f]))))fail();
      if(/\.sentence-mistakes\./.test(k)&&!strings(p))fail();
      if(/\.sentence-options\./.test(k)&&!obj(p))fail();
      if(/\.learning\./.test(k)){
        if(!obj(p)||p.version!==1||![10,20,30,50].includes(p.goal)||!obj(p.entries)||!obj(p.days))fail();
        if(!Object.values(p.entries).every(e=>obj(e)&&['stage','due','last','lastSuccess','reviews','lapses'].every(f=>Number.isFinite(e[f])&&e[f]>=0)&&e.stage<=6))fail();
        if(!Object.values(p.days).every(d=>obj(d)&&Object.values(d).every(e=>obj(e)&&Number.isFinite(e.attempts)&&Number.isFinite(e.correct)&&e.attempts>=e.correct&&e.correct>=0)))fail();
      }
    }
    return entries;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=validate;else root.validateLearningBackup=validate;
})(globalThis);
