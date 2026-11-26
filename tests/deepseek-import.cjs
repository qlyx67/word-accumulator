const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../exam-core.js');

function load(fetch) {
  const context = vm.createContext({ Blob, fetch });
  vm.runInContext(fs.readFileSync('deepseek-import.js', 'utf8') + '\nthis.adapter = DeepSeekImport;', context);
  return context.adapter;
}

test('sends photos directly to DeepSeek and records billed tokens even if output was cut off', async () => {
  const image = 'data:image/jpeg;base64,YQ==';
  const adapter = load(async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.messages[1].content[1].image_url.url, image);
    assert.equal(body.messages[1].content[2].text, '资料 2\ninsight 洞察力');
    return { ok: true, json: async () => ({
      usage: { prompt_tokens: 2500, completion_tokens: 1000, prompt_cache_hit_tokens: 500 },
      choices: [{ finish_reason: 'length' }],
    }) };
  });
  let usage;
  await assert.rejects(adapter.request([{image}, {text:'insight 洞察力'}], 'test-only', new AbortController().signal, value => { usage = value; }), /截断/);
  assert.equal(usage.total, 3500);
  assert.equal(usage.cached, 500);
  assert.equal(usage.low, 0.00601);
  assert.equal(usage.high, 0.01202);
  const unknown = adapter.usageOf({ prompt_tokens: 1000, completion_tokens: 100 });
  assert.equal(unknown.cached, null);
  assert.equal(unknown.high, 0.0028);
  assert.equal(adapter.usageOf(undefined), null);
});

test('only valid source references enter review and uncertain or incomplete rows start unchecked', () => {
  const adapter = load();
  const sources = [{id:'photo',image:'data:image/jpeg;base64,YQ=='}, {id:'text',text:'Unit 5\nheal 治愈'}];
  const rows = [
    {source:1,kind:'word',term:'insight',meaning:'洞察力',uncertain:false},
    {source:2,line:2,kind:'word',term:'heal',meaning:'治愈',uncertain:true},
    {source:1,kind:'word',term:'therapy',uncertain:false},
    {source:3,kind:'word',term:'not found',meaning:'不存在',uncertain:false},
    {source:1,kind:'word',term:'x@.!',meaning:'乱码',uncertain:false},
  ];
  const result = adapter.parseRows(JSON.stringify({rows}), sources, core, /^[a-z]+(?: [a-z]+)*$/);
  assert.equal(result.filtered, 2);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].enabled, true);
  assert.equal(result.rows[0].sources[0].sourceId, 'photo');
  assert.equal(result.rows[1].enabled, false);
  assert.equal(result.rows[1].sources[0].excerpt, 'heal 治愈');
  assert.equal(result.rows[2].enabled, false);
});
