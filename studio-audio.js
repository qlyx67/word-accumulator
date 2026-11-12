'use strict';

const cardSpeechStatus = byId('speech-status');
let speechStatus = cardSpeechStatus;
let audioContext;
let clipSource;
let dictionaryAudio;
let voiceUtterance;
let voiceTimer;
let speechRequest = 0;
let recentPack;
let recentAudio;

function stopSpeech() {
  speechRequest++;
  if (dictionaryAudio) {
    dictionaryAudio.pause();
    dictionaryAudio = null;
  }
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

function speakWithDevice(word, request) {
  const synth = window.speechSynthesis;
  const fail = () => {
    if (speechRequest !== request) return;
    clearTimeout(voiceTimer);
    speechStatus.textContent = '发音暂不可用，请检查浏览器声音设置后重试。';
    voiceUtterance = null;
    synth?.cancel();
  };
  if (!synth || !window.SpeechSynthesisUtterance) {
    fail();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(word.term);
  const voice = synth.getVoices().find(item => item.lang.toLowerCase().startsWith('en-'));
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-US';
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
  voiceTimer = setTimeout(fail, 4000);
  synth.speak(utterance);
}

async function speakStudy(word, status = cardSpeechStatus) {
  if (!word) return;
  stopSpeech();
  speechStatus = status;
  const request = speechRequest;
  speechStatus.textContent = '正在载入发音…';
  if (typeof word.audio === 'string' && /^https:\/\//.test(word.audio)) {
    const audio = new Audio(word.audio);
    dictionaryAudio = audio;
    const fallback = () => {
      if (dictionaryAudio !== audio) return;
      dictionaryAudio = null;
      audio.pause();
      clearTimeout(voiceTimer);
      speakWithDevice(word, request);
    };
    audio.onplaying = () => {
      if (dictionaryAudio !== audio) return;
      clearTimeout(voiceTimer);
      speechStatus.textContent = '播放中…';
    };
    audio.onended = () => {
      if (dictionaryAudio !== audio) return;
      dictionaryAudio = null;
      speechStatus.textContent = '';
    };
    audio.onerror = fallback;
    voiceTimer = setTimeout(fallback, 5000);
    audio.play().catch(fallback);
    return;
  }
  try {
    const clip = typeof pronunciation === 'object' && Object.hasOwn(pronunciation, word.term) && pronunciation[word.term];
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!clip || !AudioEngine) throw new Error('Audio clip unavailable');
    audioContext ||= new AudioEngine();
    const [pack, start, duration] = clip;
    // Resume immediately inside the click gesture for Safari and mobile browsers.
    const ready = audioContext.resume();
    if (recentPack !== pack) {
      recentPack = pack;
      recentAudio = fetch('pronunciation/' + pack + '.mp3?v=1')
        .then(response => {
          if (!response.ok) throw new Error('Audio download failed');
          return response.arrayBuffer();
        })
        .then(data => audioContext.decodeAudioData(data))
        .catch(error => {
          if (recentPack === pack) recentPack = undefined;
          throw error;
        });
    }
    const timeout = new Promise((_, reject) => {
      voiceTimer = setTimeout(() => reject(new Error('Audio timed out')), 5000);
    });
    const [, buffer] = await Promise.race([Promise.all([ready, recentAudio]), timeout]);
    if (speechRequest !== request) return;
    clearTimeout(voiceTimer);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      source.disconnect();
      if (clipSource !== source) return;
      clipSource = null;
      speechStatus.textContent = '';
    };
    source.start(0, start / 1000, duration / 1000);
    clipSource = source;
    speechStatus.textContent = '播放中…';
  } catch {
    if (speechRequest === request) {
      clearTimeout(voiceTimer);
      speakWithDevice(word, request);
    }
  }
}
