'use strict';

/*
=====================================================
AI Marketing Copilot - Dashboard Frontend
Local Cache Strategy

Logic:
1. ตรวจ Token และ Session Expiry จาก Browser
2. ถ้ามี Local Cache ให้แสดงทันที
3. ถ้าเคย Sync แล้วในวันนี้ ไม่เรียก API ซ้ำ
4. ถ้ายังไม่ได้ Sync วันนี้ ให้ Sync เบื้องหลัง 1 ครั้ง
5. กด Refresh Data เพื่อบังคับ Sync ได้
=====================================================
*/

const DASHBOARD_CACHE_PREFIX =
  'ai_marketing_copilot_dashboard_cache_v2';

const loading = document.getElementById('loading');
const loadingMessage =
  document.getElementById('loadingMessage');
const shell = document.getElementById('shell');

/*
=====================================================
DOM Helpers
=====================================================
*/

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);

  if (element) {
    element.textContent = value ?? '-';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/*
=====================================================
Local Storage Helpers
=====================================================
*/

function firstStoredValue(keys) {
  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (value !== null && value !== '') {
      return value;
    }
  }

  return '';
}

function parseStoredJson(key) {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(key);
    return null;
  }
}

function getSessionId() {
  return firstStoredValue([
    'session_id',
    'Session_ID',
    'sessionId',
  ]);
}

function getUsername() {
  return firstStoredValue([
    'username',
    'Username',
  ]);
}

function getDashboardCacheKey() {
  const owner =
    getSessionId() ||
    getUsername() ||
    'anonymous';

  return `${DASHBOARD_CACHE_PREFIX}:${owner}`;
}

function clearDashboardLocalCache() {
  const keysToDelete = [];

  for (
    let index = 0;
    index < localStorage.length;
    index += 1
  ) {
    const key = localStorage.key(index);

    if (
      key &&
      key.startsWith(DASHBOARD_CACHE_PREFIX)
    ) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    localStorage.removeItem(key);
  });
}

/*
=====================================================
Session Helpers
=====================================================
*/

function getSessionExpiry() {
  return firstStoredValue([
    'session_expires_at',
    'expires_at',
    'Token_Expires_At',
    'token_expires_at',
    'sessionExpires',
  ]);
}

function isSessionExpired(expiryValue) {
  if (!expiryValue) {
    return false;
  }

  const expiryTime = Date.parse(expiryValue);

  if (Number.isNaN(expiryTime)) {
    return false;
  }

  return expiryTime <= Date.now();
}

function getSessionToken() {
  if (
    window.Auth &&
    typeof window.Auth.token === 'function'
  ) {
    return window.Auth.token();
  }

  return firstStoredValue([
    'session_token',
    'token',
    'auth_token',
  ]);
}

function redirectToLogin() {
  if (
    window.Auth &&
    typeof window.Auth.redirectToLogin === 'function'
  ) {
    window.Auth.redirectToLogin();
    return;
  }

  window.location.href = '../index.html';
}

/*
=====================================================
Date / Number Helpers
=====================================================
*/

function getLocalDateKey(value = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '-';
  }

  return new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 0,
  }).format(number);
}

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '-';
  }

  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/*
=====================================================
API Response Helpers
=====================================================
*/

function normalizeApiResult(value) {
  let result = value;

  if (Array.isArray(result)) {
    result = result[0];
  }

  if (
    result &&
    typeof result === 'object' &&
    Object.keys(result).length === 1 &&
    typeof result.body === 'string'
  ) {
    try {
      result = JSON.parse(result.body);
    } catch (error) {
      // ใช้ Object เดิม
    }
  }

  if (typeof result === 'string') {
    result = JSON.parse(result);
  }

  return result;
}

function getDashboardVersion(response) {
  return (
    response?.cache?.generated_at ||
    response?.cache?.data_date ||
    response?.dashboard
      ?.account
      ?.rows?.[0]
      ?.Data_Updated_At ||
    response?.dashboard
      ?.account
      ?.rows?.[0]
      ?.Date ||
    ''
  );
}

function isNewerDashboard(
  currentResponse,
  newResponse
) {
  if (!currentResponse) {
    return true;
  }

  const currentVersion =
    getDashboardVersion(currentResponse);

  const newVersion =
    getDashboardVersion(newResponse);

  if (!currentVersion || !newVersion) {
    return (
      JSON.stringify(currentResponse.dashboard) !==
      JSON.stringify(newResponse.dashboard)
    );
  }

  const currentTime =
    Date.parse(currentVersion);

  const newTime =
    Date.parse(newVersion);

  if (
    !Number.isNaN(currentTime) &&
    !Number.isNaN(newTime)
  ) {
    return newTime > currentTime;
  }

  return newVersion !== currentVersion;
}

/*
=====================================================
Dashboard Data Helpers
=====================================================
*/

function readRows(section) {
  return Array.isArray(section?.rows)
    ? section.rows
    : [];
}

function readCount(section) {
  const count = Number(section?.count);

  if (Number.isFinite(count)) {
    return count;
  }

  return readRows(section).length;
}

/*
=====================================================
Table Render Helpers
=====================================================
*/

function setTableEmpty(
  tableBodyId,
  colspan,
  message
) {
  const body = getElement(tableBodyId);

  if (!body) {
    return;
  }

  body.innerHTML = `
    <tr>
      <td
        colspan="${colspan}"
        class="table-empty"
      >
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

function renderTable(
  tableBodyId,
  rows,
  colspan,
  rowRenderer
) {
  const body = getElement(tableBodyId);

  if (!body) {
    return;
  }

  if (!rows.length) {
    setTableEmpty(
      tableBodyId,
      colspan,
      'ไม่พบข้อมูล'
    );

    return;
  }

  body.innerHTML =
    rows.map(rowRenderer).join('');
}

/*
=====================================================
User Render
=====================================================
*/

function renderUser(response) {
  const user = response?.user || {};

  const username =
    user.username ||
    getUsername() ||
    '-';

  const displayName =
    firstStoredValue([
      'display_name',
      'displayName',
    ]) ||
    username;

  const role =
    firstStoredValue([
      'role',
      'user_role',
    ]) ||
    'USER';

  const sessionId =
    getSessionId() ||
    '-';

  const expiresAt =
    getSessionExpiry() ||
    '-';

  setText('displayName', displayName);
  setText('welcomeName', displayName);

  setText(
    'role',
    String(role).toUpperCase()
  );

  setText(
    'summaryRole',
    String(role).toUpperCase()
  );

  setText('username', username);
  setText('sessionId', sessionId);
  setText('expires', expiresAt);
  setText('sessionExpires', expiresAt);
}

/*
=====================================================
Account Table
=====================================================
*/

function renderAccount(rows) {
  renderTable(
    'accountTableBody',
    rows,
    9,
    (row) => `
      <tr>
        <td>
          ${escapeHtml(
            row.Game_Name ||
            row.Game_ID ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Account_Name ||
            row.Entity_Name ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Date ||
            '-'
          )}
        </td>

        <td>
          ${formatMoney(row.Spend)}
        </td>

        <td>
          ${formatInteger(row.Impressions)}
        </td>

        <td>
          ${formatInteger(row.Clicks)}
        </td>

        <td>
          ${formatInteger(row.Results)}
        </td>

        <td>
          ${formatMoney(
            row.Cost_Per_Result
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Data_Status ||
            '-'
          )}
        </td>
      </tr>
    `
  );
}

/*
=====================================================
Campaign Table
=====================================================
*/

function renderCampaign(rows) {
  renderTable(
    'campaignTableBody',
    rows,
    9,
    (row) => `
      <tr>
        <td>
          ${escapeHtml(
            row.Campaign_Name ||
            row.Entity_Name ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Objective_Display ||
            row.Objective ||
            '-'
          )}
        </td>

        <td>
          ${formatMoney(row.Spend)}
        </td>

        <td>
          ${formatInteger(row.Impressions)}
        </td>

        <td>
          ${formatInteger(row.Clicks)}
        </td>

        <td>
          ${formatInteger(
            row.Landing_Page_Views
          )}
        </td>

        <td>
          ${formatInteger(row.Results)}
        </td>

        <td>
          ${formatMoney(
            row.Cost_Per_Result
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Data_Status ||
            '-'
          )}
        </td>
      </tr>
    `
  );
}

/*
=====================================================
Creative Table
=====================================================
*/

function renderCreative(rows) {
  renderTable(
    'creativeTableBody',
    rows,
    9,
    (row) => `
      <tr>
        <td>
          ${escapeHtml(
            row.Creative_Group_Name ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Ad_Name ||
            row.Creative_Name ||
            row.Entity_Name ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Creative_Type ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Objective_Display ||
            row.Objective ||
            '-'
          )}
        </td>

        <td>
          ${formatMoney(row.Spend)}
        </td>

        <td>
          ${formatInteger(row.Impressions)}
        </td>

        <td>
          ${formatInteger(
            row.Link_Clicks
          )}
        </td>

        <td>
          ${formatInteger(row.Results)}
        </td>

        <td>
          ${formatMoney(
            row.Cost_Per_Result
          )}
        </td>
      </tr>
    `
  );
}

/*
=====================================================
Creative Group Table
=====================================================
*/

function renderCreativeGroup(rows) {
  renderTable(
    'creativeGroupTableBody',
    rows,
    9,
    (row) => `
      <tr>
        <td>
          ${escapeHtml(
            row.Creative_Group_Name ||
            row.Entity_Name ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Objective_Display ||
            row.Objective ||
            '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            row.Creative_Type ||
            '-'
          )}
        </td>

        <td>
          ${formatMoney(row.Spend)}
        </td>

        <td>
          ${formatInteger(row.Impressions)}
        </td>

        <td>
          ${formatInteger(row.Clicks)}
        </td>

        <td>
          ${formatInteger(
            row.Landing_Page_Views
          )}
        </td>

        <td>
          ${formatInteger(row.Results)}
        </td>

        <td>
          ${formatMoney(
            row.Cost_Per_Result
          )}
        </td>
      </tr>
    `
  );
}

/*
=====================================================
Main Dashboard Render
=====================================================
*/

function renderDashboard(
  response,
  sourceLabel
) {
  if (
    !response?.success ||
    !response?.dashboard
  ) {
    throw new Error(
      response?.message ||
      'Dashboard payload ไม่ถูกต้อง'
    );
  }

  const dashboard = response.dashboard;

  const accountRows =
    readRows(dashboard.account);

  const campaignRows =
    readRows(dashboard.campaign);

  const creativeRows =
    readRows(dashboard.creative);

  const creativeGroupRows =
    readRows(dashboard.creative_group);

  const accountCount =
    readCount(dashboard.account);

  const campaignCount =
    readCount(dashboard.campaign);

  const creativeCount =
    readCount(dashboard.creative);

  const creativeGroupCount =
    readCount(dashboard.creative_group);

  renderUser(response);

  setText(
    'accountCount',
    formatInteger(accountCount)
  );

  setText(
    'campaignCount',
    formatInteger(campaignCount)
  );

  setText(
    'creativeCount',
    formatInteger(creativeCount)
  );

  setText(
    'creativeGroupCount',
    formatInteger(creativeGroupCount)
  );

  setText(
    'accountRows',
    formatInteger(accountCount)
  );

  setText(
    'campaignRows',
    formatInteger(campaignCount)
  );

  setText(
    'creativeRows',
    formatInteger(creativeCount)
  );

  setText(
    'creativeGroupRows',
    formatInteger(creativeGroupCount)
  );

  setText(
    'accountTableBadge',
    `${formatInteger(accountCount)} rows`
  );

  setText(
    'campaignTableBadge',
    `${formatInteger(campaignCount)} rows`
  );

  setText(
    'creativeTableBadge',
    `${formatInteger(creativeCount)} rows`
  );

  setText(
    'creativeGroupTableBadge',
    `${formatInteger(
      creativeGroupCount
    )} rows`
  );

  renderAccount(accountRows);
  renderCampaign(campaignRows);
  renderCreative(creativeRows);
  renderCreativeGroup(creativeGroupRows);

  const updatedAt =
    getDashboardVersion(response) ||
    new Date().toISOString();

  setText(
    'dashboardUpdatedAt',
    `${sourceLabel} · อัปเดต ${formatDateTime(
      updatedAt
    )}`
  );

  window.DASHBOARD_RESPONSE = response;
  window.DASHBOARD_DATA = dashboard;

  loading.classList.add('hidden');
  shell.classList.remove('hidden');
}

/*
=====================================================
Dashboard Local Cache
=====================================================
*/

function saveDashboardToLocalCache(
  response,
  lastCheckedAt = new Date().toISOString()
) {
  const cacheRecord = {
    saved_at: new Date().toISOString(),
    last_checked_at: lastCheckedAt,
    data_version:
      getDashboardVersion(response),
    response,
  };

  localStorage.setItem(
    getDashboardCacheKey(),
    JSON.stringify(cacheRecord)
  );

  return cacheRecord;
}

function readDashboardFromLocalCache() {
  const cacheRecord =
    parseStoredJson(
      getDashboardCacheKey()
    );

  if (
    !cacheRecord ||
    !cacheRecord.response ||
    !cacheRecord.response.success ||
    !cacheRecord.response.dashboard
  ) {
    return null;
  }

  return cacheRecord;
}

function wasCheckedToday(cacheRecord) {
  if (!cacheRecord?.last_checked_at) {
    return false;
  }

  return (
    getLocalDateKey(
      cacheRecord.last_checked_at
    ) ===
    getLocalDateKey()
  );
}

/*
=====================================================
Dashboard API
=====================================================
*/

async function fetchDashboard(token) {
  const url =
    window.APP_CONFIG?.DASHBOARD_URL;

  if (
    !url ||
    url.includes('PASTE_N8N')
  ) {
    throw new Error(
      'กรุณาใส่ Dashboard Production URL ใน config.js'
    );
  }

  const response = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      session_token: token,
    }),
  });

  const text =
    await response.text();

  if (!text.trim()) {
    throw new Error(
      'Dashboard API ไม่ได้ส่งข้อมูลกลับมา'
    );
  }

  let result;

  try {
    result = normalizeApiResult(
      JSON.parse(text)
    );
  } catch (error) {
    throw new Error(
      'Dashboard API ส่งข้อมูลที่อ่านไม่ได้'
    );
  }

  if (
    !response.ok ||
    !result?.success ||
    !result?.dashboard
  ) {
    const apiError = new Error(
      result?.message ||
      `Dashboard API Error (${response.status})`
    );

    apiError.httpStatus = Number(
      result?.http_status ||
      response.status ||
      500
    );

    throw apiError;
  }

  return result;
}

/*
=====================================================
Refresh Button
=====================================================
*/

function createRefreshButton() {
  const existingButton =
    getElement('refreshDashboardButton');

  if (existingButton) {
    return existingButton;
  }

  const logoutButton =
    getElement('logoutButton');

  if (!logoutButton) {
    return null;
  }

  const button =
    document.createElement('button');

  button.id =
    'refreshDashboardButton';

  button.type = 'button';

  button.textContent =
    'รีเฟรชข้อมูล';

  button.style.marginRight = '10px';
  button.style.padding = '10px 16px';
  button.style.border = '1px solid #2563eb';
  button.style.borderRadius = '8px';
  button.style.background = '#2563eb';
  button.style.color = '#ffffff';
  button.style.cursor = 'pointer';
  button.style.fontWeight = '600';
  button.style.minWidth = '120px';

  logoutButton.parentNode.insertBefore(
    button,
    logoutButton
  );

  return button;
}

function setRefreshButtonLoading(
  button,
  isLoading
) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;

  button.textContent = isLoading
    ? 'กำลังรีเฟรช...'
    : 'รีเฟรชข้อมูล';

  button.style.opacity =
    isLoading ? '0.65' : '1';

  button.style.cursor =
    isLoading
      ? 'not-allowed'
      : 'pointer';
}

/*
=====================================================
Sync Dashboard
=====================================================
*/

async function syncDashboard({
  token,
  currentCache = null,
  force = false,
  showLoading = false,
} = {}) {
  const refreshButton =
    getElement('refreshDashboardButton');

  setRefreshButtonLoading(
    refreshButton,
    true
  );

  if (showLoading) {
    loadingMessage.textContent =
      'กำลังโหลด Dashboard Cache...';
  }

  try {
    const result =
      await fetchDashboard(token);

    const shouldRender =
      force ||
      !currentCache ||
      isNewerDashboard(
        currentCache.response,
        result
      );

    const updatedCache =
      saveDashboardToLocalCache(
        shouldRender
          ? result
          : currentCache.response
      );

    if (shouldRender) {
      renderDashboard(
        result,
        'n8n Cache'
      );
    } else {
      setText(
        'dashboardUpdatedAt',
        `Local Cache · ตรวจสอบล่าสุด ${formatDateTime(
          updatedCache.last_checked_at
        )}`
      );
    }

    return result;
  } catch (error) {
    console.error(
      'Dashboard Sync Error:',
      error
    );

    if (
      !currentCache &&
      showLoading
    ) {
      loadingMessage.textContent =
        error?.message ||
        'ไม่สามารถโหลด Dashboard ได้';
    }

    if (
      [401, 403].includes(
        Number(error?.httpStatus)
      )
    ) {
      clearDashboardLocalCache();

      setTimeout(
        redirectToLogin,
        1200
      );
    }

    return null;
  } finally {
    setRefreshButtonLoading(
      refreshButton,
      false
    );
  }
}

/*
=====================================================
Start Dashboard
=====================================================
*/

async function start() {
  const token =
    getSessionToken();

  if (!token) {
    redirectToLogin();
    return;
  }

  const expiry =
    getSessionExpiry();

  if (isSessionExpired(expiry)) {
    clearDashboardLocalCache();
    redirectToLogin();
    return;
  }

  const refreshButton =
    createRefreshButton();

  const localCache =
    readDashboardFromLocalCache();

  /*
  ---------------------------------------------
  มี Local Cache
  แสดงผลทันที
  ---------------------------------------------
  */

  if (localCache) {
    renderDashboard(
      localCache.response,
      'Local Cache'
    );

    /*
    เรียก API เบื้องหลังเฉพาะ
    ถ้ายังไม่ได้ตรวจสอบข้อมูลในวันนี้
    */

    if (!wasCheckedToday(localCache)) {
      syncDashboard({
        token,
        currentCache: localCache,
        force: false,
        showLoading: false,
      });
    }
  } else {
    /*
    ---------------------------------------------
    ไม่มี Local Cache
    เรียก API ครั้งแรก
    ---------------------------------------------
    */

    await syncDashboard({
      token,
      currentCache: null,
      force: true,
      showLoading: true,
    });
  }

  /*
  ---------------------------------------------
  Manual Refresh
  ---------------------------------------------
  */

  if (refreshButton) {
    refreshButton.addEventListener(
      'click',
      async () => {
        const currentCache =
          readDashboardFromLocalCache();

        await syncDashboard({
          token,
          currentCache,
          force: true,
          showLoading: false,
        });
      }
    );
  }
}

/*
=====================================================
Logout
=====================================================
*/

const logoutButton =
  getElement('logoutButton');

if (logoutButton) {
  logoutButton.addEventListener(
    'click',
    () => {
      clearDashboardLocalCache();

      if (
        window.Auth &&
        typeof window.Auth.logout ===
          'function'
      ) {
        window.Auth.logout();
        return;
      }

      redirectToLogin();
    }
  );
}

start();