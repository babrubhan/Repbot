/* page-history.js — History page */
(function() {
  'use strict';
  const { $, escapeHtml } = RB;

  function renderPlanPrompt() {
    const prompt = $('#plan-prompt');
    if (!prompt) return;
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

  function render() {
    renderPlanPrompt();
    renderList();
  }

  function renderList() {
    const list = $('#history-list');
    const all = [...RB.state.workouts].sort((a,b) => b.date.localeCompare(a.date));
    if (all.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No workouts yet</div>
          <div class="empty-body">Completed workouts will appear here.</div>
        </div>`;
      return;
    }
    const unit = RB.unitLabel();
    list.innerHTML = '';
    all.forEach((w, idx) => {
      const vol = RB.calcVolume(w);
      const volDisplay = unit === 'lb' ? Math.round(vol * 2.20462) : vol;
      const exCount = w.exercises.length;
      const setCount = w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
      const exList = w.exercises.map(ex => {
        const sets = ex.sets.map(s => `${Math.round(RB.displayWeight(s.weight || 0))}×${s.reps || 0}`).join(', ');
        return `<div class="history-ex"><span class="history-ex-name">${escapeHtml(ex.name)}</span> — ${sets || 'no sets'}</div>`;
      }).join('');
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-header">
          <span class="history-date">${RB.formatDate(w.date)}</span>
          <button class="history-delete" data-history-delete="${idx}">Delete</button>
        </div>
        <div class="history-stats">${exCount} exercises • ${setCount} sets • ${volDisplay.toLocaleString()} ${unit} volume</div>
        ${exList}
      `;
      list.appendChild(card);
    });
  }

  function wire() {
    $('#history-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-history-delete]');
      if (!btn) return;
      if (!confirm('Delete this workout?')) return;
      const sorted = [...RB.state.workouts].sort((a,b) => b.date.localeCompare(a.date));
      const toDelete = sorted[parseInt(btn.dataset.historyDelete)];
      RB.state.workouts = RB.state.workouts.filter(w => w !== toDelete);
      RB.save();
      render();
    });

    // Load plan — adds planned exercises to today and redirects to Today page
    const loadBtn = $('#load-plan-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
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
        if (navigator.vibrate) navigator.vibrate(30);
        RB.showToast(`Loaded ${added} exercises`);
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
      });
    }

    document.addEventListener('repbot:settings-changed', render);
    document.addEventListener('repbot:data-changed', render);
  }

  function init() {
    RB.load();
    RB.setupChrome('history');
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
