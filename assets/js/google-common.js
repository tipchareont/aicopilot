'use strict';

window.GoogleAdsUI = (() => {
  const config = window.APP_CONFIG || {};
  const state = {
    overview: null,
    campaignRows: [],
    insights: null,
    dataDate: '',
    loadedAt: '',
  };

  const clean = (value) => String(value ?? '').trim();
  const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const money = (value) =>
    `฿${num(value).toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })}`;
  const number = (value) =>
    num(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const percent = (value) =>
    value === null || value === undefined || Number.isNaN(Number(value))
      ? '-'
      : `${num(value).toFixed(2)}%`;

  const token = () =>
    window.Auth?.token?.() ||
    localStorage.getItem('session_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    '';

  const dateOnly = (value) => clean(value).slice(0, 10);

  const shiftDate = (dateText, days) => {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(clean(dateText))
      ? new Date(`${dateText}T00:00:00Z`)
      : new Date();
    if (Number.isNaN(base.getTime())) return '';
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
  };

  const normalizeApiPayload = (value) => {
    let result = value;
    if (Array.isArray(result) && result.length === 1) result = result[0];
    if (result && typeof result === 'object' && typeof result.body === 'string') {
      try { result = JSON.parse(result.body); } catch {}
    }
    return result;
  };

  async function post(url, body) {
    if (!url) throw new Error('Google Ads API URL ยังไม่ได้ตั้งค่า');
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        session_token: token(),
        ...(body || {}),
      }),
      cache: 'no-store',
    });

    const raw = await response.text();
    if (!raw.trim()) throw new Error(`Google Ads API ไม่ได้ส่งข้อมูลกลับมา (${response.status})`);

    let payload;
    try {
      payload = normalizeApiPayload(JSON.parse(raw));
    } catch {
      throw new Error('Google Ads API ส่ง Response ที่อ่านไม่ได้');
    }

    if (!response.ok || payload?.success === false) {
      const error = new Error(payload?.message || `Google Ads API Error (${response.status})`);
      error.httpStatus = Number(payload?.http_status || response.status || 500);
      throw error;
    }

    return payload || {};
  }

  const campaignType = (value) => {
    const upper = clean(value).toUpperCase();
    if (upper === 'PERFORMANCE_MAX' || upper === 'PMAX') return 'PMax';
    if (upper === 'SEARCH') return 'Search';
    if (upper === 'DISPLAY') return 'Display';
    if (upper === 'VIDEO') return 'Video';
    if (upper === 'DEMAND_GEN') return 'Demand Gen';
    return clean(value) || 'Other';
  };

  const campaignStatus = (value) => {
    const upper = clean(value).toUpperCase();
    if (upper === 'ENABLED' || upper === 'ACTIVE') return 'Active';
    if (upper === 'PAUSED') return 'Paused';
    if (upper === 'LEARNING') return 'Learning';
    if (upper === 'REMOVED') return 'Removed';
    return clean(value) || 'Unknown';
  };

  const normalizeCampaignRow = (row) => {
    const spend = num(row.Spend);
    const clicks = num(row.Clicks);
    const impressions = num(row.Impressions);
    const conversions = num(row.Google_Conversions ?? row.Results);
    const ctrFraction = num(row.CTR);
    const ctrPct = ctrFraction <= 1 ? ctrFraction * 100 : ctrFraction;
    const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const type = campaignType(row.Google_Campaign_Type || row.Campaign_Type);
    const status = campaignStatus(row.Google_Campaign_Status || row.Campaign_Status);

    return {
      raw: row,
      date: dateOnly(row.Date),
      gameId: clean(row.Game_ID),
      game: clean(row.Game_Name) || clean(row.Game_ID),
      accountId: clean(row.Account_ID),
      account: clean(row.Account_Name) || clean(row.Account_ID),
      campaignId: clean(row.Campaign_ID),
      campaign: clean(row.Campaign_Name),
      type,
      status,
      spend,
      impressions,
      clicks,
      ctr: ctrPct,
      avgCpc: num(row.Google_Average_CPC ?? row.CPC) || (clicks ? spend / clicks : 0),
      conversions,
      cpa: num(row.Cost_Per_Result) || (conversions ? spend / conversions : 0),
      convRate,
      convValue: num(row.Google_Conversion_Value),
      allConversions: num(row.Google_All_Conversions),
      interactions: num(row.Google_Interactions),
      interactionRate: num(row.Google_Interaction_Rate) <= 1
        ? num(row.Google_Interaction_Rate) * 100
        : num(row.Google_Interaction_Rate),
      searchIs: null,
      lostBudget: null,
      lostRank: null,
      note: 'ข้อมูลจริงจาก Google Ads API',
    };
  };

  const unique = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];

  const fillSelect = (select, values, allLabel = 'ทั้งหมด') => {
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      `<option value="">${allLabel}</option>` +
      values.map((value) => `<option value="${String(value).replaceAll('"','&quot;')}">${value}</option>`).join('');
    if (values.includes(current)) select.value = current;
  };

  const fillSelectOptions = (select, options, allLabel = 'ทั้งหมด') => {
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      `<option value="">${allLabel}</option>` +
      options.map((item) =>
        `<option value="${clean(item.value).replaceAll('"','&quot;')}">${clean(item.label)}</option>`
      ).join('');
    if (options.some((item) => clean(item.value) === current)) select.value = current;
  };

  const filterCampaigns = (rows, filters = {}) => rows.filter((row) => {
    if (filters.game && row.gameId !== filters.game && row.game !== filters.game) return false;
    if (filters.account && row.accountId !== filters.account && row.account !== filters.account) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.startDate && row.date && row.date < filters.startDate) return false;
    if (filters.endDate && row.date && row.date > filters.endDate) return false;
    return true;
  });

  const summarize = (rows) => rows.reduce((acc, row) => {
    acc.spend += num(row.spend);
    acc.impressions += num(row.impressions);
    acc.clicks += num(row.clicks);
    acc.conversions += num(row.conversions);
    acc.convValue += num(row.convValue);
    return acc;
  }, {spend:0, impressions:0, clicks:0, conversions:0, convValue:0});

  const avg = (rows, key) =>
    rows.length ? rows.reduce((sum, row) => sum + num(row[key]), 0) / rows.length : 0;

  const statusClass = (status) => {
    const normalized = clean(status).toLowerCase();
    if (
      normalized.includes('active') ||
      normalized.includes('enabled') ||
      normalized.includes('excellent') ||
      normalized.includes('good')
    ) return 'good';
    if (
      normalized.includes('learning') ||
      normalized.includes('average') ||
      normalized.includes('pending') ||
      normalized.includes('paused')
    ) return 'watch';
    return 'critical';
  };

  const gameOptions = (rows) => {
    const map = new Map();
    for (const row of rows) {
      if (!row.gameId) continue;
      map.set(row.gameId, row.game || row.gameId);
    }
    return [...map].map(([value, label]) => ({value, label}));
  };

  const accountOptions = (rows, gameId = '') => {
    const map = new Map();
    for (const row of rows) {
      if (gameId && row.gameId !== gameId) continue;
      if (!row.accountId) continue;
      map.set(row.accountId, row.account || row.accountId);
    }
    return [...map].map(([value, label]) => ({value, label}));
  };

  async function fetchOverview(filters = {}) {
    const payload = await post(config.GOOGLE_ADS_OVERVIEW_URL, {
      game_id: clean(filters.game),
      account_id: clean(filters.account),
    });
    state.overview = payload;
    state.dataDate = clean(payload.data_date);
    state.loadedAt = new Date().toISOString();
    return payload;
  }

  async function fetchCampaigns(filters = {}, range = {}) {
    const payload = await post(config.GOOGLE_ADS_CAMPAIGN_URL, {
      game_id: clean(filters.game),
      account_id: clean(filters.account),
      start_date: clean(range.startDate),
      end_date: clean(range.endDate),
      limit: Number(range.limit || 5000),
    });
    const rows = Array.isArray(payload.rows) ? payload.rows.map(normalizeCampaignRow) : [];
    state.campaignRows = rows;
    if (payload.data_date) state.dataDate = clean(payload.data_date);
    state.loadedAt = new Date().toISOString();
    return {...payload, rows};
  }

  async function fetchInsights(filters = {}) {
    const payload = await post(config.GOOGLE_ADS_INSIGHTS_URL, {
      game_id: clean(filters.game),
      account_id: clean(filters.account),
    });
    state.insights = payload;
    if (payload.data_date) state.dataDate = clean(payload.data_date);
    state.loadedAt = new Date().toISOString();
    return payload;
  }

  const lastUpdated = () => state.dataDate || '-';

  return {
    state,
    clean,
    num,
    money,
    number,
    percent,
    dateOnly,
    shiftDate,
    unique,
    fillSelect,
    fillSelectOptions,
    filterCampaigns,
    summarize,
    avg,
    statusClass,
    gameOptions,
    accountOptions,
    fetchOverview,
    fetchCampaigns,
    fetchInsights,
    lastUpdated,
  };
})();
