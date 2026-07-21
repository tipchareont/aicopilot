'use strict';

(() => {
  const state = {
    overview: null,
    preview: null,
    activeRequestId: '',
    pollTimer: null,
  };

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? '').trim();
  const escapeHtml = (value) => clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatDate = (value) => {
    const text = clean(value).slice(0, 10);
    if (!text) return '-';
    const [y, m, d] = text.split('-');
    return y && m && d ? `${d}/${m}/${y}` : text;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const parsed = window.Auth.parseBangkokDateTime(value) || new Date(value);
    if (Number.isNaN(parsed.getTime())) return clean(value);
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  };

  const request = async (payload) => {
    const response = await fetch(window.APP_CONFIG.USER_CONTROL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: window.Auth.token(),
        ...payload,
      }),
    });

    let data = null;
    try { data = await response.json(); } catch { data = null; }

    if (response.status === 401) {
      window.Auth.redirectToLogin();
      throw new Error('Session หมดอายุ');
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || `User Control API Error (${response.status})`);
    }

    return data;
  };

  const setStatusChip = (element, status) => {
    if (!element) return;
    const value = clean(status || 'UNKNOWN').toUpperCase();
    element.textContent = value;
    element.className = 'status-chip';
    if (['HEALTHY', 'COMPLETED', 'SUCCESS'].includes(value)) element.classList.add('status-healthy');
    else if (['QUEUED', 'VALIDATING', 'BACKFILL_RUNNING', 'MIGRATION_RUNNING', 'SUMMARY_REBUILDING', 'RUNNING'].includes(value)) element.classList.add('status-running');
    else if (['MISSING_DATA', 'STALE', 'PARTIAL'].includes(value)) element.classList.add('status-warning');
    else if (['FAILED', 'REJECTED', 'ERROR'].includes(value)) element.classList.add('status-failed');
    else element.classList.add('status-neutral');
  };

  const getAccess = () => Array.isArray(state.overview?.access) ? state.overview.access : [];

  const selectedAccess = (prefix) => {
    const accountId = $(`${prefix}Account`)?.value || '';
    return getAccess().find((row) => clean(row.account_id) === clean(accountId)) || null;
  };

  const populateAccessSelects = () => {
    const access = getAccess();
    ['health', 'repair'].forEach((prefix) => {
      const gameSelect = $(`${prefix}Game`);
      const accountSelect = $(`${prefix}Account`);
      const currentGame = gameSelect.value;
      const games = [...new Map(access.map((row) => [row.game_id, row])).values()];
      gameSelect.innerHTML = games.map((row) => `<option value="${escapeHtml(row.game_id)}">${escapeHtml(row.game_name || row.game_id)}</option>`).join('');
      if (games.some((row) => row.game_id === currentGame)) gameSelect.value = currentGame;

      const renderAccounts = () => {
        const gameId = gameSelect.value;
        const filtered = access.filter((row) => row.game_id === gameId);
        const currentAccount = accountSelect.value;
        accountSelect.innerHTML = filtered.map((row) => `<option value="${escapeHtml(row.account_id)}">${escapeHtml(row.account_name || row.account_id)}</option>`).join('');
        if (filtered.some((row) => row.account_id === currentAccount)) accountSelect.value = currentAccount;
        if (prefix === 'health') renderHealth();
        else syncRepairPermissions();
      };

      gameSelect.addEventListener('change', renderAccounts);
      accountSelect.addEventListener('change', prefix === 'health' ? renderHealth : syncRepairPermissions);
      renderAccounts();
    });
  };

  const renderProfile = () => {
    const profile = state.overview?.profile || {};
    $('displayName').textContent = profile.display_name || localStorage.getItem('display_name') || '-';
    $('role').textContent = profile.role || localStorage.getItem('role') || '-';
    $('welcomeTitle').textContent = `สวัสดี ${profile.display_name || profile.username || ''}`.trim();
    $('welcomeSubtitle').textContent = `คุณเข้าถึง ${getAccess().length} Account และใช้สิทธิ์ระดับ ${profile.role || '-'}`;
    $('profileAvatar').textContent = clean(profile.display_name || profile.username || 'U').charAt(0).toUpperCase();
    $('profileDisplayName').textContent = profile.display_name || '-';
    $('profileUsername').textContent = profile.username ? `@${profile.username}` : '-';
    $('profileRoleBadge').textContent = profile.role || '-';
    $('profileUserId').textContent = profile.user_id || '-';
    $('profileStatus').textContent = profile.user_status || '-';
    $('profileLastLogin').textContent = formatDateTime(profile.last_login_at);
    $('profileSessionExpiry').textContent = formatDateTime(profile.session_expires_at);
  };

  const renderAccess = () => {
    const rows = getAccess();
    $('accessCountBadge').textContent = `${rows.length} Account`;
    $('accessTableBody').innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.game_name || row.game_id)}</strong><br><small>${escapeHtml(row.game_id)}</small></td>
        <td>${escapeHtml(row.account_name || row.account_id)}<br><small>${escapeHtml(row.account_id)}</small></td>
        <td><span class="access-badge">${escapeHtml(row.access_level)}</span></td>
        <td class="${row.permissions?.can_view ? 'permission-yes' : 'permission-no'}">${row.permissions?.can_view ? '✓' : '—'}</td>
        <td class="${row.permissions?.can_repair_missing ? 'permission-yes' : 'permission-no'}">${row.permissions?.can_repair_missing ? '✓' : '—'}</td>
        <td class="${row.permissions?.can_force_refresh ? 'permission-yes' : 'permission-no'}">${row.permissions?.can_force_refresh ? '✓' : '—'}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty">ยังไม่มีสิทธิ์เข้าถึง Game หรือ Account</td></tr>';
  };

  const renderHealth = () => {
    const access = selectedAccess('health');
    const healthRows = Array.isArray(state.overview?.health) ? state.overview.health : [];
    const health = healthRows.find((row) => clean(row.account_id) === clean(access?.account_id)) || {};
    $('healthFrom').textContent = formatDate(health.data_from);
    $('healthTo').textContent = formatDate(health.data_to);
    $('healthMissingCount').textContent = Number(health.missing_days_count || 0).toLocaleString('th-TH');
    $('healthUpdatedAt').textContent = formatDateTime(health.last_updated_at);
    setStatusChip($('healthStatusBadge'), health.status || 'UNKNOWN');
    const missing = Array.isArray(health.missing_dates) ? health.missing_dates : [];
    const zero = Array.isArray(health.verified_zero_dates) ? health.verified_zero_dates : [];
    const chips = [
      ...missing.map((date) => `<span class="date-chip missing">${formatDate(date)}</span>`),
      ...zero.slice(-30).map((date) => `<span class="date-chip zero">Zero: ${formatDate(date)}</span>`),
    ];
    $('missingDateList').innerHTML = chips.length ? chips.join('') : '<span class="empty-inline">ไม่พบวันที่ขาดในช่วง Coverage ปัจจุบัน</span>';
  };

  const renderActivity = () => {
    const rows = Array.isArray(state.overview?.activities) ? state.overview.activities : [];
    $('activityTableBody').innerHTML = rows.length ? rows.map((row) => `
      <tr><td>${escapeHtml(formatDateTime(row.created_at))}</td><td>${escapeHtml(row.action_type)}</td><td>${escapeHtml(row.module)}</td><td>${escapeHtml(row.record_id)}</td><td>${escapeHtml(row.action_detail)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">ยังไม่มีกิจกรรม</td></tr>';
  };

  const syncRepairPermissions = () => {
    const access = selectedAccess('repair');
    const canForce = Boolean(access?.permissions?.can_force_refresh);
    $('forceRefreshRow').classList.toggle('hidden', !canForce);
    if (!canForce) $('forceRefresh').checked = false;
    $('reasonRow').classList.toggle('hidden', !$('forceRefresh').checked);
    state.preview = null;
    $('startRepairButton').disabled = true;
    setStatusChip($('previewStatusBadge'), 'รอ Preview');
  };

  const renderPreview = (preview) => {
    state.preview = preview;
    $('previewSelectedCount').textContent = preview.selected_dates_count || 0;
    $('previewExistingCount').textContent = preview.existing_dates_count || 0;
    $('previewZeroCount').textContent = preview.verified_zero_dates_count || 0;
    $('previewRepairCount').textContent = preview.repair_dates_count || 0;
    setStatusChip($('previewStatusBadge'), preview.allowed ? 'READY' : 'REJECTED');
    $('startRepairButton').disabled = !preview.allowed;

    const ranges = Array.isArray(preview.recommended_missing_ranges) ? preview.recommended_missing_ranges : [];
    const details = [
      `<p><strong>${escapeHtml(preview.message || '')}</strong></p>`,
      ranges.length ? `<ul>${ranges.map((range) => `<li>${formatDate(range.start_date)} – ${formatDate(range.end_date)}</li>`).join('')}</ul>` : '',
      preview.force_refresh ? '<p>คำขอนี้จะ Refresh วันที่ที่มีข้อมูลอยู่แล้ว และต้องมีเหตุผลประกอบ</p>' : '',
    ];
    $('previewDetail').innerHTML = details.join('');
    $('repairMessage').textContent = preview.allowed ? 'ตรวจสอบผ่าน สามารถเริ่มซ่อมข้อมูลได้' : (preview.message || 'คำขอไม่ผ่านเงื่อนไข');
    $('repairMessage').className = `form-message ${preview.allowed ? 'success' : 'error'}`;
  };

  const previewRepair = async () => {
    const access = selectedAccess('repair');
    const startDate = $('repairStartDate').value;
    const endDate = $('repairEndDate').value;
    if (!access || !startDate || !endDate) throw new Error('กรุณาเลือก Game, Account และช่วงวันที่');
    const preview = await request({
      action: 'PREVIEW_REPAIR',
      game_id: access.game_id,
      account_id: access.account_id,
      start_date: startDate,
      end_date: endDate,
      force_refresh: $('forceRefresh').checked,
      reason: $('repairReason').value,
    });
    renderPreview(preview.preview || preview);
  };

  const startRepair = async () => {
    if (!state.preview?.allowed) throw new Error('กรุณา Preview และแก้เงื่อนไขให้ผ่านก่อน');
    const access = selectedAccess('repair');
    const result = await request({
      action: 'START_REPAIR',
      game_id: access.game_id,
      account_id: access.account_id,
      start_date: $('repairStartDate').value,
      end_date: $('repairEndDate').value,
      force_refresh: $('forceRefresh').checked,
      reason: $('repairReason').value,
    });
    state.activeRequestId = result.request_id;
    $('repairProgressPanel').classList.remove('hidden');
    $('repairRequestId').textContent = result.request_id;
    updateRepairProgress(result.status || 'QUEUED', result.message || 'ระบบรับคำขอแล้ว');
    startPolling();
  };

  const updateRepairProgress = (status, message) => {
    const upper = clean(status).toUpperCase();
    const progressMap = { QUEUED:10, VALIDATING:20, BACKFILL_RUNNING:45, MIGRATION_RUNNING:70, SUMMARY_REBUILDING:85, COMPLETED:100, FAILED:100, REJECTED:100 };
    setStatusChip($('repairStatusBadge'), upper);
    $('repairProgressBar').style.width = `${progressMap[upper] || 15}%`;
    $('repairProgressMessage').textContent = message || upper;
  };

  const startPolling = () => {
    clearInterval(state.pollTimer);
    const poll = async () => {
      try {
        const result = await request({ action: 'REPAIR_STATUS', request_id: state.activeRequestId });
        const repair = result.repair_request || {};
        updateRepairProgress(repair.status, repair.message || repair.error_message || `สถานะ: ${repair.status}`);
        if (['COMPLETED', 'FAILED', 'REJECTED'].includes(clean(repair.status).toUpperCase())) {
          clearInterval(state.pollTimer);
          state.pollTimer = null;
          await loadOverview(false);
        }
      } catch (error) {
        $('repairProgressMessage').textContent = error.message;
      }
    };
    poll();
    state.pollTimer = setInterval(poll, 10000);
  };

  const loadOverview = async (showLoading = true) => {
    if (showLoading) {
      $('loading').classList.remove('hidden');
      $('shell').classList.add('hidden');
    }
    const result = await request({ action: 'OVERVIEW' });
    state.overview = result;
    renderProfile();
    renderAccess();
    populateAccessSelects();
    renderHealth();
    renderActivity();
    setStatusChip($('systemStatus'), result.system_status || 'READY');
    $('loading').classList.add('hidden');
    $('shell').classList.remove('hidden');
  };

  const bindEvents = () => {
    document.querySelectorAll('.workspace-tab').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.workspace-tab').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('.workspace-section').forEach((section) => section.classList.toggle('active', section.dataset.section === button.dataset.tab));
      });
    });
    $('refreshButton').addEventListener('click', () => loadOverview(true).catch(showFatal));
    $('logoutButton').addEventListener('click', () => { window.Auth.clearDashboardCache(); window.Auth.clear(); location.replace('../index.html'); });
    $('forceRefresh').addEventListener('change', () => { $('reasonRow').classList.toggle('hidden', !$('forceRefresh').checked); state.preview = null; $('startRepairButton').disabled = true; });
    $('previewRepairButton').addEventListener('click', async () => {
      try { $('repairMessage').textContent = 'กำลังตรวจสอบ Coverage...'; $('repairMessage').className = 'form-message'; await previewRepair(); }
      catch (error) { $('repairMessage').textContent = error.message; $('repairMessage').className = 'form-message error'; }
    });
    $('startRepairButton').addEventListener('click', async () => {
      try { $('startRepairButton').disabled = true; await startRepair(); }
      catch (error) { $('repairMessage').textContent = error.message; $('repairMessage').className = 'form-message error'; $('startRepairButton').disabled = !state.preview?.allowed; }
    });
  };

  const showFatal = (error) => {
    $('loadingMessage').textContent = error.message || 'ไม่สามารถโหลด My Workspace ได้';
    setTimeout(() => window.Auth.redirectToLogin(), 1800);
  };

  bindEvents();
  loadOverview(true).catch(showFatal);
})();
