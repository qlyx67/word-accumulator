/* Static star texture, with compositor animations for the moving layers. */
(() => {
  'use strict';
  const scene = document.querySelector('.space-scene');
  if (!scene) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.getElementById('space-motion-toggle');
  const storageKey = 'word-accumulator.space-motion';
  const visual = document.createElement('div');
  visual.className = 'space-depth';
  visual.innerHTML = `
    <canvas class="space-star-map" width="1360" height="960"></canvas>
    <div class="space-twinkle"></div>
    <div class="space-black-hole"></div>
    <div class="space-horizon"></div>
    <div class="space-craft"><i></i></div>
    <div class="space-sparks"><i></i><i></i><i></i><i></i></div>`;
  scene.replaceChildren(visual);

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

  let enabled = true;
  try { enabled = localStorage.getItem(storageKey) !== 'off'; } catch {}
  if (motionToggle) motionToggle.checked = enabled;
  const craft = visual.querySelector('.space-craft');
  const sparks = visual.querySelector('.space-sparks');
  const particles = [...sparks.children];
  let flightTimer;
  let flightAnimation;
  let reaction;
  let sparkAnimations = [];
  let lastReaction = -Infinity;

  const running = () => enabled && !reducedMotion.matches && !document.hidden;
  function launch() {
    if (!running()) return;
    const fromLeft = Math.random() < .5;
    const startX = fromLeft ? -60 : innerWidth + 60;
    const endX = fromLeft ? innerWidth + 60 : -60;
    const startY = innerHeight * (.09 + Math.random() * .19);
    const endY = startY + 40 + Math.random() * 100;
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    const at = (x, y) => `translate3d(${x}px,${y}px,0) rotate(${angle}deg)`;
    craft.dataset.shape = Math.random() < .5 ? 'ship' : 'drop';
    const duration = 3900 + Math.random() * 4200;
    flightAnimation = craft.animate([
      { transform: at(startX, startY), opacity: 0 },
      { opacity: .74, offset: .17 },
      { opacity: .74, offset: .83 },
      { transform: at(endX, endY), opacity: 0 }
    ], { duration, easing: 'linear' });
    flightTimer = setTimeout(launch, duration + 9000 + Math.random() * 13000);
  }

  function syncMotion() {
    const active = running();
    scene.classList.toggle('space-animated', active);
    clearTimeout(flightTimer);
    flightAnimation?.cancel();
    reaction?.cancel();
    sparkAnimations.forEach(animation => animation.cancel());
    if (active) flightTimer = setTimeout(launch, 3800);
  }

  function respond(x, y, direction) {
    if (!running() || performance.now() - lastReaction < 115) return;
    lastReaction = performance.now();
    reaction?.cancel();
    // The moving scene and the button feedback each have a small travel range.
    reaction = visual.animate([
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(${direction * 7}px,-3px,0)`, offset: .27 },
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
  syncMotion();
})();
