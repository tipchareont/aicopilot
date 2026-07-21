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

  function aiExampleButton(type, row) {
    const index = Number(row.__rowIndex);
    const label = { hook: 'Hook', message: 'Message', visual: 'Visual Direction', cta: 'CTA' }[type] || type;
    return `<div class="ai-example-area"><button type="button" class="ai-example-button" data-example-type="${esc(type)}" data-row-index="${index}">✨ ให้ AI สร้างตัวอย่าง ${esc(label)} 2 แบบ</button><div class="ai-example-result" id="ai-example-${index}-${esc(type)}"></div></div>`;
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
          <section class="compact-block plan-block"><h5>Variation Plan</h5><div class="plan-row"><b>Hook</b><p>${esc(plan.hook || '-')}</p></div>${aiExampleButton('hook', row)}<div class="plan-row"><b>Message</b><p>${esc(plan.message || '-')}</p></div>${aiExampleButton('message', row)}<div class="plan-row"><b>Visual</b><p>${esc(plan.visual || '-')}</p></div>${aiExampleButton('visual', row)}<div class="plan-row"><b>CTA</b><p>${esc(plan.cta || '-')}</p></div>${aiExampleButton('cta', row)}</section>
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

  function promptForExample(row, type) {
    const label = { hook: 'Hook', message: 'Message', visual: 'Visual Direction', cta: 'CTA' }[type] || type;
    const plan = row.Test_Plan || {};
    const currentPlan = clean(plan[type] || '');
    const objective = D.displayObjective(field(row, ['Objective'], '-')) || '-';
    const creativeGroup = field(row, ['Creative_Group_Name'], '-');
    const phase = field(row, ['Phase'], '-');

    return [
      `ช่วยสร้างตัวอย่าง ${label} ภาษาไทย 2 แบบ สำหรับ Creative Group: ${creativeGroup}`,
      `Objective: ${objective}`,
      `Phase: ${phase}`,
      currentPlan ? `แนวทางที่ระบบแนะนำไว้: ${currentPlan}` : '',
      'ตอบเฉพาะตัวอย่าง 2 แบบที่พร้อมนำไปใช้ ห้ามใส่ตัวเลข Performance ใหม่ ห้ามอธิบายยาว',
      type === 'visual' ? 'สำหรับ Visual ให้เขียนเป็น Direction ที่ทีม Creative อ่านแล้วทำภาพต่อได้' : '',
    ].filter(Boolean).join('\n');
  }

  function extractAiAnswer(value) {
    let current = value;

    for (let depth = 0; depth < 6; depth++) {
      if (Array.isArray(current)) {
        current = current[0];
        continue;
      }

      if (current && typeof current === 'object') {
        if (current.answer !== undefined) {
          current = current.answer;
          continue;
        }
        if (current.body !== undefined) {
          current = current.body;
          continue;
        }
        if (current.data !== undefined) {
          current = current.data;
          continue;
        }
        break;
      }

      if (typeof current === 'string') {
        const cleaned = current
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        if (
          (cleaned.startsWith('{') && cleaned.endsWith('}')) ||
          (cleaned.startsWith('[') && cleaned.endsWith(']'))
        ) {
          try {
            current = JSON.parse(cleaned);
            continue;
          } catch {}
        }

        return cleaned.replace(/\\n/g, '\n').trim();
      }

      break;
    }

    return typeof current === 'string'
      ? current.trim()
      : '';
  }

  function renderAiAnswer(value) {
    const answer = extractAiAnswer(value);
    if (!answer) return '<div>AI ไม่ได้ส่งตัวอย่างกลับมา</div>';

    const lines = answer
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^ตัวอย่าง\s+/i.test(line));

    const examples = lines
      .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 2);

    if (!examples.length) {
      return `<p>${esc(answer)}</p>`;
    }

    return `<ol class="ai-example-list">${examples
      .map((item) => `<li>${esc(item)}</li>`)
      .join('')}</ol>`;
  }

  async function generateExample(button) {
    const index = Number(button.dataset.rowIndex);
    const type = clean(button.dataset.exampleType);
    const row = allRows[index];
    const target = $(`ai-example-${index}-${type}`);
    if (!row || !target || button.disabled) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'AI กำลังสร้างตัวอย่าง...';
    target.className = 'ai-example-result is-loading';
    target.textContent = 'กำลังประมวลผลเฉพาะรายการนี้ จึงใช้ Token เฉพาะตอนกด';

    try {
      const url = window.APP_CONFIG?.AI_CHAT_URL;
      if (!url) throw new Error('ไม่พบ AI Chat URL');

      const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: window.Auth?.token?.(),
          question: promptForExample(row, type),
          game_id: field(row, ['Game_ID'], ''),
          game_name: field(row, ['Game_Name'], ''),
          account_id: field(row, ['Account_ID'], ''),
          account_name: field(row, ['Account_Name'], ''),
        }),
      });

      const raw = await apiResponse.text();
      if (!raw.trim()) throw new Error('AI Chat API ไม่ได้ส่งข้อมูลกลับมา');

      let result;
      try {
        result = JSON.parse(raw);
        if (Array.isArray(result)) result = result[0];
        if (result && typeof result === 'object' && typeof result.body === 'string') result = JSON.parse(result.body);
      } catch {
        throw new Error('AI Chat API ส่งข้อมูลที่อ่านไม่ได้');
      }

      if (!apiResponse.ok || !result?.success) {
        const error = new Error(result?.message || `AI Chat API Error (${apiResponse.status})`);
        error.httpStatus = Number(result?.http_status || apiResponse.status || 500);
        throw error;
      }

      target.className = 'ai-example-result is-ready';
      target.innerHTML = renderAiAnswer(result);
      button.textContent = '✨ สร้างตัวอย่างใหม่อีกครั้ง';
    } catch (error) {
      if (Number(error.httpStatus) === 401) return window.Auth?.redirectToLogin?.();
      target.className = 'ai-example-result is-error';
      target.textContent = `สร้างตัวอย่างไม่สำเร็จ: ${error.message || 'เกิดข้อผิดพลาด'}`;
      button.textContent = originalText;
    } finally {
      button.disabled = false;
    }
  }

  async function load(refresh = false) {
    $('loadingMessage').textContent = refresh ? 'กำลังรีเฟรชข้อมูลล่าสุด...' : 'กำลังอ่าน Creative Weekly Analyzer Cache...';
    if (!window.Auth?.hasUsableSession?.()) return window.Auth.redirectToLogin();

    try {
      response = await D.load({ refresh });
      allRows = D.rows(response, 'creative_weekly_analyzer').map((row, index) => ({ ...row, __rowIndex: index }));
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

  $('weeklyList').addEventListener('click', (event) => {
    const button = event.target.closest('.ai-example-button');
    if (button) generateExample(button);
  });

  $('refreshButton').addEventListener('click', () => load(true));
  $('logoutButton').addEventListener('click', () => window.Auth.redirectToLogin());
  load(false);
})();
