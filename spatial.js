/* Spatial shell: reuses the original exercises, data and persistence. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const icons = {
    study:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h4"/>',
    browse:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    library:'<path d="M4 5h5v15H4zM9 5h5v15H9zM16 4l4-1 3 15-4 1z"/>',
    practice:'<path d="m10 3 11 9-11 9V3ZM3 7v10"/>',
    mistakes:'<path d="M5 4h14v17H5zM9 1v6M15 1v6M9 12h6M9 16h4"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.2"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const shell = $('.studio-shell');
  const main = $('main');
  document.body.classList.add('spatial');
  const sky = document.createElement('div');
  sky.className = 'space-scene'; sky.setAttribute('aria-hidden','true');
  document.body.prepend(sky);
  const mast = document.createElement('header');
  mast.className = 'space-mast';
  mast.innerHTML = `<a class="space-brand" href="#" aria-label="返回背词"><span class="space-emblem" aria-hidden="true"></span><span>单词累积器<small>WORD ACCUMULATOR</small></span></a><div class="space-mast-right"><button class="space-status" type="button" data-space-panel="library"><span class="status-dot"></span><span id="space-current">选择词库</span>${icon('arrow')}</button><button class="space-icon" type="button" id="space-help" aria-label="操作说明">${icon('help')}</button></div>`;
  shell.before(mast);
  const toolbar = document.createElement('div');
  toolbar.className = 'space-location';
  toolbar.innerHTML = '<h1 id="space-mode-title">背词卡</h1><button type="button" data-space-panel="library" class="space-range">范围与分组 <span aria-hidden="true">↗</span></button>';
  main.prepend(toolbar);
  const dock = document.createElement('nav');
  dock.className = 'space-dock'; dock.setAttribute('aria-label','学习导航');
  dock.innerHTML = [
    ['library','词库','panel'],['study','背词','mode'],['practice','练习','panel'],['browse','查词','mode'],['mistakes','错题','panel']
  ].map(([key,label,type]) => `<button type="button" data-space-${type}="${key}" aria-label="${label}">${icon(key)}<span>${label}</span></button>`).join('');
  shell.after(dock);
  let activeDialog = null;
  let closing = null;
  let opener = null;
  function makePanel(key, title, side) {
    const d = document.createElement('dialog');
    d.id='space-'+key; d.className='space-panel'; d.dataset.side=side;
    d.setAttribute('aria-labelledby',d.id+'-title');
    d.innerHTML=`<div class="space-panel-surface"><div class="space-panel-head"><h2 id="${d.id}-title">${title}</h2><button type="button" class="space-icon space-close" aria-label="关闭${title}">${icon('close')}</button></div><div class="space-panel-body"></div></div>`;
    document.body.append(d);
    d.querySelector('.space-close').addEventListener('click',closePanel);
    d.addEventListener('cancel',e=> {e.preventDefault();closePanel();});
    const surface = d.querySelector('.space-panel-surface');
    let pressedBackdrop = false;
    d.addEventListener('pointerdown', event => {
      pressedBackdrop = event.target === d && !surface.getAnimations().some(
        animation => animation.playState === 'running'
      );
    });
    d.addEventListener('click', event => {
      if (pressedBackdrop && event.target === d) closePanel();
      pressedBackdrop = false;
    });
    return d;
  }
  const library = makePanel('library', '词库与范围', 'left');
  const practice = makePanel('practice', '选择练习', 'bottom');
  const mistakes = makePanel('mistakes', '错题本', 'right');
  const info = makePanel('info', '学习进度', 'bottom');
  const content = d => d.querySelector('.space-panel-body');
  content(library).append($('.study-controls'),$('#practice-scope'),$('.map-panel'));
  content(mistakes).append($('#wrong-side'));
  const classicLink = document.createElement('a');
  classicLink.className = 'space-about';
  classicLink.href = 'classic.html';
  classicLink.textContent = '打开旧版';
  content(info).append($('.hero-progress'), $('#save-note'), $('footer'), $('.rail-credit'), classicLink);
  const originalNav = $('.studio-rail nav');
  content(practice).append(originalNav);
  originalNav.className='space-mode-grid';
  const descriptions = {
    match: ['轨道配对', '把单词与释义连起来'],
    spell: ['拼写', '根据释义拼出单词'],
    quiz: ['句子选择', '根据上下文选词']
  };
  for (const control of originalNav.querySelectorAll('[data-mode]')) {
    const description = descriptions[control.dataset.mode];
    if (!description) continue;
    const [title, detail] = description;
    control.innerHTML = `<strong>${title}</strong><span class="mode-description">${detail}</span><span class="mode-go" aria-hidden="true">↗</span>`;
    control.addEventListener('click', closePanel);
  }
  const infoButton=document.createElement('button'); infoButton.type='button'; infoButton.className='space-about';
  infoButton.textContent='进度、存储与内容来源 ↗';
  infoButton.addEventListener('click', async () => {
    const source = opener;
    await closePanel();
    openPanel('info', source);
  });
  content(library).append(infoButton);
  const libraryDone=document.createElement('button');libraryDone.type='button';libraryDone.className='space-apply';
  libraryDone.textContent='回到学习 →';libraryDone.addEventListener('click',closePanel);content(library).append(libraryDone);
  $('.studio-rail').hidden=true;
  $('.studio-top').hidden=true;
  $('.acc-hero').hidden=true;
  // Move secondary settings off the learning canvas; original event handlers survive.
  const settings = document.createElement('div'); settings.className='space-study-settings';
  settings.innerHTML='<span class="space-overline">背词操作方式</span>';
  settings.append($('.flight-options'));content(library).prepend(settings);
  $('.flight-toolbar').hidden=true;
  const focus = $('#study-focus');
  focus.className='space-focus'; focus.textContent='⤢ 专注';
  $('.study-actions').append(focus);
  $('#space-help').addEventListener('click',()=>$('#help-open').click());
  $('.space-brand').addEventListener('click',e=>{e.preventDefault();goMode('study');});
  async function closePanel() {
    if(closing)return closing;
    const d=activeDialog;if(!d)return;
    const surface=d.querySelector('.space-panel-surface');
    const side=d.dataset.side;
    const end=side==='left'?'translateX(-105%)':side==='right'?'translateX(105%)':'translateY(105%)';
    document.body.removeAttribute('data-space-panel');
    closing=(async()=>{
      if(!reduced.matches){try{await surface.animate([{transform:'none',opacity:1},{transform:end,opacity:.6}],{duration:215,easing:'cubic-bezier(.4,0,1,1)'}).finished;}catch{}}
      d.close();activeDialog=null;
      opener?.focus({preventScroll:true});opener=null;
    })().finally(()=>{closing=null;});
    return closing;
  }
  async function openPanel(key,source) {
    if(closing)await closing;
    if(activeDialog)await closePanel();
    const d=$('#space-'+key);if(!d)return;
    opener=source || document.activeElement;activeDialog=d;
    if(key==='mistakes')$('#wrong-side').hidden=false;
    $('.map-panel').hidden = mode !== 'study';
    settings.hidden=mode !== 'study';
    document.body.dataset.spacePanel=d.dataset.side;
    d.showModal();
    document.dispatchEvent(new Event('study-controls-updated'));
    const side=d.dataset.side;
    const start=side==='left'?'translateX(-105%)':side==='right'?'translateX(105%)':'translateY(105%)';
    if(!reduced.matches)d.querySelector('.space-panel-surface').animate([{transform:start,opacity:.5},{transform:'none',opacity:1}],{duration:390,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  for (const control of document.querySelectorAll('[data-space-panel]')) {
    control.setAttribute('aria-haspopup', 'dialog');
    control.setAttribute('aria-controls', 'space-' + control.dataset.spacePanel);
    control.addEventListener('click', () => openPanel(control.dataset.spacePanel, control));
  }
  $('#constellation').addEventListener('click', async event => {
    if (!event.target.closest('button')) return;
    await closePanel();
    $('#study-flip').focus({preventScroll: true});
  });
  function goMode(next){
    if(next!==mode)originalNav.querySelector(`[data-mode="${next}"]`).click();
    if(next==='study'&&document.body.classList.contains('focus-study'))focus.click();
  }
  document.querySelectorAll('[data-space-mode]').forEach(b=>b.addEventListener('click',()=>goMode(b.dataset.spaceMode)));
  // Existing mistake actions navigate too; dismiss their drawer after activation.
  content(mistakes).addEventListener('click',e=>{if(e.target.closest('[data-review],#sentence-review,.sentence-list button'))closePanel();});
  const modeOrder = ['study', 'browse', 'match', 'spell', 'quiz'];
  let previousMode=mode;
  let modeAnimation=null;
  function syncMode(){
    $('#space-mode-title').textContent = $('#studio-title').textContent;
    dock.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.spaceMode===mode || b.dataset.spacePanel==='practice'&&['match','spell','quiz'].includes(mode))));
    $('.map-panel').hidden=mode!=='study';settings.hidden=mode!=='study';
    if(mode!==previousMode){
      const oldIndex=modeOrder.indexOf(previousMode),newIndex=modeOrder.indexOf(mode);
      previousMode=mode;modeAnimation?.cancel();
      if(!reduced.matches)modeAnimation=$('#'+mode).animate([{transform:`translateX(${newIndex>oldIndex?30:-30}px) scale(.99)`,opacity:0},{transform:'none',opacity:1}],{duration:320,easing:'cubic-bezier(.16,1,.3,1)'});
      window.scrollTo({top:0,behavior:'instant'});
    }
  }
  new MutationObserver(syncMode).observe(document.body,{attributes:true,attributeFilter:['data-mode']});
  function syncGroup(){
    $('#space-current').textContent=mode==='study'?$('#study-batch').textContent:$('#deck-select').selectedOptions[0]?.textContent || '学习词库';
  }
  new MutationObserver(syncGroup).observe($('#study-batch'),{childList:true,characterData:true,subtree:true});
  document.addEventListener('study-controls-updated',syncGroup);
  syncMode();syncGroup();
  // Concise onboarding is always available, not a blocking first-visit modal.
  const help = $('#studio-help');
  const guide=document.createElement('p');
  guide.textContent='新版空间导航：底部「词库」从左侧打开分组与筛选；「练习」展开配对、拼写、句子选择；「错题」从右侧打开。点空白、关闭按钮或 Esc 返回。小按钮保留至少 44 像素的触控区域。';
  const motionSetting = document.createElement('label');
  motionSetting.className = 'space-motion-setting';
  motionSetting.innerHTML = '<input id="space-motion-toggle" type="checkbox" checked> 动态星空';
  help.querySelector('.panel-heading').after(guide, motionSetting);
  for (const paragraph of help.querySelectorAll('p')) {
    if (paragraph.textContent.startsWith('学习词库：')) {
      paragraph.textContent = '用底部「词库」切换内置或自建词库，各词库独立保存星星和错题。';
    }
  }
  const previousLayout = classicLink.cloneNode(true);
  previousLayout.className = 'space-help-classic';
  help.querySelector('form').before(previousLayout);
  document.body.dataset.spatialReady='true';
})();
