'use strict';

(() => {
  const UI = window.GoogleAdsUI;

  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');
  const statusFilter = document.getElementById('statusFilter');

  const datePreset = document.getElementById('datePreset');
  const startDateFilter = document.getElementById('startDateFilter');
  const endDateFilter = document.getElementById('endDateFilter');

  let dailyRows = [];
  let latestDate = '';
  let availableStartDate = '';
  let availableEndDate = '';

  const filters = () => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
    type: typeFilter?.value || '',
    status: statusFilter?.value || '',
    startDate: startDateFilter?.value || '',
    endDate: endDateFilter?.value || '',
  });

  const setLoading = (text) => {
    const node = document.getElementById('updatedAt');
    if (node) node.textContent = text;
  };

  const setDateInputs = (start, end) => {
    if (startDateFilter) startDateFilter.value = start || '';
    if (endDateFilter) endDateFilter.value = end || '';

    if (startDateFilter) {
      startDateFilter.min = availableStartDate || '';
      startDateFilter.max = availableEndDate || '';
    }

    if (endDateFilter) {
      endDateFilter.min = availableStartDate || '';
      endDateFilter.max = availableEndDate || '';
    }
  };

  const applyPreset = (preset) => {
    const end = availableEndDate || latestDate;
    if (!end) return;

    if (preset === 'ALL') {
      setDateInputs(availableStartDate, end);
      return;
    }

    if (preset === '7D') {
      setDateInputs(UI.shiftDate(end, -6), end);
      return;
    }

    if (preset === '30D') {
      setDateInputs(UI.shiftDate(end, -29), end);
      return;
    }

    if (preset === '90D') {
      setDateInputs(UI.shiftDate(end, -89), end);
      return;
    }

    // CUSTOM keeps the currently selected dates.
  };

  const aggregateCampaigns = (rows) => {
    const groups = new Map();

    for (const row of rows) {
      const key = `${row.gameId}|${row.accountId}|${row.campaignId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          ...row,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          convValue: 0,
          firstDate: row.date,
          latestDate: row.date,
        });
      }

      const g = groups.get(key);

      g.spend += row.spend;
      g.impressions += row.impressions;
      g.clicks += row.clicks;
      g.conversions += row.conversions;
      g.convValue += row.convValue;

      if (!g.firstDate || row.date < g.firstDate) {
        g.firstDate = row.date;
      }

      if (!g.latestDate || row.date >= g.latestDate) {
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
      note: row.firstDate && row.latestDate
        ? `ข้อมูลจริง ${row.firstDate} → ${row.latestDate}`
        : 'ข้อมูลจริงจาก Google Ads API',
    }));
  };

  const render = () => {
    const selectedFilters = filters();

    // Guard against invalid custom range.
    if (
      selectedFilters.startDate &&
      selectedFilters.endDate &&
      selectedFilters.startDate > selectedFilters.endDate
    ) {
      document.getElementById('tableBody').innerHTML =
        '<tr><td colspan="11" class="table-empty">วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด</td></tr>';
      document.getElementById('tableBadge').textContent = '0 campaigns';
      return;
    }

    const scopedDaily = UI.filterCampaigns(dailyRows, selectedFilters);
    const rows = aggregateCampaigns(scopedDaily);

    const searchRows = rows.filter((row) => row.type === 'Search');
    const pmaxRows = rows.filter((row) => row.type === 'PMax');

    const rangeText =
      selectedFilters.startDate && selectedFilters.endDate
        ? `${selectedFilters.startDate} → ${selectedFilters.endDate}`
        : 'ทุกช่วงวันที่';

    document.getElementById('updatedAt').textContent =
      `ข้อมูลถึง ${latestDate || '-'} · ช่วง ${rangeText}`;

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
          <td>
            <div class="campaign-type">
              <span class="type-pill">${row.type}</span>
              <span class="status-pill ${UI.statusClass(row.status)}">${row.status}</span>
            </div>
          </td>
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
      '<tr><td colspan="11" class="table-empty">ไม่พบข้อมูล Campaign ใน Filter นี้</td></tr>';
  };

  async function loadData() {
    try {
      setLoading('กำลังโหลดข้อมูลย้อนหลังทั้งหมด...');

      // V5.7.8: omit date bounds intentionally.
      // Google Ads API V3.2 defaults CAMPAIGN route to full available history.
      // This stays one n8n execution; all filters below are client-side.
      const payload = await UI.fetchCampaigns(
        {},
        {startDate: '', endDate: '', limit: 5000}
      );

      dailyRows = payload.rows || [];
      latestDate = payload.data_date || '';
      availableStartDate =
        payload.available_start_date ||
        dailyRows.map((row) => row.date).filter(Boolean).sort().at(0) ||
        '';
      availableEndDate =
        payload.available_end_date ||
        latestDate ||
        dailyRows.map((row) => row.date).filter(Boolean).sort().at(-1) ||
        '';

      UI.fillSelectOptions(gameFilter, UI.gameOptions(dailyRows));
      UI.fillSelectOptions(accountFilter, UI.accountOptions(dailyRows, ''));
      UI.fillSelect(typeFilter, ['Search','PMax','Display','Video','Demand Gen']);
      UI.fillSelect(statusFilter, ['Active','Learning','Paused','Removed']);

      if (datePreset) datePreset.value = 'ALL';
      applyPreset('ALL');

      if (payload.truncated === true) {
        console.warn(
          `[Google Campaign] API returned ${payload.count}/${payload.matched_count} rows. ` +
          'Increase API limit before adding more historical volume.'
        );
      }

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
      localStorage.getItem('display_name') ||
      localStorage.getItem('username') ||
      'User';

    document.getElementById('role').textContent =
      localStorage.getItem('role') || 'USER';

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

    datePreset?.addEventListener('change', () => {
      applyPreset(datePreset.value);
      render();
    });

    startDateFilter?.addEventListener('change', () => {
      if (datePreset) datePreset.value = 'CUSTOM';
      render();
    });

    endDateFilter?.addEventListener('change', () => {
      if (datePreset) datePreset.value = 'CUSTOM';
      render();
    });

    document.getElementById('logoutButton')?.addEventListener(
      'click',
      () => window.Auth.redirectToLogin()
    );

    await loadData();
  };

  boot();
})();
