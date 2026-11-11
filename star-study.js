'use strict';

const studyKey = deckStorageKey('word-accumulator.study.v2');
const studyFace = byId('study-face');
const studyDetails = byId('study-details');
const ratingControls = [...document.querySelectorAll('[data-rating]')];
const studyGroups = [...groupsByTopic.values()].flat();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function motionReduced(){ return reduceMotion.matches || (typeof document !== 'undefined' && document.body?.classList.contains('no-motion')); }
let studySaved = {};
try {
  studySaved = JSON.parse(localStorage.getItem(studyKey)) || {
    group: activeDeck ? 0 : JSON.parse(localStorage.getItem('word-accumulator.study.v1'))?.group
  };
} catch {}
const groupControl = byId('map-group');
let studyGroup = studyGroups[studySaved.group] || studyGroups[0];
if (Array.isArray(studySaved.customKeys)) {
  const restored = words.filter(w => studySaved.customKeys.includes(wordKey(w)));
  if (restored.length) studyGroup = {topic: studySaved.customLabel || "专项复习", number: 1, words: restored};
}
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
let gestureFrame = 0;
let settleAnimation;
const swipeVerdict = byId('swipe-verdict');
let swallowClick = false;
let flightMode = 'swipe';
try { flightMode = localStorage.getItem('word-accumulator.flight') || 'swipe'; } catch {}
function cancelStudyMotion() {
  motionEpoch++;
  studyBusy = false;
  const pointer = gesture?.id;
  gesture = null;
  cancelAnimationFrame(gestureFrame);
  gestureFrame = 0;
  if (pointer !== undefined && studyFace.hasPointerCapture(pointer)) {
    studyFace.releasePointerCapture(pointer);
  }
  studyFace.getAnimations().forEach(a => a.cancel());
  studyFace.style.transform = '';
  studyFace.classList.remove('dragging');
  swipeVerdict.textContent = '';
}

function saveStudy() {
  try {
    localStorage.setItem(studyKey, JSON.stringify({
      group: studyGroups.indexOf(studyGroup),
      customKeys: studyGroups.includes(studyGroup) ? undefined : studyGroup.words.map(wordKey),
      customLabel: studyGroups.includes(studyGroup) ? undefined : studyGroup.topic,
      queue: studyQueue.map(wordKey),
      finished: [...studyFinished],
      seen: [...studySeen]
    }));
  } catch {}
}

let renderedMapGroup;
function renderMap() {
  const map = byId('constellation');
  if (renderedMapGroup !== studyGroup) {
    renderedMapGroup = studyGroup;
    map.replaceChildren(...studyGroup.words.map(word => {
      const control = button('', () => {
        if (studyWord === word) return;
        cancelStudyMotion();
        studyHistory = [];
        studyQueue = [word, ...studyQueue.filter(item => item !== word)];
        showStudyWord(true);
        byId('study-flip').focus({ preventScroll: true });
      });
      control.title = word.term;
      return control;
    }));
  }
  let mastered = 0;
  studyGroup.words.forEach((word, index) => {
    const control = map.children[index];
    const lit = isMastered(word);
    const caption = lit ? '✓' : String(index + 1).padStart(2, '0');
    if (lit) mastered++;
    if (control.textContent !== caption) control.textContent = caption;
    control.classList.toggle('lit', lit);
    control.setAttribute('aria-current', String(word === studyWord));
    control.setAttribute('aria-label', word.term + (lit ? '，已掌握' : '，未掌握'));
  });
  byId('map-count').textContent = mastered + ' / ' + studyGroup.words.length + ' 已掌握';
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
  for (const control of ratingControls) control.disabled = true;
  if (animate && !motionReduced() && studyFace.animate) {
    cardMove = byId('study-word').animate([
      { transform: 'translateY(7px)', opacity: .3 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 170, easing: 'ease-out' });
  }
  renderMap();
  saveStudy();
  document.dispatchEvent(new Event('study-card-updated'));
}

function startStudySession(entries, label) {
  if (!entries.length) return false;
  studyGroup = {topic:label,number:1,words:[...entries]};
  groupControl.value = '';
  startStudy();
  activateMode('study', false);
  return true;
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
  for (const control of ratingControls) control.disabled = !revealed;
  if (!revealed) return;
  byId('study-meaning').textContent = [studyWord.pos, studyWord.meaning].filter(Boolean).join(' · ') || '暂无释义';
  byId('study-example').textContent = studyWord.example || extraExamples[studyWord.term] || '';
  const source = byId('study-source');
  source.hidden = !studyWord.exampleId;
  if (studyWord.exampleId) {
    source.href = 'https://tatoeba.org/en/sentences/show/' + studyWord.exampleId;
    source.textContent = 'Tatoeba · ' + studyWord.exampleAuthor;
  }
  if (!motionReduced() && studyDetails.animate) {
    pageTurn = studyDetails.animate([
      { transform: 'rotateX(-86deg)', opacity: .2 },
      { transform: 'rotateX(5deg)', opacity: 1, offset: .83 },
      { transform: 'rotateX(0deg)', opacity: 1 }
    ], { duration: 340, easing: 'cubic-bezier(.22,.72,.24,1)' });
  }
}

async function rateStudy(rating) {
  if (!studyWord || studyBusy) return;
  if (!revealed) { flipStudy(); return; }
  studyBusy = true;
  const epoch = ++motionEpoch;
  const direction = rating === 1 ? -1 : 1;
  if (!motionReduced() && studyFace.animate) {
    const initial = studyFace.style.transform || 'translateX(0) rotate(0deg)';
    const anim = studyFace.animate([
      { transform: initial, opacity: 1 },
      { transform: `translateX(${direction * Math.min(innerWidth, 600)}px) rotate(${direction * 16}deg)`, opacity: 0 }
    ], { duration: 155, easing: 'cubic-bezier(.32,0,.65,.4)', fill: 'forwards' });
    try { await anim.finished; } catch {}
    if (epoch !== motionEpoch) return;
    anim.cancel();
  }
  studyFace.style.transform = '';
  byId('swipe-verdict').textContent = '';
  studyHistory.push({ queue: [...studyQueue], seen: new Set(studySeen), finished: new Set(studyFinished), learning: typeof LearningProgress !== "undefined" ? LearningProgress.checkpoint(studyWord) : null });
  if (studyHistory.length > 30) studyHistory.shift();
  const word = studyQueue.shift();
  const key = wordKey(word);
  if (rating < 3) studyQueue.splice(rating === 1 ? 3 : studyQueue.length, 0, word);
  else studyFinished.add(key);
  studySeen.add(key);
  if (typeof LearningProgress !== "undefined") LearningProgress.record(word,rating);
  showStudyWord();
  studyBusy = false;
  studyFace.dispatchEvent(new CustomEvent('study-card-rated', { bubbles: true, detail: direction }));
  if (!motionReduced() && studyFace.animate) {
    const anim = studyFace.animate([{ transform: 'translateY(9px) scale(.985)', opacity: .65 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 165, easing: 'cubic-bezier(.2,.8,.2,1)' });
    try { await anim.finished; } catch {}
  }
  if (epoch !== motionEpoch) return;
  studyBusy = false;
  if (!studyWord) byId('study-match').focus({ preventScroll: true });
}

function flashMatch(from, to) {
  if (motionReduced() || !Element.prototype.animate) return;
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
  }, motionReduced() ? 0 : 950);
}
byId('study-focus').addEventListener('click', () => {
  const focused = document.body.classList.toggle('focus-study');
  byId('study-focus').setAttribute('aria-pressed', String(focused));
  byId('study-focus').textContent = focused ? '↙ 退出沉浸' : '⤢ 沉浸';
  byId('study').scrollIntoView({ block: 'start', behavior: 'instant' });
});
byId('celebration-next').addEventListener('click', () => { celebration.close(); startMatch(); });
byId('study-undo').addEventListener('click', () => {
  if (!studyHistory.length) return;
  cancelStudyMotion();
  const previous = studyHistory.pop();
  studyQueue = previous.queue; studySeen = previous.seen; studyFinished = previous.finished;
  if (typeof LearningProgress !== "undefined") LearningProgress.restore(previous.learning);
  showStudyWord(true);
});
function setFlight(value) {
  cancelStudyMotion();
  flightMode = value === 'classic' ? 'classic' : 'swipe';
  document.body.dataset.flight = flightMode;
  document.querySelectorAll('[data-flight]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.flight === flightMode)));
  byId('gesture-guide').textContent = flightMode === 'swipe' ? '先轻点看释义，再左划复习 / 右划认识' : '先轻点看释义，再用下方按钮自评';
  try { localStorage.setItem('word-accumulator.flight', flightMode); } catch {}
}
document.querySelectorAll('[data-flight]').forEach(el => el.addEventListener('click', () => setFlight(el.dataset.flight)));
setFlight(flightMode);
// The implicit capture on a touched child can transfer to the card. Only
// losing capture from the card itself cancels an in-progress swipe.
function swipeTransform(dx) {
  const tilt = Math.max(-10, Math.min(10, dx / 25));
  return `translate3d(${dx}px, 0, 0) rotate(${tilt}deg)`;
}

function renderSwipe() {
  gestureFrame = 0;
  if (!gesture?.horizontal) return;
  const dx = gesture.dx;
  studyFace.style.transform = swipeTransform(dx);
  const direction = dx >= 0 ? 'right' : 'left';
  if (swipeVerdict.dataset.direction !== direction || !swipeVerdict.textContent) {
    swipeVerdict.dataset.direction = direction;
    swipeVerdict.textContent = dx >= 0 ? '认识 →' : '← 再复习';
  }
}

studyFace.addEventListener('pointerdown', event => {
  if (flightMode !== 'swipe' || !studyWord || studyBusy || !event.isPrimary ||
      event.button !== 0 || event.target.closest('#study-speak, a')) return;
  settleAnimation?.cancel();
  swallowClick = false;
  gesture = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    start: event.timeStamp,
    threshold: Math.max(34, Math.min(72, studyFace.clientWidth * .15)),
    dx: 0,
    horizontal: false
  };
});

studyFace.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!gesture.horizontal) {
    if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      gesture = null;
      return;
    }
    if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.12) return;
    gesture.horizontal = true;
    studyFace.setPointerCapture(event.pointerId);
    studyFace.classList.add('dragging');
  }
  gesture.dx = dx;
  if (!gestureFrame) gestureFrame = requestAnimationFrame(renderSwipe);
});

function endGesture(event, canceled = false) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const current = gesture;
  gesture = null;
  cancelAnimationFrame(gestureFrame);
  gestureFrame = 0;
  studyFace.classList.remove('dragging');
  if (studyFace.hasPointerCapture(event.pointerId)) studyFace.releasePointerCapture(event.pointerId);
  if (!current.horizontal) return;

  swallowClick = true;
  const dx = canceled ? current.dx : event.clientX - current.x;
  const distance = Math.abs(dx);
  const elapsed = Math.max(1, event.timeStamp - current.start);
  const flick = distance >= 23 && elapsed <= 180 && distance / elapsed >= .42;
  if (!canceled && (distance >= current.threshold || flick)) {
    studyFace.style.transform = swipeTransform(dx);
    if (!revealed) { studyFace.style.transform = ''; swipeVerdict.textContent = ''; flipStudy(); }
    else rateStudy(dx > 0 ? 3 : 1);
    return;
  }
  const transform = studyFace.style.transform || swipeTransform(current.dx);
  studyFace.style.transform = '';
  swipeVerdict.textContent = '';
  if (!motionReduced() && studyFace.animate) {
    settleAnimation = studyFace.animate(
      [{ transform }, { transform: swipeTransform(0) }],
      { duration: 185, easing: 'cubic-bezier(.22,.75,.28,1)' }
    );
  }
}

studyFace.addEventListener('pointerup', event => endGesture(event));
studyFace.addEventListener('pointercancel', event => endGesture(event, true));
studyFace.addEventListener('lostpointercapture', event => {
  if (event.target === studyFace) endGesture(event, true);
});
studyFace.addEventListener('click', event => {
  if (swallowClick && event.detail !== 0) {
    event.preventDefault();
    event.stopImmediatePropagation();
    swallowClick = false;
  }
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
  if ((document.body.dataset.view && document.body.dataset.view !== 'study') || mode !== 'study' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      document.querySelector('dialog[open]') || event.target.closest('input, select, textarea, [contenteditable], summary, a')) return;
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
