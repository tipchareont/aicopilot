'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');

  const filters = () => ({ game: gameFilter.value || '', account: accountFilter.value || '' });

  const render = () => {
    const activeFilters = filters();
    const keywords = UI.relatedKeywords(activeFilters)
      .sort((a, b) => Number(b.conversions || 0) - Number(a.conversions || 0) || Number(b.clicks || 0) - Number(a.clicks || 0))
      .slice(0, 10);
    const searchTerms = UI.relatedSearchTerms(activeFilters);
    const assetGroups = UI.relatedAssetGroups(activeFilters);
    const lowIs = UI.filterCampaigns(activeFilters).filter((row) => row.type === 'Search' && Number(row.searchIs || 0) < 65);
    const weakAssets = assetGroups.filter((row) => ['Average', 'Poor'].includes(row.strength));

    document.getElementById('updatedAt').textContent = `อัปเดตล่าสุด ${UI.lastUpdated()}`;
    document.getElementById('termKpi').textContent = UI.number(searchTerms.length);
    document.getElementById('keywordKpi').textContent = UI.number(keywords.length);
    document.getElementById('assetKpi').textContent = UI.number(assetGroups.length);
    document.getElementById('lowIsKpi').textContent = UI.number(lowIs.length);
    document.getElementById('weakAssetKpi').textContent = UI.number(weakAssets.length);

    document.getElementById('keywordBody').innerHTML = keywords.map((row, index) => `<tr>
      <td><strong>#${index + 1}</strong></td>
      <td>${row.keyword}</td>
      <td>${row.game}</td>
      <td>${row.campaign}</td>
      <td>${row.matchType}</td>
      <td>${UI.number(row.clicks)}</td>
      <td>${UI.percent(row.ctr)}</td>
      <td>${UI.number(row.conversions)}</td>
      <td>${UI.money(row.cpa)}</td>
      <td>${UI.percent(row.searchIs)}</td>
      <td>${row.action}</td>
    </tr>`).join('') || '<tr><td colspan="11" class="table-empty">ไม่พบ Keyword</td></tr>';

    document.getElementById('assetBody').innerHTML = assetGroups.map((row) => `<tr>
      <td>${row.assetGroup}</td>
      <td>${row.campaign}</td>
      <td><span class="status-pill ${UI.statusClass(row.strength)}">${row.strength}</span></td>
      <td>${UI.money(row.spend)}</td>
      <td>${UI.number(row.conversions)}</td>
      <td>${UI.money(row.cpa)}</td>
      <td>${row.topSignal}</td>
      <td>${row.note}</td>
    </tr>`).join('') || '<tr><td colspan="8" class="table-empty">ไม่พบข้อมูล Asset Group</td></tr>';

    document.getElementById('termBody').innerHTML = searchTerms.map((row) => `<tr>
      <td>${row.term}</td>
      <td>${row.campaign}</td>
      <td>${row.matchType}</td>
      <td>${UI.number(row.clicks)}</td>
      <td>${UI.percent(row.ctr)}</td>
      <td>${UI.number(row.conversions)}</td>
      <td>${UI.money(row.cpa)}</td>
      <td>${row.action}</td>
    </tr>`).join('') || '<tr><td colspan="8" class="table-empty">ไม่พบ Search Term</td></tr>';

    const recs = [
      `ถ้า Search Impression Share ต่ำกว่า 65% ให้ดู Lost Rank และแยกแผนเพิ่มคุณภาพคำโฆษณา`,
      `สำหรับ PMax ให้โฟกัส Asset Group ที่ CPA สูงกว่าค่าเฉลี่ยบัญชีและ Strength ต่ำกว่า Good`,
      `Search Term ที่ Conversion ดีควรแยกไป Exact/Phrase เพื่อคุม Query ให้ชัดขึ้น`
    ];
    document.getElementById('recommendationList').innerHTML = recs.map((text, index) => `<article class="action-card" data-level="${index === 0 ? 'medium' : index === 1 ? 'high' : 'good'}"><div class="action-head"><strong>Recommendation ${index + 1}</strong></div><p>${text}</p></article>`).join('');
  };

  const boot = () => {
    UI.fillSelect(gameFilter, UI.data.games);
    UI.fillSelect(accountFilter, UI.unique(UI.data.accounts, 'account'));
    gameFilter.addEventListener('change', () => {
      const accounts = UI.data.accounts.filter((row) => !gameFilter.value || row.game === gameFilter.value).map((row) => row.account);
      UI.fillSelect(accountFilter, [...new Set(accounts)]);
      render();
    });
    accountFilter.addEventListener('change', render);
    document.getElementById('logoutButton')?.addEventListener('click', () => window.Auth.redirectToLogin());
    render();
  };

  boot();
})();
