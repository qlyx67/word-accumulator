const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../star-study.js'), 'utf8');
const code = source.slice(source.indexOf('function swipeTransform'), source.indexOf("document.addEventListener('visibilitychange'"));

function harness() {
  const handlers = new Map();
  const face = {
    style: {},
    clientWidth: 350,
    classList: { add() {}, remove() {} },
    setPointerCapture() { this.captured = true; },
    hasPointerCapture() { return this.captured; },
    releasePointerCapture() { this.captured = false; },
    addEventListener(name, handler) { handlers.set(name, handler); }
  };
  const flipButton = { closest() { return null; } };
  const ratings = [];
  const verdict = { textContent: '', dataset: {} };
  const ctx = vm.createContext({
    studyFace: face, studyWord: { term: 'alpha' }, studyBusy: false, flightMode: 'swipe',
    gesture: null, gestureFrame: 0, swallowClick: false, settleAnimation: undefined,
    swipeVerdict: verdict, reduceMotion: { matches: true },
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    rateStudy(value) { ratings.push(value); }
  });
  vm.runInContext(code, ctx);

  const send = (type, x, y, time, target = flipButton) => handlers.get(type)({
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
    clientX: x, clientY: y, timeStamp: time, target
  });
  return { send, ratings, face, flipButton };
}

// A touch starts on the word button. Its implicit capture is transferred
// to the card, emitting a bubbling lostpointercapture from the button.
let h = harness();
h.send('pointerdown', 100, 50, 0);
h.send('pointermove', 116, 55, 20);
h.send('lostpointercapture', 116, 55, 21);
h.send('pointermove', 156, 63, 75);
h.send('pointerup', 156, 63, 92);
assert.deepEqual(h.ratings, [3], 'child capture loss must not cancel a right swipe');

h = harness();
h.send('pointerdown', 100, 50, 0);
h.send('pointermove', 75, 48, 40);
h.send('pointerup', 73, 48, 52);
assert.deepEqual(h.ratings, [1], 'short fast left flick advances the card');

h = harness();
h.send('pointerdown', 100, 50, 0);
h.send('pointermove', 126, 52, 160);
h.send('pointerup', 126, 52, 220);
assert.deepEqual(h.ratings, [], 'short slow drag returns without rating');

h = harness();
h.send('pointerdown', 100, 50, 0);
h.send('pointermove', 106, 70, 20);
h.send('pointerup', 180, 120, 95);
assert.deepEqual(h.ratings, [], 'vertical scroll does not rate a card');

h = harness();
h.send('pointerdown', 100, 50, 0);
h.send('pointermove', 160, 51, 40);
h.send('lostpointercapture', 160, 51, 45, h.face);
h.send('pointerup', 170, 52, 50);
assert.deepEqual(h.ratings, [], 'actual card capture loss cancels the gesture');
console.log('PASS: touch capture transfer, short flick, snap-back, vertical scroll and actual capture loss');
