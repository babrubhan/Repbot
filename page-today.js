/* page-today.js — Today page */
(function() {
  'use strict';
  const { $, $$, escapeHtml, cssVar, hexWithAlpha } = RB;

  let weeklyChart = null;
  let lastPRCheck = {};

  function render() {
    renderStats();
    renderPlanPrompt();
    renderExercises();
    renderWeeklyChart();
  }

  function renderStats() {
    $('#stat-workouts').textContent = RB.weekWorkouts();
    const unit = RB.unitLabel();
    const vol = Math.round(unit === 'lb' ? RB.totalVolume() * 2.20462 : RB.totalVolume());
    $('#stat-volume').textContent = vol.toLocaleString();
    $('#stat-volume-unit').textContent = unit + ' lifted';
    $('#stat-streak').textContent = RB.calcStreak();
    $('#today-date').textContent = RB.formatDate(RB.todayKey());
  }

  function renderPlanPrompt() {
    const prompt = $('#plan-prompt');
    const todayPlan = RB.state.plans[RB.todayKey()];
    const current = RB.state.current;
    const started = current && RB.hasLoggedSets(current);
    if (todayPlan && todayPlan.length > 0 && !started) {
      prompt.hidden = false;
      $('#plan-summary').textContent = todayPlan.join(' • ');
    } else {
      prompt.hidden = true;
    }
  }

  function renderExercises() {
    const current = RB.ensureCurrent();
    const list = $('#exercise-list');
    const empty = $('#empty-state');
    const finish = $('#finish-row');
    const suggestions = $('#exercise-suggestions');
    list.innerHTML = '';

    if (current.exercises.length === 0) {
      empty.hidden = false;
      finish.hidden = true;
      const names = RB.getAllExerciseNames().slice(0, 6);
      if (names.length > 0) {
        suggestions.hidden = false;
        suggestions.innerHTML = names.map(n =>
          `<button class="chip" data-suggest="${escapeHtml(n)}">${escapeHtml(n)}</button>`
        ).join('');
      } else {
        suggestions.hidden = true;
      }
      return;
    }

    empty.hidden = true;
    finish.hidden = false;
    suggestions.hidden = true;

    current.exercises.forEach((ex, exIdx) => {
      const card = document.createElement('div');
      card.className = 'ex-card';
      const pr = RB.getPersonalBest(ex.name);
      const prBadge = pr
        ? `<span class="ex-badge">PR ${Math.round(RB.displayWeight(pr))} ${RB.unitLabel()}</span>`
        : '';

      card.innerHTML = `
        <div class="ex-header">
          <div class="ex-name-row">
            <span class="ex-name">${escapeHtml(ex.name)}</span>
            ${prBadge}
          </div>
          <button class="ex-menu" data-action="remove-ex" data-idx="${exIdx}" aria-label="Remove exercise">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="set-rows" data-ex="${exIdx}"></div>
        <div class="set-actions">
          <button class="btn-ex-add" data-action="add-set" data-idx="${exIdx}">+ Add set</button>
        </div>
      `;

      const rows = card.querySelector('.set-rows');
      if (ex.sets.length === 0) {
        rows.innerHTML = '<div class="set-empty">No sets yet — add one to start</div>';
      } else {
        ex.sets.forEach((s, sIdx) => {
          const row = document.createElement('div');
          row.className = 'set-row';
          const weightVal = s.weight > 0 ? RB.displayWeight(s.weight) : '';
          row.innerHTML = `
            <span class="set-num">${sIdx + 1}</span>
            <input type="number" inputmode="decimal" placeholder="${RB.unitLabel()}" value="${weightVal}" data-field="weight" data-ex="${exIdx}" data-set="${sIdx}" />
            <input type="number" inputmode="numeric" placeholder="reps" value="${s.reps || ''}" data-field="reps" data-ex="${exIdx}" data-set="${sIdx}" />
            <button class="set-done ${s.done ? 'done' : ''}" data-action="toggle-done" data-ex="${exIdx}" data-set="${sIdx}" aria-label="Mark set complete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          `;
          rows.appendChild(row);
        });
      }

      list.appendChild(card);
    });
  }

  function renderWeeklyChart() {
    const data = RB.last7DaysVolume();
    const ctx = $('#weekly-chart');
    if (!ctx) return;
    if (weeklyChart) weeklyChart.destroy();

    const textColor = cssVar('--text-2') || '#888';
    const accent = cssVar('--accent') || '#6b5ce7';
    const accentSoft = hexWithAlpha(accent, 0.35);
    const unit = RB.unitLabel();
    const volumeData = data.map(d => unit === 'lb' ? Math.round(d.vol * 2.20462) : d.vol);

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: volumeData,
          backgroundColor: data.map((d, i) => i === data.length - 1 ? accent : accentSoft),
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => RB.formatDate(data[items[0].dataIndex].date),
              label: (item) => `${item.parsed.y.toLocaleString()} ${unit} volume`
            }
          }
        },
        scales: {
          y: { display: false, beginAtZero: true },
          x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false }, border: { display: false } }
        }
      }
    });
  }

  // ===== Interactions =====
  function addExercise() {
    const input = $('#new-exercise');
    const name = input.value.trim();
    if (!name) return;
    const current = RB.ensureCurrent();
    current.exercises.push({ name, sets: [{ weight: 0, reps: 0, done: false }] });
    input.value = '';
    RB.save();
    render();
  }

  function handleExerciseClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const exIdx = parseInt(btn.dataset.ex ?? btn.dataset.idx);
    const sIdx = parseInt(btn.dataset.set);
    const current = RB.state.current;
    if (!current) return;

    if (action === 'remove-ex') {
      if (current.exercises[exIdx].sets.some(s => s.weight > 0)) {
        if (!confirm('Remove this exercise and its sets?')) return;
      }
      current.exercises.splice(exIdx, 1);
      RB.save();
      render();
    } else if (action === 'add-set') {
      const ex = current.exercises[exIdx];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        weight: last && last.weight > 0 ? last.weight : 0,
        reps: last && last.reps > 0 ? last.reps : 0,
        done: false
      });
      RB.save();
      render();
    } else if (action === 'toggle-done') {
      const s = current.exercises[exIdx].sets[sIdx];
      if (!s.weight || !s.reps) {
        RB.showToast('Enter weight and reps first');
        return;
      }
      s.done = !s.done;
      RB.save();
      btn.classList.toggle('done', s.done);
      if (s.done) {
        const name = current.exercises[exIdx].name;
        const prevPR = lastPRCheck[name] !== undefined ? lastPRCheck[name] : (RB.getPersonalBest(name) || 0);
        if (s.weight > prevPR) {
          lastPRCheck[name] = s.weight;
          RB.showToast(`New PR on ${name}!`);
        }
        if (RB.state.settings.restDefault > 0) RB.startRest(RB.state.settings.restDefault);
        if (navigator.vibrate) navigator.vibrate(30);
      }
      renderStats();
      renderWeeklyChart();
    }
  }

  function handleExerciseInput(e) {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;
    const exIdx = parseInt(input.dataset.ex);
    const sIdx = parseInt(input.dataset.set);
    const field = input.dataset.field;
    const raw = input.value;
    const current = RB.state.current;
    if (!current) return;
    if (field === 'weight') {
      current.exercises[exIdx].sets[sIdx].weight = raw === '' ? 0 : RB.inputToKg(raw);
    } else {
      let val = 0;
      if (raw !== '') {
        val = parseFloat(raw);
        if (isNaN(val)) val = 0;
      }
      current.exercises[exIdx].sets[sIdx][field] = val;
    }
    RB.save();
    renderStats();
    renderWeeklyChart();
  }

  function finishWorkout() {
    const current = RB.state.current;
    if (!current || current.exercises.length === 0) return;
    if (!RB.hasLoggedSets(current)) {
      RB.showToast('Log at least one set first');
      return;
    }
    current.exercises.forEach(ex => {
      ex.sets = ex.sets.filter(s => s.weight > 0 && s.reps > 0);
    });
    current.exercises = current.exercises.filter(ex => ex.sets.length > 0);
    if (current.exercises.length === 0) {
      RB.state.current = null;
      RB.save();
      render();
      return;
    }
    const vol = RB.calcVolume(current);
    const unit = RB.unitLabel();
    const volDisplay = unit === 'lb' ? Math.round(vol * 2.20462) : vol;
    RB.state.workouts.push(current);
    RB.state.current = null;
    RB.stopRest();
    RB.save();
    RB.showToast(`Workout saved — ${volDisplay.toLocaleString()} ${unit} lifted`);
    if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
    setTimeout(() => { window.location.href = 'history.html'; }, 600);
  }

  function wire() {
    $('#add-exercise-btn').addEventListener('click', addExercise);
    $('#new-exercise').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addExercise();
    });
    $('#exercise-suggestions').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-suggest]');
      if (!btn) return;
      $('#new-exercise').value = btn.dataset.suggest;
      addExercise();
    });
    $('#load-plan-btn').addEventListener('click', () => {
      const plan = RB.state.plans[RB.todayKey()] || [];
      if (plan.length === 0) return;
      const current = RB.ensureCurrent();
      let added = 0;
      plan.forEach(name => {
        if (!current.exercises.some(ex => ex.name.toLowerCase() === name.toLowerCase())) {
          current.exercises.push({ name, sets: [{ weight: 0, reps: 0, done: false }] });
          added++;
        }
      });
      delete RB.state.plans[RB.todayKey()];
      RB.save();
      render();
      if (navigator.vibrate) navigator.vibrate(30);
      RB.showToast(`Loaded ${added} exercises`);
    });
    $('#exercise-list').addEventListener('click', handleExerciseClick);
    $('#exercise-list').addEventListener('input', handleExerciseInput);
    $('#finish-workout-btn').addEventListener('click', finishWorkout);

    document.addEventListener('repbot:settings-changed', render);
    document.addEventListener('repbot:data-changed', render);
  }

  function init() {
    RB.load();
    RB.setupChrome('today');
    RB.registerSW();
    wire();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
