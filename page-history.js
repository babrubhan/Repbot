/* page-history.js — History page */
(function() {
  'use strict';
  const { $, escapeHtml } = RB;

  function render() {
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
