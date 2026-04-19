/* page-plan.js — Plan page */
(function() {
  'use strict';
  const { $, escapeHtml } = RB;

  function render() {
    $('#plan-date').textContent = RB.formatDate(RB.tomorrowKey());
    const plan = RB.state.plans[RB.tomorrowKey()] || [];
    const list = $('#plan-list');
    const empty = $('#plan-empty');
    list.innerHTML = '';

    if (plan.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      plan.forEach((name, idx) => {
        const row = document.createElement('div');
        row.className = 'plan-item';
        row.innerHTML = `
          <span class="plan-num">${idx + 1}</span>
          <span class="plan-name">${escapeHtml(name)}</span>
          <button class="plan-remove" data-plan-remove="${idx}">Remove</button>
        `;
        list.appendChild(row);
      });
    }

    const copyDiv = $('#copy-from-recent');
    const recent = [...RB.state.workouts].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
    if (recent.length === 0) {
      copyDiv.innerHTML = '';
    } else {
      copyDiv.innerHTML = `
        <div class="copy-header">Copy from recent workout</div>
        ${recent.map((w, i) => `
          <button class="copy-item" data-copy-idx="${i}">
            <span class="copy-date">${RB.formatShort(w.date)}</span>
            <span class="copy-exercises">${w.exercises.map(e => escapeHtml(e.name)).join(', ')}</span>
            <span class="copy-plus">+</span>
          </button>
        `).join('')}
      `;
    }
  }

  function addToPlan() {
    const input = $('#new-plan-exercise');
    const name = input.value.trim();
    if (!name) return;
    const key = RB.tomorrowKey();
    if (!RB.state.plans[key]) RB.state.plans[key] = [];
    RB.state.plans[key].push(name);
    input.value = '';
    RB.save();
    render();
  }

  function wire() {
    $('#add-plan-btn').addEventListener('click', addToPlan);
    $('#new-plan-exercise').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addToPlan();
    });
    $('#plan-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plan-remove]');
      if (!btn) return;
      const key = RB.tomorrowKey();
      RB.state.plans[key].splice(parseInt(btn.dataset.planRemove), 1);
      if (RB.state.plans[key].length === 0) delete RB.state.plans[key];
      RB.save();
      render();
    });
    $('#copy-from-recent').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy-idx]');
      if (!btn) return;
      const recent = [...RB.state.workouts].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
      const w = recent[parseInt(btn.dataset.copyIdx)];
      if (!w) return;
      const key = RB.tomorrowKey();
      if (!RB.state.plans[key]) RB.state.plans[key] = [];
      let added = 0;
      w.exercises.forEach(ex => {
        if (!RB.state.plans[key].includes(ex.name)) {
          RB.state.plans[key].push(ex.name);
          added++;
        }
      });
      RB.save();
      render();
      if (added > 0) RB.showToast(`Added ${added} exercises`);
    });

    document.addEventListener('repbot:data-changed', render);
  }

  function init() {
    RB.load();
    RB.setupChrome('plan');
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
