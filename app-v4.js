'use strict';

const byId = id => document.getElementById(id);
const topic = byId('topic');
const search = byId('search');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const groupSize = 30;
const groupsByTopic = new Map();
for (const word of words) {
  if (!groupsByTopic.has(word.topic)) groupsByTopic.set(word.topic, []);
  const batches = groupsByTopic.get(word.topic);
  if (!batches.length || batches.at(-1).words.length === groupSize) {
    batches.push({ topic: word.topic, number: batches.length + 1, words: [] });
  }
  batches.at(-1).words.push(word);
}
const scopes = { match: new Set(), spell: new Set() };
const scopeInputs = new Map();
const starKey = 'ielts-words.stars.v1';
let stars = {};
try {
  stars = JSON.parse(localStorage.getItem(starKey)) || {};
} catch {}
let activeWord;
let mode = 'browse';
let round = [];
let selected = null;
let matched = new Set();
let spellingQueue = [];
let question;
let checked = false;

for (const [name, batches] of groupsByTopic) {
  topic.add(new Option(name, name));
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = name;
  const options = document.createElement('div');
  options.className = 'scope-options';
  for (const batch of batches) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      const scope = scopes[mode];
      if (input.checked) scope.add(batch);
      else scope.delete(batch);
      spellingQueue = [];
      refresh(false);
    });
    scopeInputs.set(batch, input);
    label.append(input, '第 ' + batch.number + ' 组');
    options.append(label);
  }
  fieldset.append(legend, options);
  byId('scope-list').append(fieldset);
}

function visibleBatches() {
  return topic.value ? groupsByTopic.get(topic.value) : [...groupsByTopic.values()].flat();
}

function pool() {
  const scope = scopes[mode];
  if (scope?.size) return [...scope].flatMap(batch => batch.words);
  return topic.value ? visibleBatches().flatMap(batch => batch.words) : words;
}

byId('scope-clear').addEventListener('click', () => {
  scopes[mode].clear();
  spellingQueue = [];
  refresh(false);
});

function shuffle(entries) {
  const copy = [...entries];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function button(label, action) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = label;
  control.addEventListener('click', action);
  return control;
}

function wordKey(word) {
  return word.topic + ':' + word.term;
}

function earned(word) {
  return stars[wordKey(word)] || {};
}

function starLabel(word) {
  const record = earned(word);
  return (record.match ? '★' : '☆') + (record.spell ? '★' : '☆');
}

function updateProgress() {
  const total = pool().reduce((sum, word) => {
    const record = earned(word);
    return sum + Number(Boolean(record.match)) + Number(Boolean(record.spell));
  }, 0);
  byId('progress').textContent = '★ ' + total + ' / ' + (pool().length * 2);
}

function award(word, skill) {
  if (earned(word)[skill]) return;
  stars[wordKey(word)] = { ...earned(word), [skill]: true };
  try {
    localStorage.setItem(starKey, JSON.stringify(stars));
  } catch {}
  updateProgress();
}

function showWord(word) {
  activeWord = word;
  byId('detail-word').textContent = word?.term || '选择一个单词';
  byId('detail-pos').textContent = word ? word.pos + ' · ' + word.topic : '';
  byId('detail-meaning').textContent = word?.meaning || '';
  byId('detail-example').textContent = word?.example || extraExamples[word?.term] || '暂无匹配的例句。';
  byId('example-block').hidden = !word;
  const source = byId('example-source');
  source.hidden = !word?.exampleId;
  if (word?.exampleId) {
    source.href = 'https://tatoeba.org/en/sentences/show/' + word.exampleId;
    source.textContent = 'Tatoeba · ' + word.exampleAuthor;
  } else {
    source.removeAttribute('href');
    source.textContent = '';
  }
  byId('detail-stars').textContent = word ? starLabel(word) + '　配对 / 拼写' : '';
}

function renderList() {
  const query = search.value.trim().toLowerCase();
  const batches = visibleBatches().map(batch => ({
    ...batch,
    matches: batch.words.filter(word => word.term.toLowerCase().includes(query) || word.meaning.includes(query))
  })).filter(batch => batch.matches.length);
  const results = batches.flatMap(batch => batch.matches);
  showWord(results.includes(activeWord) ? activeWord : results[0]);
  const list = byId('word-list');
  let current;
  const items = [];
  for (const batch of batches) {
    const heading = document.createElement('h3');
    heading.className = 'word-group-title';
    const first = (batch.number - 1) * groupSize + 1;
    heading.textContent = batch.topic + ' · 第 ' + batch.number + ' 组（' + first + '–' + (first + batch.words.length - 1) + '）';
    items.push(heading);
    for (const word of batch.matches) {
      const control = button(word.term, () => {
        current?.setAttribute('aria-pressed', 'false');
        control.setAttribute('aria-pressed', 'true');
        current = control;
        showWord(word);
      });
      control.setAttribute('aria-pressed', String(word === activeWord));
      if (word === activeWord) current = control;
      const status = document.createElement('span');
      status.className = 'word-stars';
      status.textContent = starLabel(word);
      control.append(status);
      items.push(control);
    }
  }
  list.replaceChildren(...items);
  byId('empty').hidden = results.length > 0;
}

function feedback(id, message, style = '') {
  const element = byId(id);
  element.textContent = message;
  element.className = 'feedback ' + style;
}

function startMatch() {
  const previous = new Set(round);
  const candidates = shuffle(pool().filter(word => word.meaning));
  const ordered = [...candidates.filter(word => !previous.has(word)), ...candidates.filter(word => previous.has(word))];
  const terms = new Set();
  const meanings = new Set();
  round = [];
  for (const word of ordered) {
    if (terms.has(word.term) || meanings.has(word.meaning)) continue;
    terms.add(word.term);
    meanings.add(word.meaning);
    round.push(word);
    if (round.length === 10) break;
  }
  selected = null;
  matched = new Set();
  const mistakes = new Set();
  let newStars = 0;
  const left = new Map();
  const right = new Map();
  for (const word of shuffle(round)) {
    const control = button(word.term, () => {
      if (selected) left.get(selected).setAttribute('aria-pressed', 'false');
      selected = word;
      control.setAttribute('aria-pressed', 'true');
      feedback('match-feedback', matched.size + ' / ' + round.length);
    });
    control.setAttribute('aria-pressed', 'false');
    left.set(word, control);
  }
  for (const word of shuffle(round)) {
    right.set(word, button(word.meaning, () => {
      if (!selected) {
        feedback('match-feedback', '请先选一个英文单词。');
        return;
      }
      if (selected !== word) {
        mistakes.add(selected);
        mistakes.add(word);
        feedback('match-feedback', '配错了。这次选中的两个词本轮都不能获得新星，再试一次。', 'bad');
        return;
      }
      matched.add(word);
      if (!mistakes.has(word) && !earned(word).match) {
        award(word, 'match');
        newStars++;
      }
      selected = null;
      left.get(word).setAttribute('aria-pressed', 'false');
      left.get(word).disabled = true;
      right.get(word).disabled = true;
      const nextWord = round.find(entry => !matched.has(entry));
      if (nextWord) left.get(nextWord).focus();
      else byId('new-round').focus();
      if (nextWord) {
        feedback('match-feedback', matched.size + ' / ' + round.length, 'good');
      } else {
        const missed = round.filter(entry => mistakes.has(entry)).map(entry => entry.term);
        const result = '全部配对完成，本轮新点亮 ' + newStars + ' 颗星。';
        const missedNote = missed.length ? '曾配错、本轮未获新星：' + missed.join('、') + '。' : '';
        feedback('match-feedback', result + missedNote + '按 Enter 可以换一组。', missed.length ? '' : 'good');
      }
    }));
  }
  byId('english').replaceChildren(...left.values());
  byId('chinese').replaceChildren(...right.values());
  feedback('match-feedback', '0 / ' + round.length);
}

function nextSpelling(focus = true) {
  if (!spellingQueue.length) {
    spellingQueue = shuffle(pool().filter(word => word.meaning));
    if (spellingQueue.length > 1 && spellingQueue.at(-1) === question) {
      spellingQueue.unshift(spellingQueue.pop());
    }
  }
  question = spellingQueue.pop();
  checked = false;
  byId('submit').disabled = !question;
  byId('answer').disabled = !question;
  if (!question) {
    byId('spell-clue').textContent = '这个主题暂时没有可练习的释义。';
    byId('spell-hint').textContent = '';
    byId('typed-letters').replaceChildren();
    byId('correction').hidden = true;
    feedback('spell-feedback', '');
    return;
  }
  byId('spell-clue').textContent = question.pos + ' · ' + question.meaning;
  byId('spell-hint').textContent = '首字母 ' + question.term[0].toUpperCase() + ' · ' + question.term.replace(/[^a-z]/gi, '').length + ' 个字母';
  const answer = byId('answer');
  answer.value = '';
  answer.dataset.letters = question.term.replace(/[^a-z]/gi, '').length;
  byId('correction').hidden = true;
  drawSpelling();
  answer.readOnly = false;
  byId('submit').textContent = '提交';
  feedback('spell-feedback', '');
  if (focus) answer.focus();
}

function drawSpelling(reveal = false) {
  if (!question) return;
  const entered = byId('answer').value.toLowerCase();
  function row(correctRow) {
    let index = 0;
    return [...question.term.toLowerCase()].map(expected => {
      const cell = document.createElement('span');
      cell.className = 'letter';
      if (!/[a-z]/.test(expected)) {
        cell.textContent = expected === ' ' ? ' ' : expected;
        if (expected === ' ') cell.classList.add('space');
        return cell;
      }
      const actual = entered[index++];
      cell.textContent = correctRow ? expected : (actual || '_');
      if (reveal && !correctRow) cell.classList.add(actual === expected ? 'good' : 'bad');
      return cell;
    });
  }
  byId('typed-letters').replaceChildren(...row(false));
  if (reveal) byId('correct-letters').replaceChildren(...row(true));
}

byId('answer').addEventListener('input', event => {
  if (event.isComposing) return;
  event.target.value = event.target.value.replace(/[^a-z]/gi, '').slice(0, Number(event.target.dataset.letters));
  drawSpelling();
});

byId('spell-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!question) return;
  if (checked) return nextSpelling();
  const answer = byId('answer');
  const value = answer.value.toLowerCase().replace(/[^a-z]/g, '');
  if (!value) {
    feedback('spell-feedback', '先输入一个答案。');
    answer.focus();
    return;
  }
  checked = true;
  answer.readOnly = true;
  const correct = value === question.term.toLowerCase().replace(/[^a-z]/g, '');
  if (correct) award(question, 'spell');
  drawSpelling(!correct);
  byId('correction').hidden = correct;
  feedback('spell-feedback', correct ? '拼写正确！' : '正确拼写是 ' + question.term, correct ? 'good' : 'bad');
  byId('submit').textContent = '下一题';
  byId('submit').focus();
});

function refresh(focusSpelling = true) {
  const scope = scopes[mode];
  byId('practice-scope').hidden = !scope;
  if (scope) {
    for (const [batch, input] of scopeInputs) input.checked = scope.has(batch);
    byId('scope-clear').disabled = !scope.size;
    byId('scope-summary').textContent = scope.size ? '已选 ' + scope.size + ' 组' : '使用主题范围';
  }
  updateProgress();
  byId('count').textContent = pool().length + ' 个词';
  if (mode === 'browse') renderList();
  if (mode === 'match') startMatch();
  if (mode === 'spell') nextSpelling(focusSpelling);
}

for (const control of modeButtons) {
  control.addEventListener('click', () => {
    if (mode === control.dataset.mode) return;
    mode = control.dataset.mode;
    for (const tab of modeButtons) {
      const active = tab === control;
      tab.setAttribute('aria-pressed', String(active));
      byId(tab.dataset.mode).hidden = !active;
    }
    refresh();
  });
}

topic.addEventListener('change', () => {
  spellingQueue = [];
  byId('word-list').scrollTop = 0;
  refresh(false);
});
search.addEventListener('input', () => {
  byId('word-list').scrollTop = 0;
  renderList();
});
byId('new-round').addEventListener('click', startMatch);
refresh();
