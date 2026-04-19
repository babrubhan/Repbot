/* page-goals.js — Goals page */
(function() {
  'use strict';
  const { $, escapeHtml } = RB;

  function render() {
    const list = $('#goals-list');
    list.innerHTML = '';
    if (RB.state.goals.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No goals yet</div>
          <div class="empty-body">Set a target weight and watch your progress fill in automatically.</div>
        </div>`;
      return;
    }
    const unit = RB.unitLabel();
    RB.state.goals.forEach((goal, idx) => {
      const pr = RB.getPersonalBest(goal.name) || 0;
      const pct = Math.min(100, Math.round((pr / goal.target) * 100));
      const achieved = pr >= goal.target;
      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML = `
        <div class="goal-header">
          <div class="goal-name-row">
            <span class="goal-name">${escapeHtml(goal.name)}</span>
            ${achieved ? '<span class="badge badge-success">Achieved</span>' : ''}
          </div>
          <button class="history-delete" data-goal-remove="${idx}" aria-label="Remove goal">Remove</button>
        </div>
        <div class="goal-values">
          <span>${Math.round(RB.displayWeight(pr))} ${unit}</span>
          <span>${Math.round(RB.displayWeight(goal.target))} ${unit}</span>
        </div>
        <div class="goal-bar">
          <div class="goal-fill ${achieved ? 'achieved' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="goal-pct">${pct}% complete</div>
      `;
      list.appendChild(card);
    });
  }

  function addGoal() {
    const name = $('#goal-name').value.trim();
    const target = parseFloat($('#goal-target').value);
    if (!name || !target || target <= 0) {
      RB.showToast('Enter exercise and target');
      return;
    }
    RB.state.goals.push({ name, target: RB.inputToKg(target) });
    $('#goal-name').value = '';
    $('#goal-target').value = '';
    RB.save();
    render();
    RB.showToast('Goal added');
  }

  function wire() {
    $('#add-goal-btn').addEventListener('click', addGoal);
    $('#goal-target').addEventListener('keydown', (e) => { if (e.key === 'Enter') addGoal(); });
    $('#goal-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#goal-target').focus(); });
    $('#goals-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-goal-remove]');
      if (!btn) return;
      RB.state.goals.splice(parseInt(btn.dataset.goalRemove), 1);
      RB.save();
      render();
    });
    document.addEventListener('repbot:settings-changed', render);
    document.addEventListener('repbot:data-changed', render);
  }

  function init() {
    RB.load();
    RB.setupChrome('goals');
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
