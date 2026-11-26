const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../exam-core.js');
function setup() {
  const data = new Map(), session = new Map(), options = [];
  const context = vm.createContext({ StudyPackCore: C, builtInWords: [{term:'ielts'}], groupSize:30,
    deckListKey:'decks', deckSelectionKey:'active', activeDeck:null, termPattern:/^[a-zA-Z][a-zA-Z '\u2019-]*$/,
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
    sessionStorage:{setItem:(k,v)=>session.set(k,v)}, StudyPackStore:{async meta(){}},
    deckSelect:{options,add:o=>options.push(o)}, Option:class {constructor(text,value){this.value=value;this.textContent=text;}},
    document:{dispatchEvent(){}}, Event:class{}, history:{replaceState(){}},
    location:{pathname:'/',search:'',reload(){context.reloaded=true;}}
  });
  vm.runInContext(fs.readFileSync('vocabulary-library.js','utf8')+'\nthis.api=VocabularyLibrary;',context);
  return {api:context.api,data,session,context};
}
const row = {enabled:true,kind:'word',term:'insight',meaning:'洞察力',pos:'n.',example:'',exampleZh:'',sources:[]};
test('pack words become independent normal decks; reopen preserves progress and ignores disabled/sentence rows', async()=>{
  const {api,data,session,context}=setup();
  const pack={id:'u5',name:'大学英语 U5',sources:[],progress:{existing:true},items:[row,{...row,enabled:false,term:'skip'},{...row,kind:'sentence',term:'A sentence.'}]};
  const first=await api.deckForPack(pack);
  assert.equal(first.deck.id,'pack-u5');assert.equal(first.deck.words.length,1);
  data.set('stars.pack-u5','saved-progress');
  const second=await api.deckForPack(pack);
  assert.equal(second.addedWords,0);assert.equal(JSON.parse(data.get('decks')).length,1);
  assert.equal(data.get('stars.pack-u5'),'saved-progress');assert.equal(pack.progress.existing,true);
  assert.equal(api.catalog()[0].name,'内置 · 雅思词汇');assert.equal(api.groups(second.deck).length,1);
  api.openDeck(second.deck.id,'study');
  assert.equal(data.get('active'),'pack-u5');assert.equal(session.get('word-accumulator.next-view'),'study');assert.equal(context.reloaded,true);
  const other=await api.deckForPack({...pack,id:'other'});
  assert.notEqual(other.deck.id,first.deck.id);assert.equal(JSON.parse(data.get('decks')).length,2);
});
test('sentence-only packs never create an empty word library', async()=>{
  const {api,data}=setup();
  await assert.rejects(api.deckForPack({id:'sentence',name:'句子',items:[{...row,kind:'sentence'}]}),/没有可背/);
  assert.equal(data.has('decks'),false);
});
