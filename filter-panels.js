'use strict';

const filterDetails = {
  all: '显示当前范围内的全部词',
  new: '在此练习模式中还没做过的词',
  unmastered: '配对与拼写还没拿满两颗星',
  mastered: '配对与拼写都已拿到星星',
  wrong: '练习中曾经答错的词',
  mixed: '错词优先，同时复习未掌握的词'
};

const topicCounts = new Map([...groupsByTopic].map(([name, batches]) => [
  name, batches.reduce((count, batch) => count + batch.words.length, 0)
]));

function buildFilterPanel(select, title, detailForOption = () => '') {
  const label = select.labels[0];
  if (label?.contains(select)) {
    const field = document.createElement('div');
    field.className = label.className;
    label.className = '';
    label.replaceWith(field);
    field.append(label, select);
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-panel-control';
  const trigger = document.createElement('button');
  trigger.id = select.id + '-trigger';
  trigger.type = 'button';
  trigger.className = 'filter-panel-trigger';
  const selected = document.createElement('span');
  selected.id = trigger.id + '-value';
  const icon = document.createElement('span');
  icon.className = 'filter-panel-chevron';
  icon.setAttribute('aria-hidden', 'true');
  trigger.append(selected, icon);
  const panel = document.createElement('div');
  panel.id = select.id + '-panel';
  panel.className = 'filter-panel';
  panel.hidden = true;
  const heading = document.createElement('div');
  heading.id = panel.id + '-title';
  heading.className = 'filter-panel-title';
  heading.textContent = title;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-labelledby', heading.id);
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  if (label) {
    label.id = trigger.id + '-label';
    label.htmlFor = trigger.id;
    trigger.setAttribute('aria-labelledby', label.id + ' ' + selected.id);
  } else if (select.hasAttribute('aria-label')) {
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  }
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'filter-panel-search';
  search.placeholder = '搜索' + title;
  search.setAttribute('aria-label', search.placeholder);
  const options = document.createElement('div');
  options.className = 'filter-panel-options';
  panel.append(heading, search, options);
  wrapper.append(trigger, panel);
  select.after(wrapper);
  select.hidden = true;

  function sync() {
    const option = select.selectedOptions[0];
    selected.textContent = option?.label || '请选择';
    trigger.disabled = select.disabled || !select.options.length;
    if (!wrapper.getClientRects().length || trigger.disabled) close(false);
  }

  function close(restoreFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function placePanel() {
    const bounds = trigger.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 12;
    const above = bounds.top - 12;
    const opensUp = below < 260 && above > below;
    panel.classList.toggle('opens-up', opensUp);
    panel.style.setProperty('--panel-height', Math.max(120, Math.min(362, opensUp ? above : below)) + 'px');
  }

  function renderOptions() {
    const query = search.value.trim().toLocaleLowerCase();
    const rows = [];
    for (const option of select.options) {
      if (option.disabled || !option.label.toLocaleLowerCase().includes(query)) continue;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'filter-panel-option';
      row.setAttribute('aria-pressed', String(option.selected));
      const check = document.createElement('span');
      check.className = 'filter-panel-check';
      check.textContent = option.selected ? '✓' : '';
      check.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'filter-panel-option-text';
      const name = document.createElement('strong');
      name.textContent = option.label;
      text.append(name);
      const detail = detailForOption(option);
      if (detail) {
        const meta = document.createElement('small');
        meta.textContent = detail;
        text.append(meta);
      }
      row.append(check, text);
      row.addEventListener('click', () => {
        close(true);
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      rows.push(row);
    }
    if (rows.length) options.replaceChildren(...rows);
    else {
      const empty = document.createElement('p');
      empty.className = 'filter-panel-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = '没有找到匹配项';
      options.replaceChildren(empty);
    }
  }

  function open(useSearch = false) {
    search.value = '';
    search.hidden = select.options.length < 8;
    renderOptions();
    placePanel();
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (useSearch && !search.hidden) search.focus({ preventScroll: true });
    else {
      const current = options.querySelector('[aria-pressed="true"]') || options.firstElementChild;
      current?.focus({ preventScroll: true });
      if (current) options.scrollTop = current.offsetTop - options.offsetTop;
    }
  }

  search.addEventListener('input', renderOptions);
  trigger.addEventListener('click', event => {
    if (panel.hidden) open(event.detail === 0);
    else close(true);
  });
  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    const arrows = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    const onRow = event.target.classList.contains('filter-panel-option');
    const boundary = onRow && (event.key === 'Home' || event.key === 'End');
    if (!arrows && !boundary) return;
    event.preventDefault();
    if (panel.hidden) {
      open();
      return;
    }
    const rows = [...options.querySelectorAll('button')];
    const current = rows.indexOf(event.target);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
      : event.key === 'ArrowUp' ? (current < 0 ? rows.length - 1 : current - 1) : current + 1;
    if (index === -1 && !search.hidden) search.focus();
    else rows[Math.min(rows.length - 1, Math.max(index, 0))]?.focus();
  });
  wrapper.addEventListener('focusout', event => {
    if (!wrapper.contains(event.relatedTarget)) close(false);
  });
  document.addEventListener('pointerdown', event => {
    if (!wrapper.contains(event.target)) close(false);
  });
  window.addEventListener('resize', () => { if (!panel.hidden) placePanel(); });
  document.addEventListener('study-controls-updated', sync);
  select.addEventListener('change', sync);
  sync();
}

buildFilterPanel(byId('topic'), '主题范围', option => (topicCounts.get(option.value) ?? words.length).toLocaleString() + ' 词');
buildFilterPanel(byId('word-filter'), '练习筛选', option => filterDetails[option.value]);
buildFilterPanel(byId('deck-select'), '学习词库', option => option.value ? '自建词库' : '内置词库');
buildFilterPanel(byId('map-group'), '学习分组', option => {
  const group = studyGroups[Number(option.value)];
  return group ? group.words.length + ' 词' : '';
});

document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('personal-learning')) return;
  for (const [id, label] of [
    ['quick-type', '内容类型'], ['goal-setting', '每日目标'], ['match-size', '每轮配对数量'],
    ['lumen-intensity', '反馈强度'], ['lumen-quality', '光流与粒子']
  ]) {
    const select = byId(id);
    if (select) buildFilterPanel(select, label);
  }
});
