const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({ StudyPackCore: require('../exam-core.js') });

for (const file of ['../deck-photo.js', '../exam-ocr.js']) {
  vm.runInContext(fs.readFileSync(require.resolve(file), 'utf8'), context);
}
const photo = vm.runInContext('StudyPackPhoto', context);

test('textbook OCR skips running text and proper names without losing the next reading', () => {
  const raw = [
    'Unit 5',
    "* garrative ['narativ/ n.",
    '1) [U] the art of telling a',
    'story 叙述 ; 叙述 技巧',
    'e.g. There was not enough narrative.',
    '\fProper names',
    'Helen Garner /garner/ n.',
    'Reading 2',
    'New words',
    '* evolution /izvaluzfn/ n. [U]',
    'growth over time 演变 ; 逐步 发 展',
  ].join('\n');
  const rows = photo.extract(raw, 'scan');
  assert.deepEqual(Array.from(rows, row => row.term), ['garrative', 'evolution']);
  assert.equal(rows[0].meaning, '叙述;叙述技巧');
  assert.equal(rows[1].sources[0].line, 10);
});

test('a single-letter correction supported by the same entry example requires review', async () => {
  const [candidate] = photo.extract("* pptimistic /opti'mistik/ a.\n乐观 的\ne.g. They are optimistic about the future.", 'scan');
  const resolve = async term => ({ term, meaning: term === 'optimistic' ? '乐观的' : '', pos: 'adj.' });
  const row = await photo.verify(candidate, resolve);
  assert.equal(row.term, 'optimistic');
  assert.equal(row.enabled, false);
  assert.equal(row.origin, 'photo-corrected');
  assert.equal(await photo.verify({ ...candidate, meaning: '', examplesForCheck: '' }, resolve), null);
});

test('simple bilingual screenshots keep usable word and explicitly paired sentence rows', () => {
  const rows = photo.extract([
    'address | 处理；解决',
    'A line of random text with no Chinese field',
    'We need more time. | 我们需要更多时间。',
  ].join('\n'), 'scan');
  assert.deepEqual(Array.from(rows, row => [row.term, row.kind]), [['address', 'word'], ['We need more time.', 'sentence']]);
});
