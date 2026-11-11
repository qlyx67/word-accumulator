/* Static star texture, with compositor animations for the moving layers. */
(() => {
  'use strict';
  const scene = document.querySelector('.space-scene');
  if (!scene) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.getElementById('space-motion-toggle');
  const storageKey = 'word-accumulator.space-motion';
  const worlds = {
    study: 'gargantua-soft.webp',
    browse: 'world-ice.webp',
    match: 'world-rings.webp',
    spell: 'world-star.webp',
    quiz: 'world-ocean.webp',
    mistakes: 'world-ocean.webp'
  };
  const panelWorlds = { library: 'browse', practice: 'match', mistakes: 'mistakes', info: 'quiz' };
  const visual = document.createElement('div');
  visual.className = 'space-depth';
  visual.innerHTML = `
    <div class="space-lens">
      <canvas class="space-star-map" width="1360" height="960"></canvas>
      <div class="space-twinkle"></div>
      <canvas class="space-streaks" width="800" height="540"></canvas>
    </div>
    <div class="space-horizon"></div>
    <div class="space-worlds"></div>
    <div class="space-craft"><i></i><b></b></div>
    <div class="space-sparks"><i></i><i></i><i></i><i></i></div>`;
  scene.replaceChildren(visual);
  const worldContainer = visual.querySelector('.space-worlds');
  const worldLayers = new Map(Object.entries(worlds).map(([name, src]) => {
    const layer = document.createElement('div');
    layer.className = 'space-world';
    layer.dataset.world = name;
    const image = new Image();
    image.src = src;
    image.alt = '';
    image.decoding = 'async';
    layer.append(image);
    worldContainer.append(layer);
    return [name, layer];
  }));

  // This texture is painted once, at a bounded size on phones and desktops.
  const canvas = visual.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    let seed = 761;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const { width, height } = canvas;
    for (let i = 0; i < 260; i++) {
      const x = random() * width;
      const y = random() * height;
      const bright = random();
      const radius = .32 + bright ** 3 * 1.35;
      context.fillStyle = `rgba(201, 218, 255, ${.14 + bright * .56})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    const constellations = [
      [[.045, .23], [.081, .28], [.122, .264], [.16, .318], [.206, .282]],
      [[.78, .66], [.823, .604], [.871, .618], [.911, .552], [.956, .573]]
    ];
    for (const points of constellations) {
      context.beginPath();
      points.forEach(([x, y], i) => i ? context.lineTo(x * width, y * height) : context.moveTo(x * width, y * height));
      context.strokeStyle = 'rgba(149, 182, 234, .25)';
      context.stroke();
      for (const [x, y] of points) {
        context.fillStyle = '#b8d5f3';
        context.beginPath();
        context.arc(x * width, y * height, 1.5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  const streaks = visual.querySelector('.space-streaks');
  const rays = streaks.getContext('2d');
  if (rays) {
    const { width, height } = streaks;
    for (let i = 0; i < 42; i++) {
      const angle = i * 2.39996;
      const radius = 108 + ((i * 47) % 325);
      const length = 18 + ((i * 17) % 72);
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      const startX = width / 2 + cx * radius;
      const startY = height * .46 + cy * radius;
      const endX = startX + cx * length;
      const endY = startY + cy * length;
      const gradient = rays.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, 'rgba(181,209,255,0)');
      gradient.addColorStop(1, i % 5 ? 'rgba(181,209,255,.52)' : 'rgba(246,229,201,.82)');
      rays.strokeStyle = gradient;
      rays.lineWidth = i % 5 ? .9 : 1.5;
      rays.beginPath();
      rays.moveTo(startX, startY);
      rays.lineTo(endX, endY);
      rays.stroke();
    }
  }

  let enabled = true;
  try { enabled = localStorage.getItem(storageKey) !== 'off'; } catch {}
  if (motionToggle) motionToggle.checked = enabled;
  const craft = visual.querySelector('.space-craft');
  const sparks = visual.querySelector('.space-sparks');
  const particles = [...sparks.children];
  let flightTimer;
  let flightAnimation;
  let reaction;
  let cameraAnimations = [];
  let activeWorld;
  let craftOrder = [];
  const lens = visual.querySelector('.space-lens');
  let sparkAnimations = [];
  let lastReaction = -Infinity;

  const running = () => enabled && !reducedMotion.matches && !document.hidden;
  function syncWorld() {
    const destination = panelWorlds[document.body.dataset.spaceDestination] || document.body.dataset.mode;
    const next = worldLayers.has(destination) ? destination : 'study';
    if (next === activeWorld) return;
    const previous = worldLayers.get(activeWorld);
    const incoming = worldLayers.get(next);
    const previousOpacity = previous ? getComputedStyle(previous).opacity : 0;
    const previousTransform = previous ? getComputedStyle(previous).transform : 'none';
    cameraAnimations.forEach(animation => animation.cancel());
    cameraAnimations = [];
    if (previous) previous.classList.remove('world-visible');
    incoming.classList.add('world-visible');
    scene.dataset.world = next;
    document.body.dataset.activeWorld = next;
    activeWorld = next;
    if (!previous || !running()) return;

    const direction = next === 'study' || next === 'mistakes' ? -1 : 1;
    cameraAnimations = [
      previous.animate([
        { opacity: previousOpacity, transform: previousTransform },
        { opacity: 0, transform: `translate3d(${-direction * 55}px,14px,0) scale(1.4)` }
      ], { duration: 430, easing: 'cubic-bezier(.45,0,.65,1)' }),
      incoming.animate([
        { opacity: 0, transform: `translate3d(${direction * 100}px,-30px,0) scale(.42)` },
        { opacity: .86, transform: 'translate3d(0,0,0) scale(1.08)', offset: .76 },
        { opacity: 1, transform: 'none' }
      ], { duration: 740, easing: 'cubic-bezier(.18,.72,.21,1)' }),
      lens.animate([
        { transform: 'none' },
        { transform: `translate3d(${-direction * 24}px,10px,0) scale(1.21)`, offset: .47 },
        { transform: 'none' }
      ], { duration: 720, easing: 'cubic-bezier(.22,.61,.36,1)' }),
      streaks.animate([
        { opacity: 0, transform: 'scale(.8)' },
        { opacity: .52, transform: 'scale(1.17)', offset: .36 },
        { opacity: 0, transform: 'scale(1.58)' }
      ], { duration: 620, easing: 'cubic-bezier(.2,.65,.4,1)' })
    ];
  }

  function launch() {
    if (!running()) return;
    const fromLeft = Math.random() < .5;
    const startX = fromLeft ? -84 : innerWidth + 84;
    const endX = fromLeft ? innerWidth + 84 : -84;
    const startY = innerHeight * (.09 + Math.random() * .19);
    const endY = startY + 40 + Math.random() * 100;
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    const at = (x, y) => `translate3d(${x}px,${y}px,0) rotate(${angle}deg)`;
    if (!craftOrder.length) {
      craftOrder = ['drop', 'station', 'ship'];
      for (let i = craftOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [craftOrder[i], craftOrder[j]] = [craftOrder[j], craftOrder[i]];
      }
    }
    const shape = craftOrder.pop();
    craft.dataset.shape = shape;
    const duration = { drop: 4400, station: 9700, ship: 6300 }[shape] + Math.random() * 2200;
    flightAnimation = craft.animate([
      { transform: at(startX, startY), opacity: 0 },
      { opacity: .84, offset: .13 },
      { opacity: .84, offset: .88 },
      { transform: at(endX, endY), opacity: 0 }
    ], { duration, easing: 'linear' });
    flightTimer = setTimeout(launch, duration + 4700 + Math.random() * 7800);
  }

  function syncMotion() {
    const active = running();
    scene.classList.toggle('space-animated', active);
    clearTimeout(flightTimer);
    flightAnimation?.cancel();
    reaction?.cancel();
    cameraAnimations.forEach(animation => animation.cancel());
    sparkAnimations.forEach(animation => animation.cancel());
    if (active) flightTimer = setTimeout(launch, 2700);
  }

  function respond(x, y, direction) {
    if (!running() || performance.now() - lastReaction < 115) return;
    lastReaction = performance.now();
    reaction?.cancel();
    // The moving scene and the button feedback each have a small travel range.
    reaction = visual.animate([
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(${direction * 10}px,-5px,0)`, offset: .27 },
      { transform: 'translate3d(0,0,0)' }
    ], { duration: 620, easing: 'cubic-bezier(.18,.7,.3,1)' });
    sparkAnimations.forEach(animation => animation.cancel());
    sparks.style.transform = `translate3d(${x}px,${y}px,0)`;
    sparkAnimations = particles.map((particle, i) => {
      const angle = i * Math.PI / 2 + .53;
      const distance = 18 + i * 6;
      const move = `translate3d(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance}px,0)`;
      return particle.animate([
        { transform: 'scale(.6)', opacity: .64 },
        { transform: move + ' scale(.2)', opacity: 0 }
      ], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
  }

  document.addEventListener('click', event => {
    if (!running()) return;
    const button = event.target.closest('button:not(:disabled)');
    if (!button || button.matches('[data-rating]')) return;
    const rect = event.detail === 0 ? button.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : event.clientX;
    const y = rect ? rect.top + rect.height / 2 : event.clientY;
    respond(x, y, x < innerWidth / 2 ? 1 : -1);
  });
  document.addEventListener('study-card-rated', event => {
    respond(innerWidth / 2 + event.detail * Math.min(155, innerWidth / 3), innerHeight * .38, event.detail);
  });
  motionToggle?.addEventListener('change', () => {
    enabled = motionToggle.checked;
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch {}
    syncMotion();
  });
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  syncWorld();
  new MutationObserver(syncWorld).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-space-destination']
  });
  syncMotion();
})();
