const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('two libraries with the same word keep separate progress and save back to their original keys', () => {
  const word = {term:'review', topic:'Shared', meaning:'复习'};
  const decks = [
    {id:'unit5', name:'Unit 5', words:[word]},
    {id:'unit6', name:'Unit 6', words:[word]},
  ];
  const data = new Map([
    ['word-accumulator.decks.v1', JSON.stringify(decks)],
    ['word-accumulator.active-deck.v1', 'combined:["unit6","unit5","removed","unit5"]'],
    ['word-accumulator.progress.v1.unit5', JSON.stringify({'Shared:review':{match:true}})],
  ]);
  const context = vm.createContext({
    words:[{term:'built-in',topic:'IELTS'}],
    document:{getElementById(){},dispatchEvent(){}},
    window:{addEventListener(){}}, Event:class{},
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
    byId:()=>({}), updateProgress(){}, isMastered:()=>false,
  });
  const init = fs.readFileSync('custom-decks.js','utf8').split('function buildDeckQuestions')[0];
  const app = fs.readFileSync('accumulator.js','utf8');
  const between = (a,b)=> app.slice(app.indexOf(a),app.indexOf(b));
  vm.runInContext(init +
    between('const progressBase', 'const filter =') +
    between('let records =', 'let activeWord;') +
    between('function wordKey', 'function starLabel') +
    between('function recordAttempt', 'function renderWrongWords') +
    fs.readFileSync('learning-progress.js','utf8'),context);
  const actual = vm.runInContext('({ids:selectedDeckIds, keys:words.map(wordKey), first:earned(words[0]), second:earned(words[1])})',context);
  assert.deepEqual(Array.from(actual.ids),['unit5','unit6']);
  assert.notEqual(actual.keys[0],actual.keys[1]);
  assert.equal(actual.first.match,true);
  assert.equal(actual.second.match,undefined);
  vm.runInContext(`
    recordAttempt([words[1]], 'spell', true);
    const checkpoint = LearningProgress.checkpoint(words[0]);
    LearningProgress.record(words[0], 3);
    LearningProgress.record(words[1], 1);
    LearningProgress.restore(checkpoint);
  `,context);
  assert.equal(JSON.parse(data.get('word-accumulator.progress.v1.unit6'))['Shared:review'].spellWrong,true);
  assert.equal(JSON.parse(data.get('word-accumulator.progress.v1.unit5'))['Shared:review'].spellWrong,undefined);
  assert.equal(JSON.parse(data.get('word-accumulator.learning.v1.unit6')).entries['Shared:review'].lapses,1);
  assert.equal(JSON.parse(data.get('word-accumulator.learning.v1.unit5')).entries['Shared:review'],undefined);
  assert.equal(context.LearningProgress.stats().count,1);
});
