#!/usr/bin/env node
/**
 * Simple page builder — takes the shared chrome and wraps each page's content.
 * Run: node build.js
 * Output: index.html, plan.html, progress.html, goals.html, history.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const HEADER = `<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="index.html">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 10v4M4 11v2M18 10v4M20 11v2M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>RepBot</span>
    </a>
    <button id="menu-btn" class="icon-btn" aria-label="Menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
      </svg>
    </button>
  </div>
</header>`;

const MENU = `<div id="menu-sheet" class="sheet" hidden>
  <div class="sheet-backdrop" data-close-menu></div>
  <div class="sheet-panel">
    <div class="sheet-header">
      <h3>Settings</h3>
      <button class="icon-btn" data-close-menu aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="sheet-body">
      <div class="setting-row">
        <div>
          <div class="setting-label">Unit</div>
          <div class="setting-help">Weight display</div>
        </div>
        <div class="segmented" role="radiogroup" aria-label="Weight unit">
          <button class="seg-btn" data-unit="kg">kg</button>
          <button class="seg-btn" data-unit="lb">lb</button>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Rest timer</div>
          <div class="setting-help">Default between sets</div>
        </div>
        <select id="rest-default" class="select-inline">
          <option value="0">Off</option>
          <option value="60">60s</option>
          <option value="90">90s</option>
          <option value="120">2m</option>
          <option value="180">3m</option>
          <option value="300">5m</option>
        </select>
      </div>
      <div class="sheet-divider"></div>
      <button class="row-btn" id="export-btn">
        <span>Download data (CSV)</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="row-btn" id="import-btn">
        <span>Import from CSV</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21V9m0 0l-4 4m4-4l4 4M5 3h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <input type="file" id="import-file" accept=".csv" hidden />
      <div class="sheet-divider"></div>
      <button class="row-btn row-btn-danger" id="wipe-btn">
        <span>Delete all data</span>
      </button>
      <div class="sheet-footer">
        <div>RepBot v0.2 • beta</div>
        <div>Your data stays on this device.</div>
      </div>
    </div>
  </div>
</div>`;

const REST_BANNER = `<div id="rest-banner" class="rest-banner" hidden>
  <div class="rest-banner-inner">
    <div class="rest-timer-text">Rest <span id="rest-remaining">1:30</span></div>
    <div class="rest-actions">
      <button id="rest-add">+30s</button>
      <button id="rest-skip">Skip</button>
    </div>
  </div>
  <div class="rest-progress"><div id="rest-progress-bar"></div></div>
</div>`;

const NAV = `<nav class="bottom-nav" role="tablist">
  <div class="bottom-nav-inner">
    <a class="nav-btn" data-tab="today" href="index.html">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 10v4M4 11v2M18 10v4M20 11v2M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>Today</span>
    </a>
    <a class="nav-btn" data-tab="plan" href="plan.html">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M4 9h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>Plan</span>
    </a>
    <a class="nav-btn" data-tab="progress" href="progress.html">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 18L9 13L13 17L20 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 10h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Progress</span>
    </a>
    <a class="nav-btn" data-tab="goals" href="goals.html">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
      <span>Goals</span>
    </a>
    <a class="nav-btn" data-tab="history" href="history.html">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>History</span>
    </a>
  </div>
</nav>`;

function page(opts) {
  const { title, bodyClass, content, pageScript, includeChart } = opts;
  const chartTag = includeChart
    ? '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#0f0f10" />
  <meta name="description" content="RepBot — a simple, honest gym tracker. Log your lifts, plan tomorrow, own your data." />
  <title>${title}</title>
  <link rel="manifest" href="manifest.json" />
  <link rel="icon" href="icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="icon-192.png" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="${bodyClass || ''}">
  <div id="app">
    ${HEADER}
    ${MENU}
    ${REST_BANNER}
    <main>
${content}
    </main>
    ${NAV}
    <div id="toast" class="toast" hidden></div>
  </div>
  ${chartTag}
  <script src="app.js"></script>
  <script src="${pageScript}"></script>
</body>
</html>`;
}

// ===== Page content definitions =====

const TODAY = `      <section class="view view-today-compact">
        <div class="stats-row">
          <div class="stat">
            <div class="stat-label">This week</div>
            <div class="stat-value" id="stat-workouts">0</div>
            <div class="stat-sub">workouts</div>
          </div>
          <div class="stat">
            <div class="stat-label">Volume</div>
            <div class="stat-value" id="stat-volume">0</div>
            <div class="stat-sub" id="stat-volume-unit">kg lifted</div>
          </div>
          <div class="stat">
            <div class="stat-label">Streak</div>
            <div class="stat-value" id="stat-streak">0</div>
            <div class="stat-sub">days</div>
          </div>
        </div>

        <div class="card card-compact">
          <div class="card-header">
            <div class="card-title">Volume this week</div>
            <div class="card-sub">Last 7 days</div>
          </div>
          <div class="chart-container chart-sm"><canvas id="weekly-chart"></canvas></div>
        </div>

        <div class="section-header">
          <h2>Today's workout</h2>
          <span class="section-date" id="today-date"></span>
        </div>

        <div id="exercise-list" class="exercise-list"></div>

        <div id="empty-state" class="empty-state" hidden>
          <div class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M6 10v4M4 11v2M18 10v4M20 11v2M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="empty-title">Ready to lift?</div>
          <div class="empty-body">Add an exercise below to start tracking.</div>
        </div>

        <div class="add-exercise-row">
          <input id="new-exercise" type="text" placeholder="Exercise (e.g., Bench press)" autocomplete="off" />
          <button id="add-exercise-btn" class="btn btn-primary">Add</button>
        </div>
        <div id="exercise-suggestions" class="suggestions" hidden></div>

        <div id="finish-row" class="finish-row" hidden>
          <button id="finish-workout-btn" class="btn btn-success btn-full">Finish workout</button>
        </div>
      </section>`;

const PLAN = `      <section class="view">
        <div class="section-header">
          <h2>Plan for tomorrow</h2>
          <span class="section-date" id="plan-date"></span>
        </div>
        <p class="section-lead">Queue up exercises tonight. They'll be waiting tomorrow.</p>

        <div id="plan-list" class="plan-list"></div>

        <div id="plan-empty" class="plan-empty">Nothing planned yet.</div>

        <div class="add-exercise-row">
          <input id="new-plan-exercise" type="text" placeholder="Exercise" autocomplete="off" />
          <button id="add-plan-btn" class="btn btn-primary">Add</button>
        </div>

        <div id="copy-from-recent"></div>
      </section>`;

const PROGRESS = `      <section class="view">
        <div class="section-header"><h2>Progress</h2></div>
        <label for="progress-select" class="field-label">Exercise</label>
        <select id="progress-select" class="select-full"></select>

        <div id="progress-content">
          <div class="empty-state">
            <div class="empty-title">No data yet</div>
            <div class="empty-body">Log some workouts to see your progress.</div>
          </div>
        </div>
      </section>`;

const GOALS = `      <section class="view">
        <div class="section-header"><h2>Goals</h2></div>
        <div id="goals-list" class="goals-list"></div>

        <div class="card card-soft">
          <div class="card-title">Add a goal</div>
          <div class="add-goal-form">
            <input id="goal-name" type="text" placeholder="Exercise (e.g., Squat)" autocomplete="off" />
            <div class="add-goal-row">
              <input id="goal-target" type="number" inputmode="decimal" placeholder="Target weight" />
              <button id="add-goal-btn" class="btn btn-primary">Set goal</button>
            </div>
          </div>
        </div>
      </section>`;

const HISTORY = `      <section class="view">
        <div class="section-header"><h2>History</h2></div>

        <div id="plan-prompt" class="plan-prompt" hidden>
          <div class="plan-prompt-text">
            <div class="plan-prompt-title">You planned today</div>
            <div class="plan-prompt-body" id="plan-summary"></div>
          </div>
          <button id="load-plan-btn" class="btn btn-primary btn-sm">Load plan</button>
        </div>

        <div id="history-list" class="history-list"></div>
      </section>`;

// ===== Generate pages =====
const pages = [
  { file: 'index.html', title: 'RepBot', content: TODAY, script: 'page-today.js', chart: true },
  { file: 'plan.html', title: 'Plan — RepBot', content: PLAN, script: 'page-plan.js', chart: false },
  { file: 'progress.html', title: 'Progress — RepBot', content: PROGRESS, script: 'page-progress.js', chart: true },
  { file: 'goals.html', title: 'Goals — RepBot', content: GOALS, script: 'page-goals.js', chart: false },
  { file: 'history.html', title: 'History — RepBot', content: HISTORY, script: 'page-history.js', chart: false }
];

pages.forEach(p => {
  const html = page({
    title: p.title,
    content: p.content,
    pageScript: p.script,
    includeChart: p.chart
  });
  fs.writeFileSync(path.join(ROOT, p.file), html);
  console.log('Built', p.file);
});
