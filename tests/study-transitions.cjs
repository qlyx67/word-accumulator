const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const src = fs.readFileSync('star-study.js', 'utf8');
const rate = src.slice(src.indexOf('async function rateStudy'), src.indexOf('\nfunction flashMatch'));
function harness(animated = false) {
  const a = {term:'alpha'}, b = {term:'beta'}, c = {term:'gamma'};
  let pending = [];
  const context = vm.createContext({
    studyWord:a, studyQueue:[a,b,c], studySeen:new Set(), studyFinished:new Set(), studyHistory:[],
    CustomEvent:class {}, studyBusy:false, revealed:true, motionEpoch:0, innerWidth:390, reduceMotion:{matches:!animated}, motionReduced:()=>!animated,
    byId:() => ({textContent:'',focus(){}}), wordKey:w=>w.term,
    studyFace:{style:{},dispatchEvent(){},animate(){ let resolve; const finished=new Promise(r=>resolve=r); pending.push(resolve); return {finished,cancel(){resolve();}};}},
    showStudyWord(){context.studyWord=context.studyQueue[0];},
  });
  vm.runInContext(rate,context);
  return {c:context, flush:()=>pending.shift()?.()};
}
(async()=>{
 let {c}=harness();
 await c.rateStudy(3); assert.equal(c.studyQueue[0].term,'beta');assert.equal(c.studyFinished.size,1);assert.equal(c.studyHistory.length,1);
 await c.rateStudy(1);assert.deepEqual(Array.from(c.studyQueue,w=>w.term),['gamma','beta']);assert.equal(c.studyFinished.size,1);
 await c.rateStudy(2);assert.deepEqual(Array.from(c.studyQueue,w=>w.term),['beta','gamma']);
 await c.rateStudy(1);assert.equal(c.studyQueue.length,2);assert.equal(c.studyFinished.size,1);await c.rateStudy(3);await c.rateStudy(3);assert.equal(c.studyQueue.length,0);assert.equal(c.studyBusy,false);
 let h=harness(true);let first=h.c.rateStudy(3);await h.c.rateStudy(3);assert.equal(h.c.studyQueue.length,3);h.flush();await new Promise(setImmediate);h.flush();await first;assert.equal(h.c.studyQueue.length,2);assert.equal(h.c.studyHistory.length,1);
 h=harness(true);first=h.c.rateStudy(3);h.c.motionEpoch++;h.c.studyBusy=false;h.flush();await first;assert.equal(h.c.studyQueue.length,3);assert.equal(h.c.studyHistory.length,0);
 console.log('PASS: ratings, review order, completion, rapid double input, canceled transitions preserve queue/history');
})().catch(e=>{console.error(e);process.exit(1);});
