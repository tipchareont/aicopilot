'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');

  let allRows = [];
  let latestDate = '';

  const currentFilters = () => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
    type: typeFilter?.value || '',
  });

  const setLoading = (text = 'กำลังโหลดข้อมูลจริง...') => {
    const badge = document.getElementById('updatedAt');
    if (badge) badge.textContent = text;
  };

  const renderError = (error) => {
    setLoading('โหลดข้อมูลไม่สำเร็จ');
    const body = document.getElementById('campaignBody');
    if (body) {
      body.innerHTML = `<tr><td colspan="8" class="table-empty">${error?.message || 'Google Ads API Error'}</td></tr>`;
    }
  };

  const latestRowsForFilters = (filters) => {
    const filtered = UI.filterCampaigns(allRows, filters);
    const maxDate = filtered.map((row) => row.date).filter(Boolean).sort().at(-1) || latestDate;
    return {
      date: maxDate,
      rows: filtered.filter((row) => !maxDate || row.date === maxDate),
      history: filtered,
    };
  };

  const renderTrend = (rows) => {
    const groups = new Map();
    for (const row of rows) {
      if (!row.date) continue;
      if (!groups.has(row.date)) groups.set(row.date, []);
      groups.get(row.date).push(row);
    }
    const trend = [...groups.entries()]
      .sort(([a],[b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, items]) => {
        const sum = UI.summarize(items);
        return {
          date,
          spend: sum.spend,
          conversions: sum.conversions,
          cpa: sum.conversions ? sum.spend / sum.conversions : 0,
        };
      });

    document.getElementById('trendBody').innerHTML =
      trend.map((row) =>
        `<tr><td>${row.date}</td><td>${UI.money(row.spend)}</td><td>${UI.number(row.conversions)}</td><td>${UI.money(row.cpa)}</td></tr>`
      ).join('') ||
      '<tr><td colspan="4" class="table-empty">ยังไม่มีข้อมูล Trend</td></tr>';
  };

  const render = () => {
    const filters = currentFilters();
    const scoped = latestRowsForFilters(filters);
    const rows = scoped.rows;
    const totals = UI.summarize(rows);
    const spend = totals.spend;
    const conversions = totals.conversions;
    const clicks = totals.clicks;
    const impressions = totals.impressions;
    const cpa = conversions ? spend / conversions : 0;
    const ctr = impressions ? (clicks / impressions) * 100 : 0;
    const avgCpc = clicks ? spend / clicks : 0;
    const roas = totals.convValue && spend ? totals.convValue / spend : 0;
    const searchRows = rows.filter((row) => row.type === 'Search');
    const pmaxRows = rows.filter((row) => row.type === 'PMax');

    document.getElementById('updatedAt').textContent =
      `ข้อมูลล่าสุด ${scoped.date || UI.lastUpdated() || '-'}`;
    document.getElementById('spendKpi').textContent = UI.money(spend);
    document.getElementById('convKpi').textContent = UI.number(conversions);
    document.getElementById('cpaKpi').textContent = UI.money(cpa);
    document.getElementById('clickKpi').textContent = UI.number(clicks);
    document.getElementById('ctrKpi').textContent = UI.percent(ctr);
    document.getElementById('avgCpcKpi').textContent = UI.money(avgCpc);
    document.getElementById('pmaxCount').textContent = UI.number(pmaxRows.length);
    document.getElementById('searchCount').textContent = UI.number(searchRows.length);
    document.getElementById('roasKpi').textContent = roas ? `${roas.toFixed(2)}x` : 'N/A';

    const mixRows = [
      {label:'Search', rows:searchRows},
      {label:'PMax', rows:pmaxRows},
    ];
    document.getElementById('channelMixBody').innerHTML =
      mixRows.map((item) => {
        const sum = UI.summarize(item.rows);
        const itemCpa = sum.conversions ? sum.spend / sum.conversions : 0;
        const itemCtr = sum.impressions ? (sum.clicks / sum.impressions) * 100 : 0;
        return `<tr>
          <td>${item.label}</td>
          <td>${UI.money(sum.spend)}</td>
          <td>${UI.number(sum.conversions)}</td>
          <td>${UI.money(itemCpa)}</td>
          <td>${UI.percent(itemCtr)}</td>
        </tr>`;
      }).join('');

    renderTrend(scoped.history);

    document.getElementById('alertList').innerHTML =
      `<div class="ai-placeholder"><div><strong>ยังไม่มี Google Ads Intelligence Alert</strong><p>หน้านี้แสดง Performance จริงจาก Google Ads API แล้ว แต่ยังไม่ได้เชื่อม Google-specific scoring/AI alert เพื่อป้องกันการสร้าง Insight ที่ไม่มีหลักฐาน</p></div></div>`;

    document.getElementById('campaignBody').innerHTML =
      rows.map((row) => `<tr>
        <td>${row.campaign}</td>
        <td>${row.game}</td>
        <td>${row.account}</td>
        <td>${row.type}</td>
        <td>${UI.money(row.spend)}</td>
        <td>${UI.number(row.conversions)}</td>
        <td>${UI.money(row.cpa)}</td>
        <td>${row.note}</td>
      </tr>`).join('') ||
      '<tr><td colspan="8" class="table-empty">ไม่พบ Campaign ใน Filter นี้</td></tr>';
  };

  async function loadData({preserveFilters = false} = {}) {
    try {
      setLoading();
      const filters = currentFilters();
      const overview = await UI.fetchOverview(filters);
      latestDate = overview.data_date || latestDate;

      const endDate = latestDate || new Date().toISOString().slice(0,10);
      const startDate = UI.shiftDate(endDate, -34);

      const campaign = await UI.fetchCampaigns(
        {game: filters.game, account: filters.account},
        {startDate, endDate, limit: 5000}
      );
      allRows = campaign.rows || [];
      latestDate = campaign.data_date || latestDate;

      if (!preserveFilters) {
        UI.fillSelectOptions(gameFilter, UI.gameOptions(allRows));
        UI.fillSelectOptions(accountFilter, UI.accountOptions(allRows, gameFilter?.value || ''));
        UI.fillSelect(typeFilter, ['Search','PMax','Display','Video','Demand Gen']);
      } else {
        UI.fillSelectOptions(accountFilter, UI.accountOptions(allRows, gameFilter?.value || ''));
      }

      render();
    } catch (error) {
      console.error('[Google Ads Overview]', error);
      if (Number(error?.httpStatus) === 401) {
        window.Auth?.redirectToLogin?.();
        return;
      }
      renderError(error);
    }
  }

  const boot = async () => {
    document.getElementById('displayName').textContent =
      localStorage.getItem('display_name') || localStorage.getItem('username') || 'User';
    document.getElementById('role').textContent = localStorage.getItem('role') || 'USER';

    gameFilter?.addEventListener('change', () => loadData({preserveFilters:true}));
    accountFilter?.addEventListener('change', () => loadData({preserveFilters:true}));
    typeFilter?.addEventListener('change', render);
    document.getElementById('logoutButton')?.addEventListener('click', () => window.Auth.redirectToLogin());

    await loadData();
  };

  boot();
})();
