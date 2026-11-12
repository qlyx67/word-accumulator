/* Pure learning-pack rules. Shared by the interface and regression tests. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const MODES = ['cloze', 'listen', 'en-zh', 'zh-en'];
  const labels = { cloze: '首字母', listen: '听写', 'en-zh': '英译中', 'zh-en': '中译英' };
  const uid = () => globalThis.crypto.randomUUID();
  const tidy = s => String(s || '').normalize('NFKC').replace(/[‘’]/g, "'").trim();
  const tidyChinese = s => tidy(s).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff，。！？；：、,.;:!?])/g, '$1').replace(/([，。！？；：、,.;:!?])\s+(?=[\u3400-\u9fff])/g, '$1');
  const normalize = s => tidy(s).toLowerCase().replace(/\s+/g, ' ');
  const sentenceKey = s => normalize(s).replace(/[。.!！?？,，;；:："“”]/g, '').replace(/\s+/g, '');
  const day = (at = Date.now()) => {
    const d = new Date(at);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  const daysUntil = (date, now = Date.now()) => validDate(date) ? Math.round((Date.parse(date) - Date.parse(day(now))) / DAY) : null;
  const isPos = s => /^(?:(?:n|v|vi|vt|adj|adv|a|ad|prep|pron|conj|phr|num|det)\.?(?:\s*\/\s*)?)+$/i.test(s);
  const hasHan = s => /[\u3400-\u9fff]/.test(s);
  const headers = { term: /^(英文|单词|词汇|原句|word|term|english|sentence)$/i, meaning: /^(中文|释义|译文|中文释义|meaning|translation|chinese)$/i, pos: /^(词性|pos)$/i, example: /^(例句|英文例句|example)$/i, exampleZh: /^(例句中文|例句译文|examplezh)$/i, kind: /^(类型|kind)$/i };
  function split(line) {
    if (/[|\t]/.test(line)) return line.split(line.includes('\t') ? '\t' : '|').map(tidy);
    if (line.includes(',') && (line.startsWith('"') || /^[A-Za-z'-]+,/.test(line))) {
      return (line.match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g) || []).map(s => tidy(s.replace(/^,/, '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"')));
    }
    const bilingual = line.match(/^([A-Za-z].*?)\s*(?:[：:—–]\s*|\s+)((?:(?:n|v|vt|vi|adj|adv|prep)\.)?\s*[\u3400-\u9fff].*)$/);
    if (bilingual) return [tidy(bilingual[1]), tidy(bilingual[2])];
    return line.split(/\s{2,}/).map(tidy);
  }
  function parse(text, sourceId) {
    const rows = [], skipped = [];
    let columns, latest;
    const lines = String(text).split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const raw = lines[index];
      const line = tidy(raw.replace(/^\s*(?:[•●·*]|\d+[.)、])\s*/, ''));
      if (!line) continue;
      if (/^(?:unit|lesson|chapter|page)\s*\d+\b|^(?:vocabulary|new words|词汇表|单词表)$/i.test(line)) continue;
      const annotation = line.match(/^(例句中文|例句译文|英文例句|例句|example|译文|释义)\s*[:：]\s*(.+)$/i);
      if (annotation && latest) {
        const key = /中文|例句译文/.test(annotation[1]) ? 'exampleZh' : /例句|example/i.test(annotation[1]) ? 'example' : 'meaning';
        latest[key] = (key === 'example' ? tidy(annotation[2]) : tidyChinese(annotation[2])).slice(0, 1500);
        continue;
      }
      if (hasHan(line) && !/[A-Za-z]/.test(line) && latest && !latest.meaning) { latest.meaning = tidyChinese(line); continue; }
      let values = split(line);
      const fields = values.map(v => Object.keys(headers).find(k => headers[k].test(v)));
      if (fields.includes('term') && fields.filter(Boolean).length >= 2) { columns = fields; latest = undefined; continue; }
      const item = { id: uid(), kind: 'word', term: '', meaning: '', pos: '', example: '', exampleZh: '', alternatives: [], enabled: true, origin: 'source', sources: [{ sourceId, line: index + 1, excerpt: raw.slice(0, 2000) }] };
      if (columns) columns.forEach((k, i) => { if (k) item[k] = values[i] || ''; });
      else {
        item.term = values.shift() || '';
        if (isPos(values[0] || '')) item.pos = values.shift();
        item.meaning = values.shift() || '';
        item.example = values.shift() || '';
        item.exampleZh = values.join(' | ');
      }
      if (hasHan(item.term) && /[A-Za-z]/.test(item.meaning) && !hasHan(item.meaning)) [item.term, item.meaning] = [item.meaning, item.term];
      const inlinePos = item.term.match(/^(.*?)\s+(n|v|vi|vt|adj|adv|a|ad|prep|pron|conj)\.?$/i);
      if (inlinePos) { item.term = inlinePos[1]; item.pos ||= inlinePos[2] + '.'; }
      const meaningPos = item.meaning.match(/^(n|v|vi|vt|adj|adv|a|ad|prep|pron|conj)\.\s*(.+)$/i);
      if (meaningPos) { item.pos ||= meaningPos[1] + '.'; item.meaning = meaningPos[2]; }
      item.term = tidy(item.term.replace(/\s+\/[^/]+\/\s*$/, ''));
      if (!/[A-Za-z]/.test(item.term) || hasHan(item.term) || item.term.length > 1500) { skipped.push({ line: index + 1, text: raw }); latest = undefined; continue; }
      item.kind = item.kind === 'sentence' || item.term.split(/\s+/).length > 5 || /[.!?]$/.test(item.term) || /^(?:I|You|We|They|He|She|It|There|This|That)\s+\S+\s+\S+/i.test(item.term) ? 'sentence' : 'word';
      for (const k of ['meaning', 'example', 'exampleZh']) item[k] = (k === 'example' ? tidy(item[k]) : tidyChinese(item[k])).slice(0, 1500);
      rows.push(item); latest = item;
      if (rows.length >= 300) { if (index < lines.length - 1) skipped.push({ line: index + 2, text: '单次最多 300 条，请拆分剩余内容。' }); break; }
    }
    return { rows: dedupe(rows), skipped };
  }
  function dedupe(rows) {
    const map = new Map();
    for (const item of rows) {
      const key = item.kind + '|' + normalize(item.term) + '|' + normalize(item.meaning);
      if (map.has(key)) {
        const old = map.get(key);
        old.sources.push(...item.sources.filter(s => !old.sources.some(o => o.sourceId === s.sourceId && o.line === s.line)));
        old.example ||= item.example; old.exampleZh ||= item.exampleZh;
      } else map.set(key, { ...item, sources: [...item.sources] });
    }
    return [...map.values()];
  }
  const taskKey = (item, mode) => item.id + ':' + mode;
  function eligible(item, mode) {
    if (!item.enabled || !item.term.trim() || !item.meaning.trim()) return false;
    return ['cloze', 'listen'].includes(mode) ? item.kind === 'word' : item.kind === 'sentence';
  }
  function tasks(pack) {
    return pack.items.flatMap(item => pack.modes.filter(mode => eligible(item, mode)).map(mode => ({ itemId: item.id, mode, key: taskKey(item, mode) })));
  }
  function question(item, mode) {
    if (!eligible(item, mode)) return null;
    if (mode === 'listen') return { type: mode, prompt: '听一听，写出完整的单词或短语。', answer: item.term, clue: '', audio: item.term };
    if (mode === 'en-zh' || mode === 'zh-en') return { type: mode, prompt: mode === 'en-zh' ? item.term : item.meaning, answer: mode === 'en-zh' ? item.meaning : item.term, clue: '', audio: mode === 'en-zh' ? item.term : '' };
    const escaped = item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?<![a-z])' + escaped + '(?![a-z])', 'gi');
    const mask = item.term.split(' ').map(w => w[0] + '_'.repeat(Math.min(20, Math.max(0, w.length - 1)))).join(' ');
    const matches = item.example.match(re) || [];
    return { type: mode, prompt: matches.length === 1 ? item.example.replace(re, mask) : mask, answer: item.term, clue: item.meaning, audio: '', contextual: matches.length === 1 };
  }
  function grade(item, mode, answer) {
    const q = question(item, mode);
    if (!q || !tidy(answer)) return { status: 'empty' };
    const isTranslation = mode === 'en-zh' || mode === 'zh-en';
    const clean = isTranslation ? sentenceKey : normalize;
    const accepted = [q.answer, ...(isTranslation ? item.alternatives.filter(a => a.mode === mode).map(a => a.text) : [])];
    if (accepted.some(a => clean(a) === clean(answer))) return { status: 'correct', answer: q.answer };
    // Similar word overlap cannot establish meaning (especially negation and numbers).
    return { status: isTranslation ? 'review' : 'incorrect', answer: q.answer };
  }
  function record(pack, task, correct, now = Date.now(), evidence = 'exact', attemptId = uid()) {
    if (pack.history.some(h => h.id === attemptId)) return false;
    const old = pack.progress[task.key] || {};
    const sameDay = old.lastSuccess && day(old.lastSuccess) === day(now);
    const stage = correct ? Math.max(1, Math.min(5, (old.stage || 0) + (sameDay ? 0 : 1))) : 0;
    let due = now + (correct ? [1, 3, 7, 14, 30][Math.max(0, stage - 1)] * DAY : 600000);
    const remaining = daysUntil(pack.examDate, now);
    if (correct && remaining > 0) due = Math.min(due, Date.parse(pack.examDate + 'T08:00:00'));
    pack.progress[task.key] = { stage, due, last: now, lastSuccess: correct ? now : old.lastSuccess || 0, attempts: (old.attempts || 0) + 1, correct: (old.correct || 0) + Number(correct), lapses: (old.lapses || 0) + Number(!correct), evidence };
    pack.history.push({ id: attemptId, at: now, itemId: task.itemId, mode: task.mode, correct, evidence });
    pack.history = pack.history.slice(-5000);
    return true;
  }
  function ordered(pack, list) {
    return list.sort((a, b) => {
      const p = pack.progress[a.key], q = pack.progress[b.key];
      const rank = s => !s ? 1 : s.stage === 0 ? 0 : 2;
      return rank(p) - rank(q) || (p?.due || 0) - (q?.due || 0) || a.key.localeCompare(b.key);
    });
  }
  function plan(pack, now = Date.now()) {
    const all = tasks(pack), remaining = daysUntil(pack.examDate, now);
    const doneToday = pack.history.filter(h => day(h.at) === day(now)).length;
    const capacity = Math.max(0, Math.floor(pack.minutes * 60 / 35) - doneToday);
    const due = ordered(pack, all.filter(t => pack.progress[t.key]?.due <= now));
    const fresh = all.filter(t => !pack.progress[t.key]);
    const newTarget = remaining !== null && remaining >= 0 ? Math.ceil(fresh.length / Math.max(1, remaining + 1)) : Math.min(fresh.length, 10);
    const selected = [...due, ...fresh.slice(0, newTarget)].slice(0, capacity);
    return { selected, due: due.length, fresh: fresh.length, newTarget, doneToday, capacity, remaining, overload: due.length + newTarget > capacity, complete: all.length > 0 && !due.length && !fresh.length, total: all.length };
  }
  function session(pack, mode, now = Date.now()) {
    const list = mode === 'today' ? plan(pack, now).selected : ordered(pack, tasks(pack).filter(t => t.mode === mode));
    return { id: uid(), index: 0, tasks: list.slice(0, 10), answers: [], revealed: false, input: '', started: now, mode };
  }
  function validatePack(input) {
    const fail = () => { throw Error('学习包格式无效或内容超出限制，尚未修改已有数据。'); };
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    const str = (x, n = 1500) => typeof x === 'string' && x.length <= n;
    const num = x => Number.isFinite(x) && x >= 0;
    if (!object(input) || input.version !== 1 || !str(input.id, 100) || !input.id || !str(input.name, 80) || !input.name.trim() || !validDate(input.examDate) || ![5, 10, 15, 20, 30, 45, 60].includes(input.minutes)) fail();
    if (!Array.isArray(input.modes) || !input.modes.length || input.modes.some(m => !MODES.includes(m)) || new Set(input.modes).size !== input.modes.length) fail();
    if (!Array.isArray(input.sources) || input.sources.length > 30 || !input.sources.every(s => object(s) && str(s.id, 100) && str(s.name, 200) && str(s.text, 120000) && (!s.image || str(s.image, 3500000) && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.image)))) fail();
    if (new Set(input.sources.map(s => s.id)).size !== input.sources.length) fail();
    const sourceIds = new Set(input.sources.map(s => s.id));
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 300 || !input.items.every(i => object(i) && str(i.id, 100) && i.id && ['word', 'sentence'].includes(i.kind) && ['term', 'meaning', 'example', 'exampleZh', 'pos'].every(f => str(i[f])) && i.term.trim() && typeof i.enabled === 'boolean' && Array.isArray(i.alternatives) && i.alternatives.length <= 30 && i.alternatives.every(a => object(a) && ['en-zh', 'zh-en'].includes(a.mode) && str(a.text)) && Array.isArray(i.sources) && i.sources.length <= 100 && i.sources.every(s => object(s) && sourceIds.has(s.sourceId) && Number.isInteger(s.line) && s.line > 0 && str(s.excerpt, 2000)))) fail();
    if (new Set(input.items.map(i => i.id)).size !== input.items.length || !object(input.progress) || !Array.isArray(input.history) || input.history.length > 5000) fail();
    const keys = new Set(input.items.flatMap(i => MODES.map(m => taskKey(i, m))));
    if (!Object.entries(input.progress).every(([k, p]) => keys.has(k) && object(p) && ['stage', 'due', 'last', 'lastSuccess', 'attempts', 'correct', 'lapses'].every(f => num(p[f])) && p.stage <= 5 && p.correct <= p.attempts)) fail();
    const ids = new Set(input.items.map(i => i.id));
    if (!input.history.every(h => object(h) && str(h.id, 100) && num(h.at) && ids.has(h.itemId) && MODES.includes(h.mode) && typeof h.correct === 'boolean')) fail();
    if (input.session) {
      const s = input.session;
      if (!object(s) || !str(s.id, 100) || !Number.isInteger(s.index) || !Array.isArray(s.tasks) || s.tasks.length > 10 || s.index < 0 || s.index > s.tasks.length || !s.tasks.every(t => object(t) && ids.has(t.itemId) && MODES.includes(t.mode) && t.key === t.itemId + ':' + t.mode) || !Array.isArray(s.answers) || s.answers.length > 10 || !s.answers.every(a => object(a) && str(a.text) && typeof a.correct === 'boolean') || typeof s.revealed !== 'boolean' || !str(s.input)) fail();
    }
    return JSON.parse(JSON.stringify(input));
  }
  const sampleText = `单词 | 词性 | 释义 | 例句 | 例句中文
capture | v. | 拍摄；记录 | I wanted to capture the light before sunset. | 我想拍下日落前的光线。
address | v. | 处理；解决 | We need to address this problem. | 我们需要解决这个问题。
hesitate | v. | 犹豫 | Please do not hesitate to ask for help. | 需要帮助时请不要犹豫。
allocate | v. | 分配 | We allocate enough time to each task. | 我们给每项任务分配足够的时间。
reduce | v. | 减少 | We can reduce waste by reusing bags. | 重复使用袋子可以减少浪费。
sustainable | adj. | 可持续的 | The city needs sustainable transport. | 这座城市需要可持续的交通。
focus on | phr. | 专注于 | We should focus on one task at a time. | 我们应该一次专注于一项任务。
take part in | phr. | 参加 | I want to take part in the discussion. | 我想参加讨论。`;
  const sampleSentences = `英文 | 中文
She does not always agree with this plan. | 她并不总是赞成这个计划。
Taking photos helps me notice the beauty around me. | 拍照帮助我发现身边的美。
We need to find a more sustainable solution. | 我们需要找到一个更可持续的解决方案。
Please let me know if you need any help. | 如果你需要帮助，请告诉我。`;
  const api = { uid, tidy, normalize, day, validDate, daysUntil, parse, dedupe, eligible, tasks, taskKey, question, grade, record, plan, session, validatePack, labels, MODES, sampleText, sampleSentences };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.StudyPackCore = api;
})(globalThis);
