'use strict';

const cardSpeechStatus = byId('speech-status');
const bundledPronunciations = new Set(['plot', 'capture', 'hesitate']);
const speechJobs = new Map();
const decodedSpeech = new Map();
let speechStatus = cardSpeechStatus;
let audioContext;
let clipSource;
let voiceUtterance;
let voiceTimer;
let speechRequest = 0;
let synthesisWorker;
let synthesisId = 0;
let recentPack;
let recentAudio;

function stopSpeech() {
  speechRequest++;
  if (clipSource) {
    clipSource.stop();
    clipSource = null;
  }
  if (voiceUtterance) {
    window.speechSynthesis.cancel();
    voiceUtterance = null;
  }
  clearTimeout(voiceTimer);
  speechStatus.textContent = '';
}

function prepareStudySpeech() {
  if (synthesisWorker) return synthesisWorker;
  try {
    const worker = new Worker('pronunciation/synth/speech-worker.js?v=1');
    const reset = () => {
      worker.terminate();
      if (synthesisWorker !== worker) return;
      synthesisWorker = undefined;
      for (const finish of speechJobs.values()) finish(null);
    };
    worker.onerror = reset;
    worker.onmessage = ({ data: { id, wav, failed, engineFailed } }) => {
      if (engineFailed) reset();
      else speechJobs.get(id)?.(failed ? null : wav);
    };
    synthesisWorker = worker;
    return worker;
  } catch {
    return null;
  }
}

function synthesizeSpeech(term, locale) {
  return new Promise((resolve, reject) => {
    const worker = prepareStudySpeech();
    if (!worker) {
      reject(Error('Speech worker unavailable'));
      return;
    }
    const id = ++synthesisId;
    const finish = wav => {
      clearTimeout(timer);
      speechJobs.delete(id);
      if (wav) resolve(wav);
      else reject(Error('Speech synthesis unavailable'));
    };
    const timer = setTimeout(() => finish(null), 3200);
    speechJobs.set(id, finish);
    try { worker.postMessage({ id, term, locale }); }
    catch { finish(null); }
  });
}

function speakWithDevice(word, request, locale) {
  const synth = window.speechSynthesis;
  const fail = () => {
    if (speechRequest !== request) return;
    clearTimeout(voiceTimer);
    speechStatus.textContent = '发音暂未载入，点发音重试。';
    voiceUtterance = null;
    synth?.cancel();
  };
  if (!synth || !window.SpeechSynthesisUtterance) {
    fail();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(word.term);
  const voice = synth.getVoices().find(item => item.lang.toLowerCase() === locale.toLowerCase());
  if (voice) utterance.voice = voice;
  utterance.lang = locale;
  utterance.onstart = () => {
    if (speechRequest !== request) return;
    clearTimeout(voiceTimer);
    speechStatus.textContent = '播放中…';
  };
  utterance.onend = () => {
    if (speechRequest !== request) return;
    clearTimeout(voiceTimer);
    voiceUtterance = null;
    speechStatus.textContent = '';
  };
  utterance.onerror = fail;
  voiceUtterance = utterance;
  voiceTimer = setTimeout(fail, 950);
  synth.speak(utterance);
}

function within(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Speech timed out')), milliseconds);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function decodeRecording(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error('Recording unavailable');
  return audioContext.decodeAudioData(await response.arrayBuffer());
}

async function synthesizedBuffer(term, locale) {
  const key = locale + ':' + term;
  if (decodedSpeech.has(key)) return decodedSpeech.get(key);
  const buffer = await audioContext.decodeAudioData(await synthesizeSpeech(term, locale));
  if (decodedSpeech.size >= 32) decodedSpeech.delete(decodedSpeech.keys().next().value);
  decodedSpeech.set(key, buffer);
  return buffer;
}

async function selectSpeech(term, locale) {
  if (bundledPronunciations.has(term)) {
    const accent = locale === 'en-GB' ? 'uk' : 'us';
    try { return [await within(decodeRecording('dictionary/audio/' + term + '-' + accent + '.mp3'), 650)]; }
    catch {}
  }
  const clip = !locale && typeof pronunciation === 'object' && Object.hasOwn(pronunciation, term) && pronunciation[term];
  if (clip) {
    const [pack, start, duration] = clip;
    if (recentPack !== pack) {
      recentPack = pack;
      recentAudio = decodeRecording('pronunciation/' + pack + '.mp3?v=1').catch(error => {
        if (recentPack === pack) recentPack = undefined;
        throw error;
      });
    }
    try { return [await within(recentAudio, 550), start / 1000, duration / 1000]; }
    catch {}
  }
  return [await synthesizedBuffer(term, locale || 'en-US')];
}

async function speakStudy(word, status = cardSpeechStatus, locale) {
  const term = word?.term?.trim().toLowerCase();
  if (!term) return;
  stopSpeech();
  speechStatus = status;
  const request = speechRequest;
  speechStatus.textContent = '正在准备发音…';
  try {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    audioContext ||= new AudioEngine();
    // Unlock audio inside the tap, before fetching or synthesizing.
    const ready = within(audioContext.resume(), 1000);
    const [, [buffer, offset = 0, duration = buffer?.duration]] = await Promise.all([ready, selectSpeech(term, locale)]);
    if (request !== speechRequest) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      source.disconnect();
      if (clipSource !== source) return;
      clipSource = null;
      speechStatus.textContent = '';
    };
    source.start(0, offset, duration);
    clipSource = source;
    speechStatus.textContent = '播放中…';
  } catch {
    if (request === speechRequest) speakWithDevice(word, request, locale || 'en-US');
  }
}
