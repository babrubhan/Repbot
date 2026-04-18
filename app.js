/* Lift — Simple gym tracker
 * State lives in localStorage. No server, no account.
 */

(function() {
  'use strict';

  // ===== State =====
  const STORAGE_KEY = 'lift_v1';
  let state = {
    workouts: [],      // [{date, exercises: [{name, sets: [{weight, reps, done}]}]}]
    current: null,     // {date, exercises: [...]}
    plans: {},         // {dateKey: [exerciseName]}
    goals: [],         // [{name, target}]
    settings: {
      unit: 'kg',
      restDefault: 90
    }
  };

  let charts = { weekly: null, progress: null };
  let restTimer = { endsAt: 0, total: 0, interval: null };
  let lastPRCheck = {}; // exerciseName -> last known PR, to detect new ones

  // ===== Persistence =====
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      showToast('Storage full — export CSV to save');
    }
  }

  function load() {
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
      if (state.current.exercises.length > 0) {
        // Only archive if it has at least one completed set
        const hasData = state.current.exercises.some(ex =>
          ex.sets.some(s => s.weight > 0 && s.reps > 0)
        );
        if (hasData) {
          // Clean empty sets before archiving
          state.current.exercises.forEach(ex => {
            ex.sets = ex.sets.filter(s => s.weight > 0 && s.reps > 0);
          });
          state.current.exercises = state.current.exercises.filter(ex => ex.sets.length > 0);
          if (state.current.exercises.length > 0) {
            state.workouts.push(state.current);
          }
        }
      }
      state.current = null;
    }

    // Clean up old plans (before today)
    const today = todayKey();
    Object.keys(state.plans).forEach(k => {
      if (k < today) delete state.plans[k];
    });

    // Seed PR tracking
    getAllExerciseNames().forEach(name => {
      lastPRCheck[name] = getPersonalBest(name) || 0;
    });

    save();
  }

  // ===== Date utils =====
  function keyFromDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function todayKey() { return keyFromDate(new Date()); }
  function tomorrowKey() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return keyFromDate(d);
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

  // ===== Current workout helpers =====
  function ensureCurrent() {
    if (!state.current) state.current = { date: todayKey(), exercises: [] };
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
    if (state.current && hasLoggedSets(state.current)) dates.add(state.current.date);
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

  function hasLoggedSets(workout) {
    return workout.exercises.some(ex => ex.sets.some(s => s.weight > 0 && s.reps > 0));
  }

  function weekWorkouts() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    let count = state.workouts.filter(w => new Date(w.date) >= weekAgo).length;
    if (state.current && hasLoggedSets(state.current)) count++;
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
    if (state.current && hasLoggedSets(state.current)) all.push(state.current);
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

  // ===== Unit conversion =====
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

  // ===== Render ===== 
  function render() {
    renderStats();
    renderPlanPrompt();
    renderToday();
    renderWeeklyChart();
    renderPlan();
    renderProgress();
    renderGoals();
    renderHistory();
  }

  function renderStats() {
    $('#stat-workouts').textContent = weekWorkouts();
    const vol = Math.round(state.settings.unit === 'lb' ? totalVolume() * 2.20462 : totalVolume());
    $('#stat-volume').textContent = vol.toLocaleString();
    $('#stat-volume-unit').textContent = unitLabel() + ' lifted';
    $('#stat-streak').textContent = calcStreak();
    $('#today-date').textContent = formatDate(todayKey());
  }

  function renderPlanPrompt() {
    const prompt = $('#plan-prompt');
    const todayPlan = state.plans[todayKey()];
    const started = state.current && hasLoggedSets(state.current);

    if (todayPlan && todayPlan.length > 0 && !started) {
      prompt.hidden = false;
      $('#plan-summary').textContent = todayPlan.join(' • ');
    } else {
      prompt.hidden = true;
    }
  }

  function renderToday() {
    ensureCurrent();
    const list = $('#exercise-list');
    const empty = $('#empty-state');
    const finish = $('#finish-row');
    const suggestions = $('#exercise-suggestions');
    list.innerHTML = '';

    if (state.current.exercises.length === 0) {
      empty.hidden = false;
      finish.hidden = true;
      // Show recent exercises as quick suggestions
      const names = getAllExerciseNames().slice(0, 6);
      if (names.length > 0) {
        suggestions.hidden = false;
        suggestions.innerHTML = names.map(n =>
          `<button class="chip" data-suggest="${escapeAttr(n)}">${escapeHtml(n)}</button>`
        ).join('');
      } else {
        suggestions.hidden = true;
        suggestions.innerHTML = '';
      }
      return;
    }

    empty.hidden = true;
    finish.hidden = false;
    suggestions.hidden = true;

    state.current.exercises.forEach((ex, exIdx) => {
      const card = document.createElement('div');
      card.className = 'ex-card';
      card.dataset.exIdx = exIdx;

      const pr = getPersonalBest(ex.name);
      const prBadgeHtml = pr
        ? `<span class="ex-badge">PR ${Math.round(displayWeight(pr))} ${unitLabel()}</span>`
        : '';

      card.innerHTML = `
        <div class="ex-header">
          <div class="ex-name-row">
            <span class="ex-name">${escapeHtml(ex.name)}</span>
            ${prBadgeHtml}
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
          const weightVal = s.weight > 0 ? displayWeight(s.weight) : '';
          row.innerHTML = `
            <span class="set-num">${sIdx + 1}</span>
            <input type="number" inputmode="decimal" placeholder="${unitLabel()}" value="${weightVal}" data-field="weight" data-ex="${exIdx}" data-set="${sIdx}" />
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
    const data = last7DaysVolume();
    const ctx = $('#weekly-chart');
    if (!ctx) return;
    if (charts.weekly) charts.weekly.destroy();

    const textColor = cssVar('--text-2') || '#888';
    const accent = cssVar('--accent') || '#6b5ce7';
    const accentSoft = hexWithAlpha(accent, 0.35);

    // Convert to display unit
    const volumeData = data.map(d => state.settings.unit === 'lb' ? Math.round(d.vol * 2.20462) : d.vol);

    charts.weekly = new Chart(ctx, {
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
              title: (items) => formatDate(data[items[0].dataIndex].date),
              label: (item) => `${item.parsed.y.toLocaleString()} ${unitLabel()} volume`
            }
          }
        },
        scales: {
          y: { display: false, beginAtZero: true },
          x: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });
  }

  function renderPlan() {
    $('#plan-date').textContent = formatDate(tomorrowKey());
    const plan = state.plans[tomorrowKey()] || [];
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

    // Copy from recent
    const copyDiv = $('#copy-from-recent');
    const recent = [...state.workouts].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
    if (recent.length === 0) {
      copyDiv.innerHTML = '';
    } else {
      copyDiv.innerHTML = `
        <div class="copy-header">Copy from recent workout</div>
        ${recent.map((w, i) => `
          <button class="copy-item" data-copy-idx="${i}">
            <span class="copy-date">${formatShort(w.date)}</span>
            <span class="copy-exercises">${w.exercises.map(e => escapeHtml(e.name)).join(', ')}</span>
            <span class="copy-plus">+</span>
          </button>
        `).join('')}
      `;
    }
  }

  function renderProgress() {
    const select = $('#progress-select');
    const names = getAllExerciseNames();
    const current = select.value;
    select.innerHTML = '';

    if (names.length === 0) {
      select.innerHTML = '<option>No exercises yet</option>';
      $('#progress-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No data yet</div>
          <div class="empty-body">Log some workouts to see your progress.</div>
        </div>`;
      return;
    }

    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      select.appendChild(opt);
    });
    if (current && names.includes(current)) select.value = current;

    renderProgressChart(select.value);
  }

  function renderProgressChart(name) {
    const content = $('#progress-content');
    const all = [...state.workouts];
    if (state.current && hasLoggedSets(state.current)) all.push(state.current);

    const points = [];
    all.forEach(w => {
      w.exercises.forEach(ex => {
        if (ex.name.toLowerCase() === name.toLowerCase()) {
          let maxW = 0;
          ex.sets.forEach(s => { if ((s.weight || 0) > maxW) maxW = s.weight; });
          if (maxW > 0) points.push({ date: w.date, weight: maxW });
        }
      });
    });
    points.sort((a, b) => a.date.localeCompare(b.date));

    if (points.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No data</div>
          <div class="empty-body">Log this exercise to see your progress.</div>
        </div>`;
      return;
    }

    const pr = Math.max(...points.map(p => p.weight));
    const latest = points[points.length - 1].weight;
    const first = points[0].weight;
    const change = latest - first;
    const changeStr = change >= 0 ? `+${Math.round(displayWeight(change))}` : `${Math.round(displayWeight(change))}`;

    // Simple insight
    const insight = generateInsight(points, name);

    content.innerHTML = `
      <div class="progress-stats">
        <div class="progress-stat">
          <div class="progress-stat-label">Personal best</div>
          <div class="progress-stat-value">${Math.round(displayWeight(pr))} ${unitLabel()}</div>
        </div>
        <div class="progress-stat">
          <div class="progress-stat-label">Latest</div>
          <div class="progress-stat-value">${Math.round(displayWeight(latest))} ${unitLabel()}</div>
        </div>
        <div class="progress-stat">
          <div class="progress-stat-label">Change</div>
          <div class="progress-stat-value ${change > 0 ? 'positive' : ''}">${changeStr} ${unitLabel()}</div>
        </div>
      </div>
      ${insight ? `<div class="insight">${insight}</div>` : ''}
      <div class="chart-card">
        <canvas id="progress-chart"></canvas>
      </div>
    `;

    setTimeout(() => {
      const ctx = $('#progress-chart');
      if (!ctx) return;
      if (charts.progress) charts.progress.destroy();
      const textColor = cssVar('--text-2') || '#888';
      const borderColor = cssVar('--border') || '#eee';
      const accent = cssVar('--accent') || '#6b5ce7';

      charts.progress = new Chart(ctx, {
        type: 'line',
        data: {
          labels: points.map(p => {
            const [, m, d] = p.date.split('-');
            return `${parseInt(m)}/${parseInt(d)}`;
          }),
          datasets: [{
            data: points.map(p => displayWeight(p.weight)),
            borderColor: accent,
            backgroundColor: hexWithAlpha(accent, 0.1),
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: accent,
            pointBorderColor: accent
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => `${item.parsed.y} ${unitLabel()}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              ticks: { color: textColor, font: { size: 11 } },
              grid: { color: borderColor }
            },
            x: {
              ticks: { color: textColor, font: { size: 11 } },
              grid: { display: false }
            }
          }
        }
      });
    }, 30);
  }

  function generateInsight(points, name) {
    if (points.length < 3) return null;
    const recent = points.slice(-3);
    const prior = points.slice(-6, -3);
    if (prior.length === 0) return null;

    const recentMax = Math.max(...recent.map(p => p.weight));
    const priorMax = Math.max(...prior.map(p => p.weight));
    const daysSinceLast = daysBetween(points[points.length - 1].date, todayKey());

    if (daysSinceLast > 14) {
      return `It's been ${daysSinceLast} days since your last ${escapeHtml(name)}. Time to get back in.`;
    }
    if (recentMax > priorMax) {
      const gain = Math.round(displayWeight(recentMax - priorMax));
      return `You're trending up — ${gain} ${unitLabel()} stronger over your last few sessions. Keep the progression going.`;
    }
    if (recentMax < priorMax) {
      return `Your recent sessions have been lighter than earlier peaks. This is normal — deloads build long-term strength.`;
    }
    return `Consistent at ${Math.round(displayWeight(recentMax))} ${unitLabel()}. Consider a small weight increase next session.`;
  }

  function daysBetween(key1, key2) {
    const [y1, m1, d1] = key1.split('-').map(Number);
    const [y2, m2, d2] = key2.split('-').map(Number);
    const a = new Date(y1, m1 - 1, d1);
    const b = new Date(y2, m2 - 1, d2);
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  function renderGoals() {
    const list = $('#goals-list');
    list.innerHTML = '';
    if (state.goals.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No goals yet</div>
          <div class="empty-body">Set a target weight and watch your progress fill in automatically.</div>
        </div>`;
      return;
    }
    state.goals.forEach((goal, idx) => {
      const pr = getPersonalBest(goal.name) || 0;
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
          <span>${Math.round(displayWeight(pr))} ${unitLabel()}</span>
          <span>${Math.round(displayWeight(goal.target))} ${unitLabel()}</span>
        </div>
        <div class="goal-bar">
          <div class="goal-fill ${achieved ? 'achieved' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="goal-pct">${pct}% complete</div>
      `;
      list.appendChild(card);
    });
  }

  function renderHistory() {
    const list = $('#history-list');
    const all = [...state.workouts].sort((a,b) => b.date.localeCompare(a.date));
    if (all.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No workouts yet</div>
          <div class="empty-body">Completed workouts will appear here.</div>
        </div>`;
      return;
    }
    list.innerHTML = '';
    all.forEach((w, idx) => {
      const vol = calcVolume(w);
      const volDisplay = state.settings.unit === 'lb' ? Math.round(vol * 2.20462) : vol;
      const exCount = w.exercises.length;
      const setCount = w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
      const exList = w.exercises.map(ex => {
        const sets = ex.sets
          .map(s => `${Math.round(displayWeight(s.weight || 0))}×${s.reps || 0}`)
          .join(', ');
        return `<div class="history-ex"><span class="history-ex-name">${escapeHtml(ex.name)}</span> — ${sets || 'no sets'}</div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-header">
          <span class="history-date">${formatDate(w.date)}</span>
          <button class="history-delete" data-history-delete="${idx}">Delete</button>
        </div>
        <div class="history-stats">${exCount} exercises • ${setCount} sets • ${volDisplay.toLocaleString()} ${unitLabel()} volume</div>
        ${exList}
      `;
      list.appendChild(card);
    });
  }

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
    a.download = `lift-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported ' + (rows.length - 1) + ' sets');
  }

  function importCSV(file) {
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
          const exercises = Object.keys(byDate[date]).map(name => ({
            name,
            sets: byDate[date][name]
          }));
          state.workouts.push({ date, exercises });
          count++;
        });

        save();
        render();
        showToast(`Imported ${count} workouts`);
        closeMenu();
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
    restTimer.total = seconds;
    restTimer.endsAt = Date.now() + seconds * 1000;
    $('#rest-banner').hidden = false;
    if (restTimer.interval) clearInterval(restTimer.interval);
    updateRestDisplay();
    restTimer.interval = setInterval(updateRestDisplay, 1000);
    // Vibrate if supported
    if (navigator.vibrate) navigator.vibrate(20);
  }

  function updateRestDisplay() {
    const remaining = Math.max(0, Math.ceil((restTimer.endsAt - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    $('#rest-remaining').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    const pct = Math.max(0, (remaining / restTimer.total) * 100);
    $('#rest-progress-bar').style.width = pct + '%';
    if (remaining <= 0) {
      stopRest();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  }

  function stopRest() {
    if (restTimer.interval) clearInterval(restTimer.interval);
    restTimer.interval = null;
    $('#rest-banner').hidden = true;
  }

  // ===== Toast =====
  let toastTimeout = null;
  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.hidden = false;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  // ===== Utilities =====
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function hexWithAlpha(color, alpha) {
    // Handle hex and rgb
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
  function escapeAttr(s) { return escapeHtml(s); }

  // ===== Tab switching =====
  function switchTab(tab) {
    $$('.nav-btn').forEach(b => {
      const active = b.dataset.tab === tab;
      b.classList.toggle('nav-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    ['today', 'plan', 'progress', 'goals', 'history'].forEach(t => {
      $('#view-' + t).hidden = (t !== tab);
    });
    if (tab === 'today') setTimeout(renderWeeklyChart, 30);
    if (tab === 'progress') setTimeout(() => renderProgressChart($('#progress-select').value), 30);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ===== Menu ===== 
  function openMenu() {
    const sheet = $('#menu-sheet');
    sheet.hidden = false;
    // Set current values
    $$('[data-unit]').forEach(b => b.classList.toggle('seg-active', b.dataset.unit === state.settings.unit));
    $('#rest-default').value = state.settings.restDefault;
  }
  function closeMenu() { $('#menu-sheet').hidden = true; }

  // ===== Events =====
  function wireEvents() {
    // Nav
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Menu
    $('#menu-btn').addEventListener('click', openMenu);
    $('#menu-close').addEventListener('click', closeMenu);
    $('#menu-sheet .sheet-backdrop').addEventListener('click', closeMenu);

    // Unit toggle
    $$('[data-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.settings.unit = btn.dataset.unit;
        save();
        $$('[data-unit]').forEach(b => b.classList.toggle('seg-active', b === btn));
        render();
      });
    });

    // Rest default
    $('#rest-default').addEventListener('change', (e) => {
      state.settings.restDefault = parseInt(e.target.value) || 0;
      save();
    });

    // Export / Import
    $('#export-btn').addEventListener('click', () => { exportCSV(); closeMenu(); });
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) { importCSV(e.target.files[0]); e.target.value = ''; }
    });

    // Wipe
    $('#wipe-btn').addEventListener('click', () => {
      if (confirm('Delete all workouts, plans, and goals? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        state = { workouts: [], current: null, plans: {}, goals: [], settings: state.settings };
        save();
        render();
        closeMenu();
        showToast('All data deleted');
      }
    });

    // Add exercise (today)
    $('#add-exercise-btn').addEventListener('click', addExercise);
    $('#new-exercise').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addExercise();
    });

    // Suggestion chips
    $('#exercise-suggestions').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-suggest]');
      if (!btn) return;
      $('#new-exercise').value = btn.dataset.suggest;
      addExercise();
    });

    // Load planned workout
    $('#load-plan-btn').addEventListener('click', () => {
      const plan = state.plans[todayKey()] || [];
      ensureCurrent();
      plan.forEach(name => {
        if (!state.current.exercises.some(ex => ex.name.toLowerCase() === name.toLowerCase())) {
          state.current.exercises.push({ name, sets: [{ weight: 0, reps: 0, done: false }] });
        }
      });
      delete state.plans[todayKey()];
      save();
      render();
      if (navigator.vibrate) navigator.vibrate(30);
    });

    // Exercise list interactions
    $('#exercise-list').addEventListener('click', handleExerciseClick);
    $('#exercise-list').addEventListener('input', handleExerciseInput);

    // Finish workout
    $('#finish-workout-btn').addEventListener('click', finishWorkout);

    // Plan tab
    $('#add-plan-btn').addEventListener('click', addToPlan);
    $('#new-plan-exercise').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addToPlan();
    });
    $('#plan-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plan-remove]');
      if (!btn) return;
      const key = tomorrowKey();
      state.plans[key].splice(parseInt(btn.dataset.planRemove), 1);
      if (state.plans[key].length === 0) delete state.plans[key];
      save();
      renderPlan();
    });
    $('#copy-from-recent').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy-idx]');
      if (!btn) return;
      const recent = [...state.workouts].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
      const w = recent[parseInt(btn.dataset.copyIdx)];
      if (!w) return;
      const key = tomorrowKey();
      if (!state.plans[key]) state.plans[key] = [];
      let added = 0;
      w.exercises.forEach(ex => {
        if (!state.plans[key].includes(ex.name)) {
          state.plans[key].push(ex.name);
          added++;
        }
      });
      save();
      renderPlan();
      if (added > 0) showToast(`Added ${added} exercises`);
    });

    // Goals
    $('#add-goal-btn').addEventListener('click', addGoal);
    $('#goal-target').addEventListener('keydown', (e) => { if (e.key === 'Enter') addGoal(); });
    $('#goal-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#goal-target').focus(); });
    $('#goals-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-goal-remove]');
      if (!btn) return;
      state.goals.splice(parseInt(btn.dataset.goalRemove), 1);
      save();
      renderGoals();
    });

    // Progress
    $('#progress-select').addEventListener('change', (e) => renderProgressChart(e.target.value));

    // History
    $('#history-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-history-delete]');
      if (!btn) return;
      if (!confirm('Delete this workout?')) return;
      const sorted = [...state.workouts].sort((a,b) => b.date.localeCompare(a.date));
      const toDelete = sorted[parseInt(btn.dataset.historyDelete)];
      state.workouts = state.workouts.filter(w => w !== toDelete);
      save();
      render();
    });

    // Rest timer
    $('#rest-add').addEventListener('click', () => {
      restTimer.endsAt += 30000;
      restTimer.total += 30;
      updateRestDisplay();
    });
    $('#rest-skip').addEventListener('click', stopRest);
  }

  function addExercise() {
    const input = $('#new-exercise');
    const name = input.value.trim();
    if (!name) return;
    ensureCurrent();
    state.current.exercises.push({ name, sets: [{ weight: 0, reps: 0, done: false }] });
    input.value = '';
    save();
    render();
  }

  function addToPlan() {
    const input = $('#new-plan-exercise');
    const name = input.value.trim();
    if (!name) return;
    const key = tomorrowKey();
    if (!state.plans[key]) state.plans[key] = [];
    state.plans[key].push(name);
    input.value = '';
    save();
    renderPlan();
  }

  function addGoal() {
    const name = $('#goal-name').value.trim();
    const target = parseFloat($('#goal-target').value);
    if (!name || !target || target <= 0) {
      showToast('Enter exercise and target');
      return;
    }
    state.goals.push({ name, target: inputToKg(target) });
    $('#goal-name').value = '';
    $('#goal-target').value = '';
    save();
    renderGoals();
    showToast('Goal added');
  }

  function handleExerciseClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const exIdx = parseInt(btn.dataset.ex ?? btn.dataset.idx);
    const sIdx = parseInt(btn.dataset.set);

    if (action === 'remove-ex') {
      if (state.current.exercises[exIdx].sets.some(s => s.weight > 0)) {
        if (!confirm('Remove this exercise and its sets?')) return;
      }
      state.current.exercises.splice(exIdx, 1);
      save();
      render();
    } else if (action === 'add-set') {
      const ex = state.current.exercises[exIdx];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        weight: last && last.weight > 0 ? last.weight : 0,
        reps: last && last.reps > 0 ? last.reps : 0,
        done: false
      });
      save();
      render();
    } else if (action === 'toggle-done') {
      const s = state.current.exercises[exIdx].sets[sIdx];
      if (!s.weight || !s.reps) {
        showToast('Enter weight and reps first');
        return;
      }
      s.done = !s.done;
      save();
      // Just update the button, don't re-render whole view
      btn.classList.toggle('done', s.done);
      // Check for PR
      if (s.done) {
        const name = state.current.exercises[exIdx].name;
        const prevPR = lastPRCheck[name] || 0;
        if (s.weight > prevPR) {
          lastPRCheck[name] = s.weight;
          showToast(`🎯 New PR on ${name}!`);
        }
        if (state.settings.restDefault > 0) {
          startRest(state.settings.restDefault);
        }
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
    let val = 0;
    if (raw !== '') {
      val = parseFloat(raw);
      if (isNaN(val)) val = 0;
    }
    // For weight, convert lb -> kg
    if (field === 'weight') {
      state.current.exercises[exIdx].sets[sIdx].weight = state.settings.unit === 'lb'
        ? (raw === '' ? 0 : inputToKg(raw))
        : val;
    } else {
      state.current.exercises[exIdx].sets[sIdx][field] = val;
    }
    save();
    renderStats();
    renderWeeklyChart();
  }

  function finishWorkout() {
    if (!state.current || state.current.exercises.length === 0) return;
    if (!hasLoggedSets(state.current)) {
      showToast('Log at least one set first');
      return;
    }
    // Clean empty sets
    state.current.exercises.forEach(ex => {
      ex.sets = ex.sets.filter(s => s.weight > 0 && s.reps > 0);
    });
    state.current.exercises = state.current.exercises.filter(ex => ex.sets.length > 0);

    if (state.current.exercises.length === 0) {
      showToast('No completed sets to save');
      state.current = null;
      save();
      render();
      return;
    }

    const vol = calcVolume(state.current);
    const volDisplay = state.settings.unit === 'lb' ? Math.round(vol * 2.20462) : vol;
    state.workouts.push(state.current);
    state.current = null;
    stopRest();
    save();
    render();
    switchTab('history');
    showToast(`Workout saved — ${volDisplay.toLocaleString()} ${unitLabel()} lifted 💪`);
    if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
  }

  // ===== Init =====
  function init() {
    load();
    wireEvents();
    render();

    // Register service worker for offline
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
      });
    }

    // Re-render on theme change
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        renderWeeklyChart();
        if ($('#view-progress').hidden === false) {
          renderProgressChart($('#progress-select').value);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
