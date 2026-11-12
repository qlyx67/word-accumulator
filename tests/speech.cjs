const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');

const workerCode = readFileSync(require.resolve('../pronunciation/synth/speech-worker.js'), 'utf8');
const engine = readFileSync(require.resolve('../pronunciation/synth/speak-generator.bin'));

test('the on-site worker generates non-silent speech for other words and phrases in both accents', async () => {
  const results = new Map();
  let script;
  const scope = vm.createContext({
    console, DecompressionStream, Response,
    fetch: async path => {
      assert.match(path, /^speak-generator\.bin\?/);
      return new Response(engine);
    },
    URL: {
      createObjectURL(blob) { script = blob; return 'blob:speech'; },
      revokeObjectURL() {}
    },
    importScripts(url) {
      assert.equal(url, 'blob:speech');
      vm.runInContext(gunzipSync(engine).toString('utf8'), scope);
    },
    self: { postMessage(reply) { results.set(reply.id, reply); } }
  });
  vm.runInContext(workerCode, scope);
  for (const term of ['allocate', 'luminiferous', 'take it easy']) {
    const recordings = [];
    for (const locale of ['en-GB', 'en-US']) {
      const id = term + locale;
      await scope.self.onmessage({ data: { id, term, locale } });
      const wav = Buffer.from(results.get(id).wav);
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      assert(wav.subarray(44).some(byte => byte !== 0));
      recordings.push(wav);
    }
    assert.notDeepEqual(...recordings);
  }
  assert.equal(await script.text(), gunzipSync(engine).toString('utf8'));
});
