'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');
  const statusFilter = document.getElementById('statusFilter');

  let dailyRows = [];
  let latestDate = '';

  const filters = () => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
    type: typeFilter?.value || '',
    status: statusFilter?.value || '',
  });

  const setLoading = (text) => {
    document.getElementById('updatedAt').textContent = text;
  };

  const aggregateCampaigns = (rows) => {
    const groups = new Map();

    for (const row of rows) {
      const key = `${row.accountId}|${row.campaignId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          ...row,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          convValue: 0,
          latestDate: row.date,
        });
      }
      const g = groups.get(key);
      g.spend += row.spend;
      g.impressions += row.impressions;
      g.clicks += row.clicks;
      g.conversions += row.conversions;
      g.convValue += row.convValue;
      if (row.date >= g.latestDate) {
        g.latestDate = row.date;
        g.status = row.status;
        g.type = row.type;
      }
    }

    return [...groups.values()].map((row) => ({
      ...row,
      ctr: row.impressions ? (row.clicks / row.impressions) * 100 : 0,
      avgCpc: row.clicks ? row.spend / row.clicks : 0,
      cpa: row.conversions ? row.spend / row.conversions : 0,
      convRate: row.clicks ? (row.conversions / row.clicks) * 100 : 0,
      note: `ข้อมูลจริง ${row.latestDate ? `ถึง ${row.latestDate}` : 'จาก Google Ads API'}`,
    }));
  };

  const render = () => {
    const scopedDaily = UI.filterCampaigns(dailyRows, filters());
    const rows = aggregateCampaigns(scopedDaily);
    const searchRows = rows.filter((row) => row.type === 'Search');
    const pmaxRows = rows.filter((row) => row.type === 'PMax');

    document.getElementById('updatedAt').textContent = `ข้อมูลล่าสุด ${latestDate || '-'}`;
    document.getElementById('totalCampaigns').textContent = UI.number(rows.length);
    document.getElementById('searchCampaigns').textContent = UI.number(searchRows.length);
    document.getElementById('pmaxCampaigns').textContent = UI.number(pmaxRows.length);
    document.getElementById('avgSearchIs').textContent = '-';
    document.getElementById('tableBadge').textContent = `${rows.length} campaigns`;

    document.getElementById('tableBody').innerHTML =
      rows
        .sort((a,b) => b.spend - a.spend)
        .map((row) => `<tr>
          <td class="campaign-name">
            <strong>${row.campaign}</strong>
            <small>${row.game} · ${row.account}</small>
          </td>
          <td><div class="campaign-type"><span class="type-pill">${row.type}</span><span class="status-pill ${UI.statusClass(row.status)}">${row.status}</span></div></td>
          <td class="metric">${UI.money(row.spend)}</td>
          <td class="metric">${UI.number(row.clicks)}</td>
          <td class="metric">${UI.percent(row.ctr)}</td>
          <td class="metric">${UI.money(row.avgCpc)}</td>
          <td class="metric">${UI.number(row.conversions)}</td>
          <td class="metric">${row.conversions > 0 ? UI.money(row.cpa) : '-'}</td>
          <td class="metric">${UI.percent(row.convRate)}</td>
          <td class="metric">-</td>
          <td class="insight-text">${row.note}</td>
        </tr>`).join('') ||
      '<tr><td colspan="11" class="table-empty">ไม่พบข้อมูล Campaign</td></tr>';
  };

  async function loadData() {
    try {
      setLoading('กำลังโหลดข้อมูลจริง...');
      // Campaign page needs only Campaign API.
      // Use yesterday in Asia/Bangkok as the upper bound so the page does not
      // wait for a redundant Overview API request before loading the table.
      const todayBangkok = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      const endDate = UI.shiftDate(todayBangkok, -1);
      const startDate = UI.shiftDate(endDate, -34);

      // V5.7.3 loads all permitted Google rows once.
      // Game / Account / Type / Status filters are client-side only.
      const payload = await UI.fetchCampaigns(
        {},
        {startDate, endDate, limit: 5000}
      );
      dailyRows = payload.rows || [];
      latestDate = payload.data_date || latestDate;

      UI.fillSelectOptions(gameFilter, UI.gameOptions(dailyRows));
      UI.fillSelectOptions(accountFilter, UI.accountOptions(dailyRows, ''));
      UI.fillSelect(typeFilter, ['Search','PMax','Display','Video','Demand Gen']);
      UI.fillSelect(statusFilter, ['Active','Learning','Paused']);

      render();
    } catch (error) {
      console.error('[Google Ads Campaign]', error);
      if (Number(error?.httpStatus) === 401) {
        window.Auth?.redirectToLogin?.();
        return;
      }
      setLoading('โหลดข้อมูลไม่สำเร็จ');
      document.getElementById('tableBody').innerHTML =
        `<tr><td colspan="11" class="table-empty">${error?.message || 'Google Ads API Error'}</td></tr>`;
    }
  }

  const boot = async () => {
    document.getElementById('displayName').textContent =
      localStorage.getItem('display_name') || localStorage.getItem('username') || 'User';
    document.getElementById('role').textContent = localStorage.getItem('role') || 'USER';

    gameFilter?.addEventListener('change', () => {
      if (accountFilter) accountFilter.value = '';
      UI.fillSelectOptions(
        accountFilter,
        UI.accountOptions(dailyRows, gameFilter?.value || '')
      );
      render();
    });
    accountFilter?.addEventListener('change', render);
    typeFilter?.addEventListener('change', render);
    statusFilter?.addEventListener('change', render);
    document.getElementById('logoutButton')?.addEventListener('click', () => window.Auth.redirectToLogin());

    await loadData();
  };

  boot();
})();
