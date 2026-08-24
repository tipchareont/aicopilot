'use strict';

(() => {
  const UI = window.GoogleAdsUI;
  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');

  let scopeRows = [];
  let fullResult = null;

  const clean = UI.clean;
  const num = UI.num;
  const upper = (value) => clean(value).toUpperCase();

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
    `<tr><td colspan="${cols}" class="empty-state">${escapeHtml(message)}</td></tr>`;

  const buildScopeRows = (result) => {
    const rows = [];
    const push = (row) => {
      const gameId = clean(row?.Game_ID);
      const accountId = clean(row?.Account_ID);
      if (!gameId || !accountId) return;
      rows.push({
        gameId,
        game: clean(row?.Game_Name) || gameId,
        accountId,
        account: clean(row?.Account_Name) || accountId,
      });
    };

    [
      ...(Array.isArray(result?.asset_groups) ? result.asset_groups : []),
      ...(Array.isArray(result?.search_campaigns) ? result.search_campaigns : []),
      ...(Array.isArray(result?.keywords) ? result.keywords : []),
      ...(Array.isArray(result?.search_terms) ? result.search_terms : []),
      ...(Array.isArray(result?.pmax_campaigns) ? result.pmax_campaigns : []),
      ...(Array.isArray(result?.ai_intelligence?.scopes)
        ? result.ai_intelligence.scopes
        : []),
    ].forEach(push);

    const deduped = new Map();
    rows.forEach((row) => deduped.set(`${row.gameId}||${row.accountId}`, row));
    return [...deduped.values()];
  };

  const scopedResult = () => {
    const source = fullResult || {};
    const filters = current();
    const filterRows = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => {
      if (filters.game && clean(row.Game_ID) !== filters.game) return false;
      if (filters.account && clean(row.Account_ID) !== filters.account) return false;
      return true;
    });

    const assetGroups = filterRows(source.asset_groups);
    const searchCampaigns = filterRows(source.search_campaigns);
    const keywords = filterRows(source.keywords);
    const searchTerms = filterRows(source.search_terms);
    const pmaxCampaigns = filterRows(source.pmax_campaigns);
    const aiScopes = filterRows(source?.ai_intelligence?.scopes);

    const weak = new Set(['AVERAGE','POOR','INCOMPLETE']);
    const reviewTerms = searchTerms.filter(
      (row) => num(row.Clicks) > 0 && num(row.Conversions) <= 0
    );

    return {
      ...source,
      summary:{
        asset_group_count:assetGroups.length,
        asset_link_count:assetGroups.reduce((sum,row) => sum + num(row.Asset_Count),0),
        search_campaign_count:searchCampaigns.length,
        keyword_count:keywords.length,
        search_term_count:searchTerms.length,
        search_terms_to_review:reviewTerms.length,
        weak_asset_strength_count:assetGroups.filter(
          (row) => weak.has(upper(row.Ad_Strength))
        ).length,
      },
      pmax_campaigns:pmaxCampaigns,
      asset_groups:assetGroups,
      search_campaigns:searchCampaigns,
      keywords,
      search_terms:searchTerms,
      ai_intelligence:{
        ...(source.ai_intelligence || {}),
        scopes:aiScopes,
      },
    };
  };

  const flattenAi = (result) => {
    const scopes = Array.isArray(result?.ai_intelligence?.scopes)
      ? result.ai_intelligence.scopes
      : [];

    return {
      scopes,
      campaignSignals:scopes.flatMap((scope) =>
        (Array.isArray(scope.campaign_signals) ? scope.campaign_signals : [])
          .map((row) => ({...row,__scope:scope}))
      ),
      opportunities:scopes.flatMap((scope) =>
        (Array.isArray(scope.search_term_opportunities) ? scope.search_term_opportunities : [])
          .map((row) => ({...row,__scope:scope}))
      ),
      reviewQueue:scopes.flatMap((scope) =>
        (Array.isArray(scope.search_term_review_queue) ? scope.search_term_review_queue : [])
          .map((row) => ({...row,__scope:scope}))
      ),
      actions:scopes.flatMap((scope) =>
        (Array.isArray(scope.ai_analysis?.Recommended_Actions) ? scope.ai_analysis.Recommended_Actions : [])
          .map((row) => ({...row,__scope:scope}))
      ),
    };
  };

  const setTone = (id, tone) => {
    const node = document.getElementById(id);
    if (node) node.dataset.tone = tone;
  };

  const renderSignals = (result, ai) => {
    const riskSignals = ai.campaignSignals.filter((row) =>
      ['CPA_WORSENING','NO_CONVERSION_CURRENT_7D'].includes(upper(row.signal))
    );
    const scaleSignals = ai.campaignSignals.filter((row) => upper(row.signal) === 'SCALE_SIGNAL');

    const campaignKpi = document.getElementById('campaignSignalKpi');
    const campaignNote = document.getElementById('campaignSignalNote');
    if (riskSignals.length) {
      campaignKpi.textContent = `${riskSignals.length} Risk`;
      campaignNote.textContent = riskSignals[0].evidence || 'มี Campaign Signal ที่ต้องตรวจ';
      setTone('campaignSignalCard','risk');
    } else if (scaleSignals.length) {
      campaignKpi.textContent = `${scaleSignals.length} Scale`;
      campaignNote.textContent = 'มี SCALE_SIGNAL จากข้อมูล 7D vs Previous 7D';
      setTone('campaignSignalCard','good');
    } else {
      campaignKpi.textContent = 'Stable';
      campaignNote.textContent = 'ยังไม่พบ Campaign Risk/Scale Signal ใน Scope นี้';
      setTone('campaignSignalCard','info');
    }

    const assetGroups = Array.isArray(result.asset_groups) ? result.asset_groups : [];
    const weakCount = assetGroups.filter((row) =>
      ['AVERAGE','POOR','INCOMPLETE'].includes(upper(row.Ad_Strength))
    ).length;

    const bestStrength = assetGroups.map((row) => upper(row.Ad_Strength)).find(Boolean) || '-';
    document.getElementById('assetHealthKpi').textContent =
      assetGroups.length ? bestStrength : '-';
    document.getElementById('assetHealthNote').textContent =
      assetGroups.length
        ? `${assetGroups.length} Asset Group · ${weakCount} กลุ่มที่ต้อง Review`
        : 'ยังไม่มี PMax Asset Group ใน Scope นี้';
    setTone('assetSignalCard', weakCount ? 'watch' : (assetGroups.length ? 'good' : 'info'));

    document.getElementById('opportunityKpi').textContent = UI.number(ai.opportunities.length);
    setTone('opportunitySignalCard', ai.opportunities.length ? 'info' : 'good');

    document.getElementById('reviewKpi').textContent = UI.number(ai.reviewQueue.length);
    setTone('reviewSignalCard', ai.reviewQueue.length ? 'watch' : 'good');
  };

  const renderAiSnapshot = (result, ai) => {
    const firstScope = ai.scopes[0] || {};
    const analysis = firstScope.ai_analysis || {};
    const scopeLabel = ai.scopes.length === 1
      ? `${firstScope.Game_Name || firstScope.Game_ID || '-'} · ${firstScope.Account_Name || firstScope.Account_ID || '-'}`
      : `${ai.scopes.length} Google scopes`;

    document.getElementById('aiScopeTitle').textContent = `Google AI Intelligence · ${scopeLabel}`;
    document.getElementById('aiExecutiveSummary').textContent =
      analysis.Executive_Summary ||
      (ai.scopes.length
        ? 'มี Google Intelligence Cache แต่ยังไม่มี Executive Summary ใน Scope นี้'
        : 'ยังไม่มี Google Intelligence ใน Scope นี้');

    const risk = analysis.Biggest_Risk || 'ยังไม่พบ Risk หลัก';
    const scale = analysis.Scale_Recommendation || 'ยังไม่มี Scale Recommendation';
    const pmax = analysis.PMax_Asset_Assessment || 'ยังไม่มี PMax Assessment';

    document.getElementById('aiSignalStack').innerHTML = `
      <div class="mini-signal"><strong>Risk</strong><p>${escapeHtml(risk)}</p></div>
      <div class="mini-signal"><strong>PMax</strong><p>${escapeHtml(pmax)}</p></div>
      <div class="mini-signal"><strong>Scale</strong><p>${escapeHtml(scale)}</p></div>
    `;

    const order = {HIGH:0,MEDIUM:1,LOW:2};
    const actions = [...ai.actions]
      .sort((a,b) => (order[upper(a.priority)] ?? 9) - (order[upper(b.priority)] ?? 9))
      .slice(0,6);

    document.getElementById('recommendedActions').innerHTML =
      actions.length
        ? actions.map((row) => `
          <article class="action-card" data-priority="${upper(row.priority) || 'MEDIUM'}">
            <div class="action-head">
              <strong>${escapeHtml(upper(row.priority) || 'MEDIUM')}</strong>
              <span class="chip ${upper(row.priority)==='HIGH'?'red':upper(row.priority)==='MEDIUM'?'amber':'blue'}">Recommended Action</span>
            </div>
            <p>${escapeHtml(row.action || '-')}</p>
            ${Array.isArray(row.evidence) && row.evidence.length
              ? `<p><strong>Evidence:</strong> ${escapeHtml(row.evidence.slice(0,3).join(' • '))}</p>`
              : ''}
          </article>
        `).join('')
        : `<div class="empty-state">ยังไม่มี Recommended Action ใน Scope นี้</div>`;
  };

  const renderAssets = (result) => {
    const rows = Array.isArray(result.asset_groups) ? result.asset_groups : [];
    document.getElementById('assetCountBadge').textContent = `${UI.number(rows.length)} Asset Groups`;

    const body = document.getElementById('assetBody');
    if (!rows.length) {
      body.innerHTML = emptyRow(6,'ยังไม่มี PMax Asset Group ใน Scope นี้');
      document.getElementById('assetCoverage').innerHTML = '<span class="chip slate">No Asset Group</span>';
      document.getElementById('assetCoverageNote').textContent = 'ยังไม่มีข้อมูล Asset Coverage';
      return;
    }

    body.innerHTML = rows.slice(0,10).map((row) => {
      const strength = upper(row.Ad_Strength);
      const tone = strength === 'EXCELLENT' || strength === 'GOOD'
        ? 'green'
        : ['AVERAGE','POOR','INCOMPLETE'].includes(strength) ? 'amber' : 'slate';
      return `<tr>
        <td><strong>${escapeHtml(row.Asset_Group_Name || row.Asset_Group_ID)}</strong><br><small>${escapeHtml(row.Campaign_Name || '-')}</small></td>
        <td><span class="chip ${tone}">${escapeHtml(row.Ad_Strength || '-')}</span></td>
        <td class="metric">${UI.number(row.Asset_Count || 0)}</td>
        <td class="metric">${UI.money(row.Spend)}</td>
        <td class="metric">${UI.number(row.Conversions)}</td>
        <td class="metric">${num(row.Conversions)>0 ? UI.money(row.CPA) : '-'}</td>
      </tr>`;
    }).join('');

    const coverage = [...new Set(rows.flatMap((row) =>
      Array.isArray(row.Field_Types) ? row.Field_Types : []
    ))];

    document.getElementById('assetCoverage').innerHTML =
      coverage.length
        ? coverage.map((field) => `<span class="chip blue">${escapeHtml(field)}</span>`).join('')
        : '<span class="chip slate">No Field Type</span>';

    const healthy = rows.filter((row) => ['EXCELLENT','GOOD'].includes(upper(row.Ad_Strength))).length;
    document.getElementById('assetCoverageNote').textContent =
      `${healthy}/${rows.length} Asset Group อยู่ใน Ad Strength ระดับ GOOD หรือ EXCELLENT · ใช้ Google Ad_Strength enum จริง`;
  };

  const renderIntent = (result, ai) => {
    const searchTerms = Array.isArray(result.search_terms) ? result.search_terms : [];
    document.getElementById('searchTermCountBadge').textContent =
      `${UI.number(searchTerms.length)} Search Terms`;

    document.getElementById('opportunityCountBadge').textContent =
      UI.number(ai.opportunities.length);
    document.getElementById('reviewCountBadge').textContent =
      UI.number(ai.reviewQueue.length);

    const opportunityList = document.getElementById('opportunityList');
    opportunityList.innerHTML = ai.opportunities.length
      ? ai.opportunities
          .sort((a,b) => num(b.Conversions)-num(a.Conversions) || num(a.CPA)-num(b.CPA))
          .slice(0,10)
          .map((row) => `<div class="term-row">
            <div class="term-top"><div class="term-name">${escapeHtml(row.Search_Term)}</div><span class="chip blue">${escapeHtml(row.signal || 'OPPORTUNITY')}</span></div>
            <div class="term-meta">
              <span>Clicks <strong>${UI.number(row.Clicks)}</strong></span>
              <span>Conversions <strong>${UI.number(row.Conversions)}</strong></span>
              <span>CPA <strong>${num(row.Conversions)>0 ? UI.money(row.CPA) : '-'}</strong></span>
              <span>Baseline <strong>${row.baseline_search_term_cpa!=null ? UI.money(row.baseline_search_term_cpa) : '-'}</strong></span>
            </div>
            <div class="term-note">${escapeHtml(row.Campaign_Name || '')}</div>
          </div>`).join('')
      : '<div class="empty-state">ยังไม่มี Search Term Opportunity ใน Scope นี้</div>';

    const reviewList = document.getElementById('reviewList');
    reviewList.innerHTML = ai.reviewQueue.length
      ? ai.reviewQueue
          .sort((a,b) => num(b.Spend)-num(a.Spend) || num(b.Clicks)-num(a.Clicks))
          .slice(0,10)
          .map((row) => `<div class="term-row">
            <div class="term-top"><div class="term-name">${escapeHtml(row.Search_Term)}</div><span class="chip amber">REVIEW</span></div>
            <div class="term-meta">
              <span>Clicks <strong>${UI.number(row.Clicks)}</strong></span>
              <span>Spend <strong>${UI.money(row.Spend)}</strong></span>
              <span>Conversions <strong>${UI.number(row.Conversions)}</strong></span>
            </div>
            <div class="term-note">${escapeHtml(row.note || 'มี Click แต่ยังไม่มี Conversion — ต้องตรวจ Intent เพิ่ม')}</div>
          </div>`).join('')
      : '<div class="empty-state">ไม่มี Search Term ที่ต้อง Review ใน Scope นี้</div>';
  };

  const renderKeywords = (result) => {
    const keywords = Array.isArray(result.keywords) ? result.keywords : [];
    const searchCampaigns = Array.isArray(result.search_campaigns) ? result.search_campaigns : [];
    const badge = document.getElementById('keywordStatusBadge');

    if (!keywords.length) {
      badge.textContent = searchCampaigns.length ? 'No Keyword Rows' : 'PMax-only';
      badge.className = 'chip slate';
      document.getElementById('keywordEvidenceNote').textContent =
        searchCampaigns.length
          ? 'มี Search Campaign แต่ยังไม่มี Keyword Rows ในข้อมูลช่วงนี้'
          : 'Account นี้เป็น PMax-only จึงมี Search Campaign / Keyword = 0 ได้ตามปกติ';
      document.getElementById('keywordBody').innerHTML =
        emptyRow(8,'ไม่มี Search Keyword ใน Scope นี้');
      return;
    }

    badge.textContent = `${keywords.length} Keywords`;
    badge.className = 'chip blue';
    document.getElementById('keywordEvidenceNote').textContent =
      'แสดง Keyword Evidence จากข้อมูลจริงของ Search Campaign';

    document.getElementById('keywordBody').innerHTML =
      keywords.slice(0,10).map((row) => `<tr>
        <td>${escapeHtml(row.Keyword)}</td>
        <td>${escapeHtml(row.Campaign_Name || '-')}</td>
        <td>${escapeHtml(row.Match_Type || '-')}</td>
        <td class="metric">${UI.number(row.Clicks)}</td>
        <td class="metric">${UI.percent(num(row.CTR)*100)}</td>
        <td class="metric">${UI.number(row.Conversions)}</td>
        <td class="metric">${num(row.Conversions)>0 ? UI.money(row.CPA) : '-'}</td>
        <td class="metric">${row.Search_Impression_Share==null ? '-' : UI.percent(row.Search_Impression_Share)}</td>
      </tr>`).join('');
  };

  const renderPolicy = (result) => {
    const scopes = Array.isArray(result?.ai_intelligence?.scopes)
      ? result.ai_intelligence.scopes
      : [];
    const policy = scopes[0]?.evidence_policy || {};
    const rows = [
      policy.google_conversions || 'Google Ads Conversions ไม่ map เป็น Complete Register',
      policy.asset_health || 'Asset Health ใช้ Google Ad_Strength enum จริง',
      policy.search_term_review || 'Review Queue ไม่ถูกสรุปอัตโนมัติว่าเป็น Waste',
      policy.automation || 'RECOMMEND_ONLY',
    ].filter(Boolean);

    document.getElementById('evidencePolicy').innerHTML =
      rows.map((row,index) =>
        `<span class="chip ${index===0?'blue':index===1?'green':index===2?'amber':'slate'}">${escapeHtml(row)}</span>`
      ).join('');
  };

  const render = (result) => {
    document.getElementById('updatedAt').textContent =
      `ข้อมูลล่าสุด ${result.data_date || result.ai_intelligence?.data_date || '-'}`;

    const ai = flattenAi(result);
    renderSignals(result, ai);
    renderAiSnapshot(result, ai);
    renderAssets(result);
    renderIntent(result, ai);
    renderKeywords(result);
    renderPolicy(result);
  };

  async function loadInsights() {
    try {
      document.getElementById('updatedAt').textContent = 'กำลังโหลดข้อมูลจริง...';

      // Exactly one n8n execution for this page.
      fullResult = await UI.fetchInsights({});
      scopeRows = buildScopeRows(fullResult);

      UI.fillSelectOptions(gameFilter, UI.gameOptions(scopeRows));
      UI.fillSelectOptions(accountFilter, UI.accountOptions(scopeRows, ''));

      render(scopedResult());
    } catch (error) {
      console.error('[Google Ads Insights]', error);
      if (Number(error?.httpStatus) === 401) {
        window.Auth?.redirectToLogin?.();
        return;
      }

      document.getElementById('updatedAt').textContent = 'โหลดข้อมูลไม่สำเร็จ';
      document.getElementById('aiExecutiveSummary').textContent =
        error?.message || 'Google Ads API Error';
      document.getElementById('recommendedActions').innerHTML =
        '<div class="empty-state">ไม่สามารถโหลด Google Intelligence ได้</div>';
      document.getElementById('assetBody').innerHTML =
        emptyRow(6,error?.message || 'Google Ads API Error');
      document.getElementById('opportunityList').innerHTML =
        '<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>';
      document.getElementById('reviewList').innerHTML =
        '<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>';
      document.getElementById('keywordBody').innerHTML =
        emptyRow(8,error?.message || 'Google Ads API Error');
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
        UI.accountOptions(scopeRows, gameFilter?.value || '')
      );
      if (fullResult) render(scopedResult());
    });

    accountFilter?.addEventListener('change', () => {
      if (fullResult) render(scopedResult());
    });

    document.getElementById('logoutButton')
      ?.addEventListener('click', () => window.Auth.redirectToLogin());

    await loadInsights();
  };

  boot();
})();