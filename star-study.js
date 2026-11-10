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
let studyBusy = false;
let motionEpoch = 0;
let studyHistory = [];
let gesture = null;
let swallowClick = false;
let flightMode = 'swipe';
try { flightMode = localStorage.getItem('word-accumulator.flight') || 'swipe'; } catch {}
function cancelStudyMotion() {
  motionEpoch++;
  studyBusy = false;
  gesture = null;
  studyFace.getAnimations().forEach(a => a.cancel());
  studyFace.style.transform = '';
  studyFace.classList.remove('dragging');
  byId('swipe-verdict').textContent = '';
}


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
  byId('constellation').replaceChildren(...studyGroup.words.map((word, index) => {
    const control = button(isMastered(word) ? '✓' : String(index + 1).padStart(2, '0'), () => {
      if (studyWord === word) return;
      cancelStudyMotion();
      studyHistory = [];
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
  byId('study-undo').disabled = !studyHistory.length;
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
  cancelStudyMotion();
  studyHistory = [];
  studySeen = new Set();
  studyFinished = new Set();
  studyQueue = [...studyGroup.words];
  showStudyWord(true);
}

function flipStudy() {
  if (!studyWord || studyBusy) return;
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

async function rateStudy(rating) {
  if (!studyWord || studyBusy) return;
  studyBusy = true;
  const epoch = ++motionEpoch;
  const direction = rating === 1 ? -1 : 1;
  if (!reduceMotion.matches && studyFace.animate) {
    const initial = studyFace.style.transform || 'translateX(0) rotate(0deg)';
    const anim = studyFace.animate([
      { transform: initial, opacity: 1 },
      { transform: `translateX(${direction * Math.min(innerWidth, 600)}px) rotate(${direction * 16}deg)`, opacity: 0 }
    ], { duration: 280, easing: 'cubic-bezier(.4,0,.8,.5)', fill: 'forwards' });
    try { await anim.finished; } catch {}
    if (epoch !== motionEpoch) return;
    anim.cancel();
  }
  studyFace.style.transform = '';
  byId('swipe-verdict').textContent = '';
  studyHistory.push({ queue: [...studyQueue], seen: new Set(studySeen), finished: new Set(studyFinished) });
  if (studyHistory.length > 30) studyHistory.shift();
  const word = studyQueue.shift();
  const key = wordKey(word);
  if (rating < 3 && !studySeen.has(key)) studyQueue.splice(rating === 1 ? 3 : studyQueue.length, 0, word);
  else studyFinished.add(key);
  studySeen.add(key);
  showStudyWord();
  if (!reduceMotion.matches && studyFace.animate) {
    const anim = studyFace.animate([{ transform: 'translateY(18px) scale(.96)', opacity: .4 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    try { await anim.finished; } catch {}
  }
  if (epoch !== motionEpoch) return;
  studyBusy = false;
  if (!studyWord) byId('study-match').focus({ preventScroll: true });
}

function flashMatch(from, to) {
  if (reduceMotion.matches || !Element.prototype.animate) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const dx = b.left + b.width / 2 - a.left - a.width / 2;
  const dy = b.top + b.height / 2 - a.top - a.height / 2;
  const flash = document.createElement('span');
  flash.className = 'match-flash orbital-link';
  flash.setAttribute('aria-hidden', 'true');
  Object.assign(flash.style, { left: a.left + a.width / 2 + 'px', top: a.top + a.height / 2 + 'px', width: Math.hypot(dx, dy) + 'px' });
  const angle = `rotate(${Math.atan2(dy, dx)}rad)`;
  document.body.append(flash);
  const animation = flash.animate([
    { transform: angle + ' scaleX(0)', opacity: 0 },
    { transform: angle + ' scaleX(1)', opacity: 1, offset: .32 },
    { transform: angle + ' scaleX(1)', opacity: .9, offset: .7 },
    { transform: angle + ' scaleX(1)', opacity: 0 }
  ], { duration: 900, easing: 'ease-out' });
  animation.finished.catch(() => {}).finally(() => flash.remove());
  setTimeout(() => flash.remove(), 1200);
  for (const node of [from, to]) node.animate([
    { transform: 'scale(1)', boxShadow: '0 0 0 0 #8ce4ff66' },
    { transform: 'scale(.96)', boxShadow: '0 0 0 8px #8ce4ff22', offset: .4 },
    { transform: 'scale(1)', boxShadow: '0 0 0 16px #8ce4ff00' }
  ], { duration: 650, easing: 'ease-out' });
}
let celebrationTimer;
function showMatchCelebration() {
  clearTimeout(celebrationTimer);
  const finishedRound = round;
  celebrationTimer = setTimeout(() => {
    if (round === finishedRound && mode === 'match' && matched.size === round.length && round.length && !celebration.open) celebration.showModal();
  }, reduceMotion.matches ? 0 : 950);
}
byId('study-focus').addEventListener('click', () => {
  const focused = document.body.classList.toggle('focus-study');
  byId('study-focus').setAttribute('aria-pressed', String(focused));
  byId('study-focus').textContent = focused ? '↙ 退出沉浸' : '⤢ 沉浸';
  byId('study').scrollIntoView({ block: 'start', behavior: 'instant' });
});
byId('celebration-next').addEventListener('click', () => { celebration.close(); startMatch(); });
byId('study-undo').addEventListener('click', () => {
  if (studyBusy || !studyHistory.length) return;
  cancelStudyMotion();
  const previous = studyHistory.pop();
  studyQueue = previous.queue; studySeen = previous.seen; studyFinished = previous.finished;
  showStudyWord(true);
});
function setFlight(value) {
  cancelStudyMotion();
  flightMode = value === 'classic' ? 'classic' : 'swipe';
  document.body.dataset.flight = flightMode;
  document.querySelectorAll('[data-flight]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.flight === flightMode)));
  byId('gesture-guide').textContent = flightMode === 'swipe' ? '← 左划再复习 · 轻点展开 · 右划认识 →' : '轻点展开释义 · 用下方按钮选择熟悉程度';
  try { localStorage.setItem('word-accumulator.flight', flightMode); } catch {}
}
document.querySelectorAll('[data-flight]').forEach(el => el.addEventListener('click', () => setFlight(el.dataset.flight)));
setFlight(flightMode);
studyFace.addEventListener('pointerdown', event => {
  if (flightMode !== 'swipe' || !studyWord || studyBusy || !event.isPrimary || event.button !== 0 || event.target.closest('#study-speak, a')) return;
  swallowClick = false;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, horizontal: false };
});
studyFace.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (!gesture.horizontal) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    gesture.horizontal = true;
    studyFace.setPointerCapture(event.pointerId);
    studyFace.classList.add('dragging');
  }
  gesture.dx = dx;
  studyFace.style.transform = `translateX(${dx}px) rotate(${Math.max(-12, Math.min(12, dx / 22))}deg)`;
  byId('swipe-verdict').textContent = dx > 0 ? '认识 →' : '← 再复习';
  byId('swipe-verdict').dataset.direction = dx > 0 ? 'right' : 'left';
});
function endGesture(event, canceled = false) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const { dx, horizontal } = gesture;
  gesture = null;
  studyFace.classList.remove('dragging');
  if (studyFace.hasPointerCapture(event.pointerId)) studyFace.releasePointerCapture(event.pointerId);
  swallowClick = horizontal;
  if (!canceled && horizontal && Math.abs(dx) > Math.min(100, studyFace.clientWidth * .23)) rateStudy(dx > 0 ? 3 : 1);
  else {
    const transform = studyFace.style.transform;
    studyFace.style.transform = '';
    byId('swipe-verdict').textContent = '';
    if (horizontal && !reduceMotion.matches) studyFace.animate([{ transform }, { transform: 'translateX(0) rotate(0deg)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}
studyFace.addEventListener('pointerup', event => endGesture(event));
studyFace.addEventListener('pointercancel', event => endGesture(event, true));
studyFace.addEventListener('lostpointercapture', event => endGesture(event, true));
studyFace.addEventListener('click', event => {
  if (swallowClick) { event.preventDefault(); event.stopImmediatePropagation(); swallowClick = false; }
}, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelStudyMotion(); });

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
  } else if (['1', '2', '3', 'ArrowLeft', 'ArrowRight'].includes(event.key) && studyWord) {
    event.preventDefault();
    rateStudy(event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? 3 : Number(event.key));
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
