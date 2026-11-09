'use strict';

const studyKey = deckStorageKey('word-accumulator.study.v2');
const studyFace = byId('study-face');
const studyDetails = byId('study-details');
const ratingControls = [...document.querySelectorAll('[data-rating]')];
const studyGroups = [...groupsByTopic.values()].flat();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let studySaved = {};
try {
  studySaved = JSON.parse(localStorage.getItem(studyKey)) || {
    group: activeDeck ? 0 : JSON.parse(localStorage.getItem('word-accumulator.study.v1'))?.group
  };
} catch {}
const groupControl = byId('map-group');
let studyGroup = studyGroups[studySaved.group] || studyGroups[0];
let studyQueue = [];
let studyFinished = new Set();
let pageTurn;
let cardMove;
let studySeen = new Set();
let studyWord;
let revealed = false;

function saveStudy() {
  try {
    localStorage.setItem(studyKey, JSON.stringify({
      group: studyGroups.indexOf(studyGroup),
      queue: studyQueue.map(wordKey),
      finished: [...studyFinished],
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
      showStudyWord(true);
      byId('study-flip').focus({ preventScroll: true });
    });
    control.classList.toggle('lit', isMastered(word));
    control.setAttribute('aria-current', String(word === studyWord));
    control.setAttribute('aria-label', word.term + (isMastered(word) ? '，已掌握' : '，未掌握'));
    control.title = word.term;
    return control;
  }));
}

function showStudyWord(animate = false) {
  stopSpeech();
  pageTurn?.cancel();
  cardMove?.cancel();
  studyWord = studyQueue[0];
  revealed = false;
  studyDetails.hidden = true;
  byId('study-flip').setAttribute('aria-expanded', 'false');
  byId('study-flip').disabled = !studyWord;
  byId('study-speak').disabled = !studyWord;
  byId('study-word').textContent = studyWord?.term || '本组词卡已完成';
  byId('study-hint').textContent = studyWord ? '点击翻页 · 空格' : '再背一次，或开始本组配对';
  byId('study-batch').textContent = studyGroup.topic + ' · 第 ' + studyGroup.number + ' 组';
  byId('study-count').textContent = '本组 ' + studyGroup.words.length + ' 词 · 待看 ' + studyQueue.length + ' 张';
  byId('study-index').textContent = studyWord ? 'WORD / ' + String(studyGroup.words.indexOf(studyWord) + 1).padStart(2, '0') : 'SESSION COMPLETE';
  byId('study-progress').max = studyGroup.words.length;
  byId('study-progress').value = studyFinished.size;
  byId('study-restart').hidden = Boolean(studyWord);
  for (const control of ratingControls) control.disabled = !studyWord;
  if (animate && !reduceMotion.matches && studyFace.animate) {
    cardMove = byId('study-word').animate([
      { transform: 'translateY(7px)', opacity: .3 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 170, easing: 'ease-out' });
  }
  renderMap();
  saveStudy();
}

function startStudy() {
  studySeen = new Set();
  studyFinished = new Set();
  studyQueue = [...studyGroup.words];
  showStudyWord(true);
}

function flipStudy() {
  if (!studyWord) return;
  pageTurn?.cancel();
  revealed = !revealed;
  studyDetails.hidden = !revealed;
  byId('study-flip').setAttribute('aria-expanded', String(revealed));
  byId('study-hint').textContent = revealed ? '收起释义 · 空格' : '点击翻页 · 空格';
  if (!revealed) return;
  byId('study-meaning').textContent = [studyWord.pos, studyWord.meaning].filter(Boolean).join(' · ') || '暂无释义';
  byId('study-example').textContent = studyWord.example || extraExamples[studyWord.term] || '';
  const source = byId('study-source');
  source.hidden = !studyWord.exampleId;
  if (studyWord.exampleId) {
    source.href = 'https://tatoeba.org/en/sentences/show/' + studyWord.exampleId;
    source.textContent = 'Tatoeba · ' + studyWord.exampleAuthor;
  }
  if (!reduceMotion.matches && studyDetails.animate) {
    pageTurn = studyDetails.animate([
      { transform: 'rotateX(-86deg)', opacity: .2 },
      { transform: 'rotateX(5deg)', opacity: 1, offset: .83 },
      { transform: 'rotateX(0deg)', opacity: 1 }
    ], { duration: 340, easing: 'cubic-bezier(.22,.72,.24,1)' });
  }
}

function rateStudy(rating) {
  if (!studyWord) return;
  const word = studyQueue.shift();
  const key = wordKey(word);
  if (rating < 3 && !studySeen.has(key)) {
    studyQueue.splice(rating === 1 ? 3 : studyQueue.length, 0, word);
  } else {
    studyFinished.add(key);
  }
  studySeen.add(key);
  showStudyWord(true);
  if (!studyWord) byId('study-match').focus({ preventScroll: true });
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
  startStudy();
});
byId('study-flip').addEventListener('click', flipStudy);
byId('study-restart').addEventListener('click', startStudy);
byId('study-match').addEventListener('click', () => {
  topic.value = studyGroup.topic;
  scopes.match = new Set([studyGroup]);
  filters.match = 'all';
  activateMode('match', false);
  byId('match').scrollIntoView({ block: 'start' });
  byId('english').firstElementChild?.focus({ preventScroll: true });
});
const help = byId('studio-help');
byId('help-open').addEventListener('click', () => help.showModal());
help.addEventListener('click', event => {
  if (event.target === help) help.close();
});
byId('study-speak').addEventListener('click', () => speakStudy(studyWord));
for (const control of ratingControls) {
  control.addEventListener('click', () => rateStudy(Number(control.dataset.rating)));
}
document.addEventListener('keydown', event => {
  if (mode !== 'study' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      (help.open || deckDialog.open) || event.target.closest('input, select, textarea, [contenteditable], summary, a')) return;
  if (event.code === 'Space' && (!event.target.closest('button') || event.target.id === 'study-flip' || event.target.matches('[data-rating]'))) {
    event.preventDefault();
    flipStudy();
  } else if (['1', '2', '3'].includes(event.key) && studyWord) {
    event.preventDefault();
    rateStudy(Number(event.key));
  }
});

if (Array.isArray(studySaved.queue) && Array.isArray(studySaved.seen) && Array.isArray(studySaved.finished)) {
  const groupWords = new Map(studyGroup.words.map(word => [wordKey(word), word]));
  studyQueue = [...new Set(studySaved.queue)].map(key => groupWords.get(key)).filter(Boolean);
  studySeen = new Set(studySaved.seen.filter(key => groupWords.has(key)));
  studyFinished = new Set(studySaved.finished.filter(key => groupWords.has(key)));
  showStudyWord();
} else startStudy();
activateMode('study', false);
