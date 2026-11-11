const assert=require('node:assert/strict'),validate=require('../backup-validation.js');
const wrap=(key,value)=>({format:'word-accumulator-backup',version:1,storage:{[key]:JSON.stringify(value)}});
assert.equal(validate(wrap('word-accumulator.progress.v1',{alpha:{spell:true}})).length,1);
assert.throws(()=>validate(wrap('foreign-key',{})));
assert.throws(()=>validate(wrap('word-accumulator.study.v2',{queue:'broken'})));
assert.throws(()=>validate(wrap('word-accumulator.decks.v1',[{id:'x',name:'x',words:[{term:5}]}])));
assert.throws(()=>validate(wrap('word-accumulator.learning.v1',{version:1,goal:20,entries:{x:null},days:{}})));
assert.equal(validate(wrap('word-accumulator.learning.v1',{version:1,goal:20,entries:{},days:{}})).length,1);
console.log('PASS: valid exports, wrong namespace, malformed decks/queues/review records');
