"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const D = window.CopilotData;
  let allRows = [];
  let response = null;

  const arr = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => String(value ?? '').trim();
  const upper = (value) => clean(value).toUpperCase();
  const esc = (value) => D.esc(value);
  const field = (row, names, fallback = '') => D.field(row, names, fallback);

  const labels = {
    WINNER: 'Winner',
    PROMISING: 'Promising',
    WATCH: 'Watch',
    LOSER: 'Loser',
    INSUFFICIENT_DATA: 'ข้อมูลไม่พอ',
  };

  const actionLabels = {
    CONTINUE_AND_VARIATE: 'ทำต่อและแตก Variation',
    TEST_VARIATION: 'ทดลอง Variation',
    REFRESH_TEST: 'Refresh & Test',
    REDUCE_AND_REWORK: 'ลด Priority และ Rework',
    COLLECT_MORE_DATA: 'เก็บข้อมูลเพิ่ม',
  };

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
    const values = [...new Set(rows.map((row) => clean(field(row, names))).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    select.innerHTML = '<option value="">ทั้งหมด</option>' + values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    select.value = values.includes(current) ? current : '';
  }

  function list(items) {
    const values = arr(items).filter(Boolean);
    return values.length ? `<ul>${values.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<div class="search-hint">ไม่มีข้อมูล</div>';
  }

  function metricValue(row) {
    const value = field(row, ['Main_Metric_Value'], null);
    return value === null || value === '' ? 'N/A' : Number(value).toLocaleString('th-TH', { maximumFractionDigits: 4 });
  }

  function renderCard(row) {
    const decision = upper(field(row, ['Analyzer_Decision'], 'INSUFFICIENT_DATA'));
    const action = upper(field(row, ['Recommended_Action']));
    const momentum = upper(field(row, ['Momentum'], 'UNKNOWN'));
    const plan = row.Test_Plan || {};
    const cardClass = decision === 'WINNER' ? 'is-winner' : decision === 'PROMISING' ? 'is-promising' : decision === 'LOSER' ? 'is-loser' : decision === 'WATCH' ? 'is-watch' : '';
    const rank = D.integer(field(row, ['Weekly_Rank']));
    const peers = D.integer(field(row, ['Peer_Count']));
    const currentWindow = row.Current_Window || {};

    return `<article class="weekly-card ${cardClass}">
      <div class="weekly-head">
        <div class="weekly-title"><h3>${esc(field(row, ['Creative_Group_Name'], '-'))}</h3><p>${esc(field(row, ['Game_Name', 'Game_ID'], '-'))} · ${esc(field(row, ['Account_Name', 'Account_ID'], '-'))} · ${esc(field(row, ['Objective'], '-'))} · ${esc(field(row, ['Phase'], '-'))}</p></div>
        <div class="weekly-badges"><span class="creative-decision decision-${esc(decision)}">${esc(labels[decision] || decision)}</span><span class="momentum momentum-${esc(momentum)}">${esc(momentum)}</span></div>
      </div>

      <div class="weekly-kpis">
        <div class="weekly-kpi"><span>Weekly Rank</span><strong>${rank} / ${peers}</strong></div>
        <div class="weekly-kpi"><span>${esc(field(row, ['Main_Metric_Label'], 'Main Metric'))}</span><strong>${esc(metricValue(row))}</strong></div>
        <div class="weekly-kpi"><span>Spend 7D</span><strong>฿${D.money(field(row, ['Spend']))}</strong></div>
        <div class="weekly-kpi"><span>Results 7D</span><strong>${D.integer(field(row, ['Results']))}</strong></div>
        <div class="weekly-kpi"><span>CTR</span><strong>${(D.num(field(row, ['CTR'])) * 100).toFixed(2)}%</strong></div>
        <div class="weekly-kpi"><span>Active Days</span><strong>${D.integer(field(currentWindow, ['active_days']))}</strong></div>
      </div>

      <div class="weekly-recommendation"><div><strong>${esc(actionLabels[action] || action || 'Recommendation')}</strong><span>${esc(field(row, ['Recommendation'], '-'))}</span></div><span class="confidence">Confidence: ${esc(field(row, ['Confidence'], '-'))}</span></div>

      <div class="weekly-grid">
        <section class="weekly-section"><h4>เหตุผลจาก Performance</h4>${list(row.Reasons)}<h4 style="margin-top:14px">ความเสี่ยง</h4>${list(row.Risks)}</section>
        <section class="weekly-section test-plan"><h4>Variation Test Plan</h4><dl><dt>Control</dt><dd>${esc(plan.control || '-')}</dd><dt>Hook</dt><dd>${esc(plan.hook || '-')}</dd><dt>Message</dt><dd>${esc(plan.message || '-')}</dd><dt>Visual</dt><dd>${esc(plan.visual || '-')}</dd><dt>CTA</dt><dd>${esc(plan.cta || '-')}</dd></dl></section>
        <section class="weekly-section"><h4>Test Rule</h4><p>${esc(plan.test_rule || '-')}</p><h4 style="margin-top:14px">Creative Coverage</h4><p>${D.integer(arr(row.Creative_IDs).length)} Creative IDs · ${D.integer(arr(row.Campaign_Names).length)} Campaigns · ${esc(arr(row.Creative_Types).join(', ') || '-')}</p><h4 style="margin-top:14px">ข้อจำกัด</h4>${list(row.Limitations)}</section>
      </div>
    </article>`;
  }

  function filteredRows() {
    const query = upper($('searchFilter').value);
    const game = $('gameFilter').value;
    const account = $('accountFilter').value;
    const objective = $('objectiveFilter').value;
    const decision = $('decisionFilter').value;

    return allRows.filter((row) => {
      const name = upper(field(row, ['Creative_Group_Name']));
      const rowGame = clean(field(row, ['Game_Name', 'Game_ID']));
      const rowAccount = clean(field(row, ['Account_Name', 'Account_ID']));
      const rowObjective = clean(field(row, ['Objective']));
      const rowDecision = upper(field(row, ['Analyzer_Decision']));
      return (!query || name.includes(query)) && (!game || rowGame === game) && (!account || rowAccount === account) && (!objective || rowObjective === objective) && (!decision || rowDecision === decision);
    });
  }

  function render() {
    const rows = filteredRows();
    const counts = rows.reduce((acc, row) => {
      const key = upper(field(row, ['Analyzer_Decision']));
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    $('winnerCount').textContent = D.integer(counts.WINNER || 0);
    $('promisingCount').textContent = D.integer(counts.PROMISING || 0);
    $('watchCount').textContent = D.integer(counts.WATCH || 0);
    $('loserCount').textContent = D.integer(counts.LOSER || 0);
    $('insufficientCount').textContent = D.integer(counts.INSUFFICIENT_DATA || 0);
    $('resultBadge').textContent = `${D.integer(rows.length)} creative groups`;
    $('weeklyList').innerHTML = rows.length ? rows.map(renderCard).join('') : '<div class="empty">ไม่พบ Creative Group ตามตัวกรอง หรือ Cache Creative Weekly ยังไม่มีข้อมูล</div>';
  }

  async function load(refresh = false) {
    $('loadingMessage').textContent = refresh ? 'กำลังรีเฟรชข้อมูลล่าสุด...' : 'กำลังอ่าน Creative Weekly Analyzer Cache...';
    if (!window.Auth?.hasUsableSession?.()) return window.Auth.redirectToLogin();

    try {
      response = await D.load({ refresh });
      allRows = D.rows(response, 'creative_weekly_analyzer');
      uniqueOptions('gameFilter', allRows, ['Game_Name', 'Game_ID']);
      uniqueOptions('accountFilter', allRows, ['Account_Name', 'Account_ID']);
      uniqueOptions('objectiveFilter', allRows, ['Objective']);
      const meta = response?.creative_weekly_analyzer_cache || {};
      const section = response?.dashboard?.creative_weekly_analyzer || {};
      const window = section.current_window || allRows[0]?.Current_Window || {};
      $('windowBadge').textContent = `Window: ${window.from || '-'} → ${window.to || meta.data_date || '-'}`;
      $('updatedAt').textContent = meta.generated_at ? `Updated: ${new Date(meta.generated_at).toLocaleString('th-TH')}` : 'Updated: -';
      setUser();
      render();
      showApp();
    } catch (error) {
      if (Number(error.httpStatus) === 401) return window.Auth.redirectToLogin();
      $('loadingMessage').textContent = error.message || 'ไม่สามารถโหลดข้อมูลได้';
    }
  }

  ['searchFilter', 'gameFilter', 'accountFilter', 'objectiveFilter', 'decisionFilter'].forEach((id) => {
    $(id).addEventListener(id === 'searchFilter' ? 'input' : 'change', render);
  });

  $('resetButton').addEventListener('click', () => {
    $('searchFilter').value = '';
    $('gameFilter').value = '';
    $('accountFilter').value = '';
    $('objectiveFilter').value = '';
    $('decisionFilter').value = '';
    render();
  });

  $('refreshButton').addEventListener('click', () => load(true));
  $('logoutButton').addEventListener('click', () => window.Auth.redirectToLogin());
  load(false);
})();