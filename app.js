/* RepBot — Shared core
 * Loaded on every page. Owns state, storage, nav, header, menu, toast, rest timer.
 * Each page then has its own script that uses RB.* to read/write data.
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'repbot_v1';

  // ===== State (single source of truth, loaded from localStorage) =====
  let state = {
    workouts: [],
    current: null,
    plans: {},
    goals: [],
    settings: { unit: 'kg', restDefault: 90 }
  };

  let restTimer = { endsAt: 0, total: 0, interval: null };
  let toastTimeout = null;

  // ===== Persistence =====
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      showToast('Storage full — export CSV to back up');
    }
  }

  function load() {
    // Legacy migration for anyone on the old "lift_v1" key
    try {
      const legacy = localStorage.getItem('lift_v1');
      const existing = localStorage.getItem(STORAGE_KEY);
      if (legacy && !existing) localStorage.setItem(STORAGE_KEY, legacy);
    } catch (e) {}

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(state, parsed);
        state.settings = Object.assign({ unit: 'kg', restDefault: 90 }, parsed.settings || {});
      }
    } catch (e) {
      console.error('Failed to load state', e);
    }

    // Archive stale current workout (from a previous day)
    if (state.current && state.current.date !== todayKey()) {
      const hasData = state.current.exercises.some(ex =>
        ex.sets.some(s => s.weight > 0 && s.reps > 0)
      );
      if (hasData) {
        state.current.exercises.forEach(ex => {
          ex.sets = ex.sets.filter(s => s.weight > 0 && s.reps > 0);
        });
        state.current.exercises = state.current.exercises.filter(ex => ex.sets.length > 0);
        if (state.current.exercises.length > 0) state.workouts.push(state.current);
      }
      state.current = null;
    }

    // Clean up old plans
    const today = todayKey();
    Object.keys(state.plans).forEach(k => { if (k < today) delete state.plans[k]; });

    save();
  }

  // ===== Date utils =====
  function keyFromDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function todayKey() { return keyFromDate(new Date()); }
  function tomorrowKey() {
    const d = new Date(); d.setDate(d.getDate() + 1); return keyFromDate(d);
  }
  function formatDate(key) {
    const [y, m, d] = key.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  function formatShort(key) {
    const [y, m, d] = key.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ===== State helpers =====
  function ensureCurrent() {
    if (!state.current) state.current = { date: todayKey(), exercises: [] };
    return state.current;
  }
  function hasLoggedSets(workout) {
    return workout && workout.exercises.some(ex => ex.sets.some(s => s.weight > 0 && s.reps > 0));
  }
  function calcVolume(workout) {
    let total = 0;
    workout.exercises.forEach(ex => {
      ex.sets.forEach(s => { total += (s.weight || 0) * (s.reps || 0); });
    });
    return Math.round(total);
  }
  function calcStreak() {
    const dates = new Set(state.workouts.map(w => w.date));
    if (hasLoggedSets(state.current)) dates.add(state.current.date);
    if (dates.size === 0) return 0;
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      if (dates.has(keyFromDate(d))) streak++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  function weekWorkouts() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    let count = state.workouts.filter(w => new Date(w.date) >= weekAgo).length;
    if (hasLoggedSets(state.current)) count++;
    return count;
  }
  function totalVolume() {
    let total = 0;
    state.workouts.forEach(w => total += calcVolume(w));
    if (state.current) total += calcVolume(state.current);
    return total;
  }
  function last7DaysVolume() {
    const result = [];
    const today = new Date();
    const all = [...state.workouts];
    if (hasLoggedSets(state.current)) all.push(state.current);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = keyFromDate(d);
      const vol = all.filter(w => w.date === key).reduce((s, w) => s + calcVolume(w), 0);
      result.push({
        date: key,
        vol,
        label: d.toLocaleDateString(undefined, { weekday: 'short' })[0]
      });
    }
    return result;
  }
  function getPersonalBest(name) {
    let best = 0;
    state.workouts.forEach(w => {
      w.exercises.forEach(ex => {
        if (ex.name.toLowerCase() === name.toLowerCase()) {
          ex.sets.forEach(s => { if ((s.weight || 0) > best) best = s.weight; });
        }
      });
    });
    return best || null;
  }
  function getAllExerciseNames() {
    const names = new Set();
    state.workouts.forEach(w => w.exercises.forEach(ex => names.add(ex.name)));
    if (state.current) state.current.exercises.forEach(ex => names.add(ex.name));
    return Array.from(names).sort();
  }

  // ===== Unit helpers =====
  function displayWeight(kg) {
    if (!kg && kg !== 0) return '';
    if (state.settings.unit === 'lb') return Math.round(kg * 2.20462 * 10) / 10;
    return kg;
  }
  function inputToKg(val) {
    if (!val && val !== 0) return 0;
    const n = parseFloat(val);
    if (isNaN(n)) return 0;
    if (state.settings.unit === 'lb') return Math.round(n / 2.20462 * 100) / 100;
    return n;
  }
  function unitLabel() { return state.settings.unit; }

  // ===== CSV =====
  function exportCSV() {
    const rows = [['date','exercise','set','weight_kg','reps','volume_kg']];
    const all = [...state.workouts].sort((a,b) => a.date.localeCompare(b.date));
    all.forEach(w => {
      w.exercises.forEach(ex => {
        ex.sets.forEach((s, i) => {
          const weight = s.weight || 0;
          const reps = s.reps || 0;
          rows.push([w.date, ex.name, i + 1, weight, reps, Math.round(weight * reps)]);
        });
      });
    });
    const csv = rows.map(r => r.map(cell => {
      const str = String(cell);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repbot-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported ' + (rows.length - 1) + ' sets');
  }

  function importCSV(file, onDone) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return showToast('CSV is empty');
        const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const dateIdx = header.indexOf('date');
        const exIdx = header.indexOf('exercise');
        const weightIdx = findHeader(header, ['weight_kg', 'weight']);
        const repsIdx = header.indexOf('reps');
        if (dateIdx < 0 || exIdx < 0 || weightIdx < 0 || repsIdx < 0) {
          return showToast('CSV needs: date, exercise, weight, reps');
        }
        const byDate = {};
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          const date = cells[dateIdx];
          const name = cells[exIdx];
          const weight = parseFloat(cells[weightIdx]) || 0;
          const reps = parseInt(cells[repsIdx]) || 0;
          if (!date || !name || weight <= 0 || reps <= 0) continue;
          if (!byDate[date]) byDate[date] = {};
          if (!byDate[date][name]) byDate[date][name] = [];
          byDate[date][name].push({ weight, reps, done: true });
        }
        let count = 0;
        Object.keys(byDate).sort().forEach(date => {
          const exercises = Object.keys(byDate[date]).map(name => ({ name, sets: byDate[date][name] }));
          state.workouts.push({ date, exercises });
          count++;
        });
        save();
        showToast(`Imported ${count} workouts`);
        if (onDone) onDone();
      } catch (err) {
        console.error(err);
        showToast('Failed to read CSV');
      }
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur); cur = '';
      } else cur += c;
    }
    result.push(cur);
    return result;
  }
  function findHeader(header, candidates) {
    for (const c of candidates) {
      const i = header.indexOf(c);
      if (i >= 0) return i;
    }
    return -1;
  }

  // ===== Rest timer =====
  function startRest(seconds) {
    if (!seconds || seconds <= 0) return;
    const banner = $('#rest-banner');
    if (!banner) return;
    restTimer.total = seconds;
    restTimer.endsAt = Date.now() + seconds * 1000;
    banner.hidden = false;
    if (restTimer.interval) clearInterval(restTimer.interval);
    updateRestDisplay();
    restTimer.interval = setInterval(updateRestDisplay, 1000);
    if (navigator.vibrate) navigator.vibrate(20);
  }
  function updateRestDisplay() {
    const remaining = Math.max(0, Math.ceil((restTimer.endsAt - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const remEl = $('#rest-remaining');
    const barEl = $('#rest-progress-bar');
    if (remEl) remEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    if (barEl) barEl.style.width = Math.max(0, (remaining / restTimer.total) * 100) + '%';
    if (remaining <= 0) {
      stopRest();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  }
  function stopRest() {
    if (restTimer.interval) clearInterval(restTimer.interval);
    restTimer.interval = null;
    const banner = $('#rest-banner');
    if (banner) banner.hidden = true;
  }

  // ===== Toast =====
  function showToast(msg) {
    let toast = $('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.hidden = false;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  // ===== DOM utils =====
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function hexWithAlpha(color, alpha) {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ===== Header / Nav / Menu (shared chrome) =====
  function setupChrome(activeTab) {
    // Mark the active nav item
    $$('.nav-btn').forEach(link => {
      link.classList.toggle('nav-active', link.dataset.tab === activeTab);
      if (link.dataset.tab === activeTab) link.setAttribute('aria-current', 'page');
    });

    // Menu open/close
    const menuBtn = $('#menu-btn');
    const sheet = $('#menu-sheet');
    if (menuBtn && sheet) {
      menuBtn.addEventListener('click', () => {
        sheet.hidden = false;
        $$('[data-unit]').forEach(b => b.classList.toggle('seg-active', b.dataset.unit === state.settings.unit));
        const restSel = $('#rest-default');
        if (restSel) restSel.value = state.settings.restDefault;
      });
      document.addEventListener('click', (e) => {
        if (e.target.closest('[data-close-menu]')) sheet.hidden = true;
      });
    }

    // Unit toggle
    $$('[data-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.settings.unit = btn.dataset.unit;
        save();
        $$('[data-unit]').forEach(b => b.classList.toggle('seg-active', b === btn));
        // Notify page to re-render
        document.dispatchEvent(new CustomEvent('repbot:settings-changed'));
      });
    });

    // Rest timer default
    const restSel = $('#rest-default');
    if (restSel) {
      restSel.addEventListener('change', (e) => {
        state.settings.restDefault = parseInt(e.target.value) || 0;
        save();
      });
    }

    // Export / Import / Wipe
    const exportBtn = $('#export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      exportCSV();
      if (sheet) sheet.hidden = true;
    });
    const importBtn = $('#import-btn');
    const importFile = $('#import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          importCSV(e.target.files[0], () => {
            if (sheet) sheet.hidden = true;
            document.dispatchEvent(new CustomEvent('repbot:data-changed'));
          });
          e.target.value = '';
        }
      });
    }
    const wipeBtn = $('#wipe-btn');
    if (wipeBtn) wipeBtn.addEventListener('click', () => {
      if (confirm('Delete all workouts, plans, and goals? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        state = { workouts: [], current: null, plans: {}, goals: [], settings: state.settings };
        save();
        if (sheet) sheet.hidden = true;
        showToast('All data deleted');
        document.dispatchEvent(new CustomEvent('repbot:data-changed'));
      }
    });

    // Rest banner buttons
    const restAdd = $('#rest-add');
    const restSkip = $('#rest-skip');
    if (restAdd) restAdd.addEventListener('click', () => {
      restTimer.endsAt += 30000;
      restTimer.total += 30;
      updateRestDisplay();
    });
    if (restSkip) restSkip.addEventListener('click', stopRest);
  }

  // ===== Service worker =====
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  // ===== Public API =====
  const RB = {
    get state() { return state; },
    save,
    load,
    // dates
    todayKey, tomorrowKey, keyFromDate, formatDate, formatShort,
    // workout helpers
    ensureCurrent, hasLoggedSets, calcVolume, calcStreak, weekWorkouts,
    totalVolume, last7DaysVolume, getPersonalBest, getAllExerciseNames,
    // units
    displayWeight, inputToKg, unitLabel,
    // csv
    exportCSV, importCSV,
    // rest
    startRest, stopRest,
    // ui
    showToast, setupChrome, registerSW,
    // dom
    $, $$, cssVar, hexWithAlpha, escapeHtml
  };

  global.RB = RB;
})(window);
