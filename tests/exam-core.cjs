const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../exam-core.js');
function pack() {
  const sources = [{ id: 's1', name: 'Original classroom list', text: C.sampleText + '\n' + C.sampleSentences, image: '' }];
  return { version: 1, id: 'test-pack', name: 'Test', examDate: '2026-11-20', minutes: 15, modes: [...C.MODES], items: C.parse(sources[0].text, 's1').rows, sources, progress: {}, history: [] };
}
test('mixed word and sentence tables retain examples and exact original line references', () => {
  const p = pack(); assert.equal(p.items.length, 12);
  const address = p.items.find(i => i.term === 'address');
  assert.equal(address.meaning, '处理;解决'); assert.match(address.example, /address this problem/);
  assert.equal(address.sources[0].line, 3); assert.match(address.sources[0].excerpt, /address \| v\./);
  assert.equal(p.items.filter(i => i.kind === 'sentence').length, 4);
  assert.doesNotThrow(() => C.validatePack(p));
});
test('duplicates retain all sources but different senses remain separate', () => {
  const a = C.parse('address | 地址\naddress | 处理', 'a').rows;
  const b = C.parse('address | 地址', 'b').rows;
  const items = C.dedupe([...a, ...b]);
  assert.equal(items.length, 2); assert.equal(items[0].sources.length, 2);
});
test('Chinese-first lines, part-of-speech text and multiline translations import correctly', () => {
  assert.equal(C.parse('我们需要更多时间。 | We need more time.', 'a').rows[0].term, 'We need more time.');
  const x = C.parse('1. capture v. 捕捉\n例句：I capture the light.\nWe need more time\n我们需要更多时间。', 'a');
  assert.equal(x.rows[0].term, 'capture'); assert.equal(x.rows[0].pos, 'v.');
  assert.equal(x.rows[1].kind, 'sentence'); assert.equal(x.rows[1].meaning, '我们需要更多时间。');
});
test('OCR gaps are cleaned in translations while exact source text and English spacing remain intact', () => {
  const text = 'We need more time.  我 们 需要 更 多 时 间 。';
  const item = C.parse(text, 'image').rows[0];
  assert.equal(item.meaning, '我们需要更多时间。');
  assert.equal(item.term, 'We need more time.');
  assert.equal(item.sources[0].excerpt, text);
});
test('cloze uses a whole word or phrase exactly once; substring matches cannot leak a wrong question', () => {
  const item = pack().items.find(i => i.term === 'address');
  const q = C.question(item, 'cloze'); assert.equal(q.contextual, true); assert.equal(q.prompt, 'We need to a______ this problem.');
  const other = { ...item, term: 'dress' }; assert.equal(C.question(other, 'cloze').contextual, false);
  assert.equal(C.grade(item, 'cloze', ' Address ').status, 'correct');
  assert.equal(C.grade(item, 'cloze', 'addresses').status, 'incorrect');
});
test('negation and quantity changes in translations are never accepted by fuzzy overlap', () => {
  const sentence = pack().items.find(i => i.term.startsWith('She'));
  assert.equal(C.grade(sentence, 'zh-en', 'She always agrees with this plan.').status, 'review');
  assert.equal(C.grade(sentence, 'zh-en', 'She never agrees with this plan.').status, 'review');
  assert.equal(C.grade(sentence, 'en-zh', '她总是赞成这个计划。').status, 'review');
  assert.equal(C.grade(sentence, 'en-zh', '她并不总是赞成这个计划').status, 'correct');
  sentence.alternatives.push({ mode: 'en-zh', text: '她并非一直同意这项计划。' });
  assert.equal(C.grade(sentence, 'en-zh', '她并非一直同意这项计划。').status, 'correct');
});
test('each skill progresses independently, same-day repeats do not inflate stages, attempts are idempotent', () => {
  const p = pack(), task = C.tasks(p)[0], now = Date.parse('2026-11-12T12:00:00');
  C.record(p, task, true, now, 'exact', 'a');
  C.record(p, task, true, now + 1000, 'exact', 'b');
  assert.equal(p.progress[task.key].stage, 1);
  assert.equal(Object.keys(p.progress).length, 1);
  assert.equal(C.record(p, task, false, now, 'exact', 'b'), false);
  assert.equal(p.history.length, 2);
  C.record(p, task, false, now + 2000, 'exact', 'c');
  assert.equal(p.progress[task.key].stage, 0); assert.equal(p.progress[task.key].due, now + 602000);
  C.record(p, task, true, now + 3000, 'exact', 'd');
  assert.equal(p.progress[task.key].stage, 1, 'a corrected lapse must become passed, even after an earlier success today');
});
test('plans prefer due work and cap daily effort; inactive entries never produce tasks', () => {
  const p = pack(), now = Date.parse('2026-11-12T12:00:00'); p.minutes = 5;
  const task = C.tasks(p)[0]; C.record(p, task, false, now - 3600000, 'exact', 'a');
  const plan = C.plan(p, now); assert.equal(plan.selected[0].key, task.key); assert(plan.selected.length <= 7);
  p.items.forEach(i => { i.enabled = false; }); assert.equal(C.tasks(p).length, 0);
});
test('today and past exam dates stay finite and valid', () => {
  const p = pack(), now = Date.parse('2026-11-20T12:00:00');
  assert.equal(C.plan(p, now).remaining, 0);
  assert.equal(C.plan(p, now + 86400000).remaining, -1);
  assert.equal(C.validDate('2026-99-99'), false); assert.equal(C.validDate('2026-02-30'), false);
});
test('backups reject HTML images, orphaned sources, invalid progress and malformed sessions', () => {
  for (const change of [p => p.sources[0].image = 'data:image/svg+xml;base64,PHN2Zz4=', p => p.items[0].sources[0].sourceId = 'missing', p => p.progress['wrong-key'] = {}, p => p.session = { index: 100, tasks: [] }]) {
    const p = pack(); change(p); assert.throws(() => C.validatePack(p));
  }
  const p = pack(); p.session = C.session(p, 'today'); assert.doesNotThrow(() => C.validatePack(p));
});
