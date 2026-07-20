'use strict';

window.CopilotData = (() => {
  const CACHE_PREFIX = 'ai_marketing_copilot_dashboard_cache_v9';
  const MAX_PERSISTENT_CACHE_CHARS = 1000000;
  let memoryCache = null;

  const first = (keys) => {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
    return '';
  };

  const token = () => window.Auth?.token?.() || first(['session_token', 'token', 'auth_token']);
  const sid = () => first(['session_id', 'Session_ID', 'sessionId']);
  const cacheKey = () => `${CACHE_PREFIX}:${first(['username', 'Username']) || 'current_user'}`;

  function cleanupDashboardCaches({ keepCurrent = true } = {}) {
    const currentKey = cacheKey();
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('ai_marketing_copilot_dashboard_cache_')) continue;
      if (keepCurrent && key === currentKey) continue;
      try { localStorage.removeItem(key); } catch {}
    }
  }

  function safeSaveCache(response) {
    const cache = { saved_at: new Date().toISOString(), response };
    memoryCache = cache;

    let serialized;
    try {
      serialized = JSON.stringify(cache);
    } catch (error) {
      console.warn('[AI Marketing Copilot v4.9.0] ไม่สามารถแปลง Dashboard Cache ได้', error);
      return false;
    }

    if (serialized.length > MAX_PERSISTENT_CACHE_CHARS) {
      cleanupDashboardCaches({ keepCurrent: false });
      console.info(`[AI Marketing Copilot v4.9.0] ข้าม Browser Cache เพราะข้อมูลมีขนาด ${serialized.length.toLocaleString()} ตัวอักษร`);
      return false;
    }

    cleanupDashboardCaches({ keepCurrent: true });
    try {
      localStorage.setItem(cacheKey(), serialized);
      return true;
    } catch (error) {
      cleanupDashboardCaches({ keepCurrent: false });
      console.warn('[AI Marketing Copilot v4.9.0] Browser Cache เต็ม จึงใช้ข้อมูลจาก API โดยตรง', error);
      return false;
    }
  }

  const parseDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim().replace(' ', 'T');
    let normalized = raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += 'T00:00:00';
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) normalized += '+07:00';
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const normalize = (value) => {
    let result = value;
    if (Array.isArray(result)) result = result[0];
    if (result && typeof result === 'object' && Object.keys(result).length === 1 && typeof result.body === 'string') {
      try { result = JSON.parse(result.body); } catch {}
    }
    if (typeof result === 'string') result = JSON.parse(result);
    return result;
  };

  async function fetchFresh() {
    const url = window.APP_CONFIG?.DASHBOARD_URL;
    if (!url || url.includes('PASTE_N8N')) throw new Error('ไม่พบ Dashboard Production URL');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token() }),
    });

    const raw = await response.text();
    if (!raw.trim()) throw new Error('Dashboard API ไม่ได้ส่งข้อมูลกลับมา');

    let result;
    try {
      result = normalize(JSON.parse(raw));
    } catch {
      throw new Error('Dashboard API ส่งข้อมูลที่อ่านไม่ได้');
    }

    if (!response.ok || !result?.success || !result?.dashboard) {
      const error = new Error(result?.message || `Dashboard API Error (${response.status})`);
      error.httpStatus = Number(result?.http_status || response.status || 500);
      throw error;
    }

    safeSaveCache(result);
    return result;
  }

  function readCache() {
    if (memoryCache?.response?.dashboard) return memoryCache.response;
    try {
      return JSON.parse(localStorage.getItem(cacheKey()) || 'null')?.response || null;
    } catch {
      return null;
    }
  }

  async function load({ refresh = false } = {}) {
    if (!token() || window.Auth?.isExpired?.()) {
      throw Object.assign(new Error('Session หมดอายุ'), { httpStatus: 401 });
    }
    if (refresh) return fetchFresh();
    try {
      return await fetchFresh();
    } catch (error) {
      const cached = readCache();
      if (cached?.dashboard) {
        console.warn('[AI Marketing Copilot v4.9.0] ใช้ Browser Cache เพราะ Dashboard API ไม่พร้อม', error);
        return cached;
      }
      throw error;
    }
  }

  const rows = (response, key) => Array.isArray(response?.dashboard?.[key]?.rows) ? response.dashboard[key].rows : [];

  const field = (row, names, fallback = '') => {
    for (const name of names) {
      if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') return row[name];
    }
    return fallback;
  };

  const num = (value) => {
    const parsed = Number(String(value ?? '').replaceAll(',', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function normalizeObjectiveValue(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const upper = raw.toUpperCase();
    if (['SALE', 'SALES', 'CONVERSION'].includes(upper)) return 'Conversion';
    if (upper === 'TRAFFIC') return 'Traffic';
    if (upper === 'AWARENESS') return 'Awareness';
    if (upper === 'ENGAGEMENT') return 'Engagement';
    if (upper === 'LEADS') return 'Leads';
    return raw;
  }

  function displayObjective(rowOrValue) {
    if (typeof rowOrValue === 'string') return normalizeObjectiveValue(rowOrValue);
    return normalizeObjectiveValue(field(rowOrValue, ['Objective_Display', 'Objective'], ''));
  }

  function isConversionObjective(rowOrValue) {
    const label = displayObjective(rowOrValue).toUpperCase();
    return label === 'CONVERSION';
  }

  const metric = (row, name) => {
    const map = {
      spend: ['Spend', 'Amount_Spent'],
      impressions: ['Impressions'],
      clicks: ['Clicks', 'Link_Clicks'],
      lpv: ['Landing_Page_Views', 'LandingPageViews', 'LPV'],
      results: ['Results', 'Result'],
      reach: ['Reach'],
      ctr: ['CTR', 'Ctr'],
      frequency: ['Frequency'],
      cpr: ['Cost_Per_Result', 'CostPerResult', 'CPA'],
      cplpv: ['Cost_Per_Landing_Page_View', 'Cost_Per_LPV', 'CostPerLandingPageView'],
      completeRegister: [
        'Complete_Register',
        'Complete_Registers',
        'Complete_Registers',
        'Complete_Registration',
        'Complete_Registrations',
        'Complete Register',
        'Completed_Register',
        'Completed_Registers',
        'New_Register',
        'New_Registers',
        'CompleteRegister',
      ],
      cpcr: [
        'Cost_Per_Complete_Register',
        'Cost_Per_Complete_Registration',
        'Cost_Per_CompleteRegister',
        'CostPerCompleteRegister',
      ],
    };

    if (name === 'completeRegister') {
      const explicit = field(row, map.completeRegister, null);
      if (explicit !== null && explicit !== '') return num(explicit);
      return isConversionObjective(row) ? num(field(row, ['Results', 'Result'], 0)) : 0;
    }

    if (name === 'cpcr') {
      const explicit = field(row, map.cpcr, null);
      if (explicit !== null && explicit !== '') return num(explicit);
      const cr = metric(row, 'completeRegister');
      return cr ? num(field(row, ['Spend', 'Amount_Spent'], 0)) / cr : 0;
    }

    return num(field(row, map[name] || [name], 0));
  };

  const aggregate = (list) => {
    const totals = { spend: 0, impressions: 0, clicks: 0, lpv: 0, results: 0, reach: 0, completeRegister: 0 };
    for (const row of list) {
      for (const key of ['spend', 'impressions', 'clicks', 'lpv', 'results', 'reach']) totals[key] += metric(row, key);
      totals.completeRegister += metric(row, 'completeRegister');
    }
    totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpr = totals.results ? totals.spend / totals.results : 0;
    totals.cplpv = totals.lpv ? totals.spend / totals.lpv : 0;
    totals.cpcr = totals.completeRegister ? totals.spend / totals.completeRegister : 0;
    return totals;
  };

  const aggregateConversion = (list) => {
    const rows = list.filter((row) => isConversionObjective(row));
    return aggregate(rows);
  };

  const group = (list, keyFn) => {
    const map = new Map();
    for (const row of list) {
      const key = String(keyFn(row));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items, sample: items[0], totals: aggregate(items), conversionTotals: aggregateConversion(items) }));
  };

  const dateKey = (value) => {
    const date = parseDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const money = (value) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(value));
  const integer = (value) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(num(value));
  const percent = (value) => `${num(value).toFixed(2)}%`;

  const thumbUrl = (row) => field(row, ['Thumbnail_URL', 'Image_URL', 'Creative_Thumbnail_URL', 'Picture_URL', 'picture', 'thumbnail_url'], '');

  return {
    load,
    rows,
    field,
    num,
    metric,
    aggregate,
    aggregateConversion,
    group,
    dateKey,
    parseDate,
    esc,
    money,
    integer,
    percent,
    thumbUrl,
    token,
    displayObjective,
    normalizeObjectiveValue,
    isConversionObjective,
  };
})();
