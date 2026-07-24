'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');

  const currentFilters = () => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
    type: typeFilter?.value || ''
  });

  const render = () => {
    const filters = currentFilters();
    const rows = UI.filterCampaigns(filters);
    const totals = UI.summarize(rows);
    const spend = totals.spend;
    const conversions = totals.conversions;
    const clicks = totals.clicks;
    const cpa = conversions ? spend / conversions : 0;
    const avgCtr = UI.avg(rows, 'ctr');
    const avgCpc = clicks ? spend / clicks : 0;
    const roas = totals.convValue ? totals.convValue / spend : 0;
    const searchRows = rows.filter((row) => row.type === 'Search');
    const pmaxRows = rows.filter((row) => row.type === 'PMax');

    document.getElementById('updatedAt').textContent = `อัปเดตล่าสุด ${UI.lastUpdated()}`;
    document.getElementById('spendKpi').textContent = UI.money(spend);
    document.getElementById('convKpi').textContent = UI.number(conversions);
    document.getElementById('cpaKpi').textContent = UI.money(cpa);
    document.getElementById('clickKpi').textContent = UI.number(clicks);
    document.getElementById('ctrKpi').textContent = UI.percent(avgCtr);
    document.getElementById('avgCpcKpi').textContent = UI.money(avgCpc);
    document.getElementById('pmaxCount').textContent = UI.number(pmaxRows.length);
    document.getElementById('searchCount').textContent = UI.number(searchRows.length);
    document.getElementById('roasKpi').textContent = roas ? `${roas.toFixed(2)}x` : 'N/A';

    const mixBody = document.getElementById('channelMixBody');
    const mixRows = [
      { label: 'Search', rows: searchRows },
      { label: 'PMax', rows: pmaxRows }
    ];
    mixBody.innerHTML = mixRows.map((item) => {
      const sum = UI.summarize(item.rows);
      const itemCpa = sum.conversions ? sum.spend / sum.conversions : 0;
      return `<tr>
        <td>${item.label}</td>
        <td>${UI.money(sum.spend)}</td>
        <td>${UI.number(sum.conversions)}</td>
        <td>${UI.money(itemCpa)}</td>
        <td>${UI.percent(UI.avg(item.rows, 'ctr'))}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="table-empty">ไม่พบข้อมูล</td></tr>';

    const trendBody = document.getElementById('trendBody');
    trendBody.innerHTML = UI.data.trend.map((row) => `<tr><td>${row.date}</td><td>${UI.money(row.spend)}</td><td>${UI.number(row.conversions)}</td><td>${UI.money(row.cpa)}</td></tr>`).join('');

    const alertList = document.getElementById('alertList');
    const alertScope = filters.game || '';
    const alerts = UI.data.alerts.filter((row) => !alertScope || row.scope === alertScope);
    alertList.innerHTML = alerts.map((row) => `<article class="action-card" data-level="${row.level}"><div class="action-head"><strong>${row.title}</strong><span class="action-tag">${row.scope}</span></div><p>${row.detail}</p></article>`).join('') || '<div class="ai-placeholder"><div><strong>ไม่มี Alert ที่ต้องโฟกัส</strong><p>สำหรับชุดข้อมูลที่เลือกยังไม่มีประเด็นสำคัญเพิ่มเติม</p></div></div>';

    const campaignBody = document.getElementById('campaignBody');
    campaignBody.innerHTML = rows.map((row) => `<tr>
      <td>${row.campaign}</td>
      <td>${row.game}</td>
      <td>${row.account}</td>
      <td>${row.type}</td>
      <td>${UI.money(row.spend)}</td>
      <td>${UI.number(row.conversions)}</td>
      <td>${UI.money(row.cpa)}</td>
      <td>${row.note}</td>
    </tr>`).join('') || '<tr><td colspan="8" class="table-empty">ไม่พบ Campaign</td></tr>';
  };

  const boot = () => {
    UI.fillSelect(gameFilter, UI.data.games);
    UI.fillSelect(accountFilter, UI.unique(UI.data.accounts, 'account'));
    UI.fillSelect(typeFilter, ['Search', 'PMax']);
    gameFilter?.addEventListener('change', () => {
      const accounts = UI.data.accounts.filter((row) => !gameFilter.value || row.game === gameFilter.value).map((row) => row.account);
      UI.fillSelect(accountFilter, [...new Set(accounts)]);
      render();
    });
    accountFilter?.addEventListener('change', render);
    typeFilter?.addEventListener('change', render);
    document.getElementById('logoutButton')?.addEventListener('click', () => window.Auth.redirectToLogin());
    render();
  };

  boot();
})();
