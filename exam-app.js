/* The second-stage study workspace. Personal material stays on this device. */
function StudyPackWorkspace(root) {
  'use strict';
  const C = StudyPackCore, S = StudyPackStore, L = VocabularyLibrary;
  const $ = id => root.getElementById(id);
  const navigate = view => document.dispatchEvent(new CustomEvent('studio-navigate', { detail: view }));
  let materialDraft, selectedLibrary, libraryGroups = [], savedLibrary, preferLibrary;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  let packs = [], active, draft, editing, page = 0, view = 'home', archived = false, busy = false;
  let noticeTimer, draftTimer, draftWrites = Promise.resolve(), ocrWorker, ocrCancel, ocrToken = 0, ocrBusy = false, previewBusy = false;
  let cloudRequest;
  let accent = 'en-US';
  const unfinished = p => p.session && p.session.index < p.session.tasks.length;
  const defaultDate = () => C.day(Date.now() + 7 * 86400000);
  function freshDraft() { return { text: '', sources: [], rows: [], skipped: [], name: '', examDate: defaultDate(), minutes: 15, modes: [...C.MODES], step: 1, importMode: 'image' }; }
  function notice(message, permanent = false) { clearTimeout(noticeTimer); $('notice').textContent = message; if (!permanent) noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 6500); }
  function fail(error) { notice(error.message || '操作未完成，请重试。', true); }
  function show(next) {
    stopSpeech(); view = next; 
    for (const id of ['home', 'import', 'pack', 'practice', 'saved']) $('view-' + id).hidden = next !== id;
    root.querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === next ? 'page' : 'false'));
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
 }).join('') : `<div class="empty-card"><span class="empty-icon" aria-hidden="true">＋</span><div><h3>${archived ? '还没有归档的学习包' : '还没有学习包'}</h3><p>${archived ? '可以从这里恢复已归档的学习包。' : '在上方选择词库分组，创建你的第一个学习包。'}</p></div></div>`;
 const latest = packs.find(p => !p.archived && (unfinished(p) || p.history.length));
 $('return-strip').hidden = !latest;
 if(latest) $('return-strip').innerHTML = `<div><span class="status-dot"></span><span>接着上次学</span><strong>${esc(latest.name)}</strong></div><button data-continue-pack="${esc(latest.id)}">继续学习 →</button>`;
}
  function readForm() {
    draft.text = $('import-text').value; draft.name = $('pack-name').value.trim(); draft.examDate = $('exam-date').value;
    draft.modes = [...root.querySelectorAll('[name=pack-mode]:checked')].map(e => e.value);
  }
  function saveDraftSoon() {
    if (!draft || draft !== materialDraft) return;
    readForm();
    const copy = clone(draft);
    clearTimeout(draftTimer);
    $('draft-status').textContent = '正在保存草稿…';
    draftTimer = setTimeout(() => {
      draftWrites = draftWrites.catch(() => {}).then(() => S.meta('draft', copy));
      draftWrites.then(() => { $('draft-status').textContent = '草稿已保存在当前设备'; }).catch(fail);
    }, 350);
  }
  function setForm() {
 $('import-text').value = draft.text; $('pack-name').value = draft.name; $('exam-date').value = draft.examDate;
 root.querySelectorAll('[data-minutes]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.minutes)===draft.minutes));
 root.querySelectorAll('[name=pack-mode]').forEach(e=>{e.checked=draft.modes.includes(e.value);e.disabled=false;e.closest('label').classList.remove('unavailable');});
 $('recognition-method').value = draft.recognitionMethod === 'deepseek' ? 'deepseek' : 'local';
 renderRecognitionMethod();
 renderDeepSeekUsage(draft.aiUsage);
 setImportMode(draft.importMode || (draft.text?'text':'image')); renderSources();
}
  function setImportMode(mode){
 draft.importMode=mode;
 $('image-input-panel').hidden=mode!=='image';$('text-input-panel').hidden=mode!=='text';
 root.querySelectorAll('[data-import-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.importMode===mode));
}
  function wizardStep(step) {
    draft.step = step;
    const importing = draft === materialDraft;
    const ending = importing ? '保存到词库' : '设置练习';
    const titles = ['添加到词库', '核对要保存的词句', ending];
    const descriptions = [
      '输入单词，粘贴词表，或添加图片与文档。',
      '直接修改识别结果，并勾选要保留的内容。点「原文」可以对照。',
      importing ? '选择已有词库，或为这批单词新建一个词库。' : '设置学习包名称、日期与题型。'
    ];
    $('import-heading').textContent = titles[step - 1];
    $('import-description').textContent = descriptions[step - 1];
    $('import-kicker').textContent = importing ? `第 ${step} 步 · ${['添加资料','核对词句',ending][step - 1]}` : '';
    $('final-step-label').textContent = ending;
    $('step-one').parentElement.hidden = !importing;
    $('back-to-sources').hidden = !importing;
    $('back-to-review').hidden = Boolean(draft.fromLibrary);
    for (const [index, id] of ['step-one','step-two','step-three'].entries()) {
      $(id).classList.toggle('active', index + 1 === step);
      $(id).classList.toggle('done', index + 1 < step);
      $(id).setAttribute('aria-current', index + 1 === step ? 'step' : 'false');
    }
    $('import-inputs').hidden = step !== 1;
    $('preview-actions').hidden = step !== 1;
    $('review-panel').hidden = step === 1;
    $('review-content').hidden = step !== 2;
    $('destination-content').hidden = step !== 3 || !importing;
    $('plan-content').hidden = step !== 3 || importing;
    if (step === 2) renderReview();
    if (step === 3) {
      if (importing) renderDestination();
      else renderPlan();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function chosenComplete(){
 const chosen=draft.rows.filter(i=>i.enabled);
 if(!chosen.length){notice('先选择至少一条想学的词句。');return false;}
 const incomplete=chosen.find(i=>!i.term.trim()||!i.meaning.trim());
 if(incomplete){
  page=Math.floor(draft.rows.indexOf(incomplete)/20);wizardStep(2);
  const field=root.querySelector(`[data-row="${CSS.escape(incomplete.id)}"] [data-field="${incomplete.term.trim()?'meaning':'term'}"]`);
  field?.focus();notice('这一条还需要补全英文和中文，也可以取消勾选。');return false;
 }
 return true;
}
  function proceedToPlan() {
    if (draft === materialDraft) {
      if (!draft.aiReport && !draft.photoReport && draft.sources.some(isOldPhoto)) {
        return notice('请返回「修改资料」，重识别旧照片后再核对。');
      }
      const selected = draft.rows.filter(row => row.enabled);
      if (!selected.length) return notice('请先勾选要保存的词句。');
      const incomplete = selected.find(row => !row.term.trim() || row.kind === 'sentence' && !row.meaning.trim());
      if (incomplete) {
        page = Math.floor(draft.rows.indexOf(incomplete) / 20);
        wizardStep(2);
        return notice('请补齐所选词条的英文，以及双语句子的译文。');
      }
      wizardStep(3);
      saveDraftSoon();
      return;
    }
    if (!chosenComplete()) return;
    readForm();
    if (!draft.name) {
      draft.name = '我的英语练习 · ' + C.day().slice(5).replace('-', '/');
      $('pack-name').value = draft.name;
    }
    const available = C.MODES.filter(mode => draft.rows.some(row => C.eligible(row, mode)));
    let selected = draft.modes.filter(mode => available.includes(mode));
    if (!selected.length) selected = available;
    root.querySelectorAll('[name=pack-mode]').forEach(input => { input.checked = selected.includes(input.value); });
    readForm();
    wizardStep(3);
  }

  function renderDestination() {
    draft.materialId ||= C.uid();
    const selected = draft.rows.filter(row => row.enabled);
    const words = selected.filter(row => row.kind === 'word').length;
    const sentences = selected.length - words;
    $('destination-summary').textContent = `已选 ${words} 个单词／短语、${sentences} 个句子。`;
    $('word-destination').hidden = !words;
    $('sentence-destination').hidden = !sentences;
    const options = [
      new Option('新建独立词库（推荐）', 'new'),
      new Option('收藏单词', L.collectionId),
      ...L.catalog().filter(deck => deck.id && deck.words && deck.id !== L.collectionId)
        .map(deck => new Option(deck.name, deck.id)),
    ];
    $('material-deck').replaceChildren(...options);
    const suggested = draft.sources.find(source => source.id !== 'pasted')?.name.replace(/\.[^.]+$/, '').slice(0, 80);
    const preferred = draft.targetDeck ?? 'new';
    $('material-deck').value = options.some(option => option.value === preferred) ? preferred : 'new';
    $('material-name').value = draft.libraryName ?? suggested ?? ('我的词库 · ' + new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    $('material-name-field').hidden = $('material-deck').value !== 'new';
  }

  async function saveMaterials() {
    if (busy || draft !== materialDraft) return;
    busy = true;
    $('save-to-library').disabled = true;
    try {
      const rows = draft.rows.filter(row => row.enabled);
      if (!rows.length) return notice('请先勾选要保存的词句。');
      savedLibrary = await L.save(rows, $('material-deck').value, $('material-name').value,
        draft.sources, draft.materialId, 'import-' + draft.materialId);
      preferLibrary = savedLibrary.deck?.id || L.sentencesId;
      const message = [];
      if (savedLibrary.addedWords) message.push(`${savedLibrary.addedWords} 个单词已加入「${savedLibrary.deck.name}」`);
      if (savedLibrary.addedSentences) message.push(`${savedLibrary.addedSentences} 个句子已加入「已添加」`);
      $('library-saved-message').textContent = message.length ? message.join('，') + '。' : '所选词句已经在词库里。';
      $('open-imported-library').textContent = savedLibrary.deck ? '开始背这套单词' : '查看已添加的句子';
      $('browse-imported-library').hidden = !savedLibrary.deck;
      clearTimeout(draftTimer);
      await draftWrites.catch(() => {});
      try {
        await S.meta('draft', null);
      } catch {
        notice('词库已保存，旧草稿未能清除。');
      }
      materialDraft = null;
      draft = null;
      show('saved');
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      $('save-to-library').disabled = false;
    }
  }

  function selectLibrary() {
    const choices = L.catalog();
    selectedLibrary = choices.find(deck => deck.id === $('pack-deck').value) || choices[0];
    libraryGroups = L.groups(selectedLibrary);
    $('pack-groups').replaceChildren(...libraryGroups.map((group, index) => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(index);
      label.append(checkbox, document.createTextNode(group.name + ' · ' + group.entries.length + ' 条'));
      return label;
    }));
    updateGroupSelection();
  }

  function showPackPicker() {
    const select = $('pack-deck');
    const previous = preferLibrary ?? (select.options.length ? select.value : activeDeck?.id || '');
    select.replaceChildren(...L.catalog().map(deck => new Option(deck.name, deck.id)));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    preferLibrary = undefined;
    selectLibrary();
  }

  function pickedGroups() {
    return [...$('pack-groups').querySelectorAll('input:checked')].map(input => libraryGroups[Number(input.value)]);
  }

  function updateGroupSelection() {
    const picked = pickedGroups();
    const total = picked.reduce((sum, group) => sum + group.entries.length, 0);
    $('choose-pack-groups').disabled = !total || total > 300;
    $('pack-group-count').textContent = total > 300 ? '每个学习包最多 300 条，请少选几组。' :
      total ? `已选 ${picked.length} 组 · ${total} 条` : '请勾选要练的分组。';
  }

  async function createFromLibrary() {
    if (busy || ocrBusy || previewBusy) return;
    const picked = pickedGroups();
    if (!picked.length || picked.reduce((sum, group) => sum + group.entries.length, 0) > 300) return;
    busy = true;
    $('choose-pack-groups').disabled = true;
    try {
      const { rows, sources } = await L.buildRows(selectedLibrary, picked);
      if (!rows.length) return notice('所选分组缺少可练的双语词句，请先补齐释义。');
      if (document.body.dataset.view !== 'packs') return;
      draft = {
        ...freshDraft(), rows, sources, fromLibrary: true,
        name: (picked.length === 1 ? picked[0].name : selectedLibrary.name + ' · ' + picked.length + ' 组').slice(0, 80),
      };
      editing = null;
      setForm();
      $('save-pack').textContent = '创建并开始练习 →';
      $('save-status').textContent = '已跳过没有中文释义的条目。';
      show('import');
      proceedToPlan();
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      updateGroupSelection();
    }
  }
  function renderPlan(){
 const available=C.MODES.filter(m=>draft.rows.some(i=>C.eligible(i,m)));
 root.querySelectorAll('[name=pack-mode]').forEach(e=>{
  e.disabled=!available.includes(e.value);if(e.disabled)e.checked=false;
  e.closest('label').classList.toggle('unavailable',e.disabled);
  e.closest('label').querySelector('small').textContent=e.disabled?(['cloze','listen'].includes(e.value)?'选入单词或短语后可练':'选入双语句子后可练'):({cloze:'从词义和原句里回忆',listen:'听到单词，写出拼写','en-zh':'读懂原句的意思','zh-en':'用英文把意思说出来'}[e.value]);
 });
 readForm();
 const chosen=draft.rows.filter(i=>i.enabled),words=chosen.filter(i=>i.kind==='word').length;
 const tasks=C.tasks({items:draft.rows,modes:draft.modes});
 $('plan-ready-title').textContent=tasks.length?`${tasks.length} 道练习，准备好了。`:'选一种想练的题型。';
 $('plan-ready-summary').textContent=`${words} 个单词／短语 + ${chosen.length-words} 个句子，每天 ${draft.minutes} 分钟。`;
 $('plan-preview').innerHTML=draft.modes.map(m=>`<span>${C.labels[m]} <b>${tasks.filter(t=>t.mode===m).length}</b></span>`).join('');
}
  async function startImport() {
    if (busy || previewBusy) return;
    const stored = materialDraft || await S.meta('draft');
    if (document.body.dataset.view !== 'materials') return;
    if (stored && Array.isArray(stored.sources) && Array.isArray(stored.rows) && !stored.editingId) {
      materialDraft = stored;
    } else {
      materialDraft = freshDraft();
      materialDraft.importMode = 'text';
    }
    draft = materialDraft;
    editing = null;
    setForm();
    page = 0;
    show('import');
    wizardStep(draft.rows.length ? Math.max(1, Math.min(3, draft.step || 2)) : 1);
  }
  function isOldPhoto(source) {
    return source.image && source.text && source.ocrRevision !== StudyPackPhoto.version;
  }
  function renderSources() {
    const files = draft.sources.filter(source => source.id !== 'pasted');
    $('source-list').innerHTML = files.map(source => {
      const state = source.error || (isOldPhoto(source) ? '旧版识别，建议重识别' : '') ||
        (source.image && source.ocrRows ? '找到 ' + source.ocrRows + ' 个候选词条' : source.text ? '已读取' : '待识别');
      const retry = source.image && !usesDeepSeek() ? `<button data-retry-source="${esc(source.id)}" ${ocrBusy ? 'disabled' : ''}>重识别</button>` : '';
      return `<div class="source-file">${source.image ? `<img src="${source.image}" alt="资料缩略图">` : ''}<span>${esc(source.name)}<span class="state"> · ${esc(state)}</span></span><button data-draft-source="${esc(source.id)}">原文</button>${retry}<button data-remove-source="${esc(source.id)}" aria-label="移除 ${esc(source.name)}" ${ocrBusy ? 'disabled' : ''}>×</button></div>`;
    }).join('');
    $('import-summary').textContent = files.length ? `已添加 ${files.length} 个文件${$('import-text').value.trim() ? '，也会一并整理粘贴的文字' : ''}。下一步可核对词条和原图。` : '';
  }
  async function imageData(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, 2600 / Math.max(img.naturalWidth, img.naturalHeight));
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
        if (data.status !== 'recognizing text') $('ocr-status').textContent = '正在准备识别组件 · ' + Math.round((data.progress || 0) * 100) + '%';
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
    renderSources();
    const cancelled = new Promise((_, reject) => { ocrCancel = () => reject(Error('识别已停止，可重试。')); });
    try {
      worker = await Promise.race([loadOCR(token), cancelled]);
      ocrWorker = worker;
      for (const [index, source] of sources.entries()) {
        if (token !== ocrToken) break;
        const status = step => { $('ocr-status').textContent = `第 ${index + 1} / ${sources.length} 张 · ${step}`; };
        status('正在准备图片');
        try {
          const recognize = async canvas => {
            const result = await Promise.race([
              timeout(worker.recognize(canvas), 60000, '这张图片识别超时，请裁小后再试。'),
              cancelled
            ]);
            return result.data;
          };
          const raw = await StudyPackPhoto.read(worker, source, status, recognize);
          if (token !== ocrToken) break;
          source.text = raw.slice(0, 120000);
          source.ocrRevision = StudyPackPhoto.version;
          source.ocrRows = StudyPackPhoto.extract(source.text, source.id).length;
          if (source.ocrRows) delete source.error;
          else source.error = '没找到可用词条。可对照原图，裁到一栏再试或粘贴词表。';
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
    if (ocrBusy || previewBusy) return notice('请等当前资料读取完成。');
    const work = draft;
    previewBusy = true;
    $('preview').disabled = true;
    const count = draft.sources.filter(s => s.id !== 'pasted').length;
    if (files.length + count > 10) {
      previewBusy = false;
      $('preview').disabled = false;
      return notice('每批最多添加 10 个文件，请分批导入。');
    }
    const images = [];
    for (const file of files) {
      try {
        if (isDeckImage(file) && file.size > 12 * 1024 * 1024) throw Error(file.name + ' 超过 12 MB，请压缩或裁切。');
        const source = { id: C.uid(), name: file.name.slice(0, 200), text: '', image: '' };
        if (isDeckImage(file)) {
          source.image = await imageData(file);
          images.push(source);
        } else {
          source.text = (await readDeckFile(file, status => notice(status), () => {
            throw Error('无法读取图片');
          })).slice(0, 120000);
        }
        work.sources.push(source);
      } catch (error) { fail(error); }
    }
    previewBusy = false;
    $('preview').disabled = false;
    renderSources(); saveDraftSoon();
    if (!usesDeepSeek()) await recognizeSources(images);
  }
  const usesDeepSeek = () => $('recognition-method').value === 'deepseek';

  function renderRecognitionMethod() {
    const cloud = usesDeepSeek();
    $('deepseek-settings').hidden = !cloud;
    $('image-recognition-note').textContent = cloud ? '可以一次添加多张照片。点击「用 DeepSeek 识别」才会发送资料。' :
      '本机识别首次需下载识别资源，可以随时停止。';
    $('preview').textContent = cloud ? '用 DeepSeek 识别' : '下一步：核对词句 →';
    if (!cloud) $('deepseek-key').value = '';
  }

  function renderDeepSeekUsage(usage) {
    const format = value => value.toLocaleString('zh-CN');
    const yuan = value => value > 0 && value < 0.000001 ? '不到 ¥0.000001' : '¥' + value.toFixed(6);
    const label = usage ? `本次 DeepSeek · 输入 ${format(usage.input)}、输出 ${format(usage.output)}，共 ${format(usage.total)} token` +
      (usage.cached === null ? '（缓存用量未返回）' : `（缓存命中 ${format(usage.cached)}）`) +
      ` · 估算 ${yuan(usage.low)} 至 ${yuan(usage.high)}，以 DeepSeek 账单为准。` :
      usage === null ? '本次 DeepSeek 未返回 token 用量，费用请查看 DeepSeek 账单。' : '';
    $('deepseek-usage').textContent = $('deepseek-review-usage').textContent = label;
    $('deepseek-usage').hidden = $('deepseek-review-usage').hidden = !label;
  }

  async function previewWithDeepSeek() {
    const key = $('deepseek-key').value.trim();
    if (!key) {
      $('deepseek-key').focus();
      return notice('请先填写你的 DeepSeek API Key。');
    }
    const work = draft;
    const pasted = { id: 'pasted', name: '粘贴的文字', text: work.text, image: '' };
    const sources = work.sources.filter(source => source.id !== 'pasted');
    if (pasted.text.trim()) sources.unshift(pasted);
    const readable = sources.filter(source => source.image || source.text.trim());
    if (!readable.length) return notice('请先上传照片或粘贴文字。');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 150000);
    cloudRequest = controller;
    previewBusy = true;
    $('deepseek-key').value = '';
    $('preview').disabled = $('recognition-method').disabled = $('deepseek-key').disabled = true;
    $('import-text').readOnly = true;
    $('deepseek-cancel').hidden = false;
    $('preview').textContent = 'DeepSeek 正在识别…';
    work.aiUsage = undefined;
    renderDeepSeekUsage();
    try {
      const content = await DeepSeekImport.request(readable, key, controller.signal, usage => {
        if (controller.signal.aborted || draft !== work) return;
        work.aiUsage = usage;
        renderDeepSeekUsage(usage);
        saveDraftSoon();
      });
      if (controller.signal.aborted || draft !== work || document.body.dataset.view !== 'materials') return;
      const { rows, limited, filtered } = DeepSeekImport.parseRows(content, readable, C, termPattern);
      if (!rows.length) throw Error('DeepSeek 没找到可用词条。可以把页面裁小后再试。');
      const matched = new Set(rows.flatMap(row => row.sources.map(ref => ref.sourceId)));
      work.sources = sources;
      work.rows = rows;
      work.skipped = [];
      work.photoReport = null;
      work.aiReport = { limited, filtered, skipped: readable.filter(source => !matched.has(source.id)).map(source => source.name) };
      page = 0;
      wizardStep(2);
      saveDraftSoon();
    } catch (error) {
      if (draft !== work || document.body.dataset.view !== 'materials') return;
      if (controller.signal.aborted) {
        return notice((controller.signal.reason === 'timeout' ? '识别等待超时。' : '已停止等待。') +
          '若 DeepSeek 已处理请求，仍可能计费，请以账单为准。', true);
      }
      fail(error);
    } finally {
      clearTimeout(timer);
      cloudRequest = null;
      previewBusy = false;
      $('preview').disabled = $('recognition-method').disabled = $('deepseek-key').disabled = false;
      $('import-text').readOnly = false;
      $('deepseek-cancel').hidden = true;
      renderRecognitionMethod();
    }
  }

  async function preview() {
    if (ocrBusy || previewBusy || draft !== materialDraft) return;
    readForm();
    if (usesDeepSeek()) return previewWithDeepSeek();
    const pending = draft.sources.filter(source => source.image && !source.text && !source.error);
    if (pending.length) await recognizeSources(pending);
    if (draft !== materialDraft || document.body.dataset.view !== 'materials') return;
    if (draft.sources.some(source => isOldPhoto(source) && !source.error)) {
      await recognizeSources(draft.sources.filter(source => isOldPhoto(source) && !source.error));
      return notice('重识别完成。请检查各张图片的结果，再点下一步。');
    }
    if (!draft.text.trim() && !draft.sources.some(source => source.text.trim())) {
      return notice(draft.sources.some(source => source.image) ? '图片尚未识别出可用内容，可以重识别，或粘贴词表。' : '请先粘贴词表，或上传一张资料图片。');
    }
    previewBusy = true; $('preview').disabled = true; $('preview').textContent = '正在整理…';
    try {
      draft.sources = draft.sources.filter(s => s.id !== 'pasted');
      if (draft.text.trim()) draft.sources.unshift({ id: 'pasted', name: '粘贴的文字', text: draft.text, image: '' });
      const parsed = draft.sources.filter(source => !source.image && source.text).map(source => C.parse(source.text, source.id, 600));
      const photos = draft.sources.filter(source => source.image);
      const photoRows = C.dedupe(photos.filter(source => source.ocrRevision === StudyPackPhoto.version)
        .flatMap(source => StudyPackPhoto.extract(source.text, source.id)));
      const candidates = await Promise.all(photoRows.slice(0, 600).map(item => StudyPackPhoto.verify(item, WordDictionary.local)));
      const confirmed = candidates.filter(Boolean);
      const keptSources = new Set(confirmed.flatMap(item => item.sources.map(ref => ref.sourceId)));
      draft.rows = C.dedupe([...parsed.flatMap(result => result.rows), ...confirmed]).slice(0, 600);
      draft.aiReport = null;
      draft.skipped = parsed.flatMap(result => result.skipped);
      draft.photoReport = photos.length ? {
        skipped: photos.filter(source => !keptSources.has(source.id)).map(source => source.name),
        filtered: photoRows.length - confirmed.length,
      } : null;
      if (!draft.rows.length) throw Error(photos.length ? '照片里没有找到可用词条。请查看原图，试着裁到一栏后重识别，或粘贴整理好的词表。' : '还没有找到英文词句。请按示例格式粘贴。');
      const missing = draft.rows.filter(item => item.kind === 'word' && !item.meaning);
      await Promise.all(missing.map(async item => {
        const entry = await WordDictionary.local(item.term);
        if (entry.meaning) {
        item.meaning = entry.meaning.slice(0, 1500);
        item.pos ||= entry.pos;
        item.example ||= entry.example || '';
        item.exampleZh ||= entry.exampleZh || '';
        item.origin = 'dictionary';
      }
      }));
      page = 0; wizardStep(2); saveDraftSoon();
    } catch (error) { fail(error); }
    finally { previewBusy = false; $('preview').disabled = false; $('preview').textContent = '下一步：核对词句 →'; }
  }
  function reviewCounts() {
    const chosen = draft.rows.filter(i => i.enabled);
    $('review-summary').textContent = `共 ${draft.rows.length} 条 · 已选 ${chosen.filter(i => i.kind === 'word').length} 个词／短语、${chosen.filter(i => i.kind === 'sentence').length} 个句子`;
    $('chosen-summary').textContent = `已选 ${chosen.length} 条 · ${draft === materialDraft ? '下一步选择词库' : '下一步设置练习'}`;
    $('select-all').checked = chosen.length === draft.rows.length; $('select-all').indeterminate = chosen.length > 0 && chosen.length < draft.rows.length;
  }
  function renderReview() {
    reviewCounts();
    $('parse-notice').textContent = draft.skipped.length ? `有 ${draft.skipped.length} 处文字未自动转成词条，可在「修改资料」中查看原文。重复的相同词义已合并，原始来源保留。` : '相同词义已去重；同一个词的不同意思会分别保留。请核对释义后勾选。';
    $('deepseek-review-usage').hidden = !draft.aiReport || draft.aiUsage === undefined;
    if (draft.aiReport) {
      const { limited, filtered, skipped } = draft.aiReport;
      $('parse-notice').textContent = '这是 DeepSeek 提取的结果。请核对词头和释义，缺释义或不确定的词条默认不勾选。' +
        (limited ? ' 本批已达到条目上限，可分批识别剩余资料。' : '') +
        (filtered ? ` 已略过 ${filtered} 条格式不完整的候选。` : '') +
        (skipped.length ? ' 以下资料未提取到可用词条：' + skipped.join('、') + '。' : '');
    } else if (!editing && !draft.photoReport && draft.sources.some(isOldPhoto)) {
      $('parse-notice').textContent = '这份草稿使用旧版照片识别。请点「修改资料」，再点「下一步：核对词句」，即可用原图重识别。';
    } else if (draft.photoReport) {
      const { skipped, filtered } = draft.photoReport;
      $('parse-notice').textContent = '请对照原图核对词条。待确认的词头或释义默认不勾选。' +
        (filtered ? ' 已略过 ' + filtered + ' 条无法核实的候选。' : '') +
        (skipped.length ? ' 以下图片未提取到可用词条：' + skipped.join('、') + '。' : '');
    }
    $('review-rows').innerHTML = draft.rows.slice(page * 20, page * 20 + 20).map((row, i) => `<article class="review-row" data-row="${esc(row.id)}"><div class="row-top"><label class="check"><input type="checkbox" data-field="enabled" ${row.enabled ? 'checked' : ''} aria-label="选择第 ${page * 20 + i + 1} 条"><span class="row-number">${String(page * 20 + i + 1).padStart(2, '0')}</span></label><div class="kind-buttons"><button data-kind="word" aria-pressed="${row.kind === 'word'}">单词／短语</button><button data-kind="sentence" aria-pressed="${row.kind === 'sentence'}">句子</button></div><button class="text-button row-source" data-row-source="${esc(row.id)}">原文 ↗</button></div><div class="row-fields"><label>英文<textarea rows="2" lang="en" data-field="term" maxlength="1500" aria-label="第 ${page * 20 + i + 1} 条英文">${esc(row.term)}</textarea></label><label>中文释义／译文<textarea rows="2" data-field="meaning" maxlength="1500" aria-label="第 ${page * 20 + i + 1} 条中文">${esc(row.meaning)}</textarea></label></div>${row.origin === 'deepseek' && !row.enabled ? '<p class="row-warning">请核对原文并补齐释义后勾选。</p>' : row.origin === 'photo-corrected' ? '<p class="row-warning">词头按例句和词典推测，请确认后勾选。</p>' : row.origin === 'dictionary' ? '<p class="row-warning">释义由站内词典补充，请选定原文中的意思。</p>' : row.origin === 'photo' && !row.enabled ? '<p class="row-warning">识别结果待确认，请对照原文后勾选。</p>' : ''}<details><summary>例句与译文 ${row.example ? '· 已有例句' : '· 可选'}</summary><label class="field">英文例句<textarea rows="2" data-field="example" maxlength="1500" lang="en">${esc(row.example)}</textarea></label><label class="field">例句中文<textarea rows="2" data-field="exampleZh" maxlength="1500">${esc(row.exampleZh)}</textarea></label></details></article>`).join('');
    $('page-label').textContent = `${page + 1} / ${Math.max(1, Math.ceil(draft.rows.length / 20))} 页`;
    $('prev-page').disabled = page === 0; $('next-page').disabled = (page + 1) * 20 >= draft.rows.length;
  }
  async function savePack(){
 if(busy)return;readForm();
 if(!editing && !draft.photoReport && draft.sources.some(isOldPhoto)) { wizardStep(2); return notice('请返回修改资料，重识别旧照片后再创建学习包。'); }
 if(!draft.name){$('pack-name').focus();return notice('给学习包起一个名称。');}
 if(!C.validDate(draft.examDate)){$('exam-date').focus();return notice('请选择有效的日期。');}
 if(!draft.modes.length)return notice('至少选择一种练习题型。');
 if(!chosenComplete())return;
 const startImmediately=!editing;
 const pack=editing?clone(editing):{version:1,id:C.uid(),createdAt:Date.now(),revision:0,progress:{},history:[],archived:false};
 Object.assign(pack,{name:draft.name,examDate:draft.examDate,minutes:draft.minutes,modes:draft.modes,sources:clone(draft.sources),items:C.dedupe(clone(draft.rows.filter(i=>i.term.trim()))),session:null});
 if (draft.fromLibrary) pack.fromLibrary = true;
 if(!C.tasks(pack).length)return notice('所选题型没有可练内容：单词可练首字母／听写，完整句子可练双向翻译。');
 if(editing){
  const unchanged=new Set(pack.items.filter(i=>editing.items.some(old=>old.id===i.id&&['term','meaning','kind','example'].every(k=>old[k]===i[k]))).map(i=>i.id));
  pack.progress=Object.fromEntries(Object.entries(pack.progress).filter(([key])=>unchanged.has(key.split(':')[0])));
  pack.history=pack.history.filter(h=>unchanged.has(h.itemId));
 }
 busy=true;$('save-pack').disabled=true;
 try{
  active=await persist(pack);
  draft=null;editing=null;notice(startImmediately?'学习包已保存。先来一小轮，随时可以暂停。':'修改已保存。');openPack(active.id);
  if(startImmediately){busy=false;await startPractice('today');}
 }catch(error){fail(error);}finally{busy=false;$('save-pack').disabled=false;}
}
  function openPack(id) {
    active = packs.find(p => p.id === id); if (!active) return;
    renderPack(); show('pack');
  }
  function renderPack() {
    const p = active, plan = C.plan(p), selected = p.items.filter(i => i.enabled);
    const newCount = plan.selected.filter(t => !p.progress[t.key]).length;
    $('pack-detail').innerHTML = `<button class="back-link" data-go="home">← 返回学习包</button><div class="pack-header"><div><span class="badge">${deadline(p)}</span><h1>${esc(p.name)}</h1><p class="muted">${selected.filter(i => i.kind === 'word').length} 个词／短语 · ${selected.filter(i => i.kind === 'sentence').length} 个句子 · 每天 ${p.minutes} 分钟</p></div><div class="actions">${selected.some(i => i.kind === 'word') ? '<button data-action="study-library">背这套单词</button>' : ''}<button data-action="edit">调整内容与计划</button>${p.fromLibrary ? '' : '<button data-action="copy-library">将词句加入词库</button>'}<button data-action="export">导出</button><button data-action="archive">${p.archived ? '恢复到学习中' : '归档'}</button></div></div><div class="detail-grid"><section class="panel today-panel"><p class="eyebrow">今天的小目标</p><h2>${plan.selected.length ? '今天先练 ' + Math.min(10, plan.selected.length) + ' 题。' : plan.doneToday ? '今天已经留下积累。' : '按自己的节奏练习。'}</h2><p class="muted">${plan.selected.length ? `先复习到期内容，再练 ${newCount} 道新题。每轮最多 10 题，做完再继续。` : plan.capacity === 0 ? '已达到今天设置的练习量。也可以选择下方题型，继续巩固。' : '暂时没有到期任务。可以选择下方题型提前练习。'}</p><div class="plan-stats"><div><strong>${plan.selected.length}</strong><span>今日待练</span></div><div><strong>${plan.due}</strong><span>到期题目</span></div><div><strong>${plan.doneToday}</strong><span>今日已练</span></div></div><div class="actions">${unfinished(p) ? '<button class="primary" data-action="resume">继续上次练习 →</button>' : `<button class="primary" data-start="today" ${!plan.selected.length ? 'disabled' : ''}>开始今日练习 →</button>`}</div>${plan.overload ? '<p class="hint">按当前时间可能无法完成全部待练内容。可以增加每日时间，或缩小本次学习范围。</p>' : ''}</section><section class="panel"><p class="eyebrow">看见自己的进步</p><h2>会认、会听，也要会表达。</h2><div class="skills">${C.MODES.map(mode => { const s = stats(p, mode); return `<div class="skill"><p>${C.labels[mode]}</p><strong>${s.passed}</strong><small> / ${s.total} 通过</small><progress value="${s.passed}" max="${s.total || 1}" aria-label="${C.labels[mode]}通过进度"></progress></div>`; }).join('')}</div><p class="hint">显示最近一次练习结果；翻译自评会标记。通过一遍后，仍会安排间隔复习。</p></section></div><div class="section-head"><h2>按题型练习</h2><span class="muted">也可以单独补薄弱项</span></div><div class="practice-options">${C.MODES.map(mode => { const n = C.tasks(p).filter(t => t.mode === mode).length; return `<button class="practice-option" data-start="${mode}" ${!n ? 'disabled' : ''}><strong>${C.labels[mode]} ↗</strong><small>${n ? n + ' 道 · ' + ({cloze:'看意思，回忆完整拼写',listen:'听发音，写出单词','en-zh':'读英文，写出中文意思','zh-en':'看中文，用英文表达'}[mode]) : '暂无已选内容'}</small></button>`; }).join('')}</div>${p.sources.length ? `<section class="panel"><h3>原始资料</h3><div class="source-chips">${p.sources.map(s => `<button data-source="${esc(s.id)}">▤ ${esc(s.name)} ↗</button>`).join('')}</div></section>` : ''}<section class="pack-entries"><div class="section-head"><h2>本次学习内容</h2><span class="muted">${selected.length} 条</span></div>${selected.slice(0, 30).map(i => entryHTML(i, p)).join('')}${selected.length > 30 ? `<details><summary>查看其余 ${selected.length - 30} 条</summary>${selected.slice(30).map(i => entryHTML(i, p)).join('')}</details>` : ''}</section>`;
  }
  function entryHTML(i, p) {
    const trained = C.MODES.filter(mode => p.progress[C.taskKey(i, mode)]?.attempts);
    return `<div class="entry"><div class="term" lang="en">${esc(i.term)}<span class="entry-note">${esc(p.name)}${trained.length ? ' · ' + trained.map(m => C.labels[m] + (p.progress[C.taskKey(i, m)].stage > 0 ? ' ✓' : ' 待复习') + (p.progress[C.taskKey(i, m)].evidence === 'self' ? '（自评）' : '')).join(' / ') : ''}</span></div><span class="meaning">${esc(i.meaning)}</span>${i.sources.length ? `<button data-entry-source="${esc(i.id)}" data-owner="${esc(p.id)}">来源 ↗</button>` : ''}</div>`;
  }
  function editPack(){
 editing=clone(active);
 draft={editingId:active.id,text:active.sources.find(s=>s.id==='pasted')?.text||'',sources:clone(active.sources),rows:clone(active.items),skipped:[],name:active.name,examDate:active.examDate,minutes:active.minutes,modes:[...active.modes],step:2};
 page=0;setForm();$('save-pack').textContent='保存修改 →';
 $('save-status').textContent='修改词句或例句会重置该条练习进度，未修改的词句保留进度。';show('import');wizardStep(2);saveDraftSoon();
}
  function sourceView(sourceIds, pack, row) {
    const sources = pack.sources.filter(s => sourceIds.includes(s.id));
    $('source-title').textContent = row ? row.term.slice(0, 70) : sources[0]?.name || '原始资料';
    $('source-content').innerHTML = sources.map(s => {
      const refs = row?.sources.filter(r => r.sourceId === s.id && r.excerpt) || [];
      return `<section class="source-section"><h3>${esc(s.name)}</h3>${refs.map(r => `<p class="source-excerpt">第 ${r.line} 行 · ${esc(r.excerpt)}</p>`).join('')}${s.image ? `<img class="source-image" src="${s.image}" alt="${esc(s.name)} 的原图">` : ''}<details ${s.image ? '' : 'open'}><summary class="hint">${s.image ? '查看识别文字（可能含误读）' : '查看完整原文'}</summary><pre class="source-text">${s.text.split('\n').map((line, i) => refs.some(r => r.line === i + 1) ? '<mark>' + esc(line) + '</mark>' : esc(line)).join('\n')}</pre></details></section>`;
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
    const playable=q.audio||(s.revealed?item.term:'');
    $('speech-line').hidden=!playable;
    $('question-play').hidden=!playable||task.mode==='listen';
    $('question-play').textContent=item.kind==='word'?'♪ 朗读单词':'♪ 朗读原句';
    $('question-source').hidden = !item.sources.length || !s.revealed && task.mode === 'listen';
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
  async function studyPackWords() {
    if (busy || !active) return;
    busy = true;
    try {
      const result = await L.deckForPack(active);
      L.openDeck(result.deck.id, 'study');
    } catch (error) { fail(error); }
    finally { busy = false; }
  }

  async function copyOldPack() {
    if (busy || !active) return;
    const previous = active;
    if (!await confirmAction('把词句加入词库？', '单词存入同名词库，句子存入「已添加」。原学习包和练习进度会保留。', '加入词库')) return;
    busy = true;
    try {
      const rows = previous.items.filter(row => row.enabled && (row.kind === 'sentence' ?
        row.term.trim() && row.meaning.trim() : termPattern.test(row.term)));
      if (!rows.length) return notice('这份学习包没有可导入的词句。');
      const existing = L.catalog().find(deck => deck.id === 'pack-' + previous.id);
      savedLibrary = await L.save(rows, existing?.id || 'new', previous.name, previous.sources, 'pack-' + previous.id, 'pack-' + previous.id);
      preferLibrary = savedLibrary.deck?.id || L.sentencesId;
      notice(`已加入 ${savedLibrary.addedWords} 个单词和 ${savedLibrary.addedSentences} 个句子。`);
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
    }
  }
  root.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.go === 'home') { renderHome(); show('home'); }
      if (b.dataset.pack) openPack(b.dataset.pack);
      if(b.dataset.continuePack){openPack(b.dataset.continuePack);if(unfinished(active))await startPractice('today',true);else if(C.plan(active).selected.length)await startPractice('today');}
      if(b.dataset.importMode){setImportMode(b.dataset.importMode);saveDraftSoon();}
      if (b.dataset.start) await startPractice(b.dataset.start);
      if (b.dataset.action === 'study-library') await studyPackWords();
      if (b.dataset.action === 'copy-library') await copyOldPack();
      if (b.dataset.action === 'edit' && !ocrBusy && !previewBusy && !busy) editPack();
      if (b.dataset.action === 'resume') await startPractice('today', true);
      if (b.dataset.action === 'export') exportPacks([active]);
      if (b.dataset.action === 'archive') { active.archived = !active.archived; await persist(); renderHome(); show('home'); notice(active.archived ? '已归档。可在「查看已归档」中恢复。' : '已恢复到学习中。'); }
      if (b.dataset.source) sourceView([b.dataset.source], active);
      if (b.dataset.entrySource) { const p = packs.find(p => p.id === b.dataset.owner), i = p.items.find(i => i.id === b.dataset.entrySource); sourceView(i.sources.map(s => s.sourceId), p, i); }
      if (b.dataset.rowSource) { const i = draft.rows.find(i => i.id === b.dataset.rowSource); sourceView(i.sources.map(s => s.sourceId), draft, i); }
      if (b.dataset.draftSource) sourceView([b.dataset.draftSource], draft);
      if (b.dataset.removeSource && !ocrBusy && !previewBusy) { draft.sources = draft.sources.filter(s => s.id !== b.dataset.removeSource); renderSources(); saveDraftSoon(); }
      if (b.dataset.retrySource && !ocrBusy && !previewBusy) await recognizeSources(draft.sources.filter(s => s.id === b.dataset.retrySource));
      if (b.dataset.minutes) { draft.minutes = Number(b.dataset.minutes); root.querySelectorAll('[data-minutes]').forEach(n => n.setAttribute('aria-pressed', n === b)); renderPlan(); saveDraftSoon(); }
      if (b.dataset.kind) { const row = draft.rows.find(i => i.id === b.closest('[data-row]').dataset.row); row.kind = b.dataset.kind; renderReview(); saveDraftSoon(); }
      if (b.dataset.accent) { accent = b.dataset.accent; root.querySelectorAll('[data-accent]').forEach(n => n.setAttribute('aria-pressed', n === b)); }
    } catch (error) { fail(error); }
  });
  $('import-text').addEventListener('input', () => { renderSources(); saveDraftSoon(); });
  for (const id of ['pack-name', 'exam-date']) $(id).addEventListener('input', saveDraftSoon);
  root.querySelectorAll('[name=pack-mode]').forEach(e => e.addEventListener('change', () => { renderPlan(); saveDraftSoon(); }));
  $('review-rows').addEventListener('input', e => {
    const field = e.target.dataset.field; if (!field) return;
    const row = draft.rows.find(i => i.id === e.target.closest('[data-row]').dataset.row);
    row[field] = field === 'enabled' ? e.target.checked : e.target.value; reviewCounts(); saveDraftSoon();
  });
  $('select-all').onchange = () => { draft.rows.forEach(i => { i.enabled = $('select-all').checked; }); renderReview(); saveDraftSoon(); };
  $('add-row').onclick = () => {
    const limit = draft === materialDraft ? 600 : 300;
    if (draft.rows.length >= limit) return notice(`当前最多 ${limit} 条，请分批整理。`);
    draft.rows.push({ id: C.uid(), kind: 'word', term: '', meaning: '', pos: '', example: '', exampleZh: '', alternatives: [], sources: [], enabled: true, origin: 'manual' }); page = Math.floor((draft.rows.length - 1) / 20); renderReview(); saveDraftSoon();
  };
  $('prev-page').onclick = () => { page--; renderReview(); }; $('next-page').onclick = () => { page++; renderReview(); };
  $('source-files').onchange = e => { addFiles([...e.target.files]).catch(fail); e.target.value = ''; };
  for (const event of ['dragenter', 'dragover']) $('drop-zone').addEventListener(event, e => { e.preventDefault(); $('drop-zone').classList.add('dragover'); });
  $('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragover'));
  $('drop-zone').addEventListener('drop', e => { e.preventDefault(); $('drop-zone').classList.remove('dragover'); addFiles([...e.dataTransfer.files]).catch(fail); });
  $('cancel-ocr').onclick = () => { ocrToken++; ocrCancel?.(); ocrWorker?.terminate(); notice('识别已停止，已经读出的文字仍会保留。'); };
  $('fill-example').onclick = async function(){
 if (previewBusy) return;
 if($('import-text').value.trim()&&!await confirmAction('替换为示例文字？','当前粘贴框里的文字会被替换，已经上传的文件会保留。','填入示例'))return;
 $('import-text').value='address | 处理；解决 | We need to address this problem.\ncapture | 拍摄；记录 | I want to capture the light.\nWe need more time. | 我们需要更多时间。';renderSources();saveDraftSoon();
};
  $('recognition-method').onchange = () => {
    draft.recognitionMethod = $('recognition-method').value;
    renderRecognitionMethod();
    renderSources();
    saveDraftSoon();
  };
  $('deepseek-cancel').onclick = () => cloudRequest?.abort('cancelled');
  $('preview').onclick = preview; $('save-pack').onclick = savePack;
  $('back-to-sources').onclick=()=>{wizardStep(1);saveDraftSoon();notice('再次整理会按原始资料重新生成预览。已修改的词句，请先复制留存。');};
  $('review-forward').onclick=proceedToPlan;
  $('back-to-review').onclick=()=>{readForm();wizardStep(2);saveDraftSoon();};
  $('save-to-library').onclick = saveMaterials;
  $('back-to-material-review').onclick = () => { wizardStep(2); saveDraftSoon(); };
  $('material-deck').onchange = () => {
    draft.targetDeck = $('material-deck').value;
    $('material-name-field').hidden = draft.targetDeck !== 'new';
    saveDraftSoon();
  };
  $('material-name').oninput = () => { draft.libraryName = $('material-name').value; saveDraftSoon(); };
  $('pack-deck').onchange = selectLibrary;
  $('pack-groups').onchange = updateGroupSelection;
  $('choose-pack-groups').onclick = createFromLibrary;
  $('go-add-material').onclick = () => navigate('materials');
  $('add-more-material').onclick = () => startImport().catch(fail);
  $('practice-imported-library').onclick = () => navigate('packs');
  $('browse-imported-library').onclick = () => {
    if (savedLibrary?.deck) L.openDeck(savedLibrary.deck.id);
  };
  $('open-imported-library').onclick = () => {
    if (savedLibrary?.deck) L.openDeck(savedLibrary.deck.id, 'study');
    else {
      navigate('collection');
      document.querySelector('[data-collection="sentence"]').click();
    }
  };
  $('back-from-workspace').onclick = () => {
    if (draft === materialDraft) navigate('home');
    else if (editing) openPack(editing.id);
    else { showPackPicker(); renderHome(); show('home'); }
  };
  $('toggle-archived').onclick = () => { archived = !archived; renderHome(); };
  $('backup-all').onclick = () => packs.length ? exportPacks(packs) : notice('还没有学习包可以导出。');
  $('backup-file').onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; };
  $('source-close').onclick = () => $('source-dialog').close();
  $('question-source').onclick = () => { const { item } = current(); sourceView(item.sources.map(s => s.sourceId), active, item); };
  function playQuestion(){const {q,s,item}=current();const audio=q?.audio||(s.revealed&&item?.term);if(audio)speakStudy({term:audio},$('speech-status'),accent);}
  $('listen-play').onclick = playQuestion; $('question-play').onclick = playQuestion;
  $('answer-form').onsubmit = e => { e.preventDefault(); checkAnswer(); };
  $('practice-answer').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); checkAnswer(); } });
  $('practice-answer').addEventListener('input', () => { if (active?.session) active.session.input = $('practice-answer').value.slice(0, 1500); });
  $('reveal-answer').onclick = () => checkAnswer(true);
  $('self-correct').onclick = () => selfReview(true); $('self-wrong').onclick = () => selfReview(false); $('next-question').onclick = nextQuestion;
  $('leave-practice').onclick = async () => { if (busy) return; try { await persist(); renderPack(); show('pack'); } catch (error) { fail(error); } };
  window.addEventListener('beforeunload', e => { if (ocrBusy || busy) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && view === 'practice' && active && !busy) persist().catch(fail); });
  const ready = refresh().catch(fail);
  let lastView;
  return {
    async open(next) {
      try {
        if (lastView === next) {
          if (next === 'materials' && view === 'saved') await startImport();
          return;
        }
        if (lastView === 'packs' && view === 'practice' && active && !busy) await persist();
        lastView = next;
        await ready;
        if (document.body.dataset.view !== next) return;
        if (next === 'materials') await startImport();
        else { showPackPicker(); renderHome(); show('home'); }
      } catch (error) {
        fail(error);
      }
    },
    leave() {
      lastView = undefined;
      cloudRequest?.abort('navigation');
      $('deepseek-key').value = '';
      if (view === 'practice' && active && !busy) persist().catch(fail);
      stopSpeech();
    },
  };
}
