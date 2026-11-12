/* The second-stage study workspace. Personal material stays on this device. */
(() => {
  'use strict';
  const C = StudyPackCore, S = StudyPackStore, $ = byId;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  let packs = [], active, draft, editing, page = 0, view = 'home', archived = false, busy = false;
  let noticeTimer, draftTimer, draftWrites = Promise.resolve(), ocrWorker, ocrCancel, ocrToken = 0, ocrBusy = false, previewBusy = false;
  let accent = 'en-US', libraryLimit = 50;
  const unfinished = p => p.session && p.session.index < p.session.tasks.length;
  const defaultDate = () => C.day(Date.now() + 7 * 86400000);
  function freshDraft() { return { text: '', sources: [], rows: [], skipped: [], name: '', examDate: defaultDate(), minutes: 15, modes: [...C.MODES] }; }
  function notice(message, permanent = false) { clearTimeout(noticeTimer); $('notice').textContent = message; if (!permanent) noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 6500); }
  function fail(error) { notice(error.message || '操作未完成，请重试。', true); }
  function show(next) {
    stopSpeech(); view = next;
    for (const id of ['home', 'import', 'pack', 'practice', 'library']) $('view-' + id).hidden = next !== id;
    document.querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === next ? 'page' : 'false'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function confirmAction(title, description, actionText = '确认') {
    return new Promise(resolve => {
      $('confirm-title').textContent = title; $('confirm-description').textContent = description; $('confirm-ok').textContent = actionText;
      const dialog = $('confirm-dialog');
      const done = value => { dialog.close(); resolve(value); };
      $('confirm-ok').onclick = () => done(true); $('confirm-cancel').onclick = () => done(false);
      dialog.oncancel = () => resolve(false); dialog.showModal();
    });
  }
  async function refresh() { packs = (await S.all()).sort((a, b) => b.updatedAt - a.updatedAt); renderHome(); }
  async function persist(pack = active) {
    const saved = await S.save(pack);
    const i = packs.findIndex(p => p.id === saved.id);
    if (i >= 0) packs[i] = saved; else packs.unshift(saved);
    if (active?.id === saved.id) active = saved;
    return saved;
  }
  function stats(pack, mode) {
    const list = C.tasks(pack).filter(t => !mode || t.mode === mode);
    return { total: list.length, passed: list.filter(t => pack.progress[t.key]?.stage > 0).length };
  }
  function deadline(p) {
    const d = C.daysUntil(p.examDate);
    return d < 0 ? '考试已结束 · 继续积累' : d === 0 ? '今天考试' : '距考试 ' + d + ' 天';
  }
  function renderHome() {
    const visible = packs.filter(p => Boolean(p.archived) === archived);
    $('toggle-archived').textContent = archived ? '返回进行中的学习包' : '查看已归档';
    $('pack-list').innerHTML = visible.length ? visible.map(p => {
      const s = stats(p), plan = C.plan(p), ratio = s.total ? s.passed / s.total * 100 : 0;
      return `<button class="pack-card" data-pack="${esc(p.id)}"><span class="pack-icon">▤</span><h3>${esc(p.name)}</h3><p class="pack-meta">${p.items.filter(i => i.enabled).length} 条词句 · ${deadline(p)}</p><progress max="100" value="${ratio}" aria-label="练习通过比例"></progress><div class="card-foot"><span>${unfinished(p) ? '继续上次练习' : plan.selected.length ? '今日安排 ' + plan.selected.length + ' 题' : '查看学习与复习'}</span><span>↗</span></div></button>`;
    }).join('') : `<div class="empty-card"><h3>${archived ? '还没有归档的学习包。' : '给这一次学习，留一个位置。'}</h3><p>${archived ? '归档后，词句仍会保留在「我的积累」。' : '添加自己的资料，或先体验一份示例学习包。'}</p></div>`;
  }
  function readForm() {
    draft.text = $('import-text').value; draft.name = $('pack-name').value.trim(); draft.examDate = $('exam-date').value;
    draft.modes = [...document.querySelectorAll('[name=pack-mode]:checked')].map(e => e.value);
  }
  function saveDraftSoon() {
    clearTimeout(draftTimer); $('draft-status').textContent = '正在保存草稿…';
    draftTimer = setTimeout(() => {
      if (!draft) return;
      readForm(); const copy = clone(draft);
      draftWrites = draftWrites.catch(() => {}).then(() => S.meta('draft', copy));
      draftWrites.then(() => { $('draft-status').textContent = '草稿已保存在当前设备'; }).catch(fail);
    }, 350);
  }
  function setForm() {
    $('import-text').value = draft.text; $('pack-name').value = draft.name; $('exam-date').value = draft.examDate;
    document.querySelectorAll('[data-minutes]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.minutes) === draft.minutes));
    document.querySelectorAll('[name=pack-mode]').forEach(e => { e.checked = draft.modes.includes(e.value); });
    renderSources();
  }
  async function startImport() {
    if (ocrBusy) { show('import'); return; }
    const stored = await S.meta('draft');
    draft = stored && Array.isArray(stored.sources) && Array.isArray(stored.rows) ? stored : freshDraft();
    editing = draft.editingId ? packs.find(p => p.id === draft.editingId) || null : null;
    setForm(); $('import-heading').textContent = editing ? '继续完善这份学习包。' : '从你的资料开始。'; $('save-pack').textContent = editing ? '保存学习包修改 →' : '确认并创建学习包 →';
    $('save-status').textContent = ''; $('review-panel').hidden = true; $('import-inputs').hidden = false; $('preview-actions').hidden = false;
    $('step-one').classList.add('active'); $('step-two').classList.remove('active'); show('import');
    if (draft.rows.length) { page = 0; renderReview(); $('review-panel').hidden = false; $('import-inputs').hidden = true; $('preview-actions').hidden = true; $('step-two').classList.add('active'); }
  }
  function renderSources() {
    $('source-list').innerHTML = draft.sources.filter(s => s.id !== 'pasted').map(s => `<div class="source-file">${s.image ? `<img src="${s.image}" alt="资料缩略图">` : ''}<span>${esc(s.name)}<span class="state"> · ${s.error ? esc(s.error) : s.text ? '已读取' : '待识别'}</span></span><button data-draft-source="${esc(s.id)}">原文</button>${s.error && s.image ? `<button data-retry-source="${esc(s.id)}">重试</button>` : ''}<button data-remove-source="${esc(s.id)}" aria-label="移除 ${esc(s.name)}">×</button></div>`).join('');
  }
  async function imageData(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, 1900 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', .9);
    } finally { URL.revokeObjectURL(url); }
  }
  function timeout(promise, ms, message) { return new Promise((resolve, reject) => { const t = setTimeout(() => reject(Error(message)), ms); promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); }); }); }
  async function loadOCR(token) {
    if (!window.Tesseract) await timeout(new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'vendor/tesseract/tesseract.min.js'; script.onload = resolve; script.onerror = () => { script.remove(); reject(Error('识别组件未加载，请检查网络后重试。')); }; document.head.append(script);
    }), 25000, '识别组件加载超时，可重试或先粘贴文字。');
    if (token !== ocrToken) throw Error('识别已停止。');
    const creation = Tesseract.createWorker(['eng', 'chi_sim'], 1, {
      workerPath: new URL('vendor/tesseract/worker.min.js', location.href).href,
      logger: data => {
        if (token !== ocrToken) return;
        $('ocr-meter').value = data.progress || 0;
        $('ocr-status').textContent = (data.status === 'recognizing text' ? '正在识别文字 ' : '首次准备识别组件 ') + Math.round((data.progress || 0) * 100) + '%';
      }
    });
    creation.then(worker => { if (token !== ocrToken) worker.terminate(); }).catch(() => {});
    const worker = await timeout(creation, 70000, '首次准备时间过长，请重试；也可以先粘贴文字。');
    if (token !== ocrToken) { worker.terminate(); throw Error('识别已停止。'); }
    return worker;
  }
  async function recognizeSources(sources) {
    if (!sources.length || ocrBusy) return;
    ocrBusy = true; const token = ++ocrToken; $('ocr-progress').hidden = false; $('preview').disabled = true;
    $('ocr-status').textContent = '正在准备图片识别，首次使用可能需要一些时间…';
    let worker;
    const cancelled = new Promise((_, reject) => { ocrCancel = () => reject(Error('识别已停止，可重试。')); });
    try {
      worker = await Promise.race([loadOCR(token), cancelled]);
      ocrWorker = worker;
      for (const source of sources) {
        if (token !== ocrToken) break;
        $('ocr-status').textContent = '正在读取 ' + source.name;
        try {
          const result = await Promise.race([timeout(worker.recognize(source.image), 60000, '这张图片识别超时，请裁小后再试。'), cancelled]);
          if (token !== ocrToken) break;
          if (!result.data.text.trim()) throw Error('没有找到文字，请使用清晰的词表截图。');
          source.text = result.data.text.slice(0, 120000); delete source.error;
        } catch (e) { source.error = e.message; if (token !== ocrToken) break; }
        renderSources(); saveDraftSoon();
      }
    } catch (error) { for (const s of sources) if (!s.text) s.error = error.message; if (token === ocrToken) fail(error); }
    finally {
      worker?.terminate(); ocrWorker = null; ocrCancel = null;
      if (token === ocrToken) ocrToken++;
      for (const source of sources) if (!source.text && !source.error) source.error = '尚未识别，可重试';
      ocrBusy = false; $('ocr-progress').hidden = true; $('preview').disabled = false; renderSources(); saveDraftSoon();
    }
  }
  async function addFiles(files) {
    if (ocrBusy) return notice('请等当前图片识别完成，或先停止识别。');
    const count = draft.sources.filter(s => s.id !== 'pasted').length;
    if (files.length + count > 10) return notice('每个学习包最多添加 10 个文件，请分批创建学习包。');
    const images = [];
    for (const file of files) {
      try {
        if (file.size > 12 * 1024 * 1024) throw Error(file.name + ' 超过 12 MB，请压缩或裁切。');
        const source = { id: C.uid(), name: file.name.slice(0, 200), text: '', image: '' };
        if (/\.(?:png|jpe?g|webp)$/i.test(file.name) || /^image\/(?:png|jpeg|webp)$/.test(file.type)) { source.image = await imageData(file); images.push(source); }
        else if (/\.(?:txt|csv|tsv)$/i.test(file.name)) { source.text = (await file.text()).slice(0, 120000); }
        else throw Error(file.name + ' 格式暂不支持。请使用 JPG、PNG、WebP 或文本文件。');
        draft.sources.push(source);
      } catch (error) { fail(error); }
    }
    renderSources(); saveDraftSoon(); await recognizeSources(images);
  }
  async function preview() {
    if (ocrBusy || previewBusy) return;
    readForm();
    if (!draft.text.trim() && !draft.sources.some(s => s.text.trim())) return notice('请先粘贴词表，或上传一张清晰的资料图片。');
    previewBusy = true; $('preview').disabled = true; $('preview').textContent = '正在整理…';
    try {
      draft.sources = draft.sources.filter(s => s.id !== 'pasted');
      if (draft.text.trim()) draft.sources.unshift({ id: 'pasted', name: '粘贴的文字', text: draft.text, image: '' });
      const parsed = draft.sources.filter(s => s.text).map(s => C.parse(s.text, s.id));
      draft.rows = C.dedupe(parsed.flatMap(p => p.rows)).slice(0, 300); draft.skipped = parsed.flatMap(p => p.skipped);
      if (!draft.rows.length) throw Error('还没有找到英文词句。请检查识别原文，或按示例格式粘贴。');
      const missing = draft.rows.filter(i => i.kind === 'word' && !i.meaning);
      await Promise.all(missing.map(async item => { const entry = await WordDictionary.local(item.term); if (entry.meaning) { item.meaning = entry.meaning; item.pos ||= entry.pos; item.origin = 'dictionary'; } }));
      page = 0; renderReview(); $('review-panel').hidden = false; $('import-inputs').hidden = true; $('preview-actions').hidden = true;
      $('step-two').classList.add('active'); saveDraftSoon(); window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) { fail(error); }
    finally { previewBusy = false; $('preview').disabled = false; $('preview').textContent = '整理并预览 →'; }
  }
  function reviewCounts() {
    const chosen = draft.rows.filter(i => i.enabled);
    $('review-summary').textContent = `共 ${draft.rows.length} 条 · 已选 ${chosen.filter(i => i.kind === 'word').length} 个词／短语、${chosen.filter(i => i.kind === 'sentence').length} 个句子`;
    $('select-all').checked = chosen.length === draft.rows.length; $('select-all').indeterminate = chosen.length > 0 && chosen.length < draft.rows.length;
  }
  function renderReview() {
    reviewCounts();
    $('parse-notice').textContent = draft.skipped.length ? `有 ${draft.skipped.length} 处文字未自动转成词条，可在「修改资料」中查看原文。重复的相同词义已合并，原始来源保留。` : '相同词义已去重；同一个词的不同意思会分别保留。请核对释义后勾选。';
    $('review-rows').innerHTML = draft.rows.slice(page * 20, page * 20 + 20).map((row, i) => `<article class="review-row" data-row="${esc(row.id)}"><div class="row-top"><label class="check"><input type="checkbox" data-field="enabled" ${row.enabled ? 'checked' : ''} aria-label="选择第 ${page * 20 + i + 1} 条"><span class="row-number">${String(page * 20 + i + 1).padStart(2, '0')}</span></label><div class="kind-buttons"><button data-kind="word" aria-pressed="${row.kind === 'word'}">单词／短语</button><button data-kind="sentence" aria-pressed="${row.kind === 'sentence'}">句子</button></div><button class="text-button row-source" data-row-source="${esc(row.id)}">原文 ↗</button></div><div class="row-fields"><label>英文<textarea rows="2" lang="en" data-field="term" maxlength="1500" aria-label="第 ${page * 20 + i + 1} 条英文">${esc(row.term)}</textarea></label><label>中文释义／译文<textarea rows="2" data-field="meaning" maxlength="1500" aria-label="第 ${page * 20 + i + 1} 条中文">${esc(row.meaning)}</textarea></label></div>${row.origin === 'dictionary' ? '<p class="row-warning">释义由站内词典补充，请选定原文中的意思。</p>' : ''}<details><summary>例句与译文 ${row.example ? '· 已有例句' : '· 可选'}</summary><label class="field">英文例句<textarea rows="2" data-field="example" maxlength="1500" lang="en">${esc(row.example)}</textarea></label><label class="field">例句中文<textarea rows="2" data-field="exampleZh" maxlength="1500">${esc(row.exampleZh)}</textarea></label></details></article>`).join('');
    $('page-label').textContent = `${page + 1} / ${Math.max(1, Math.ceil(draft.rows.length / 20))} 页`;
    $('prev-page').disabled = page === 0; $('next-page').disabled = (page + 1) * 20 >= draft.rows.length;
  }
  async function savePack() {
    if (busy) return; readForm();
    if (!draft.name) { $('pack-name').focus(); return notice('给学习包起一个名称。'); }
    if (!C.validDate(draft.examDate)) { $('exam-date').focus(); return notice('请选择有效的考试日期。'); }
    if (!draft.modes.length) return notice('至少选择一种练习题型。');
    const chosen = draft.rows.filter(i => i.enabled);
    if (!chosen.length) return notice('至少选入一条词句。');
    const incomplete = chosen.find(i => !i.term.trim() || !i.meaning.trim());
    if (incomplete) { page = Math.floor(draft.rows.indexOf(incomplete) / 20); renderReview(); return notice('请补全「' + incomplete.term.slice(0, 30) + '」的英文和中文，或取消勾选。'); }
    const pack = editing ? clone(editing) : { version: 1, id: C.uid(), createdAt: Date.now(), revision: 0, progress: {}, history: [], archived: false };
    Object.assign(pack, { name: draft.name, examDate: draft.examDate, minutes: draft.minutes, modes: draft.modes, sources: clone(draft.sources), items: C.dedupe(clone(draft.rows)), session: null });
    if (!C.tasks(pack).length) return notice('所选题型没有可练内容：单词可练首字母／听写，完整句子可练双向翻译。');
    if (editing) {
      const unchanged = new Set(pack.items.filter(i => editing.items.some(old => old.id === i.id && ['term', 'meaning', 'kind', 'example'].every(k => old[k] === i[k]))).map(i => i.id));
      pack.progress = Object.fromEntries(Object.entries(pack.progress).filter(([key]) => unchanged.has(key.split(':')[0])));
      pack.history = pack.history.filter(h => unchanged.has(h.itemId));
    }
    busy = true; $('save-pack').disabled = true;
    try {
      active = await persist(pack); clearTimeout(draftTimer); await draftWrites.catch(() => {}); await S.meta('draft', null);
      draft = null; editing = null; notice('学习包已保存。可以开始今天的练习了。'); openPack(active.id);
    } catch (error) { fail(error); }
    finally { busy = false; $('save-pack').disabled = false; }
  }
  function openPack(id) {
    active = packs.find(p => p.id === id); if (!active) return;
    renderPack(); show('pack');
  }
  function renderPack() {
    const p = active, plan = C.plan(p), selected = p.items.filter(i => i.enabled);
    const newCount = plan.selected.filter(t => !p.progress[t.key]).length;
    $('pack-detail').innerHTML = `<button class="back-link" data-go="home">← 返回学习包</button><div class="pack-header"><div><span class="badge">${deadline(p)}</span><h1>${esc(p.name)}</h1><p class="muted">${selected.filter(i => i.kind === 'word').length} 个词／短语 · ${selected.filter(i => i.kind === 'sentence').length} 个句子 · 每天 ${p.minutes} 分钟</p></div><div class="actions"><button data-action="edit">调整内容与计划</button><button data-action="export">导出</button><button data-action="archive">${p.archived ? '恢复到学习中' : '归档'}</button></div></div><div class="detail-grid"><section class="panel today-panel"><p class="eyebrow">TODAY, ONE STEP CLOSER</p><h2>${plan.selected.length ? '今天，从这里继续。' : plan.doneToday ? '今天已经留下积累。' : '按自己的节奏练习。'}</h2><p class="muted">${plan.selected.length ? `先复习到期内容，再练 ${newCount} 道新题。每轮最多 10 题，做完再继续。` : plan.capacity === 0 ? '已达到今天设置的练习量。也可以选择下方题型，继续巩固。' : '暂时没有到期任务。可以选择下方题型提前练习。'}</p><div class="plan-stats"><div><strong>${plan.selected.length}</strong><span>今日待练</span></div><div><strong>${plan.due}</strong><span>到期题目</span></div><div><strong>${plan.doneToday}</strong><span>今日已练</span></div></div><div class="actions">${unfinished(p) ? '<button class="primary" data-action="resume">继续上次练习 →</button>' : `<button class="primary" data-start="today" ${!plan.selected.length ? 'disabled' : ''}>开始今日练习 →</button>`}</div>${plan.overload ? '<p class="hint">按当前时间可能无法完成全部待练内容。可以增加每日时间，或缩小本次学习范围。</p>' : ''}</section><section class="panel"><p class="eyebrow">KNOW WHAT YOU KNOW</p><h2>不同能力，分别积累。</h2><div class="skills">${C.MODES.map(mode => { const s = stats(p, mode); return `<div class="skill"><p>${C.labels[mode]}</p><strong>${s.passed}</strong><small> / ${s.total} 通过</small><progress value="${s.passed}" max="${s.total || 1}" aria-label="${C.labels[mode]}通过进度"></progress></div>`; }).join('')}</div><p class="hint">显示最近一次练习结果；翻译自评会标记。通过一遍后，仍会安排间隔复习。</p></section></div><div class="section-head"><h2>按题型练习</h2><span class="muted">也可以单独补薄弱项</span></div><div class="practice-options">${C.MODES.map(mode => { const n = C.tasks(p).filter(t => t.mode === mode).length; return `<button class="practice-option" data-start="${mode}" ${!n ? 'disabled' : ''}><strong>${C.labels[mode]} ↗</strong><small>${n ? n + ' 道 · 优先薄弱项' : '暂无已选内容'}</small></button>`; }).join('')}</div><section class="panel"><h3>原始资料</h3><div class="source-chips">${p.sources.map(s => `<button data-source="${esc(s.id)}">▤ ${esc(s.name)} ↗</button>`).join('')}</div></section><section class="pack-entries"><div class="section-head"><h2>本次学习内容</h2><span class="muted">${selected.length} 条</span></div>${selected.slice(0, 30).map(i => entryHTML(i, p)).join('')}${selected.length > 30 ? '<button class="text-button" data-go="library">到我的积累查看全部 →</button>' : ''}</section>`;
  }
  function entryHTML(i, p) {
    const trained = C.MODES.filter(mode => p.progress[C.taskKey(i, mode)]?.attempts);
    return `<div class="entry"><div class="term" lang="en">${esc(i.term)}<span class="entry-note">${esc(p.name)}${trained.length ? ' · ' + trained.map(m => C.labels[m] + (p.progress[C.taskKey(i, m)].stage > 0 ? ' ✓' : ' 待复习') + (p.progress[C.taskKey(i, m)].evidence === 'self' ? '（自评）' : '')).join(' / ') : ''}</span></div><span class="meaning">${esc(i.meaning)}</span><button data-entry-source="${esc(i.id)}" data-owner="${esc(p.id)}">来源 ↗</button></div>`;
  }
  function editPack() {
    editing = clone(active); draft = { editingId: active.id, text: active.sources.find(s => s.id === 'pasted')?.text || '', sources: clone(active.sources), rows: clone(active.items), skipped: [], name: active.name, examDate: active.examDate, minutes: active.minutes, modes: [...active.modes] };
    page = 0; setForm(); renderReview(); $('import-heading').textContent = '调整这次学习。'; $('save-pack').textContent = '保存修改 →';
    $('review-panel').hidden = false; $('import-inputs').hidden = true; $('preview-actions').hidden = true; $('step-two').classList.add('active');
    $('save-status').textContent = '修改词句或例句会重置该条练习进度，未修改的词句保留进度。'; show('import');
  }
  function renderLibrary() {
    const query = C.normalize($('library-search').value);
    const entries = packs.flatMap(p => p.items.filter(i => i.enabled && (!query || C.normalize(i.term + ' ' + i.meaning).includes(query))).map(i => ({ i, p })));
    const senses = new Set(entries.map(({ i }) => C.normalize(i.term) + '|' + C.normalize(i.meaning)));
    $('library-count').textContent = `${senses.size} 条不同词义／句子 · ${entries.length} 份学习记录`;
    $('library-list').innerHTML = entries.length ? entries.slice(0, libraryLimit).map(({ i, p }) => entryHTML(i, p)).join('') : '<div class="empty-card"><h3>积累从一条词句开始。</h3><p>创建学习包后，词句和原文会出现在这里。</p></div>';
    $('library-more').hidden = entries.length <= libraryLimit;
  }
  function sourceView(sourceIds, pack, row) {
    const sources = pack.sources.filter(s => sourceIds.includes(s.id));
    $('source-title').textContent = row ? row.term.slice(0, 70) : sources[0]?.name || '原始资料';
    $('source-content').innerHTML = sources.map(s => {
      const refs = row?.sources.filter(r => r.sourceId === s.id) || [];
      return `<section class="source-section"><h3>${esc(s.name)}</h3>${refs.map(r => `<p class="source-excerpt">第 ${r.line} 行 · ${esc(r.excerpt)}</p>`).join('')}${s.image ? `<img class="source-image" src="${s.image}" alt="${esc(s.name)} 的原图">` : ''}<details ${s.image ? '' : 'open'}><summary class="hint">${s.image ? '查看识别文字' : '查看完整原文'}</summary><pre class="source-text">${s.text.split('\n').map((line, i) => refs.some(r => r.line === i + 1) ? '<mark>' + esc(line) + '</mark>' : esc(line)).join('\n')}</pre></details></section>`;
    }).join('') || '<p class="muted">这条内容由你手动添加。</p>';
    $('source-dialog').showModal();
  }
  async function startPractice(mode, resume = false) {
    if (busy) return;
    if (!resume && unfinished(active) && !await confirmAction('开始新一轮？', '上一轮的作答记录已经保存。开始新一轮会替换尚未完成的题目队列。', '开始新一轮')) return;
    busy = true;
    try {
      if (!resume) active.session = C.session(active, mode);
      if (!active.session?.tasks.length) return notice('当前没有这类待练题目，可以调整学习范围或选择其他题型。');
      await persist(); prepareStudySpeech(); show('practice'); renderQuestion();
    } catch (error) { fail(error); } finally { busy = false; }
  }
  function current() {
    const s = active.session, task = s.tasks[s.index], item = active.items.find(i => i.id === task?.itemId);
    return { s, task, item, q: item && C.question(item, task.mode) };
  }
  function feedback(message, answer, kind = '') {
    $('answer-feedback').hidden = false; $('answer-feedback').className = kind;
    $('answer-feedback').innerHTML = `<strong>${esc(message)}</strong><span class="muted">你的答案</span><p class="submitted-answer">${esc(active.session.input || '暂时不会')}</p><span class="muted">参考答案</span><p class="reference">${esc(answer)}</p>`;
  }
  function renderQuestion() {
    stopSpeech(); const { s, task, item, q } = current();
    $('practice-name').textContent = active.name; $('practice-count').textContent = `${Math.min(s.index + 1, s.tasks.length)} / ${s.tasks.length}`;
    $('practice-meter').max = s.tasks.length; $('practice-meter').value = s.index;
    if (s.index >= s.tasks.length) return renderResult();
    $('question-card').hidden = false; $('session-result').hidden = true;
    if (!q) { notice('这道题的内容已被修改，请返回学习包重新开始。'); return; }
    $('question-type').textContent = C.labels[task.mode] + (task.mode === 'cloze' ? q.contextual ? ' · 原文语境' : ' · 根据释义' : '');
    $('question-prompt').textContent = q.prompt; $('question-prompt').lang = task.mode === 'zh-en' || task.mode === 'listen' ? 'zh-CN' : 'en';
    $('question-clue').textContent = q.clue; $('listen-area').hidden = task.mode !== 'listen';
    $('question-play').hidden = !q.audio || task.mode === 'listen'; $('question-source').hidden = !s.revealed && task.mode === 'listen';
    $('answer-label').textContent = task.mode === 'en-zh' ? '写出中文意思' : task.mode === 'zh-en' ? '用英文表达这句话' : '请输入完整单词或短语';
    $('practice-answer').value = s.input || ''; $('practice-answer').lang = task.mode === 'en-zh' ? 'zh-CN' : 'en';
    $('answer-feedback').hidden = true; $('self-review').hidden = true; $('next-question').hidden = true; $('remember-alternative').checked = false;
    $('answer-form').hidden = Boolean(s.revealed); $('practice-answer').disabled = false;
    if (s.revealed) {
      const result = s.answers[s.index];
      if (result) { feedback(result.correct ? (result.evidence === 'self' ? '已按你的自评记录为通过' : '答对了，继续积累。') : '已经加入待复习，稍后再试。', q.answer, result.correct ? 'good' : 'bad'); $('next-question').hidden = false; }
      else { feedback('表达可能不同，请对照参考答案。', q.answer); $('self-review').hidden = false; }
    }
    if (s.revealed && item.example && task.mode === 'listen') $('question-clue').textContent = item.meaning + ' · ' + item.example;
    $('next-question').textContent = s.index === s.tasks.length - 1 ? '查看本轮总结 →' : '下一题 →';
  }
  async function recordAnswer(correct, evidence) {
    const { s, task } = current();
    if (s.answers[s.index]) return;
    C.record(active, task, correct, Date.now(), evidence, s.id + ':' + s.index);
    s.answers[s.index] = { text: s.input || '', correct, evidence }; s.revealed = true;
    await persist();
  }
  async function checkAnswer(reveal = false) {
    if (busy) return; const { s, task, item, q } = current();
    s.input = $('practice-answer').value.slice(0, 1500);
    if (!reveal && !s.input.trim()) return notice('先写下你的答案，或点击「暂时不会」。');
    busy = true; $('check-answer').disabled = true;
    const backup = clone(active);
    try {
      const result = reveal ? { status: 'incorrect' } : C.grade(item, task.mode, s.input);
      if (result.status === 'review') { s.revealed = true; await persist(); }
      else await recordAnswer(result.status === 'correct', 'exact');
      renderQuestion();
    } catch (error) { active = backup; fail(error); }
    finally { busy = false; $('check-answer').disabled = false; }
  }
  async function selfReview(correct) {
    if (busy) return; const backup = clone(active); busy = true;
    try {
      const { s, item, task } = current();
      if (correct && $('remember-alternative').checked && s.input.trim() && item.alternatives.length < 30 && !item.alternatives.some(a => a.mode === task.mode && C.normalize(a.text) === C.normalize(s.input))) item.alternatives.push({ mode: task.mode, text: s.input });
      await recordAnswer(correct, 'self'); renderQuestion();
    } catch (error) { active = backup; fail(error); } finally { busy = false; }
  }
  async function nextQuestion() {
    if (busy || !active.session.answers[active.session.index]) return;
    busy = true; const backup = clone(active);
    try { active.session.index++; active.session.revealed = false; active.session.input = ''; await persist(); renderQuestion(); }
    catch (error) { active = backup; fail(error); } finally { busy = false; }
  }
  function renderResult() {
    const s = active.session, passed = s.answers.filter(a => a.correct).length;
    const missed = s.tasks.filter((t, i) => !s.answers[i]?.correct);
    const terms = [...new Set(missed.map(t => active.items.find(i => i.id === t.itemId)?.term))];
    $('question-card').hidden = true; $('session-result').hidden = false; $('practice-meter').value = s.tasks.length;
    $('session-result').innerHTML = `<p class="eyebrow">ONE SESSION, MORE CONFIDENCE</p><h2>${missed.length ? '薄弱的地方，已经找到了。' : '这一轮，完成了。'}</h2><div class="result-number">${passed}<span> / ${s.tasks.length}</span></div><p>本轮通过 ${passed} 题${s.answers.some(a => a.evidence === 'self') ? '，包含翻译自评' : ''}。之后仍会安排间隔复习。</p>${terms.length ? `<div class="missed-list">${terms.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}<div class="actions">${missed.length ? '<button class="primary" id="retry-missed">只练本轮错题 →</button>' : ''}<button id="result-back">回到学习包</button></div>`;
    $('result-back').onclick = () => { renderPack(); show('pack'); };
    if ($('retry-missed')) $('retry-missed').onclick = async () => {
      if (busy) return; busy = true;
      try { active.session = { ...C.session(active, 'today'), tasks: missed, mode: 'retry' }; await persist(); renderQuestion(); }
      catch (error) { fail(error); } finally { busy = false; }
    };
  }
  function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
  function exportPacks(list) { download('单词累积器-学习包-' + C.day() + '.json', JSON.stringify({ format: 'word-accumulator-packs', version: 1, createdAt: new Date().toISOString(), packs: list }), 'application/json'); notice('备份已生成，包含词句、来源图片和练习进度。请确认已下载保存。'); }
  async function importBackup(file) {
    try {
      if (file.size > 30 * 1024 * 1024) throw Error('备份超过 30 MB，请按单个学习包导入。');
      const data = JSON.parse(await file.text());
      if (data.format !== 'word-accumulator-packs' || data.version !== 1 || !Array.isArray(data.packs) || !data.packs.length || data.packs.length > 50) throw Error('请选择备考学习包导出的 JSON 备份。');
      const validated = data.packs.map(C.validatePack);
      if (!await confirmAction('导入 ' + validated.length + ' 个学习包？', '内容与来源图片将保存在当前浏览器。已有相同学习包会另存为副本，不覆盖现有进度。', '导入')) return;
      for (const p of validated) {
        if (packs.some(old => old.id === p.id)) { p.id = C.uid(); p.name = (p.name.slice(0, 70) + '（导入副本）'); }
        p.revision = 0; await persist(p);
      }
      renderHome(); show('home'); notice('导入完成，原有学习包未被覆盖。');
    } catch (error) { fail(error); }
  }
  async function sample() {
    const existing = packs.find(p => p.sample && !p.archived); if (existing) return openPack(existing.id);
    const sources = [{ id: 'sample-words', name: '示例 · 课堂词表（原创）', text: C.sampleText, image: '' }, { id: 'sample-sentences', name: '示例 · 重点句（原创）', text: C.sampleSentences, image: '' }];
    const pack = { version: 1, id: C.uid(), name: '英语小测 · 先体验这一份', examDate: defaultDate(), minutes: 15, modes: [...C.MODES], sources, items: sources.flatMap(s => C.parse(s.text, s.id).rows), progress: {}, history: [], createdAt: Date.now(), revision: 0, sample: true, archived: false };
    active = await persist(pack); openPack(active.id);
  }
  document.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.go) { if (b.dataset.go === 'home') { renderHome(); show('home'); } else if (b.dataset.go === 'library') { renderLibrary(); show('library'); } }
      if (b.dataset.pack) openPack(b.dataset.pack);
      if (b.dataset.start) await startPractice(b.dataset.start);
      if (b.dataset.action === 'new') await startImport();
      if (b.dataset.action === 'edit') editPack();
      if (b.dataset.action === 'resume') await startPractice('today', true);
      if (b.dataset.action === 'export') exportPacks([active]);
      if (b.dataset.action === 'archive') { active.archived = !active.archived; await persist(); renderHome(); show('home'); notice(active.archived ? '已归档。可在「查看已归档」中恢复，词句仍在我的积累。' : '已恢复到学习中。'); }
      if (b.dataset.source) sourceView([b.dataset.source], active);
      if (b.dataset.entrySource) { const p = packs.find(p => p.id === b.dataset.owner), i = p.items.find(i => i.id === b.dataset.entrySource); sourceView(i.sources.map(s => s.sourceId), p, i); }
      if (b.dataset.rowSource) { const i = draft.rows.find(i => i.id === b.dataset.rowSource); sourceView(i.sources.map(s => s.sourceId), draft, i); }
      if (b.dataset.draftSource) sourceView([b.dataset.draftSource], draft);
      if (b.dataset.removeSource && !ocrBusy) { draft.sources = draft.sources.filter(s => s.id !== b.dataset.removeSource); renderSources(); saveDraftSoon(); }
      if (b.dataset.retrySource && !ocrBusy) await recognizeSources(draft.sources.filter(s => s.id === b.dataset.retrySource));
      if (b.dataset.minutes) { draft.minutes = Number(b.dataset.minutes); document.querySelectorAll('[data-minutes]').forEach(n => n.setAttribute('aria-pressed', n === b)); saveDraftSoon(); }
      if (b.dataset.kind) { const row = draft.rows.find(i => i.id === b.closest('[data-row]').dataset.row); row.kind = b.dataset.kind; renderReview(); saveDraftSoon(); }
      if (b.dataset.accent) { accent = b.dataset.accent; document.querySelectorAll('[data-accent]').forEach(n => n.setAttribute('aria-pressed', n === b)); }
    } catch (error) { fail(error); }
  });
  $('import-text').addEventListener('input', saveDraftSoon);
  for (const id of ['pack-name', 'exam-date']) $(id).addEventListener('input', saveDraftSoon);
  document.querySelectorAll('[name=pack-mode]').forEach(e => e.addEventListener('change', saveDraftSoon));
  $('review-rows').addEventListener('input', e => {
    const field = e.target.dataset.field; if (!field) return;
    const row = draft.rows.find(i => i.id === e.target.closest('[data-row]').dataset.row);
    row[field] = field === 'enabled' ? e.target.checked : e.target.value; reviewCounts(); saveDraftSoon();
  });
  $('select-all').onchange = () => { draft.rows.forEach(i => { i.enabled = $('select-all').checked; }); renderReview(); saveDraftSoon(); };
  $('add-row').onclick = () => {
    if (draft.rows.length >= 300) return notice('每个学习包最多 300 条，请另建学习包。');
    draft.rows.push({ id: C.uid(), kind: 'word', term: '', meaning: '', pos: '', example: '', exampleZh: '', alternatives: [], sources: [], enabled: true, origin: 'manual' }); page = Math.floor((draft.rows.length - 1) / 20); renderReview(); saveDraftSoon();
  };
  $('prev-page').onclick = () => { page--; renderReview(); }; $('next-page').onclick = () => { page++; renderReview(); };
  $('source-files').onchange = e => { addFiles([...e.target.files]).catch(fail); e.target.value = ''; };
  for (const event of ['dragenter', 'dragover']) $('drop-zone').addEventListener(event, e => { e.preventDefault(); $('drop-zone').classList.add('dragover'); });
  $('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragover'));
  $('drop-zone').addEventListener('drop', e => { e.preventDefault(); $('drop-zone').classList.remove('dragover'); addFiles([...e.dataTransfer.files]).catch(fail); });
  $('cancel-ocr').onclick = () => { ocrToken++; ocrCancel?.(); ocrWorker?.terminate(); notice('识别已停止，已经读出的文字仍会保留。'); };
  $('fill-example').onclick = () => { $('import-text').value = [C.sampleText, '', C.sampleSentences].join('\n'); saveDraftSoon(); };
  $('preview').onclick = preview; $('save-pack').onclick = savePack;
  $('back-to-sources').onclick = () => { $('review-panel').hidden = true; $('import-inputs').hidden = false; $('preview-actions').hidden = false; notice('再次整理将按原始资料重新生成预览。已在预览中修改的文字，请先同步到原文。'); };
  $('sample').onclick = () => sample().catch(fail);
  $('toggle-archived').onclick = () => { archived = !archived; renderHome(); };
  $('backup-all').onclick = () => packs.length ? exportPacks(packs) : notice('还没有学习包可以导出。');
  $('backup-file').onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; };
  $('source-close').onclick = () => $('source-dialog').close();
  $('question-source').onclick = () => { const { item } = current(); sourceView(item.sources.map(s => s.sourceId), active, item); };
  function playQuestion() { const { q } = current(); if (q?.audio) speakStudy({ term: q.audio }, $('speech-status'), accent); }
  $('listen-play').onclick = playQuestion; $('question-play').onclick = playQuestion;
  $('answer-form').onsubmit = e => { e.preventDefault(); checkAnswer(); };
  $('practice-answer').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); checkAnswer(); } });
  $('practice-answer').addEventListener('input', () => { if (active?.session) active.session.input = $('practice-answer').value.slice(0, 1500); });
  $('reveal-answer').onclick = () => checkAnswer(true);
  $('self-correct').onclick = () => selfReview(true); $('self-wrong').onclick = () => selfReview(false); $('next-question').onclick = nextQuestion;
  $('leave-practice').onclick = async () => { if (busy) return; try { await persist(); renderPack(); show('pack'); } catch (error) { fail(error); } };
  $('library-search').oninput = () => { libraryLimit = 50; renderLibrary(); }; $('library-more').onclick = () => { libraryLimit += 50; renderLibrary(); };
  window.addEventListener('beforeunload', e => { if (ocrBusy || busy) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && view === 'practice' && active && !busy) persist().catch(fail); });
  refresh().catch(fail);
})();
