'use strict';

const deckListKey = 'word-accumulator.decks.v1';
const deckSelectionKey = 'word-accumulator.active-deck.v1';
const deckDialog = document.getElementById('deck-dialog');
const deckField = id => document.getElementById('deck-' + id);
const originalWords = new Map();
for (const word of words) if (!originalWords.has(word.term.toLowerCase())) originalWords.set(word.term.toLowerCase(), word);
let decks = [];
let activeDeck;
try {
  const saved = JSON.parse(localStorage.getItem(deckListKey));
  if (Array.isArray(saved)) decks = saved.filter(item => item?.id && item.name && item.words?.length);
  activeDeck = decks.find(item => item.id === localStorage.getItem(deckSelectionKey));
} catch {}
if (activeDeck) words.splice(0, words.length, ...activeDeck.words);

function deckStorageKey(key) {
  return activeDeck ? key + '.' + activeDeck.id : key;
}

function buildDeckQuestions(entries) {
  const known = entries.filter(word => word.meaning);
  if (known.length < 4) return [];
  return known.flatMap(word => {
    if (!word.example) return [];
    const escaped = word.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('\\b' + escaped + '\\b', 'gi');
    const matches = word.example.match(pattern);
    if (matches?.length !== 1) return [];
    const decoys = known.filter(item => item !== word && item.meaning !== word.meaning)
      .map(item => [item.term, item.meaning]);
    if (decoys.length < 3) return [];
    return [{ id: word.term, sentence: word.example.replace(pattern, '___'), part: word.pos, reason: word.example, meaning: word.meaning, decoys }];
  });
}

const deckSelect = deckField('select');
deckSelect.add(new Option('内置 · 雅思词汇', ''));
for (const deck of decks) deckSelect.add(new Option(deck.name + ' · ' + deck.words.length + ' 词', deck.id));
deckSelect.value = activeDeck?.id || '';
deckSelect.addEventListener('change', () => {
  try {
    localStorage.setItem(deckSelectionKey, deckSelect.value);
    location.reload();
  } catch {
    deckSelect.value = activeDeck?.id || '';
    document.getElementById('save-note').textContent = '当前浏览器无法保存词库切换。';
  }
});

const posPattern = /^(?:(?:n|v|vi|vt|a|ad|adj|adv|pron|prep|conj|interj|det|num|phr)\.?|noun|verb|adjective|adverb|preposition|conjunction|pronoun|determiner|phrase|interjection|名词|动词|形容词|副词|代词|介词|连词|感叹词|短语|数词)(?:\s*[/、]\s*.+)?$/i;
const termPattern = /^[A-Za-z]+(?:[ '\u2019-][A-Za-z]+)*$/;
const rowLabels = { term: '单词', pos: '词性', meaning: '释义', example: '例句' };
const headingNames = {
  term: /^(?:单词|词汇|词条|英文|词头|word|term|vocabulary)$/i,
  pos: /^(?:词性|pos|part of speech)$/i,
  meaning: /^(?:释义|意思|翻译|中文|中文释义|meaning|definition|translation)$/i,
  example: /^(?:例句|英文例句|example|example sentence|sentence)$/i
};

function splitDeckLine(line) {
  if (line.includes('\t') || line.includes('|')) return line.split(line.includes('\t') ? '\t' : '|').map(value => value.trim());
  if (line.includes(',')) {
    return (line.match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g) || [])
      .map(value => value.replace(/^,/, '').trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
  }
  const columns = line.split(/\s{2,}/).map(value => value.trim());
  if (columns.length > 1) return columns;
  const bilingual = line.match(/^([A-Za-z][A-Za-z '\u2019-]*?)\s+(?:(\w{1,5}\.)\s*)?([\u3400-\u9fff].*)$/);
  if (bilingual) return [bilingual[1], bilingual[2] || '', bilingual[3]];
  const tagged = line.match(/^(.+?)\s+((?:n|v|vi|vt|a|ad|adj|adv|pron|prep|conj)\.)\s+(.+)$/i);
  if (tagged) return tagged.slice(1);
  return [line];
}

function parseDeckText(text) {
  const entries = new Map();
  let columns;
  let latest;
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^ +| +$/g, '').replace(/^(?:[•●·]|\d+[.)、])\s*/, '');
    if (!line.trim()) continue;
    const field = line.match(/^(例句|英文例句|example(?: sentence)?|词性|part of speech|释义|meaning|definition)\s*[:：]\s*(.+)$/i);
    if (field && latest) {
      const key = Object.keys(headingNames).find(name => headingNames[name].test(field[1]));
      if (key && !latest[key]) latest[key] = field[2];
      continue;
    }
    const values = splitDeckLine(line);
    const headings = values.map(value => Object.keys(headingNames).find(key => headingNames[key].test(value)));
    if (headings.length > 1 && headings.includes('term') && headings.filter(Boolean).length >= 2) {
      columns = headings;
      latest = null;
      continue;
    }
    const row = { term: '', pos: '', meaning: '', example: '' };
    if (columns) {
      for (const [i, key] of columns.entries()) if (key) row[key] = values[i] || '';
    } else {
      row.term = values.shift() || '';
      if (values.length && (!values[0] || values.length === 3 || posPattern.test(values[0]))) row.pos = values.shift();
      row.meaning = values.shift() || '';
      row.example = values.join(', ');
    }
    const inlineExample = row.meaning.match(/^(.+?)\s+(?:例句|example)\s*[:：]\s*(.+)$/i);
    if (inlineExample && !row.example) {
      row.meaning = inlineExample[1];
      row.example = inlineExample[2];
    }
    if (!termPattern.test(row.term) || row.term.length > 90) {
      skipped++;
      continue;
    }
    const key = row.term.toLowerCase();
    const existing = entries.get(key);
    if (existing) {
      for (const field of ['pos', 'meaning', 'example']) if (!existing[field]) existing[field] = row[field];
      latest = existing;
    } else {
      entries.set(key, row);
      latest = row;
    }
  }
  return { rows: [...entries.values()], skipped };
}

const dictionaryEndpoint = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
async function lookupDeckWord(row, online, signal) {
  const local = originalWords.get(row.term.toLowerCase());
  if (local) {
    row.pos ||= local.pos;
    if (!row.example && (!row.meaning || row.meaning === local.meaning)) {
      row.example = local.example || extraExamples[local.term] || '';
      if (local.exampleId && row.example === local.example) {
        row.exampleId = local.exampleId;
        row.exampleAuthor = local.exampleAuthor;
      }
    }
    row.meaning ||= local.meaning;
  }
  if (!online || signal.aborted || (row.pos && row.meaning && row.example && local)) return;
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 4500);
  try {
    const response = await fetch(dictionaryEndpoint + encodeURIComponent(row.term), { signal: request.signal, referrerPolicy: 'no-referrer' });
    if (!response.ok) return;
    const entries = await response.json();
    const meanings = entries.flatMap(item => item.meanings || []);
    const defs = meanings.flatMap(item => (item.definitions || []).map(def => ({ ...def, pos: item.partOfSpeech })));
    const definition = defs.find(item => item.example) || defs[0];
    if (definition) {
      row.pos ||= definition.pos;
      row.meaning ||= definition.definition;
      row.example ||= definition.example || '';
    }
    const audio = entries.flatMap(item => item.phonetics || []).map(item => item.audio)
      .find(url => typeof url === 'string' && /^(?:https:)?\/\//.test(url));
    if (audio) row.audio = audio.startsWith('//') ? 'https:' + audio : audio;
  } catch {
    // Keep original fields and leave unavailable dictionary entries editable.
  } finally {
    signal.removeEventListener('abort', abort);
    clearTimeout(timeout);
  }
}

const deckText = deckField('text');
const deckFile = deckField('file');
const deckStatus = deckField('status');
const deckPreview = deckField('preview');
let draftRows = [];
let lookupTask;
let fileTask = 0;
const deckScripts = new Map();

function loadDeckScript(url) {
  if (!deckScripts.has(url)) {
    deckScripts.set(url, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => {
        deckScripts.delete(url);
        script.remove();
        reject(new Error('无法下载文件读取组件'));
      };
      document.head.append(script);
    }));
  }
  return deckScripts.get(url);
}

function isDeckImage(file) {
  return file.type.startsWith('image/') || /\.(?:png|jpe?g|webp|gif|bmp|tiff?|avif)$/i.test(file.name);
}

async function createDeckImageWorker(status) {
  await loadDeckScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  return window.Tesseract.createWorker(['eng', 'chi_sim', 'chi_tra'], 1, {
    logger: data => {
      if (data.status === 'recognizing text') status('正在识别图片 ' + Math.round(data.progress * 100) + '%…');
    }
  });
}

async function readDeckFile(file, status, getImageWorker) {
  if (file.size > 18 * 1024 * 1024) throw new Error('文件超过 18 MB，请拆分后再试。');
  if (isDeckImage(file)) {
    const worker = await getImageWorker();
    return readDeckImage(file, worker, status);
  }
  if (/\.docx$/i.test(file.name)) {
    await loadDeckScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');
    const { value } = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
      convertImage: window.mammoth.images.imgElement(async () => ({}))
    });
    const template = document.createElement('template');
    template.innerHTML = value;
    const blocks = [...template.content.children];
    return blocks.flatMap(element => element.tagName === 'TABLE'
      ? [...element.querySelectorAll('tr')].map(row => [...row.cells].map(cell => cell.textContent.trim()).join('\t'))
      : [element.textContent.trim()]).join('\n');
  }
  if (/\.pdf$/i.test(file.name)) {
    const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    try {
      if (pdf.numPages > 40) throw new Error('PDF 超过 40 页，请先拆分。');
      const lines = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        status('读取 PDF 第 ' + i + ' / ' + pdf.numPages + ' 页…');
        const content = await (await pdf.getPage(i)).getTextContent();
        const items = content.items.filter(item => item.str?.trim() && item.transform);
        items.sort((a, b) => b.transform[5] - a.transform[5]);
        const rows = [];
        for (const item of items) {
          const last = rows.at(-1);
          if (last && Math.abs(last[0].transform[5] - item.transform[5]) <= 3) last.push(item);
          else rows.push([item]);
        }
        for (const row of rows) {
          row.sort((a, b) => a.transform[4] - b.transform[4]);
          lines.push(row.map((item, index) => {
            const last = row[index - 1];
            const gap = last ? item.transform[4] - last.transform[4] - last.width : 0;
            return (gap > 12 ? '\t' : gap > 1 ? ' ' : '') + item.str;
          }).join(''));
        }
      }
      if (!lines.join('').trim()) throw new Error('这份 PDF 没有可选文字。可以截取词表页面，再以图片导入。');
      return lines.join('\n');
    } finally { await pdf.destroy(); }
  }
  if (/\.(txt|csv|tsv)$/i.test(file.name)) return file.text();
  throw new Error('请选择受支持的图片、文本或文档格式。');
}

function renderDeckDraft(rows) {
  const list = deckField('rows');
  list.replaceChildren(...rows.map((row, index) => {
    const section = document.createElement('div');
    section.className = 'deck-row';
    for (const [key, text] of Object.entries(rowLabels)) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.value = row[key] || '';
      input.maxLength = key === 'term' ? 90 : 500;
      input.setAttribute('aria-label', '第 ' + (index + 1) + ' 条 ' + text);
      input.addEventListener('input', () => {
        if (key === 'term' && input.value.trim() !== row.term) delete row.audio;
        row[key] = input.value.trim();
      });
      label.append(text, input);
      section.append(label);
    }
    return section;
  }));
  deckField('review').hidden = false;
}

function invalidateDraft() {
  lookupTask?.abort();
  lookupTask = undefined;
  deckPreview.disabled = false;
  draftRows = [];
  deckField('review').hidden = true;
}

deckField('import').addEventListener('click', () => deckDialog.showModal());
deckField('close').addEventListener('click', () => deckDialog.close());
deckDialog.addEventListener('close', () => {
  fileTask++;
  invalidateDraft();
  deckStatus.textContent = '';
  deckFile.value = '';
  deckFile.disabled = false;
});
deckText.addEventListener('input', () => {
  fileTask++;
  invalidateDraft();
  deckStatus.textContent = '';
  deckFile.value = '';
  deckFile.disabled = false;
});
deckFile.addEventListener('change', async () => {
  const files = [...deckFile.files];
  if (!files.length) return;
  const token = ++fileTask;
  invalidateDraft();
  deckPreview.disabled = true;
  deckFile.disabled = true;

  let current = 0;
  let imageWorker;
  const status = message => {
    if (token === fileTask) deckStatus.textContent = '第 ' + current + ' / ' + files.length + ' 个文件 · ' + message;
  };
  const getImageWorker = () => imageWorker ??= createDeckImageWorker(status);
  const results = [];
  const failures = [];
  try {
    for (const file of files) {
      if (token !== fileTask) return;
      current++;
      status('正在读取 ' + file.name + '…');
      try {
        const result = (await readDeckFile(file, status, getImageWorker)).trim();
        if (!result) throw new Error('没有识别到文字');
        if (token !== fileTask) return;
        results.push(result);
        deckText.value = [deckText.value.trim(), result].filter(Boolean).join('\n');
      } catch (error) {
        failures.push(file.name + '（' + (error.message || '读取失败') + '）');
      }
    }
    if (token !== fileTask) return;
    const summary = '已读取 ' + results.length + ' / ' + files.length + ' 个文件。';
    const errors = failures.length ? '未读出：' + failures.slice(0, 3).join('、') + (failures.length > 3 ? '等。' : '。') : '';
    deckStatus.textContent = summary + errors + (results.length ? '请核对文字，再生成预览。' : '');
  } finally {
    if (imageWorker) await imageWorker.then(worker => worker.terminate()).catch(() => {});
    if (token === fileTask) {
      deckPreview.disabled = false;
      deckFile.disabled = false;
      deckFile.value = '';
    }
  }
});

deckPreview.addEventListener('click', async () => {
  invalidateDraft();
  const { rows, skipped } = parseDeckText(deckText.value);
  if (!rows.length || rows.length > 600) {
    deckStatus.textContent = rows.length ? '每套最多 600 词，请拆成几套导入。' : '没有识别到有效词条。请每行放一个单词或短语。';
    return;
  }
  const task = new AbortController();
  lookupTask = task;
  deckPreview.disabled = true;
  const online = deckField('lookup').checked;
  let next = 0;
  let done = 0;
  const update = () => { deckStatus.textContent = '正在整理 ' + done + ' / ' + rows.length + ' 条…'; };
  update();
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, async () => {
    while (next < rows.length && !task.signal.aborted) {
      await lookupDeckWord(rows[next++], online, task.signal);
      if (!task.signal.aborted) { done++; update(); }
    }
  }));
  if (task.signal.aborted) return;
  lookupTask = undefined;
  deckPreview.disabled = false;
  draftRows = rows;
  renderDeckDraft(rows);
  const noMeaning = rows.filter(row => !row.meaning).length;
  const noExample = rows.filter(row => !row.example).length;
  deckStatus.textContent = '识别 ' + rows.length + ' 条' + (skipped ? '，跳过 ' + skipped + ' 行' : '') +
    '。' + (noMeaning || noExample ? '待补释义 ' + noMeaning + ' 条，待补例句 ' + noExample + ' 条。' : '请核对后保存。');
});

deckField('save').addEventListener('click', () => {
  const name = deckField('name').value.trim();
  if (!name) {
    deckStatus.textContent = '先给词库起个名字。';
    deckField('name').focus();
    return;
  }
  if (!draftRows.length || draftRows.some(row => !termPattern.test(row.term))) {
    deckStatus.textContent = '有空白或格式不正确的单词，请修正预览。';
    return;
  }
  if (new Set(draftRows.map(row => row.term.toLowerCase())).size !== draftRows.length) {
    deckStatus.textContent = '预览中有重复单词，请修改后保存。';
    return;
  }
  const id = crypto.randomUUID();
  const newDeck = { id, name, words: draftRows.map(row => ({ ...row, topic: name })) };
  try {
    const stored = JSON.parse(localStorage.getItem(deckListKey)) || [];
    localStorage.setItem(deckListKey, JSON.stringify([...stored, newDeck]));
    localStorage.setItem(deckSelectionKey, id);
    location.reload();
  } catch {
    deckStatus.textContent = '浏览器未能保存或切换词库。请检查本地存储空间。';
  }
});
