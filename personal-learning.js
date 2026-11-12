/* Quick capture, personal collections, and self-checked translations. */
(() => {
  'use strict';

  const collectionId = 'personal-words';
  const collectionName = '收藏单词';
  const sentenceStorageKey = 'word-accumulator.translation.v1';
  const dialog = byId('quick-add');
  const quickText = byId('quick-text');
  const quickType = byId('quick-type');
  const quickStatus = byId('quick-status');
  const quickPreview = byId('quick-preview');
  const quickSave = byId('quick-save');
  const collectionStatus = byId('collection-status');
  const answer = byId('translation-answer');
  const ratings = [...document.querySelectorAll('[data-translation-rating]')];
  const normalize = text => text.normalize('NFKC').trim().replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ').toLowerCase();
  const comparable = text => normalize(text).replace(/[.!?。！？]+$/, '');
  const otherLanguage = lang => lang === 'en' ? 'zh' : 'en';
  const directionLabel = lang => lang === 'en' ? '英译中' : '汉译英';
  const navigate = view => document.dispatchEvent(new CustomEvent('personal-navigate', { detail: view }));

  let kind = 'word';
  let drafts = [];
  let lookup;
  let edit = null;
  let direction = 'en';
  let reviewOnly = false;
  let roundDirty = true;
  let queue = [];
  let step = 0;
  let passed = 0;
  let submitted = false;
  let noticeTimer;

  function readList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  }

  function savedWords() {
    return readList(deckListKey).find(deck => deck.id === collectionId)?.words || [];
  }

  function savedSentences() {
    return readList(sentenceStorageKey).filter(item => item && typeof item.id === 'string' &&
      typeof item.en === 'string' && typeof item.zh === 'string' &&
      (item.source === 'en' || item.source === 'zh'));
  }

  function storeChanges(wordEntries, sentences) {
    const changes = [];
    if (wordEntries) {
      const otherDecks = readList(deckListKey).filter(deck => deck.id !== collectionId);
      if (wordEntries.length) otherDecks.push({ id: collectionId, name: collectionName, words: wordEntries });
      changes.push([deckListKey, JSON.stringify(otherDecks)]);
    }
    if (sentences) changes.push([sentenceStorageKey, JSON.stringify(sentences)]);

    const previous = changes.map(([key]) => [key, localStorage.getItem(key)]);
    let written = 0;
    try {
      for (const [key, value] of changes) {
        localStorage.setItem(key, value);
        written++;
      }
    } catch (error) {
      for (const [key, value] of previous.slice(0, written)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      throw error;
    }
    if (sentences) roundDirty = true;
    if (wordEntries) syncDeckOption(wordEntries.length);
  }

  function syncDeckOption(count) {
    const existing = [...deckSelect.options].find(option => option.value === collectionId);
    if (count) {
      const option = existing || new Option('', collectionId);
      option.textContent = collectionName + ' · ' + count + ' 词';
      if (!existing) deckSelect.add(option);
    } else if (existing && activeDeck?.id !== collectionId) {
      existing.remove();
    }
  }

  function reloadInto(deckId, view, notice = '') {
    try {
      sessionStorage.setItem('word-accumulator.next-view', view);
      if (notice) sessionStorage.setItem('word-accumulator.collection-notice', notice);
    } catch {}
    localStorage.setItem(deckSelectionKey, deckId);
    location.reload();
  }

  function resetDrafts() {
    lookup?.abort();
    lookup = undefined;
    drafts = [];
    quickPreview.disabled = false;
    quickSave.disabled = false;
    quickStatus.textContent = '';
    byId('quick-review').hidden = true;
  }

  function openQuick(type = 'auto') {
    edit = null;
    resetDrafts();
    quickText.value = '';
    quickType.value = type;
    byId('quick-add-title').textContent = '添加到收藏';
    byId('quick-form').hidden = false;
    quickSave.textContent = '加入收藏';
    dialog.showModal();
    quickText.focus();
  }

  function parseQuickLine(line, type) {
    const parts = line.split(line.includes('\t') ? '\t' : '|').map(part => part.trim());
    const [source, second = '', third = '', fourth = ''] = parts;
    const identified = /[\u3400-\u9fff]/.test(source) ? 'zh' :
      /^[a-z]+(?:[-'’][a-z]+)*$/i.test(source) ? 'word' : 'en';
    const format = type === 'auto' ? identified : type;
    if (!source) return null;

    if (format === 'word') {
      if (!termPattern.test(source) || source.length > 90) return null;
      const hasPos = parts.length >= 2 && (posPattern.test(second) || (!second && parts.length >= 3));
      return {
        kind: 'word',
        term: source,
        pos: hasPos ? second : '',
        meaning: (hasPos ? third : second).slice(0, 1000),
        example: (hasPos ? fourth : third).slice(0, 1000)
      };
    }

    return {
      kind: 'sentence',
      source: format,
      [format]: source.slice(0, 1500),
      [otherLanguage(format)]: second.slice(0, 1500)
    };
  }

  function addField(container, row, key, title, multiline = false, locked = false) {
    const label = document.createElement('label');
    const input = document.createElement(multiline ? 'textarea' : 'input');
    input.value = row[key] || '';
    input.maxLength = key === 'term' ? 90 : key === 'pos' ? 150 : 1500;
    if (multiline) input.rows = 2;
    input.readOnly = locked;
    if (key === 'en' || key === 'term' || key === 'example') input.lang = 'en';
    input.addEventListener('input', () => {
      if (key === 'term' && normalize(row.term) !== normalize(input.value)) delete row.audio;
      if (key === 'example' || key === 'term') {
        delete row.exampleId;
        delete row.exampleAuthor;
      }
      row[key] = input.value.trim();
    });
    label.append(title, input);
    container.append(label);
    return input;
  }

  function renderDrafts() {
    byId('quick-rows').replaceChildren(...drafts.map((row, index) => {
      const entry = document.createElement('div');
      entry.className = 'quick-row';
      const tools = document.createElement('div');
      tools.className = 'quick-row-tools';
      if (!edit) tools.append(button('移除', () => {
        drafts.splice(index, 1);
        renderDrafts();
      }));
      if (row.kind === 'word') {
        const status = document.createElement('span');
        status.className = 'tag';
        status.setAttribute('role', 'status');
        tools.prepend(button('试听发音', () => speakStudy(row, status)), status);
        addField(entry, row, 'term', '单词或短语', false, Boolean(edit));
        const fields = document.createElement('div');
        fields.className = 'quick-word-fields';
        addField(fields, row, 'pos', '词性');
        addField(fields, row, 'meaning', '释义');
        entry.append(fields);
        const field = addField(entry, row, 'example', '例句', true);
        if (row.exampleId) {
          const source = document.createElement('a');
          source.className = 'tag';
          source.href = 'https://tatoeba.org/en/sentences/show/' + encodeURIComponent(row.exampleId);
          source.textContent = 'Tatoeba · ' + row.exampleAuthor;
          source.target = '_blank';
          source.rel = 'noopener';
          field.parentElement.after(source);
          field.addEventListener('input', () => source.remove(), { once: true });
        }
      } else {
        for (const lang of [row.source, otherLanguage(row.source)]) {
          addField(entry, row, lang, lang === 'en' ? '英文' : '中文', true);
        }
      }
      entry.append(tools);
      return entry;
    }));
    byId('quick-review').hidden = !drafts.length;
  }

  async function fillWord(row, signal) {
    await lookupDeckWord(row, true, signal);
    if (signal.aborted || row.example) return;

    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 2000);
    try {
      const parameters = new URLSearchParams({
        lang: 'eng', q: '"' + row.term + '"', word_count: '5-18', limit: '8', showtrans: 'none'
      });
      const response = await fetch('https://api.tatoeba.org/v1/sentences?' + parameters,
        { signal: request.signal, referrerPolicy: 'no-referrer' });
      if (!response.ok) return;
      const { data } = await response.json();
      const escapedTerm = row.term.replace(/['’]/g, "['’]");
      const exact = new RegExp('\\b' + escapedTerm + '\\b', 'i');
      const example = data?.find(item => item.owner && !item.is_unapproved &&
        typeof item.text === 'string' && exact.test(item.text));
      if (example) {
        row.example = example.text;
        row.exampleId = example.id;
        row.exampleAuthor = example.owner;
      }
    } catch {
      // The editable preview also works when example search is unavailable.
    } finally {
      signal.removeEventListener('abort', abort);
      clearTimeout(timeout);
    }
  }

  byId('quick-form').addEventListener('submit', async event => {
    event.preventDefault();
    resetDrafts();
    const lines = quickText.value.split(/\r?\n/).filter(line => line.trim());
    if (lines.length > 50) {
      quickStatus.textContent = '一次最多添加 50 条。更多词汇可以用批量导入。';
      return;
    }
    const rows = lines.map(line => parseQuickLine(line, quickType.value)).filter(Boolean);
    if (!rows.length) {
      quickStatus.textContent = '请检查输入，或手动选择内容类型。';
      return;
    }

    const task = new AbortController();
    lookup = task;
    quickPreview.disabled = true;
    const wordsToLookup = rows.filter(row => row.kind === 'word');
    if (wordsToLookup.length) quickStatus.textContent = '正在查找单词的释义、例句和发音…';
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(5, wordsToLookup.length) }, async () => {
      while (next < wordsToLookup.length && !task.signal.aborted) {
        await fillWord(wordsToLookup[next++], task.signal);
      }
    }));
    if (task.signal.aborted) return;
    lookup = undefined;
    quickPreview.disabled = false;
    drafts = rows;
    renderDrafts();
    const messages = [];
    if (lines.length !== rows.length) messages.push('已跳过 ' + (lines.length - rows.length) + ' 条格式无效的内容。');
    if (wordsToLookup.some(row => !row.meaning || !row.example)) messages.push('有些词缺少释义或例句，可以手动补上，也可先保存。');
    if (rows.some(row => row.kind === 'sentence' && (!row.zh || !row.en))) messages.push('句子可以先收藏。补齐中英两栏后，就能用于翻译练习。');
    quickStatus.textContent = messages.join(' ');
  });

  function announce(message) {
    collectionStatus.textContent = message;
    const toast = byId('personal-notice');
    toast.textContent = document.body.dataset.view === 'collection' ? '' : message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { toast.textContent = ''; }, 3200);
  }

  function saveDrafts() {
    const wordEntries = savedWords();
    const sentences = savedSentences();
    let wordsChanged = false;
    let sentencesChanged = false;
    let added = 0;
    let duplicates = 0;
    const focusedKind = drafts[0]?.kind;

    for (const row of drafts) {
      if (row.kind === 'word') {
        if (!termPattern.test(row.term)) throw Error('请填写有效的英文单词或短语。');
        const { kind: ignored, ...fields } = row;
        const word = { ...fields, topic: collectionName };
        const index = wordEntries.findIndex(item => normalize(item.term) === normalize(word.term));
        if (edit && index >= 0) wordEntries[index] = word;
        else if (edit) throw Error('这条单词已移除，请重新添加。');
        else if (index < 0) wordEntries.push(word);
        else { duplicates++; continue; }
        wordsChanged = true;
      } else {
        if (!row[row.source]) throw Error('请保留原句。');
        const sameSource = item => item.source === row.source && comparable(item[row.source]) === comparable(row[row.source]);
        const samePair = item => row.en && row.zh && comparable(item.en) === comparable(row.en) && comparable(item.zh) === comparable(row.zh);
        const index = edit ? sentences.findIndex(item => item.id === edit.id) : -1;
        if (edit && index < 0) throw Error('这条句子已移除，请重新添加。');
        if (sentences.some((item, i) => i !== index && (sameSource(item) || samePair(item)))) { duplicates++; continue; }
        const sentence = {
          id: index >= 0 ? sentences[index].id : crypto.randomUUID(),
          source: row.source,
          en: row.en || '',
          zh: row.zh || ''
        };
        if (index >= 0) {
          sentence.wrong = sentences[index].wrong || {};
          sentences[index] = sentence;
        } else sentences.push(sentence);
        sentencesChanged = true;
      }
      added++;
    }
    if (!added) {
      quickStatus.textContent = '这些内容已在收藏里。可到收藏中编辑。';
      return;
    }
    storeChanges(wordsChanged ? wordEntries : null, sentencesChanged ? sentences : null);
    kind = focusedKind || kind;
    const notice = edit ? '已保存修改。' : '已收藏 ' + added + ' 条。' + (duplicates ? ' 跳过 ' + duplicates + ' 条重复内容。' : '');
    dialog.close();
    if (wordsChanged && activeDeck?.id === collectionId) {
      reloadInto(collectionId, 'collection', notice);
      return;
    }
    renderCollection();
    announce(notice);
    if (document.body.dataset.view === 'translate') showTranslation();
  }

  function openEditor(item, type) {
    resetDrafts();
    edit = item;
    byId('quick-form').hidden = true;
    byId('quick-add-title').textContent = type === 'word' ? '编辑收藏单词' : '编辑收藏句子';
    quickSave.textContent = '保存修改';
    drafts = [{ ...item, kind: type }];
    renderDrafts();
    dialog.showModal();
    dialog.querySelector('.quick-row input:not([readonly]), .quick-row textarea')?.focus();
  }

  function renderCollection() {
    const wordEntries = savedWords();
    const entries = kind === 'word' ? wordEntries : savedSentences();
    for (const control of document.querySelectorAll('[data-collection]')) {
      control.setAttribute('aria-pressed', String(control.dataset.collection === kind));
    }
    byId('collection-study').hidden = kind !== 'word';
    byId('collection-study').disabled = !wordEntries.length;
    byId('collection-translate').hidden = kind !== 'sentence';
    byId('collection-translate').disabled = !entries.some(item => item.en && item.zh);
    byId('collection-empty').hidden = entries.length > 0;
    byId('collection-empty').textContent = kind === 'word'
      ? '还没有收藏单词。点顶部「＋ 添加」收下第一个生词。'
      : '还没有收藏句子。点顶部「＋ 添加」，输入中文或英文句子。';
    byId('collection-list').replaceChildren(...entries.map(item => {
      const li = document.createElement('li');
      const text = document.createElement('div');
      const title = document.createElement('strong');
      title.lang = kind === 'word' ? 'en' : item.source;
      title.textContent = kind === 'word' ? item.term : item[item.source];
      const subtitle = document.createElement('p');
      subtitle.textContent = kind === 'word' ? [item.pos, item.meaning].filter(Boolean).join(' · ') || '待补释义'
        : item[otherLanguage(item.source)] || '待补译文';
      text.append(title, subtitle);
      if (kind === 'word' && item.example) {
        const example = document.createElement('small');
        example.lang = 'en';
        example.textContent = item.example;
        text.append(example);
        if (item.exampleId) {
          const source = document.createElement('a');
          source.href = 'https://tatoeba.org/en/sentences/show/' + encodeURIComponent(item.exampleId);
          source.textContent = 'Tatoeba · ' + item.exampleAuthor;
          text.append(source);
        }
      }
      const actions = document.createElement('div');
      actions.className = 'collection-row-actions';
      const type = kind;
      if (type === 'word') actions.append(button('发音', () => speakStudy(item, byId('collection-audio'))));
      actions.append(button(type === 'sentence' && (!item.en || !item.zh) ? '补译文' : '编辑', () => openEditor(item, type)));
      li.append(text, actions);
      return li;
    }));
  }

  function startRound() {
    const complete = savedSentences().filter(item => item.en && item.zh);
    queue = shuffle(reviewOnly ? complete.filter(item => item.wrong?.[direction]) : complete);
    step = 0;
    passed = 0;
    roundDirty = false;
    nextTranslation();
  }

  function nextTranslation() {
    submitted = false;
    answer.value = '';
    answer.readOnly = false;
    byId('translation-form').querySelector('button').hidden = false;
    byId('translation-result').hidden = true;
    showTranslation();
  }

  function showTranslation() {
    if (roundDirty) {
      startRound();
      return;
    }
    const item = queue[step];
    const done = step > 0 && !item;
    const empty = !item && !done;
    for (const control of document.querySelectorAll('[data-direction]')) {
      control.setAttribute('aria-pressed', String(control.dataset.direction === direction));
    }
    byId('translation-all').hidden = !reviewOnly;
    byId('translation-question').hidden = !item;
    byId('translation-empty').hidden = !empty;
    byId('translation-add').hidden = !empty || reviewOnly;
    byId('translation-done').hidden = !done;
    byId('translation-progress').textContent = item ? `${reviewOnly ? '重练错句 · ' : ''}${step + 1} / ${queue.length}` : '';
    if (empty) {
      byId('translation-empty').textContent = reviewOnly ? '这个方向没有待重练的句子。' : '收藏一个句子，补齐中英译文后就可以开始。';
    } else if (done) {
      byId('translation-summary').textContent = `本轮通过 ${passed} / ${step} 句` +
        (passed < step ? '。需要重练的句子已加入复习。' : '。');
    } else {
      byId('translation-prompt').lang = direction;
      byId('translation-prompt').textContent = item[direction];
      answer.lang = otherLanguage(direction);
      answer.placeholder = direction === 'en' ? '写下中文意思' : '写下英文译文';
    }
  }

  byId('translation-form').addEventListener('submit', event => {
    event.preventDefault();
    if (submitted || !queue[step] || !answer.value.trim()) return;
    submitted = true;
    answer.readOnly = true;
    const reference = queue[step][otherLanguage(direction)];
    byId('translation-reference').lang = otherLanguage(direction);
    byId('translation-reference').textContent = reference;
    byId('translation-feedback').textContent = comparable(reference) === comparable(answer.value)
      ? '和参考译文一致。请选择本题结果。'
      : '请对照参考译文。人物、否定、数字和时间等信息一致时，换一种说法也可以通过。';
    byId('translation-result').hidden = false;
    byId('translation-form').querySelector('button').hidden = true;
    ratings[0].focus();
  });

  for (const control of ratings) control.addEventListener('click', () => {
    if (!submitted || !queue[step]) return;
    const sentences = savedSentences();
    const item = sentences.find(entry => entry.id === queue[step].id);
    const correct = control.dataset.translationRating !== 'again';
    if (item) {
      item.wrong = { ...item.wrong, [direction]: !correct };
      try { localStorage.setItem(sentenceStorageKey, JSON.stringify(sentences)); }
      catch { byId('translation-feedback').textContent = '无法保存结果，请检查浏览器存储后重试。'; return; }
    }
    if (correct) passed++;
    step++;
    nextTranslation();
    (queue[step] ? byId('translation-prompt') : byId('translation-repeat')).focus();
  });

  function renderTranslationReview() {
    const list = byId('translation-review');
    const entries = savedSentences().filter(item => item.en && item.zh);
    const groups = ['en', 'zh'].map(lang => {
      const mistakes = entries.filter(item => item.wrong?.[lang]);
      if (!mistakes.length) return null;
      const group = document.createElement('div');
      group.append(button('重练' + directionLabel(lang) + ' · ' + mistakes.length + ' 句', () => {
        direction = lang;
        reviewOnly = true;
        startRound();
        navigate('translate');
      }));
      const rows = document.createElement('ul');
      rows.className = 'wrong-list';
      for (const item of mistakes) {
        const li = document.createElement('li');
        li.lang = lang;
        li.textContent = item[lang];
        rows.append(li);
      }
      group.append(rows);
      return group;
    });
    list.replaceChildren(...groups.filter(Boolean));
  }

  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    if (add) openQuick(add.id === 'translation-add' ? direction : 'auto');
    const collection = event.target.closest('[data-collection]');
    if (collection) {
      kind = collection.dataset.collection;
      renderCollection();
    }
    const choice = event.target.closest('[data-direction]');
    if (choice && direction !== choice.dataset.direction) {
      direction = choice.dataset.direction;
      startRound();
    }
  });

  quickText.addEventListener('input', resetDrafts);
  quickType.addEventListener('change', resetDrafts);
  byId('quick-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { resetDrafts(); stopSpeech(); });
  quickSave.onclick = () => {
    try { saveDrafts(); }
    catch (error) { quickStatus.textContent = error instanceof DOMException ? '无法保存，请检查浏览器存储空间。' : error.message; }
  };

  byId('collection-import').onclick = () => deckField('import').click();
  byId('collection-study').onclick = () => {
    try {
      const current = savedWords();
      if (activeDeck?.id !== collectionId || JSON.stringify(activeDeck.words) !== JSON.stringify(current)) {
        reloadInto(collectionId, 'study');
      } else if (!studyQueue.length) {
        startStudy();
        navigate('study');
      } else navigate('study');
    } catch { announce('浏览器无法切换词库。'); }
  };
  byId('collection-translate').onclick = () => {
    reviewOnly = false;
    startRound();
    navigate('translate');
  };
  byId('translation-all').onclick = () => { reviewOnly = false; startRound(); };
  byId('translation-repeat').onclick = startRound;
  document.addEventListener('studio-view-changed', () => {
    const view = document.body.dataset.view;
    if (view === 'collection') renderCollection();
    if (view === 'translate') showTranslation();
    if (view === 'mistakes') renderTranslationReview();
  });

  window.addEventListener('storage', event => {
    if (event.key === deckListKey) renderCollection();
    if (event.key === sentenceStorageKey) {
      roundDirty = true;
      renderCollection();
      renderTranslationReview();
      if (document.body.dataset.view === 'translate' && !submitted && !answer.value.trim()) showTranslation();
    }
  });

  renderCollection();
  try {
    const notice = sessionStorage.getItem('word-accumulator.collection-notice');
    if (notice) {
      announce(notice);
      sessionStorage.removeItem('word-accumulator.collection-notice');
    }
  } catch {}
})();
