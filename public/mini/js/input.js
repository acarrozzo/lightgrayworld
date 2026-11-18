// Light Gray Mini: one input state for keyboard and touch.
// Buttons, laid out like a 16-bit pad: a (swing / talk / confirm), b (ranged /
// back), y (spell), x (use the chosen item), start (menu), map. `held` is the live state; `pressed` is true for the one
// update after a button goes down.

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', Space: 'a',
  KeyX: 'b', KeyK: 'b',
  KeyC: 'y', KeyL: 'y',
  KeyV: 'x', Semicolon: 'x',
  Enter: 'start', Escape: 'start', KeyI: 'start',
  Tab: 'map', KeyQ: 'map',
  KeyM: 'mute',
};

const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'start', 'map', 'mute'];

export const held = Object.fromEntries(BUTTONS.map((b) => [b, false]));
export const pressed = Object.fromEntries(BUTTONS.map((b) => [b, false]));
const queued = Object.fromEntries(BUTTONS.map((b) => [b, false]));

// What a button is called depends on what you are holding. On a keyboard the
// sword is Z, so the game says Z; on the touch pad it is A, so it says A.
const NAMES = {
  keys: { a: 'Z', b: 'X', y: 'C', x: 'V', start: 'Enter', map: 'Tab', back: 'Esc', move: 'The arrows move you.' },
  touch: { a: 'A', b: 'B', y: 'Y', x: 'X', start: 'START', map: 'MAP', back: 'B', move: 'The pad moves you.' },
};
let device = 'keys';

export function setDevice(name) {
  if (NAMES[name]) device = name;
}

export function currentDevice() {
  return device;
}

/** The name on the button that does `button`: label('a') is 'Z' or 'A'. */
export function label(button) {
  return NAMES[device][button] || button;
}

/** Fill {a}, {b}, {x}, {y}, {start}, {map}, {back} and {move} in a line of text. */
export function withKeys(text) {
  return String(text).replace(/\{(a|b|x|y|start|map|back|move)\}/g, (_, k) => label(k));
}

let onFirstGesture = null;
let gestured = false;

function gesture() {
  if (gestured) return;
  gestured = true;
  if (onFirstGesture) onFirstGesture();
}

function setButton(name, down) {
  if (down && !held[name]) queued[name] = true;
  held[name] = down;
}

/** Call once per fixed update, before game logic reads `pressed`. */
export function pollInput() {
  for (const b of BUTTONS) {
    pressed[b] = queued[b];
    queued[b] = false;
  }
}

export function clearInput() {
  for (const b of BUTTONS) { held[b] = false; pressed[b] = false; queued[b] = false; }
}

/** The direction the player is pushing, as -1/0/1 on each axis. */
export function axis() {
  return {
    x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
    y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
  };
}

export function initInput({ firstGesture } = {}) {
  onFirstGesture = firstGesture || null;

  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (!name) return;
    e.preventDefault();
    gesture();
    device = 'keys';
    if (!e.repeat) setButton(name, true);
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (!name) return;
    e.preventDefault();
    setButton(name, false);
  });
  window.addEventListener('blur', clearInput);

  initTouch();
}

// ------------------------------------------------------------------- touch

function initTouch() {
  const pad = document.getElementById('dpad');
  const showTouch = () => { document.body.classList.add('touch'); device = 'touch'; };
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) showTouch();
  window.addEventListener('touchstart', showTouch, { once: true, passive: true });

  if (pad) {
    let active = null;
    const read = (e) => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const dead = 0.22;
      // Eight directions: an axis counts once it passes the dead zone and is at
      // least 40% as strong as the other one.
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const useX = ax > dead && ax > ay * 0.4;
      const useY = ay > dead && ay > ax * 0.4;
      setButton('left', useX && dx < 0);
      setButton('right', useX && dx > 0);
      setButton('up', useY && dy < 0);
      setButton('down', useY && dy > 0);
      pad.dataset.dir = `${useX ? (dx < 0 ? 'l' : 'r') : ''}${useY ? (dy < 0 ? 'u' : 'd') : ''}`;
    };
    const release = () => {
      active = null;
      for (const b of ['left', 'right', 'up', 'down']) setButton(b, false);
      pad.dataset.dir = '';
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      gesture();
      device = 'touch';
      active = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      read(e);
    });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === active) read(e); });
    pad.addEventListener('pointerup', (e) => { if (e.pointerId === active) release(); });
    pad.addEventListener('pointercancel', (e) => { if (e.pointerId === active) release(); });
  }

  for (const el of document.querySelectorAll('[data-btn]')) {
    const name = el.dataset.btn;
    const down = (e) => {
      e.preventDefault();
      gesture();
      device = 'touch';
      el.classList.add('down');
      setButton(name, true);
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove('down');
      setButton(name, false);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
