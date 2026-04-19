/* page-progress.js — Progress page */
(function() {
  'use strict';
  const { $, escapeHtml, cssVar, hexWithAlpha } = RB;

  let progressChart = null;

  function daysBetween(key1, key2) {
    const [y1, m1, d1] = key1.split('-').map(Number);
    const [y2, m2, d2] = key2.split('-').map(Number);
    const a = new Date(y1, m1 - 1, d1);
    const b = new Date(y2, m2 - 1, d2);
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  function generateInsight(points, name) {
    if (points.length < 3) return null;
    const recent = points.slice(-3);
    const prior = points.slice(-6, -3);
    if (prior.length === 0) return null;
    const recentMax = Math.max(...recent.map(p => p.weight));
    const priorMax = Math.max(...prior.map(p => p.weight));
    const daysSinceLast = daysBetween(points[points.length - 1].date, RB.todayKey());
    if (daysSinceLast > 14) {
      return `It's been ${daysSinceLast} days since your last ${escapeHtml(name)}. Time to get back in.`;
    }
    if (recentMax > priorMax) {
      const gain = Math.round(RB.displayWeight(recentMax - priorMax));
      return `Trending up — ${gain} ${RB.unitLabel()} stronger over your last few sessions. Keep progressing.`;
    }
    if (recentMax < priorMax) {
      return `Recent sessions have been lighter than earlier peaks. Deloads are normal — they build long-term strength.`;
    }
    return `Consistent at ${Math.round(RB.displayWeight(recentMax))} ${RB.unitLabel()}. Try a small weight increase next session.`;
  }

  function render() {
    const select = $('#progress-select');
    const names = RB.getAllExerciseNames();
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
    renderChart(select.value);
  }

  function renderChart(name) {
    const content = $('#progress-content');
    const all = [...RB.state.workouts];
    if (RB.hasLoggedSets(RB.state.current)) all.push(RB.state.current);

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
    const changeStr = change >= 0
      ? `+${Math.round(RB.displayWeight(change))}`
      : `${Math.round(RB.displayWeight(change))}`;
    const insight = generateInsight(points, name);
    const unit = RB.unitLabel();

    content.innerHTML = `
      <div class="progress-stats">
        <div class="progress-stat">
          <div class="progress-stat-label">Personal best</div>
          <div class="progress-stat-value">${Math.round(RB.displayWeight(pr))} ${unit}</div>
        </div>
        <div class="progress-stat">
          <div class="progress-stat-label">Latest</div>
          <div class="progress-stat-value">${Math.round(RB.displayWeight(latest))} ${unit}</div>
        </div>
        <div class="progress-stat">
          <div class="progress-stat-label">Change</div>
          <div class="progress-stat-value ${change > 0 ? 'positive' : ''}">${changeStr} ${unit}</div>
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
      if (progressChart) progressChart.destroy();
      const textColor = cssVar('--text-2') || '#888';
      const borderColor = cssVar('--border') || '#eee';
      const accent = cssVar('--accent') || '#6b5ce7';

      progressChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: points.map(p => {
            const [, m, d] = p.date.split('-');
            return `${parseInt(m)}/${parseInt(d)}`;
          }),
          datasets: [{
            data: points.map(p => RB.displayWeight(p.weight)),
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
              callbacks: { label: (item) => `${item.parsed.y} ${unit}` }
            }
          },
          scales: {
            y: { beginAtZero: false, ticks: { color: textColor, font: { size: 11 } }, grid: { color: borderColor } },
            x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    }, 30);
  }

  function wire() {
    $('#progress-select').addEventListener('change', (e) => renderChart(e.target.value));
    document.addEventListener('repbot:settings-changed', render);
    document.addEventListener('repbot:data-changed', render);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        renderChart($('#progress-select').value);
      });
    }
  }

  function init() {
    RB.load();
    RB.setupChrome('progress');
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
