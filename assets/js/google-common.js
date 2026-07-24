'use strict';

window.GoogleAdsUI = (() => {
  const data = window.GOOGLE_ADS_MOCK || { campaigns: [], accounts: [], games: [] };
  const money = (value) => `฿${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
  const number = (value) => Number(value || 0).toLocaleString('en-US');
  const percent = (value) => value === null || value === undefined || Number.isNaN(Number(value)) ? '-' : `${Number(value).toFixed(1)}%`;
  const unique = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];
  const fillSelect = (select, values, allLabel = 'ทั้งหมด') => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${allLabel}</option>` + values.map((value) => `<option value="${value}">${value}</option>`).join('');
    if (values.includes(current)) select.value = current;
  };
  const filterCampaigns = (filters = {}) => data.campaigns.filter((row) => {
    if (filters.game && row.game !== filters.game) return false;
    if (filters.account && row.account !== filters.account) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
  const relatedKeywords = (filters = {}) => (data.keywords || []).filter((row) => {
    if (filters.game && row.game !== filters.game) return false;
    if (filters.account && row.account !== filters.account) return false;
    return true;
  });
  const relatedSearchTerms = (filters = {}) => data.searchTerms.filter((row) => {
    if (filters.game && row.game !== filters.game) return false;
    if (filters.account && row.account !== filters.account) return false;
    return true;
  });
  const relatedAssetGroups = (filters = {}) => data.assetGroups.filter((row) => {
    if (filters.game && row.game !== filters.game) return false;
    if (filters.account && row.account !== filters.account) return false;
    return true;
  });
  const summarize = (rows) => rows.reduce((acc, row) => {
    acc.spend += Number(row.spend || 0);
    acc.clicks += Number(row.clicks || 0);
    acc.conversions += Number(row.conversions || 0);
    acc.convValue += Number(row.convValue || 0);
    return acc;
  }, { spend: 0, clicks: 0, conversions: 0, convValue: 0 });
  const avg = (rows, key) => rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0;
  const statusClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('active') || normalized.includes('excellent') || normalized.includes('good')) return 'good';
    if (normalized.includes('learning') || normalized.includes('average') || normalized.includes('pending')) return 'watch';
    return 'critical';
  };
  const lastUpdated = () => data.updatedAt || '-';
  return { data, money, number, percent, unique, fillSelect, filterCampaigns, relatedKeywords, relatedSearchTerms, relatedAssetGroups, summarize, avg, statusClass, lastUpdated };
})();
