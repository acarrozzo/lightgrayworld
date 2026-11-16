// Light Gray Mini: the save. One slot, in this browser only. Nothing here is
// tied to a Light Gray RPG account.

import { newPlayer } from './rules.js';

// ?slot=name keeps a separate save, so a test run never touches the real one.
const slot = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('slot') : null;
const KEY = `lgmini.save.v1${slot ? `.${slot}` : ''}`;
const PREFS = 'lgmini.prefs.v1';

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    // A save from an older build may be missing newer fields.
    return { ...newPlayer(), ...data, gear: { ...newPlayer().gear, ...(data.gear || {}) } };
  } catch {
    return null;
  }
}

export function saveGame(player) {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch { return {}; }
}

export function savePrefs(prefs) {
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* play on without it */ }
}
