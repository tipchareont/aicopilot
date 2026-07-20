'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? '').trim();
  const esc = (value) => clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const state = {
    response: null,
    accounts: [],
    sending: false,
  };

  const normalizeApiResult = (value) => {
    let result = value;
    if (Array.isArray(result)) result = result[0];
    if (
      result &&
      typeof result === 'object' &&
      Object.keys(result).length === 1 &&
      typeof result.body === 'string'
    ) {
      try { result = JSON.parse(result.body); } catch {}
    }
    if (typeof result === 'string') result = JSON.parse(result);
    return result;
  };

  const renderUser = () => {
    $('displayName').textContent =
      localStorage.getItem('display_name') ||
      localStorage.getItem('username') ||
      '-';
    $('role').textContent = localStorage.getItem('role') || 'USER';
  };

  const dashboardRows = (key) =>
    Array.isArray(state.response?.dashboard?.[key]?.rows)
      ? state.response.dashboard[key].rows
      : [];

  const field = (row, names, fallback = '') => {
    for (const name of names) {
      if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') {
        return row[name];
      }
    }
    return fallback;
  };

  const buildScopeOptions = () => {
    const rows = dashboardRows('account');
    const map = new Map();

    for (const row of rows) {
      const gameId = clean(field(row, ['Game_ID']));
      const gameName = clean(field(row, ['Game_Name'], gameId));
      const accountId = clean(field(row, ['Account_ID']));
      const accountName = clean(field(row, ['Account_Name'], accountId));
      if (!accountId && !gameId) continue;

      const key = `${gameId}||${accountId}`;
      if (!map.has(key)) {
        map.set(key, { gameId, gameName, accountId, accountName });
      }
    }

    state.accounts = [...map.values()].sort((a, b) =>
      `${a.gameName}${a.accountName}`.localeCompare(`${b.gameName}${b.accountName}`, 'th')
    );

    const games = new Map();
    for (const account of state.accounts) {
      const key = account.gameId || account.gameName;
      if (key && !games.has(key)) games.set(key, account.gameName || account.gameId);
    }

    $('gameFilter').innerHTML =
      '<option value="">ทุก Game ที่มีสิทธิ์</option>' +
      [...games.entries()].map(([value, label]) =>
        `<option value="${esc(value)}">${esc(label)}</option>`
      ).join('');

    renderAccountOptions();
  };

  const renderAccountOptions = () => {
    const gameValue = clean($('gameFilter').value);
    const current = clean($('accountFilter').value);
    const accounts = state.accounts.filter((row) =>
      !gameValue || row.gameId === gameValue || row.gameName === gameValue
    );

    $('accountFilter').innerHTML =
      '<option value="">ทุก Account ที่มีสิทธิ์</option>' +
      accounts.map((row) =>
        `<option value="${esc(row.accountId)}">${esc(row.accountName || row.accountId)}</option>`
      ).join('');

    if (accounts.some((row) => row.accountId === current)) {
      $('accountFilter').value = current;
    }

    updateScopeLabel();
  };

  const selectedScope = () => {
    const gameValue = clean($('gameFilter').value);
    const gameOption = $('gameFilter').selectedOptions[0];
    const accountId = clean($('accountFilter').value);
    const account = state.accounts.find((row) => row.accountId === accountId);

    return {
      game_id: gameValue,
      game_name: gameValue ? clean(gameOption?.textContent) : '',
      account_id: accountId,
      account_name: account?.accountName || '',
    };
  };

  const updateScopeLabel = () => {
    const scope = selectedScope();
    const parts = [scope.game_name, scope.account_name].filter(Boolean);
    $('scopeLabel').textContent = `Scope: ${parts.length ? parts.join(' / ') : 'ทุกข้อมูลที่มีสิทธิ์'}`;
  };

  const appendMessage = ({ role, text, meta = '', evidence = [], limitations = [] }) => {
    const wrapper = document.createElement('article');
    wrapper.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

    const evidenceHtml = role === 'assistant' && evidence.length
      ? `<div class="evidence-list">${evidence.map((row) => `
          <div class="evidence-card">
            <div class="evidence-top">
              <strong>${esc(row.entity_name || row.entity_type || 'หลักฐาน')}</strong>
              <span class="evidence-status">${esc(row.status || row.entity_type || '')}</span>
            </div>
            <p>${esc([row.metric, row.value].filter(Boolean).join(': '))}${row.reason ? `<br>${esc(row.reason)}` : ''}${row.advisor_decision ? `<br><strong>Scale:</strong> ${esc(row.advisor_decision)}${row.budget_step_pct ? ` · Budget Step ${esc(row.budget_step_pct)}%` : ''}` : ''}${row.risk ? `<br><strong>Risk:</strong> ${esc(row.risk)}` : ''}${row.guardrail ? `<br><strong>Guardrail:</strong> ${esc(row.guardrail)}` : ''}${row.analyzer_decision ? `<br><strong>Creative Weekly:</strong> ${esc(row.analyzer_decision)}${row.weekly_rank ? ` · Rank ${esc(row.weekly_rank)}` : ''}` : ''}${row.suggested_test ? `<br><strong>Suggested Test:</strong> ${esc(row.suggested_test)}` : ''}</p>
          </div>
        `).join('')}</div>`
      : '';

    const limitationText = role === 'assistant' && limitations.length
      ? `\n\nข้อจำกัด:\n${limitations.map((value) => `• ${clean(value)}`).join('\n')}`
      : '';

    wrapper.innerHTML = `
      <div class="message-label">${role === 'user' ? 'คุณ' : 'AI Copilot'}</div>
      <div class="message-bubble">${esc(`${text}${limitationText}`)}</div>
      ${meta ? `<div class="message-meta">${esc(meta)}</div>` : ''}
      ${evidenceHtml}
    `;

    $('chatMessages').appendChild(wrapper);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    return wrapper;
  };

  const appendTyping = () => {
    const wrapper = document.createElement('article');
    wrapper.id = 'typingMessage';
    wrapper.className = 'chat-message assistant-message';
    wrapper.innerHTML = `
      <div class="message-label">AI Copilot</div>
      <div class="message-bubble typing-bubble">
        <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
      </div>
    `;
    $('chatMessages').appendChild(wrapper);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  };

  const setSending = (value) => {
    state.sending = value;
    $('sendButton').disabled = value;
    $('questionInput').disabled = value;
    $('sendButton').textContent = value ? 'AI กำลังวิเคราะห์...' : 'ส่งคำถาม';
  };

  const ask = async (question) => {
    if (state.sending) return;
    const text = clean(question);
    if (!text) return;

    appendMessage({ role: 'user', text });
    $('questionInput').value = '';
    $('characterCount').textContent = '0 / 1,500';
    setSending(true);
    appendTyping();

    try {
      const url = window.APP_CONFIG?.AI_CHAT_URL;
      if (!url) throw new Error('ไม่พบ AI Chat URL');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: window.Auth?.token?.(),
          question: text,
          ...selectedScope(),
        }),
      });

      const raw = await response.text();
      if (!raw.trim()) throw new Error('AI Chat API ไม่ได้ส่งข้อมูลกลับมา');

      let result;
      try {
        result = normalizeApiResult(JSON.parse(raw));
      } catch {
        throw new Error('AI Chat API ส่งข้อมูลที่อ่านไม่ได้');
      }

      if (!response.ok || !result?.success) {
        const error = new Error(result?.message || `AI Chat API Error (${response.status})`);
        error.httpStatus = Number(result?.http_status || response.status || 500);
        throw error;
      }

      $('typingMessage')?.remove();
      appendMessage({
        role: 'assistant',
        text: result.answer,
        meta: `ข้อมูลวันที่ ${result.data_date || '-'} · ${result.scope || 'ทุกข้อมูลที่มีสิทธิ์'}`,
        evidence: Array.isArray(result.evidence) ? result.evidence : [],
        limitations: Array.isArray(result.limitations) ? result.limitations : [],
      });
    } catch (error) {
      $('typingMessage')?.remove();
      if ([401].includes(error.httpStatus)) {
        window.Auth?.redirectToLogin?.();
        return;
      }
      appendMessage({
        role: 'assistant',
        text: `ไม่สามารถตอบคำถามนี้ได้: ${error.message || 'เกิดข้อผิดพลาด'}`,
      });
    } finally {
      setSending(false);
      $('questionInput').focus();
    }
  };

  const start = async () => {
    try {
      if (!window.Auth?.hasUsableSession?.()) {
        window.Auth?.redirectToLogin?.();
        return;
      }

      renderUser();
      state.response = await window.CopilotData.load();
      buildScopeOptions();

      const date =
        state.response?.cache?.data_date ||
        state.response?.ai_cache?.data_date ||
        '-';
      $('dataDateBadge').textContent = `ข้อมูล ${date}`;

      $('loading').classList.add('hidden');
      $('shell').classList.remove('hidden');
      $('questionInput').focus();
    } catch (error) {
      if ([401, 403].includes(error.httpStatus)) {
        window.Auth?.redirectToLogin?.();
        return;
      }
      $('loadingMessage').textContent = error.message || 'ไม่สามารถเปิด AI Chat ได้';
    }
  };

  $('gameFilter').addEventListener('change', renderAccountOptions);
  $('accountFilter').addEventListener('change', updateScopeLabel);
  $('logoutButton').addEventListener('click', () => window.Auth?.redirectToLogin?.());
  $('clearChatButton').addEventListener('click', () => {
    $('chatMessages').innerHTML = `
      <article class="chat-message assistant-message">
        <div class="message-label">AI Copilot</div>
        <div class="message-bubble">เริ่มบทสนทนาใหม่แล้ว ถามคำถามต่อได้เลย</div>
      </article>
    `;
  });
  $('chatForm').addEventListener('submit', (event) => {
    event.preventDefault();
    ask($('questionInput').value);
  });
  $('questionInput').addEventListener('input', () => {
    $('characterCount').textContent = `${$('questionInput').value.length.toLocaleString('th-TH')} / 1,500`;
  });
  $('questionInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      $('chatForm').requestSubmit();
    }
  });
  document.querySelectorAll('.suggestion').forEach((button) => {
    button.addEventListener('click', () => ask(button.dataset.question));
  });

  start();
})();
