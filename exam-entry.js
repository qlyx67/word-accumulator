/* Open both tools inside the main app, under its existing navigation. */
(() => {
  const host = document.getElementById('vocabulary-workspace');
  const home = document.getElementById('learning-home');
  if (!host || !home) return;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'pack-launch';
  card.dataset.view = 'packs';
  card.innerHTML = '<span><strong>学习包</strong><small>从词库选组，练填空、听写和翻译。</small></span><span aria-hidden="true">↗</span>';
  home.querySelector('.home-grid')?.after(card);
  document.dispatchEvent(new Event('studio-layout-changed'));

  let controller;
  function prepare() {
    if (controller) return controller;
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    const template = document.getElementById('vocabulary-template');
    const links = ['exam.css?v=welcome3', 'exam-workspace.css?v=2.3.0'].map(href => {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = href;
      return style;
    });
    root.replaceChildren(...links, template.content.cloneNode(true));
    controller = StudyPackWorkspace(root);
    return controller;
  }

  async function update() {
    const view = document.body.dataset.view;
    if (view !== 'materials' && view !== 'packs') {
      controller?.leave();
      return;
    }
    try {
      await prepare().open(view);
    } catch (error) {
      console.error(error);
      const retry = document.createElement('button');
      retry.textContent = '重新加载';
      retry.onclick = update;
      (host.shadowRoot || host).replaceChildren(document.createTextNode('学习区暂时无法打开。 '), retry);
    }
  }
  document.addEventListener('studio-view-changed', update);
  update();
})();
