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

  const decisionOrder = ['WINNER', 'PROMISING', 'WATCH', 'LOSER', 'INSUFFICIENT_DATA'];
  const labels = {
    WINNER: 'Winner',
    PROMISING: 'Promising',
    WATCH: 'Watch',
    LOSER: 'Loser',
    INSUFFICIENT_DATA: 'ข้อมูลไม่พอ',
  };
  const groupDescriptions = {
    WINNER: 'ตัวนี้มีแนวโน้มดีที่สุดในกลุ่มเดียวกัน เหมาะเป็น Control',
    PROMISING: 'ผลงานดีและยังมีโอกาสโต ถ้าเพิ่มการทดสอบอีกเล็กน้อย',
    WATCH: 'ยังต้องเฝ้าดู ควรปรับ 1 จุดแล้วดูผลต่อ',
    LOSER: 'ควรพักไว้ก่อน แล้วปรับใหม่ก่อนกลับมาทดสอบ',
    INSUFFICIENT_DATA: 'ข้อมูลยังไม่พอสำหรับสรุป',
  };
  const actionLabels = {
    CONTINUE_AND_VARIATE: 'ทำต่อและแตก Variation',
    TEST_VARIATION: 'ทดลอง Variation',
    REFRESH_TEST: 'Refresh แล้วทดสอบใหม่',
    REDUCE_AND_REWORK: 'ลด Priority และ Rework',
    COLLECT_MORE_DATA: 'เก็บข้อมูลเพิ่ม',
  };
  const momentumLabels = {
    IMPROVING: 'ดีขึ้น',
    STABLE: 'ทรงตัว',
    WORSENING: 'แย่ลง',
    UNKNOWN: 'ยังไม่มีข้อมูลเทียบ',
  };

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

  function assets(row) {
    const list = arr(row.Creative_Assets).filter((asset) => clean(asset?.Thumbnail_URL));
    if (list.length) return list;
    const url = clean(field(row, ['Thumbnail_URL']));
    return url ? [{
      Creative_ID: field(row, ['Creative_ID']),
      Creative_Name: field(row, ['Creative_Group_Name']),
      Thumbnail_URL: url,
      Creative_Type: field(row, ['Creative_Type']),
    }] : [];
  }

  function imageBox(asset, className = '') {
    const url = clean(asset?.Thumbnail_URL);
    if (!url) return `<div class="creative-image ${className} image-failed"><span>ไม่มีรูป Creative</span></div>`;
    return `<a class="creative-image ${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="เปิดรูป Creative ขนาดเต็ม"><img src="${esc(url)}" alt="${esc(asset?.Creative_Name || 'Creative')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('image-failed');this.remove()"><span>ไม่สามารถโหลดรูปได้</span></a>`;
  }

  function shortSummary(row) {
    const decision = upper(field(row, ['Analyzer_Decision'], 'INSUFFICIENT_DATA'));
    const action = upper(field(row, ['Recommended_Action']));
    const actionText = actionLabels[action] || 'ทดสอบต่อ';
    if (decision === 'WINNER') return `คงแกนเดิมไว้ แล้วแตกแบบใหม่เพิ่ม โดยใช้ชุดนี้เป็นตัวตั้งต้น`;
    if (decision === 'PROMISING') return `ตัวนี้มีแววดี ให้เพิ่มการทดสอบอีกเล็กน้อยเพื่อเก็บข้อมูลเพิ่ม`;
    if (decision === 'WATCH') return `ยังไม่ควรสรุป ให้เปลี่ยนแค่ 1 จุด แล้วเช็กผลรอบถัดไป`;
    if (decision === 'LOSER') return `พักตัวนี้ก่อน แล้วปรับสาร/ภาพ/CTA ใหม่ก่อนกลับมาทดสอบ`;
    return `${actionText} เมื่อข้อมูลเพียงพอ`;
  }

  function simpleSteps(row) {
    const metricLabel = field(row, ['Main_Metric_Label'], 'Main Metric');
    const plan = row.Test_Plan || {};
    return [
      `คงแกนหลักของ Creative Group นี้ไว้ก่อน`,
      `เลือกเปลี่ยน 1 อย่างจาก ${plan.hook ? 'Hook' : plan.message ? 'Message' : plan.visual ? 'Visual' : 'CTA'} เพื่อให้รู้ชัดว่าอะไรส่งผล`,
      `ใช้ ${metricLabel} เดิมเป็นตัวตัดสินผลรอบถัดไป`,
    ];
  }

  function exampleSet(type, objective) {
    const objectiveLabel = D.displayObjective(objective) || 'Conversion';
    if (type === 'cta') {
      if (objectiveLabel === 'Conversion') return ['สมัครเลยตอนนี้', 'รับสิทธิ์แล้วเริ่มเล่นเลย'];
      if (objectiveLabel === 'Traffic') return ['ดูรายละเอียดเพิ่มเติม', 'คลิกเพื่อดูข้อมูล'];
      if (objectiveLabel === 'Awareness') return ['ทำความรู้จักเกมนี้', 'ดูจุดเด่นเพิ่มเติม'];
      if (objectiveLabel === 'Engagement') return ['คอมเมนต์ความเห็นของคุณ', 'ร่วมกิจกรรมตอนนี้'];
      return ['กดดูรายละเอียด', 'ทดลองคลิกดู'];
    }
    if (type === 'hook') return ['เปิดด้วยประโยคสั้นที่สื่อประโยชน์ชัดเจน', 'เปิดด้วยคำถามที่ชวนหยุดดู'];
    if (type === 'message') return ['เน้น 1 จุดเด่นหลักแล้วตามด้วยประโยชน์ที่ผู้เล่นจะได้', 'เปลี่ยนถ้อยคำให้ตรง Pain Point มากขึ้น'];
    if (type === 'visual') return ['เวอร์ชัน A: ตัวละครเด่น + headline ชัด', 'เวอร์ชัน B: โฟกัสของรางวัล/ระบบเกม + CTA เด่น'];
    return ['ตัวอย่างที่ 1', 'ตัวอย่างที่ 2'];
  }

  function exampleDropdown(title, items) {
    return `<details class="example-toggle"><summary>${esc(title)}</summary><div class="example-toggle-body"><ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div></details>`;
  }

  function renderActionFocus(row) {
    const action = upper(field(row, ['Recommended_Action']));
    const steps = simpleSteps(row);
    return `<section class="action-focus"><div class="action-focus-title"><span>สิ่งที่ควรทำต่อ</span><strong>${esc(actionLabels[action] || action || 'Recommendation')}</strong></div><ol>${steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol></section>`;
  }

  function renderCreative(row) {
    const decision = upper(field(row, ['Analyzer_Decision'], 'INSUFFICIENT_DATA'));
    const action = upper(field(row, ['Recommended_Action']));
    const momentum = upper(field(row, ['Momentum'], 'UNKNOWN'));
    const plan = row.Test_Plan || {};
    const rank = D.integer(field(row, ['Weekly_Rank']));
    const peers = D.integer(field(row, ['Peer_Count']));
    const currentWindow = row.Current_Window || {};
    const title = field(row, ['Creative_Group_Name'], '-');
    const campaignCount = arr(row.Campaign_Names).length || arr(row.Campaign_IDs).length;
    const objective = D.displayObjective(field(row, ['Objective'], '-')) || '-';
    const isConversion = D.isConversionObjective(objective);
    const completeRegister = D.metric(row, 'completeRegister');
    const cpcr = D.metric(row, 'cpcr');
    const thumb = assets(row)[0];

    return `<details class="creative-item item-${esc(decision)}">
      <summary class="creative-summary">
        <div class="summary-image">${imageBox(thumb, 'summary-thumb')}</div>
        <div class="summary-main"><div class="summary-title-line"><h4>${esc(title)}</h4><span class="creative-decision decision-${esc(decision)}">${esc(labels[decision] || decision)}</span></div><p>${esc(field(row, ['Game_Name', 'Game_ID'], '-'))} · ${esc(objective)} · ${esc(field(row, ['Phase'], '-'))}</p><strong class="summary-action">${esc(actionLabels[action] || action || '-')}</strong></div>
        <div class="summary-metrics"><span>${esc(field(row, ['Main_Metric_Label'], 'Metric'))}<b>${esc(metricValue(row))}</b></span><span>Spend 7D<b>฿${D.money(field(row, ['Spend']))}</b></span><span>Rank<b>${rank} / ${peers}</b></span></div>
        <span class="expand-label">ดูรายละเอียด</span>
      </summary>

      <div class="creative-detail">
        <div class="creative-hero compact-mode">
          <div class="hero-content full-width">
            ${renderActionFocus(row)}
            <div class="quick-facts"><span>Momentum <b class="momentum-text momentum-${esc(momentum)}">${esc(momentumLabels[momentum] || momentum)}</b></span><span>Confidence <b>${esc(field(row, ['Confidence'], '-'))}</b></span><span>Active Days <b>${D.integer(field(currentWindow, ['active_days']))}</b></span><span>Campaigns <b>${D.integer(campaignCount)}</b></span><span>Complete Register <b>${isConversion ? D.integer(completeRegister) : '-'}</b></span><span>Cost / Complete Register <b>${isConversion && completeRegister ? `฿${D.money(cpcr)}` : '-'}</b></span></div>
            <div class="simple-note">${esc(shortSummary(row))}</div>
          </div>
        </div>

        <div class="detail-columns">
          <section class="compact-block"><h5>ทำไมระบบแนะนำแบบนี้</h5>${list(row.Reasons)}<h5>ความเสี่ยงที่ต้องรู้</h5>${list(row.Risks)}</section>
          <section class="compact-block plan-block"><h5>Variation Plan</h5><div class="plan-row"><b>Hook</b><p>${esc(plan.hook || '-')}</p></div>${exampleDropdown('ดูตัวอย่าง Hook 2 แบบ', exampleSet('hook', objective))}<div class="plan-row"><b>Message</b><p>${esc(plan.message || '-')}</p></div>${exampleDropdown('ดูตัวอย่าง Message 2 แบบ', exampleSet('message', objective))}<div class="plan-row"><b>Visual</b><p>${esc(plan.visual || '-')}</p></div>${exampleDropdown('ดูตัวอย่าง Visual Direction', exampleSet('visual', objective))}<div class="plan-row"><b>CTA</b><p>${esc(plan.cta || '-')}</p></div>${exampleDropdown('ดูตัวอย่าง CTA 2 แบบ', exampleSet('cta', objective))}</section>
        </div>

        <details class="secondary-details"><summary>ดู Test Rule, Coverage และข้อจำกัด</summary><div class="secondary-grid"><section><h5>Test Rule</h5><p>${esc(plan.test_rule || '-')}</p></section><section><h5>Creative Coverage</h5><p>${D.integer(arr(row.Creative_IDs).length)} Creative IDs · ${D.integer(campaignCount)} Campaigns · ${esc(arr(row.Creative_Types).join(', ') || '-')}</p></section><section><h5>ข้อจำกัด</h5>${list(row.Limitations)}</section></div></details>
      </div>
    </details>`;
  }

  function renderDecisionGroup(decision, rows) {
    const open = decision === 'WINNER' || (decisionOrder.find((key) => rows.some((row) => upper(field(row, ['Analyzer_Decision'])) === key)) === decision);
    return `<details class="decision-group group-${decision}" ${open ? 'open' : ''}><summary><div><span class="decision-dot"></span><strong>${esc(labels[decision])}</strong><small>${esc(groupDescriptions[decision])}</small></div><b>${D.integer(rows.length)}</b></summary><div class="decision-content">${rows.map(renderCreative).join('')}</div></details>`;
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
      const rowObjective = D.displayObjective(field(row, ['Objective'], ''));
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

    const sections = decisionOrder.map((decision) => {
      const groupRows = rows.filter((row) => upper(field(row, ['Analyzer_Decision'])) === decision);
      return groupRows.length ? renderDecisionGroup(decision, groupRows) : '';
    }).join('');

    $('weeklyList').innerHTML = sections || '<div class="empty">ไม่พบ Creative Group ตามตัวกรอง หรือ Cache Creative Weekly ยังไม่มีข้อมูล</div>';
  }

  async function load(refresh = false) {
    $('loadingMessage').textContent = refresh ? 'กำลังรีเฟรชข้อมูลล่าสุด...' : 'กำลังอ่าน Creative Weekly Analyzer Cache...';
    if (!window.Auth?.hasUsableSession?.()) return window.Auth.redirectToLogin();

    try {
      response = await D.load({ refresh });
      allRows = D.rows(response, 'creative_weekly_analyzer');
      uniqueOptions('gameFilter', allRows, (row) => clean(field(row, ['Game_Name', 'Game_ID'])));
      uniqueOptions('accountFilter', allRows, (row) => clean(field(row, ['Account_Name', 'Account_ID'])));
      uniqueOptions('objectiveFilter', allRows, (row) => D.displayObjective(field(row, ['Objective'], '')));
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
