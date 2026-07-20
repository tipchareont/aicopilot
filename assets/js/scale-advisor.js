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

  function uniqueOptions(id, rows, getter) {
    const select = $(id);
    const current = select.value;
    const values = [...new Set(rows.map(getter).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
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

  function simpleRecommendation(row) {
    const recommendation = clean(value(row, ['Recommendation'], ''));
    if (recommendation) return recommendation;
    const decision = upper(value(row, ['Advisor_Decision'], 'HOLD'));
    if (decision === 'SCALE_READY') return 'เพิ่มงบตาม Step ที่ระบบแนะนำ และเช็ก Metric หลักทุกวัน';
    if (decision === 'TEST_SCALE') return 'ลองเพิ่มงบแบบค่อยเป็นค่อยไป แล้วดูผล 24 ชั่วโมงถัดไป';
    if (decision === 'DO_NOT_SCALE') return 'ยังไม่ควรเพิ่มงบ ให้แก้ปัญหาก่อน';
    return 'พักการเพิ่มงบไว้ก่อน และติดตาม Metric ที่ระบบระบุ';
  }

  function renderCard(row) {
    const decision = upper(value(row, ['Advisor_Decision'], 'HOLD'));
    const status = upper(value(row, ['Status'], 'INSUFFICIENT_DATA'));
    const cardClass = decision === 'SCALE_READY' ? 'is-ready' : decision === 'TEST_SCALE' ? 'is-test' : ['DO_NOT_SCALE', 'HOLD_REVIEW'].includes(decision) ? 'is-risk' : '';
    const budget = D.num(value(row, ['Recommended_Budget_Step_Pct']));
    const guardrail = row.Guardrail || {};
    const baseline = row.Baseline || {};
    const completeRegister = D.metric(row, 'completeRegister');
    const cpcr = D.metric(row, 'cpcr');
    const isConversion = D.isConversionObjective(value(row, ['Objective'], ''));
    const objective = D.displayObjective(value(row, ['Objective'], '')) || '-';
    const reasons = arr(row.Reasons);
    const risks = arr(row.Risks);
    const guardrailItems = arr(guardrail.stop_conditions);

    return `<article class="advisor-card ${cardClass}">
      <div class="advisor-head">
        <div class="advisor-title">
          <h3>${esc(value(row, ['Campaign_Name'], '-'))}</h3>
          <p>${esc(value(row, ['Game_Name', 'Game_ID'], '-'))} · ${esc(value(row, ['Account_Name', 'Account_ID'], '-'))} · ${esc(objective)} · ${esc(value(row, ['Phase'], '-'))}</p>
        </div>
        <div class="advisor-badges">
          <span class="decision-badge decision-${esc(decision)}">${esc(decisionLabel[decision] || decision)}</span>
          <span class="status-badge status-${esc(status)}">${esc(status)}</span>
        </div>
      </div>

      <div class="advisor-kpis">
        <div class="advisor-kpi"><span>Budget Step</span><strong>${budget > 0 ? `+${D.integer(budget)}%` : '0%'}</strong></div>
        <div class="advisor-kpi"><span>Confidence</span><strong>${esc(value(row, ['Confidence'], '-'))}</strong></div>
        <div class="advisor-kpi"><span>${esc(value(row, ['Main_Metric_Label', 'Main_Metric'], 'Main Metric'))} 7D</span><strong>${esc(value(baseline, ['value_7d'], value(row, ['Trend_7D'], '-')))}</strong></div>
        <div class="advisor-kpi"><span>Spend ล่าสุด</span><strong>฿${D.money(value(row, ['Spend']))}</strong></div>
        <div class="advisor-kpi"><span>Complete Register</span><strong>${isConversion ? D.integer(completeRegister) : '-'}</strong></div>
        <div class="advisor-kpi"><span>Cost / Complete Register</span><strong>${isConversion && completeRegister ? `฿${D.money(cpcr)}` : '-'}</strong></div>
      </div>

      <div class="advisor-recommendation">
        <strong>คำแนะนำแบบสั้น</strong>
        <span>${esc(simpleRecommendation(row))}</span>
      </div>

      <div class="advisor-grid">
        <section class="advisor-section">
          <h4>เหตุผลที่ระบบแนะนำแบบนี้</h4>
          ${reasons.length ? list(reasons) : '<div class="search-hint">ยังไม่มีเหตุผลเชิงโครงสร้าง</div>'}
        </section>
        <section class="advisor-section">
          <h4>ความเสี่ยงที่ต้องระวัง</h4>
          ${risks.length ? list(risks) : '<div class="search-hint">ยังไม่พบความเสี่ยงเด่นในชุดข้อมูลนี้</div>'}
        </section>
        <section class="advisor-section">
          <h4>Metrics ที่ต้องเฝ้าดู</h4>
          ${chips(row.Metrics_To_Monitor)}
        </section>
      </div>

      <details class="advisor-guardrail">
        <summary>ดู Guardrail และเงื่อนไขหยุดเพิ่มงบ</summary>
        <div class="advisor-guardrail-body">
          <div>
            <h4>Stop Conditions</h4>
            ${guardrailItems.length ? list(guardrailItems) : '<div class="search-hint">ไม่มีข้อมูล</div>'}
          </div>
          <div>
            <h4>Observation Window</h4>
            <p class="search-hint">${esc(guardrail.observation_window || 'ยังไม่มีข้อมูล')}</p>
          </div>
        </div>
      </details>
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
      uniqueOptions('gameFilter', allRows, (row) => clean(value(row, ['Game_Name', 'Game_ID'])));
      uniqueOptions('accountFilter', allRows, (row) => clean(value(row, ['Account_Name', 'Account_ID'])));
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
