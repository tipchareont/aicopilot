'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');

  let scopeRows = [];

  const clean = UI.clean;
  const num = UI.num;

  const escapeHtml = (value) =>
    clean(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const current = () => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
  });

  const emptyRow = (cols, message) =>
    `<tr><td colspan="${cols}" class="table-empty">${escapeHtml(message)}</td></tr>`;

  const searchTermAction = (row) => {
    if (num(row.Conversions) > 0) {
      return 'มี Conversion — ใช้เป็น Intent Signal สำหรับตรวจต่อ';
    }
    if (num(row.Clicks) > 0) {
      return 'มี Click แต่ยังไม่ Convert — ตรวจ Intent / Landing';
    }
    return 'เฝ้าดูข้อมูลเพิ่ม';
  };

  const keywordAction = (row) => {
    if (num(row.Conversions) > 0) {
      return 'มี Conversion — จัดเป็น Keyword ที่ควรตรวจต่อ';
    }
    if (num(row.Clicks) > 0) {
      return 'มี Click แต่ยังไม่ Convert — ตรวจ Search Intent';
    }
    return 'เฝ้าดูข้อมูลเพิ่ม';
  };

  const assetInsight = (row) => {
    const strength = clean(row.Ad_Strength).toUpperCase();

    if (strength === 'EXCELLENT') return 'Asset Strength ดีมาก';
    if (strength === 'GOOD') return 'Asset Strength อยู่ในเกณฑ์ดี';
    if (['AVERAGE','POOR','INCOMPLETE'].includes(strength)) {
      return 'ควรตรวจ Asset Mix / Coverage';
    }
    return 'ตรวจสถานะ Asset เพิ่มเติม';
  };

  async function ensureScopeRows() {
    if (scopeRows.length) return;

    const overview = await UI.fetchOverview({});
    const endDate =
      overview.data_date ||
      new Date().toISOString().slice(0,10);

    const campaign = await UI.fetchCampaigns(
      {},
      {
        startDate:endDate,
        endDate,
        limit:5000,
      }
    );

    scopeRows = campaign.rows || [];

    UI.fillSelectOptions(
      gameFilter,
      UI.gameOptions(scopeRows)
    );

    UI.fillSelectOptions(
      accountFilter,
      UI.accountOptions(
        scopeRows,
        gameFilter?.value || ''
      )
    );
  }

  function render(result) {
    const summary = result.summary || {};
    const keywords = Array.isArray(result.keywords) ? result.keywords : [];
    const assetGroups = Array.isArray(result.asset_groups) ? result.asset_groups : [];
    const searchCampaigns = Array.isArray(result.search_campaigns) ? result.search_campaigns : [];
    const searchTerms = Array.isArray(result.search_terms) ? result.search_terms : [];

    document.getElementById('updatedAt').textContent =
      `ข้อมูลล่าสุด ${result.data_date || '-'}`;

    document.getElementById('keywordKpi').textContent =
      UI.number(summary.keyword_count || 0);

    document.getElementById('termKpi').textContent =
      UI.number(summary.search_terms_to_review || 0);

    document.getElementById('assetKpi').textContent =
      UI.number(summary.asset_group_count || 0);

    // No arbitrary "Low Search IS" threshold is invented in V1.
    document.getElementById('lowIsKpi').textContent =
      searchCampaigns.length ? '-' : '-';

    document.getElementById('weakAssetKpi').textContent =
      UI.number(summary.weak_asset_strength_count || 0);

    const keywordBody = document.getElementById('keywordBody');

    if (!keywords.length) {
      keywordBody.innerHTML = emptyRow(
        11,
        'ไม่พบ Search Keyword ใน Scope นี้ — PMax-only account สามารถเป็น 0 ได้'
      );
    } else {
      keywordBody.innerHTML = keywords
        .slice(0,10)
        .map((row,index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.Keyword)}</td>
            <td>${escapeHtml(row.Game_Name || row.Game_ID)}</td>
            <td>${escapeHtml(row.Campaign_Name)}</td>
            <td>${escapeHtml(row.Match_Type || '-')}</td>
            <td>${UI.number(row.Clicks)}</td>
            <td>${UI.percent(num(row.CTR) * 100)}</td>
            <td>${UI.number(row.Conversions)}</td>
            <td>${num(row.Conversions) > 0 ? UI.money(row.CPA) : '-'}</td>
            <td>${
              row.Search_Impression_Share === null ||
              row.Search_Impression_Share === undefined
                ? '-'
                : UI.percent(row.Search_Impression_Share)
            }</td>
            <td>${escapeHtml(keywordAction(row))}</td>
          </tr>
        `)
        .join('');
    }

    const assetBody = document.getElementById('assetBody');

    if (!assetGroups.length) {
      assetBody.innerHTML = emptyRow(
        8,
        'ไม่พบ PMax Asset Group ใน Scope นี้'
      );
    } else {
      assetBody.innerHTML = assetGroups
        .slice(0,10)
        .map(row => {
          const signal = [
            `${UI.number(row.Asset_Count || 0)} assets`,
            ...(Array.isArray(row.Field_Types) ? row.Field_Types.slice(0,3) : []),
          ].join(' • ');

          return `
            <tr>
              <td>${escapeHtml(row.Asset_Group_Name || row.Asset_Group_ID)}</td>
              <td>${escapeHtml(row.Campaign_Name)}</td>
              <td><span class="status-pill ${
                clean(row.Ad_Strength).toUpperCase() === 'EXCELLENT' ? 'good' :
                ['AVERAGE','POOR','INCOMPLETE'].includes(clean(row.Ad_Strength).toUpperCase()) ? 'watch' :
                ''
              }">${escapeHtml(row.Ad_Strength || '-')}</span></td>
              <td>${UI.money(row.Spend)}</td>
              <td>${UI.number(row.Conversions)}</td>
              <td>${num(row.Conversions) > 0 ? UI.money(row.CPA) : '-'}</td>
              <td>${escapeHtml(signal)}</td>
              <td>${escapeHtml(assetInsight(row))}</td>
            </tr>
          `;
        })
        .join('');
    }

    const termBody = document.getElementById('termBody');

    if (!searchTerms.length) {
      termBody.innerHTML = emptyRow(
        8,
        'ยังไม่พบ Search Term ใน Scope นี้'
      );
    } else {
      termBody.innerHTML = searchTerms
        .slice(0,10)
        .map(row => `
          <tr>
            <td>${escapeHtml(row.Search_Term)}</td>
            <td>${escapeHtml(row.Campaign_Name)}</td>
            <td>${escapeHtml(row.Search_Term_Match_Type || row.Campaign_Type || '-')}</td>
            <td>${UI.number(row.Clicks)}</td>
            <td>${UI.percent(num(row.CTR) * 100)}</td>
            <td>${UI.number(row.Conversions)}</td>
            <td>${num(row.Conversions) > 0 ? UI.money(row.CPA) : '-'}</td>
            <td>${escapeHtml(searchTermAction(row))}</td>
          </tr>
        `)
        .join('');
    }

    const recommendationList = document.getElementById('recommendationList');
    const cards = [];
    const aiScopes = Array.isArray(result?.ai_intelligence?.scopes)
      ? result.ai_intelligence.scopes
      : [];

    if (aiScopes.length) {
      for (const scope of aiScopes) {
        const analysis = scope.ai_analysis || {};
        const campaignSignals = Array.isArray(scope.campaign_signals) ? scope.campaign_signals : [];
        const scaleCount = campaignSignals.filter(row => clean(row.signal).toUpperCase() === 'SCALE_SIGNAL').length;
        const riskCount = campaignSignals.filter(row => ['CPA_WORSENING','NO_CONVERSION_CURRENT_7D'].includes(clean(row.signal).toUpperCase())).length;

        cards.push(`
          <article class="action-card" data-level="${riskCount ? 'medium' : (scaleCount ? 'good' : '')}">
            <div class="action-head">
              <strong>Google AI Intelligence</strong>
              <span>${escapeHtml(scope.Game_Name || scope.Game_ID)} · ${escapeHtml(scope.Account_Name || scope.Account_ID)}</span>
            </div>
            <p><strong>สรุป:</strong> ${escapeHtml(analysis.Executive_Summary || 'ข้อมูลยังไม่เพียงพอ')}</p>
            <p><strong>PMax:</strong> ${escapeHtml(analysis.PMax_Asset_Assessment || 'ข้อมูลยังไม่เพียงพอ')}</p>
            <p><strong>Search Term:</strong> ${escapeHtml(analysis.Search_Term_Opportunity || 'ข้อมูลยังไม่เพียงพอ')}</p>
            <p><strong>Risk:</strong> ${escapeHtml(analysis.Biggest_Risk || 'ยังไม่พบ Risk หลัก')}</p>
            <p><strong>Scale:</strong> ${escapeHtml(analysis.Scale_Recommendation || 'ยังไม่มี Scale Signal')}</p>
          </article>
        `);

        const actions = Array.isArray(analysis.Recommended_Actions) ? analysis.Recommended_Actions : [];
        actions.slice(0,3).forEach(row => {
          cards.push(`
            <article class="action-card" data-level="${clean(row.priority).toLowerCase() === 'high' ? 'medium' : ''}">
              <div class="action-head"><strong>${escapeHtml(row.priority || 'MEDIUM')} · Recommended Action</strong></div>
              <p>${escapeHtml(row.action || '-')}</p>
              ${Array.isArray(row.evidence) && row.evidence.length
                ? `<p><strong>Evidence:</strong> ${escapeHtml(row.evidence.join(' • '))}</p>`
                : ''}
            </article>
          `);
        });
      }
    } else {
      cards.push(`
        <article class="action-card" data-level="medium">
          <div class="action-head"><strong>Google AI Intelligence</strong></div>
          <p>ยังไม่มี google_ads_intelligence_latest ใน Scope นี้</p>
        </article>
      `);
    }

    cards.push(`
      <article class="action-card" data-level="${num(summary.search_terms_to_review) > 0 ? 'medium' : 'good'}">
        <div class="action-head">
          <strong>Search Term Review Queue</strong>
          <span>${UI.number(summary.search_terms_to_review || 0)}</span>
        </div>
        <p>Search Term ที่มี Click แต่ยังไม่มี Conversion เป็น Review Queue เท่านั้น ระบบไม่สรุปว่าเป็น Waste หรือควรทำ Negative Keyword โดยอัตโนมัติ</p>
      </article>
    `);

    recommendationList.innerHTML = cards.join('');
  }

  async function loadInsights() {
    try {
      document.getElementById('updatedAt').textContent =
        'กำลังโหลดข้อมูลจริง...';

      const result = await UI.fetchInsights(current());

      if (!result.data_available) {
        document.getElementById('updatedAt').textContent =
          `ข้อมูลล่าสุด ${result.data_date || '-'}`;

        document.getElementById('keywordKpi').textContent = '0';
        document.getElementById('termKpi').textContent = '0';
        document.getElementById('assetKpi').textContent = '0';
        document.getElementById('lowIsKpi').textContent = '-';
        document.getElementById('weakAssetKpi').textContent = '0';

        document.getElementById('keywordBody').innerHTML =
          emptyRow(11, result.message || 'ยังไม่มีข้อมูล');

        document.getElementById('assetBody').innerHTML =
          emptyRow(8, result.message || 'ยังไม่มีข้อมูล');

        document.getElementById('termBody').innerHTML =
          emptyRow(8, result.message || 'ยังไม่มีข้อมูล');

        document.getElementById('recommendationList').innerHTML = `
          <article class="action-card" data-level="medium">
            <div class="action-head"><strong>ยังไม่มี Google Insight Data</strong></div>
            <p>${escapeHtml(result.message || 'ยังไม่มีข้อมูลใน Scope นี้')}</p>
          </article>
        `;
        return;
      }

      render(result);
    } catch (error) {
      console.error('[Google Ads Insights]', error);

      if (Number(error?.httpStatus) === 401) {
        window.Auth?.redirectToLogin?.();
        return;
      }

      document.getElementById('updatedAt').textContent =
        'โหลดข้อมูลไม่สำเร็จ';

      document.getElementById('keywordBody').innerHTML =
        emptyRow(11, error?.message || 'Google Ads API Error');

      document.getElementById('assetBody').innerHTML =
        emptyRow(8, error?.message || 'Google Ads API Error');

      document.getElementById('termBody').innerHTML =
        emptyRow(8, error?.message || 'Google Ads API Error');
    }
  }

  const boot = async () => {
    document.getElementById('displayName').textContent =
      localStorage.getItem('display_name') ||
      localStorage.getItem('username') ||
      'User';

    document.getElementById('role').textContent =
      localStorage.getItem('role') ||
      'USER';

    await ensureScopeRows();

    gameFilter?.addEventListener('change', async () => {
      accountFilter.value = '';
      UI.fillSelectOptions(
        accountFilter,
        UI.accountOptions(
          scopeRows,
          gameFilter?.value || ''
        )
      );
      await loadInsights();
    });

    accountFilter?.addEventListener(
      'change',
      loadInsights
    );

    document
      .getElementById('logoutButton')
      ?.addEventListener(
        'click',
        () => window.Auth.redirectToLogin()
      );

    await loadInsights();
  };

  boot();
})();