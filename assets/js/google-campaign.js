'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');
  const statusFilter = document.getElementById('statusFilter');

  const currentFilters = () => ({ game: gameFilter.value || '', account: accountFilter.value || '', type: typeFilter.value || '', status: statusFilter.value || '' });

  const render = () => {
    const rows = UI.filterCampaigns(currentFilters());
    const searchRows = rows.filter((row) => row.type === 'Search');
    const pmaxRows = rows.filter((row) => row.type === 'PMax');
    document.getElementById('updatedAt').textContent = `อัปเดตล่าสุด ${UI.lastUpdated()}`;
    document.getElementById('totalCampaigns').textContent = UI.number(rows.length);
    document.getElementById('searchCampaigns').textContent = UI.number(searchRows.length);
    document.getElementById('pmaxCampaigns').textContent = UI.number(pmaxRows.length);
    document.getElementById('avgSearchIs').textContent = UI.percent(UI.avg(searchRows.filter((row) => row.searchIs !== null), 'searchIs'));
    document.getElementById('tableBadge').textContent = `${rows.length} campaigns`;
    document.getElementById('tableBody').innerHTML = rows.map((row) => `<tr>
      <td>${row.campaign}</td>
      <td>${row.game}</td>
      <td>${row.account}</td>
      <td>${row.type}</td>
      <td><span class="status-pill ${UI.statusClass(row.status)}">${row.status}</span></td>
      <td>${UI.money(row.spend)}</td>
      <td>${UI.number(row.clicks)}</td>
      <td>${UI.percent(row.ctr)}</td>
      <td>${UI.money(row.avgCpc)}</td>
      <td>${UI.number(row.conversions)}</td>
      <td>${UI.money(row.cpa)}</td>
      <td>${UI.percent(row.convRate)}</td>
      <td>${row.searchIs === null ? '-' : UI.percent(row.searchIs)}</td>
      <td>${row.lostBudget === null ? '-' : UI.percent(row.lostBudget)}</td>
      <td>${row.lostRank === null ? '-' : UI.percent(row.lostRank)}</td>
      <td>${row.note}</td>
    </tr>`).join('') || '<tr><td colspan="16" class="table-empty">ไม่พบข้อมูล</td></tr>';
  };

  const boot = () => {
    UI.fillSelect(gameFilter, UI.data.games);
    UI.fillSelect(accountFilter, UI.unique(UI.data.accounts, 'account'));
    UI.fillSelect(typeFilter, ['Search', 'PMax']);
    UI.fillSelect(statusFilter, ['Active', 'Learning', 'Paused']);
    gameFilter.addEventListener('change', () => {
      const accounts = UI.data.accounts.filter((row) => !gameFilter.value || row.game === gameFilter.value).map((row) => row.account);
      UI.fillSelect(accountFilter, [...new Set(accounts)]);
      render();
    });
    [accountFilter, typeFilter, statusFilter].forEach((node) => node.addEventListener('change', render));
    document.getElementById('logoutButton')?.addEventListener('click', () => window.Auth.redirectToLogin());
    render();
  };

  boot();
})();
