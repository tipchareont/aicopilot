"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const D = window.CopilotData;
  let response = null;
  let allRows = [];

  const decisionLabel = {
    SCALE_READY: 'พร้อม Scale',
    TEST_SCALE: 'ทดลอง Scale',
    HOLD: 'Hold',
    HOLD_REVIEW: 'Hold & Review',
    DO_NOT_SCALE: 'ห้าม Scale',
    INSUFFICIENT_DATA: 'ข้อมูลไม่พอ',
  };

  const arr = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => String(value ?? '').trim();
  const upper = (value) => clean(value).toUpperCase();
  const esc = (value) => D.esc(value);

  const value = (row, names, fallback = '') => D.field(row, names, fallback);

  function showApp() {
    $('loading').classList.add('hidden');
    $('shell').classList.remove('hidden');
  }

  function setUser() {
    $('displayName').textContent = localStorage.getItem('display_name') || localStorage.getItem('username') || '-';
    $('role').textContent = localStorage.getItem('role') || '-';
  }

  function uniqueOptions(id, rows, names) {
    const select = $(id);
    const current = select.value;
    const values = [...new Set(rows.map((row) => clean(value(row, names))).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    select.innerHTML = '<option value="">ทั้งหมด</option>' + values.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
    select.value = values.includes(current) ? current : '';
  }

  function list(items) {
    const values = arr(items).filter(Boolean);
    return values.length ? `<ul>${values.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<div class="search-hint">ไม่มีข้อมูล</div>';
  }

  function chips(items) {
    const values = arr(items).filter(Boolean);
    return values.length ? `<div class="monitor-chips">${values.map((item) => `<span class="monitor-chip">${esc(item)}</span>`).join('')}</div>` : '<span class="search-hint">ไม่มีข้อมูล</span>';
  }

  function renderCard(row) {
    const decision = upper(value(row, ['Advisor_Decision'], 'HOLD'));
    const status = upper(value(row, ['Status'], 'INSUFFICIENT_DATA'));
    const cardClass = decision === 'SCALE_READY' ? 'is-ready' : decision === 'TEST_SCALE' ? 'is-test' : ['DO_NOT_SCALE', 'HOLD_REVIEW'].includes(decision) ? 'is-risk' : '';
    const budget = D.num(value(row, ['Recommended_Budget_Step_Pct']));
    const guardrail = row.Guardrail || {};
    const baseline = row.Baseline || {};

    return `<article class="advisor-card ${cardClass}">
      <div class="advisor-head">
        <div class="advisor-title"><h3>${esc(value(row, ['Campaign_Name'], '-'))}</h3><p>${esc(value(row, ['Game_Name', 'Game_ID'], '-'))} · ${esc(value(row, ['Account_Name', 'Account_ID'], '-'))} · ${esc(value(row, ['Objective'], '-'))} · ${esc(value(row, ['Phase'], '-'))}</p></div>
        <div class="advisor-badges"><span class="decision-badge decision-${esc(decision)}">${esc(decisionLabel[decision] || decision)}</span><span class="status-badge status-${esc(status)}">${esc(status)}</span></div>
      </div>
      <div class="advisor-kpis">
        <div class="advisor-kpi"><span>Budget Step</span><strong>${budget > 0 ? `+${D.integer(budget)}%` : '0%'}</strong></div>
        <div class="advisor-kpi"><span>Confidence</span><strong>${esc(value(row, ['Confidence'], '-'))}</strong></div>
        <div class="advisor-kpi"><span>${esc(value(row, ['Main_Metric_Label', 'Main_Metric'], 'Main Metric'))} 7D</span><strong>${esc(value(baseline, ['value_7d'], value(row, ['Trend_7D'], '-')))}</strong></div>
        <div class="advisor-kpi"><span>Spend ล่าสุด</span><strong>฿${D.money(value(row, ['Spend']))}</strong></div>
        <div class="advisor-kpi"><span>Results ล่าสุด</span><strong>${D.integer(value(row, ['Results', 'Result']))}</strong></div>
      </div>
      <div class="advisor-recommendation"><strong>คำแนะนำ</strong><span>${esc(value(row, ['Recommendation'], '-'))}</span></div>
      <div class="advisor-grid">
        <section class="advisor-section"><h4>เหตุผล</h4>${list(row.Reasons)}</section>
        <section class="advisor-section"><h4>ความเสี่ยง</h4>${list(row.Risks)}</section>
        <section class="advisor-section"><h4>Metrics ที่ต้องเฝ้าดู</h4>${chips(row.Metrics_To_Monitor)}<h4 style="margin-top:14px">Guardrail</h4>${list(guardrail.stop_conditions)}<p class="search-hint" style="margin:10px 0 0">${esc(guardrail.observation_window || '')}</p></section>
      </div>
    </article>`;
  }

  function filteredRows() {
    const query = upper($('searchFilter').value);
    const game = $('gameFilter').value;
    const account = $('accountFilter').value;
    const decision = $('decisionFilter').value;

    return allRows.filter((row) => {
      const name = upper(value(row, ['Campaign_Name']));
      const rowGame = clean(value(row, ['Game_Name', 'Game_ID']));
      const rowAccount = clean(value(row, ['Account_Name', 'Account_ID']));
      const rowDecision = upper(value(row, ['Advisor_Decision']));
      return (!query || name.includes(query)) && (!game || rowGame === game) && (!account || rowAccount === account) && (!decision || rowDecision === decision);
    });
  }

  function render() {
    const rows = filteredRows();
    const counts = rows.reduce((acc, row) => {
      const key = upper(value(row, ['Advisor_Decision']));
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    $('scaleReadyCount').textContent = D.integer(counts.SCALE_READY || 0);
    $('testScaleCount').textContent = D.integer(counts.TEST_SCALE || 0);
    $('holdCount').textContent = D.integer((counts.HOLD || 0) + (counts.HOLD_REVIEW || 0));
    $('blockedCount').textContent = D.integer((counts.DO_NOT_SCALE || 0) + (counts.INSUFFICIENT_DATA || 0));
    $('resultBadge').textContent = `${D.integer(rows.length)} campaigns`;
    $('advisorList').innerHTML = rows.length ? rows.map(renderCard).join('') : '<div class="empty">ไม่พบ Campaign ตามตัวกรอง หรือ Cache Scale Advisor ยังไม่มีข้อมูล</div>';
  }

  async function load(refresh = false) {
    $('loadingMessage').textContent = refresh ? 'กำลังรีเฟรชข้อมูลล่าสุด...' : 'กำลังอ่าน Scale Advisor Cache...';
    if (!window.Auth?.hasUsableSession?.()) return window.Auth.redirectToLogin();

    try {
      response = await D.load({ refresh });
      allRows = D.rows(response, 'scale_advisor');
      uniqueOptions('gameFilter', allRows, ['Game_Name', 'Game_ID']);
      uniqueOptions('accountFilter', allRows, ['Account_Name', 'Account_ID']);
      const meta = response?.scale_up_advisor_cache || {};
      $('dataDateBadge').textContent = `Data: ${meta.data_date || allRows[0]?.Date || '-'}`;
      $('updatedAt').textContent = meta.generated_at ? `Updated: ${new Date(meta.generated_at).toLocaleString('th-TH')}` : 'Updated: -';
      setUser();
      render();
      showApp();
    } catch (error) {
      if (Number(error.httpStatus) === 401) return window.Auth.redirectToLogin();
      $('loadingMessage').textContent = error.message || 'ไม่สามารถโหลดข้อมูลได้';
    }
  }

  ['searchFilter', 'gameFilter', 'accountFilter', 'decisionFilter'].forEach((id) => {
    $(id).addEventListener(id === 'searchFilter' ? 'input' : 'change', render);
  });

  $('resetButton').addEventListener('click', () => {
    $('searchFilter').value = '';
    $('gameFilter').value = '';
    $('accountFilter').value = '';
    $('decisionFilter').value = '';
    render();
  });

  $('refreshButton').addEventListener('click', () => load(true));
  $('logoutButton').addEventListener('click', () => window.Auth.redirectToLogin());
  load(false);
})();