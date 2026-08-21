'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');

  let scopeRows = [];

  const current = () => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
  });

  const emptyTables = (message) => {
    document.getElementById('keywordBody').innerHTML =
      `<tr><td colspan="11" class="table-empty">${message}</td></tr>`;
    document.getElementById('assetBody').innerHTML =
      `<tr><td colspan="8" class="table-empty">${message}</td></tr>`;
    document.getElementById('termBody').innerHTML =
      `<tr><td colspan="8" class="table-empty">${message}</td></tr>`;
  };

  async function load({preserveFilters = false} = {}) {
    try {
      document.getElementById('updatedAt').textContent = 'กำลังตรวจข้อมูลจริง...';

      // Real campaign request is used only to build authorized filters.
      const overview = await UI.fetchOverview(current());
      const endDate = overview.data_date || new Date().toISOString().slice(0,10);
      const campaign = await UI.fetchCampaigns(
        current(),
        {startDate:endDate, endDate, limit:5000}
      );
      scopeRows = campaign.rows || [];

      if (!preserveFilters) {
        UI.fillSelectOptions(gameFilter, UI.gameOptions(scopeRows));
        UI.fillSelectOptions(accountFilter, UI.accountOptions(scopeRows, gameFilter?.value || ''));
      } else {
        UI.fillSelectOptions(accountFilter, UI.accountOptions(scopeRows, gameFilter?.value || ''));
      }

      const result = await UI.fetchInsights(current());
      const message = result.message || 'Asset Group / Keyword / Search Term ETL ยังไม่ได้เปิดใช้งาน';

      document.getElementById('updatedAt').textContent = `ข้อมูลล่าสุด ${result.data_date || endDate || '-'}`;
      document.getElementById('termKpi').textContent = '0';
      document.getElementById('keywordKpi').textContent = '0';
      document.getElementById('assetKpi').textContent = '0';
      document.getElementById('lowIsKpi').textContent = '-';
      document.getElementById('weakAssetKpi').textContent = '-';
      emptyTables(message);

      document.getElementById('recommendationList').innerHTML =
        `<article class="action-card" data-level="medium">
          <div class="action-head"><strong>รอ Google-specific Insight ETL</strong></div>
          <p>${message} หน้านี้จึงไม่แสดง Mock Data เพื่อป้องกันการตีความข้อมูลจำลองเป็นข้อมูลจริง</p>
        </article>`;
    } catch (error) {
      console.error('[Google Ads Insights]', error);
      if (Number(error?.httpStatus) === 401) {
        window.Auth?.redirectToLogin?.();
        return;
      }
      document.getElementById('updatedAt').textContent = 'โหลดข้อมูลไม่สำเร็จ';
      emptyTables(error?.message || 'Google Ads API Error');
    }
  }

  const boot = async () => {
    document.getElementById('displayName').textContent =
      localStorage.getItem('display_name') || localStorage.getItem('username') || 'User';
    document.getElementById('role').textContent = localStorage.getItem('role') || 'USER';

    gameFilter?.addEventListener('change', () => load({preserveFilters:true}));
    accountFilter?.addEventListener('change', () => load({preserveFilters:true}));
    document.getElementById('logoutButton')?.addEventListener('click', () => window.Auth.redirectToLogin());

    await load();
  };

  boot();
})();
