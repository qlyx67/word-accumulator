'use strict';

const studyKey = 'word-accumulator.study.v1';
const studyGroups = [...groupsByTopic.values()].flat();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let studySaved = {};
try { studySaved = JSON.parse(localStorage.getItem(studyKey)) || {}; } catch {}
const groupControl = byId('map-group');
let studyGroup = studyGroups[studySaved.group] || studyGroups[0];
let studyQueue = [];
let studyOffset = Number.isInteger(studySaved.offset) ? studySaved.offset : 0;
let studySeen = new Set();
let studyWord;
let revealed = false;

function saveStudy() {
  try {
    localStorage.setItem(studyKey, JSON.stringify({
      group: studyGroups.indexOf(studyGroup),
      queue: studyQueue.map(wordKey),
      offset: studyOffset,
      seen: [...studySeen]
    }));
  } catch {}
}

function renderMap() {
  const mastered = studyGroup.words.filter(isMastered).length;
  byId('map-count').textContent = mastered + ' / ' + studyGroup.words.length + ' 已掌握';
  byId('constellation').replaceChildren(...studyGroup.words.map(word => {
    const control = button(isMastered(word) ? '★' : '·', () => {
      if (studyWord === word) return;
      studyQueue = [word, ...studyQueue.filter(item => item !== word)];
      showStudyWord();
    });
    control.classList.toggle('lit', isMastered(word));
    control.setAttribute('aria-current', String(word === studyWord));
    control.setAttribute('aria-label', word.term + (isMastered(word) ? '，已掌握' : '，未掌握'));
    control.title = word.term;
    return control;
  }));
}

function showStudyWord() {
  studyWord = studyQueue[0];
  revealed = false;
  byId('study-details').hidden = true;
  byId('study-flip').setAttribute('aria-expanded', 'false');
  byId('study-flip').disabled = !studyWord;
  byId('study-speak').disabled = !studyWord || !('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  byId('study-word').textContent = studyWord?.term || '本轮词卡已完成';
  byId('study-hint').textContent = studyWord ? '点卡片或按空格查看释义' : '可以去配对，或再学一轮';
  byId('study-count').textContent = studyWord ? '待看 ' + studyQueue.length + ' 张' : '本轮完成';
  for (const control of document.querySelectorAll('[data-rating]')) control.disabled = true;
  renderMap();
  saveStudy();
}

function startStudy() {
  studySeen = new Set();
  const batch = studyGroup.words;
  const start = studyOffset % batch.length;
  studyQueue = batch.slice(start, start + 10);
  studyOffset = (start + studyQueue.length) % batch.length;
  showStudyWord();
}

function flipStudy() {
  if (!studyWord) return;
  revealed = !revealed;
  byId('study-details').hidden = !revealed;
  byId('study-flip').setAttribute('aria-expanded', String(revealed));
  byId('study-hint').textContent = revealed ? '点卡片或按空格收起' : '点卡片或按空格查看释义';
  byId('study-meaning').textContent = studyWord.pos + ' · ' + studyWord.meaning;
  byId('study-example').textContent = studyWord.example || extraExamples[studyWord.term] || '';
  const source = byId('study-source');
  source.hidden = !studyWord.exampleId;
  if (studyWord.exampleId) {
    source.href = 'https://tatoeba.org/en/sentences/show/' + studyWord.exampleId;
    source.textContent = 'Tatoeba · ' + studyWord.exampleAuthor;
  }
  for (const control of document.querySelectorAll('[data-rating]')) control.disabled = !revealed;
}

function rateStudy(rating) {
  if (!studyWord || !revealed) return;
  const word = studyQueue.shift();
  const key = wordKey(word);
  if (rating < 3 && !studySeen.has(key)) {
    studyQueue.splice(rating === 1 ? 3 : studyQueue.length, 0, word);
  }
  studySeen.add(key);
  showStudyWord();
}

function flashMatch(from, to) {
  if (reduceMotion.matches || !Element.prototype.animate) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
  const flash = document.createElement('span');
  flash.className = 'match-flash';
  flash.setAttribute('aria-hidden', 'true');
  flash.style.left = a.left + a.width / 2 + 'px';
  flash.style.top = a.top + a.height / 2 + 'px';
  flash.style.width = Math.hypot(dx, dy) + 'px';
  const angle = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
  document.body.append(flash);
  const animation = flash.animate([
    { transform: angle + ' scaleX(0)', opacity: 0 },
    { transform: angle + ' scaleX(1)', opacity: 1, offset: .4 },
    { transform: angle + ' scaleX(1)', opacity: 0 }
  ], { duration: 240, easing: 'ease-out' });
  animation.onfinish = animation.oncancel = () => flash.remove();
}

for (const [i, group] of studyGroups.entries()) groupControl.add(new Option(group.topic + ' · 第 ' + group.number + ' 组', i));
groupControl.value = String(studyGroups.indexOf(studyGroup));
groupControl.addEventListener('change', () => {
  studyGroup = studyGroups[Number(groupControl.value)];
  studyOffset = 0;
  startStudy();
});
byId('study-flip').addEventListener('click', flipStudy);
byId('study-restart').addEventListener('click', startStudy);
byId('study-match').addEventListener('click', () => {
  scopes.match = new Set([studyGroup]);
  filters.match = 'all';
  activateMode('match', false);
});
byId('study-speak').addEventListener('click', () => {
  if (!studyWord) return;
  const utterance = new SpeechSynthesisUtterance(studyWord.term);
  utterance.lang = 'en';
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
});
for (const control of document.querySelectorAll('[data-rating]')) {
  control.addEventListener('click', () => {
    rateStudy(Number(control.dataset.rating));
    byId('study-flip').focus();
  });
}
document.addEventListener('keydown', event => {
  if (mode !== 'study' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.target.closest('input, select, textarea, [contenteditable], summary, a')) return;
  if (event.code === 'Space' && (!event.target.closest('button') || event.target.id === 'study-flip')) {
    event.preventDefault();
    flipStudy();
  } else if (['1', '2', '3'].includes(event.key) && revealed) {
    event.preventDefault();
    rateStudy(Number(event.key));
  }
});

if (Array.isArray(studySaved.queue) && Array.isArray(studySaved.seen)) {
  const groupWords = new Map(studyGroup.words.map(word => [wordKey(word), word]));
  studyQueue = [...new Set(studySaved.queue)].map(key => groupWords.get(key)).filter(Boolean);
  studySeen = new Set(studySaved.seen);
  showStudyWord();
} else startStudy();
activateMode('study', false);
