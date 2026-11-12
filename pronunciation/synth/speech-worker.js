'use strict';

const engine = fetch('speak-generator.bin?v=1').then(async response => {
  if (!response.ok || !response.body) throw Error('Speech engine unavailable');
  const javascript = response.body.pipeThrough(new DecompressionStream('gzip'));
  const script = URL.createObjectURL(await new Response(javascript, {
    headers: { 'Content-Type': 'text/javascript' }
  }).blob());
  try {
    importScripts(script);
  } finally {
    URL.revokeObjectURL(script);
  }
});
engine.catch(() => self.postMessage({ engineFailed: true }));

self.onmessage = async ({ data: { id, term, locale } }) => {
  try {
    if (typeof term !== 'string' || !term.trim() || term.length > 150) throw Error('Invalid term');
    await engine;
    const voice = locale === 'en-GB' ? 'en/en' : 'en/en-us';
    const wav = generateSpeech(term, { voice, speed: 150 });
    if (wav.byteLength <= 44) throw Error('Empty speech');
    self.postMessage({ id, wav: wav.buffer }, [wav.buffer]);
  } catch {
    self.postMessage({ id, failed: true });
  }
};
