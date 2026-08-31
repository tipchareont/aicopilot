'use strict';

(() => {
  const UI = window.GoogleAdsUI;

  const gameFilter = document.getElementById('gameFilter');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const trendMetric = document.getElementById('trendMetric');
  const campaignSort = document.getElementById('campaignSort');

  const state = {
    allRows: [],
    availableStart: '',
    availableEnd: '',
    rangeMode: 'MTD',
    startDate: '',
    endDate: '',
    charts: {},
  };

  const clean = (v) => String(v ?? '').trim();
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const uniqueCampaignCount = (rows) =>
    new Set(rows.map((r) => `${r.gameId}|${r.accountId}|${r.campaignId}`).filter(Boolean)).size;

  const daysBetweenInclusive = (start, end) => {
    if (!start || !end) return 0;
    const a = new Date(`${start}T00:00:00Z`);
    const b = new Date(`${end}T00:00:00Z`);
    return Math.floor((b - a) / 86400000) + 1;
  };

  const firstOfMonth = (dateText) => clean(dateText).slice(0, 7) + '-01';

  const previousMonthSameDayRange = (start, end) => {
    const endDate = new Date(`${end}T00:00:00Z`);
    const currentDay = endDate.getUTCDate();
    const prevMonthLast = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 0));
    const prevYear = prevMonthLast.getUTCFullYear();
    const prevMonth = prevMonthLast.getUTCMonth();
    const prevLastDay = prevMonthLast.getUTCDate();
    const prevEndDay = Math.min(currentDay, prevLastDay);
    const prevStart = new Date(Date.UTC(prevYear, prevMonth, 1));
    const prevEnd = new Date(Date.UTC(prevYear, prevMonth, prevEndDay));
    return {
      start: prevStart.toISOString().slice(0, 10),
      end: prevEnd.toISOString().slice(0, 10),
    };
  };

  const previousRange = (start, end) => {
    if (!start || !end) return {start:'', end:''};

    if (state.rangeMode === 'MTD') {
      return previousMonthSameDayRange(start, end);
    }

    const days = daysBetweenInclusive(start, end);
    return {
      start: UI.shiftDate(start, -days),
      end: UI.shiftDate(start, -1),
    };
  };

  const scopeFilters = (withDate = true) => ({
    game: gameFilter?.value || '',
    account: accountFilter?.value || '',
    type: typeFilter?.value || '',
    ...(withDate ? {startDate: state.startDate, endDate: state.endDate} : {}),
  });

  const summarize = (rows) => {
    const base = UI.summarize(rows);
    const spend = base.spend;
    const conversions = base.conversions;
    const clicks = base.clicks;
    const impressions = base.impressions;

    return {
      ...base,
      cpa: conversions > 0 ? spend / conversions : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      avgCpc: clicks > 0 ? spend / clicks : 0,
      convRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      campaigns: uniqueCampaignCount(rows),
    };
  };

  const metricDefs = {
    spend: {label:'Spend', value:(s)=>s.spend, format:UI.money, direction:'neutral'},
    conversions: {label:'Google Ads Conversions', value:(s)=>s.conversions, format:UI.number, direction:'higher'},
    cpa: {label:'CPA', value:(s)=>s.cpa, format:UI.money, direction:'lower'},
    ctr: {label:'CTR', value:(s)=>s.ctr, format:UI.percent, direction:'higher'},
    avgCpc: {label:'Avg CPC', value:(s)=>s.avgCpc, format:UI.money, direction:'lower'},
    convRate: {label:'Conversion Rate', value:(s)=>s.convRate, format:UI.percent, direction:'higher'},
    clicks: {label:'Clicks', value:(s)=>s.clicks, format:UI.number, direction:'neutral'},
    impressions: {label:'Impressions', value:(s)=>s.impressions, format:UI.number, direction:'neutral'},
    campaigns: {label:'Campaigns', value:(s)=>s.campaigns, format:UI.number, direction:'neutral'},
  };

  const deltaPercent = (current, previous) => {
    if (!Number.isFinite(previous) || previous === 0) {
      if (current === 0) return 0;
      return null;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const deltaClass = (delta, direction) => {
    if (delta === null || !Number.isFinite(delta) || Math.abs(delta) < 0.005 || direction === 'neutral') {
      return 'neutral';
    }
    const improving =
      direction === 'higher' ? delta > 0 :
      direction === 'lower' ? delta < 0 :
      false;
    return improving ? 'good' : 'bad';
  };

  const renderDelta = (id, current, previous, direction) => {
    const el = document.getElementById(id);
    if (!el) return;
    const delta = deltaPercent(current, previous);
    el.className = `kpi-delta ${deltaClass(delta, direction)}`;
    if (delta === null) {
      el.textContent = 'ไม่มีช่วงเทียบ';
      return;
    }
    const sign = delta > 0 ? '+' : '';
    el.textContent = `${sign}${delta.toFixed(1)}%`;
  };

  const setRange = (mode) => {
    const end = state.availableEnd;
    if (!end) return;

    state.rangeMode = mode;

    if (mode === 'MTD') {
      state.startDate = firstOfMonth(end);
      state.endDate = end;
    } else if (mode === '7') {
      state.startDate = UI.shiftDate(end, -6);
      state.endDate = end;
    } else if (mode === '14') {
      state.startDate = UI.shiftDate(end, -13);
      state.endDate = end;
    } else if (mode === '30') {
      state.startDate = UI.shiftDate(end, -29);
      state.endDate = end;
    } else if (mode === '90') {
      state.startDate = UI.shiftDate(end, -89);
      state.endDate = end;
    } else if (mode === 'ALL') {
      state.startDate = state.availableStart;
      state.endDate = end;
    }

    if (dateFrom) {
      dateFrom.value = state.startDate;
      dateFrom.min = state.availableStart;
      dateFrom.max = state.availableEnd;
    }
    if (dateTo) {
      dateTo.value = state.endDate;
      dateTo.min = state.availableStart;
      dateTo.max = state.availableEnd;
    }

    document.querySelectorAll('.preset').forEach((button) => {
      button.classList.toggle('active', button.dataset.range === mode);
    });
  };

  const aggregateCampaigns = (rows) => {
    const map = new Map();

    for (const row of rows) {
      const key = `${row.gameId}|${row.accountId}|${row.campaignId}`;
      if (!map.has(key)) {
        map.set(key, {
          gameId: row.gameId,
          game: row.game,
          accountId: row.accountId,
          account: row.account,
          campaignId: row.campaignId,
          campaign: row.campaign,
          type: row.type,
          status: row.status,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          firstDate: row.date,
          lastDate: row.date,
        });
      }

      const item = map.get(key);
      item.spend += num(row.spend);
      item.impressions += num(row.impressions);
      item.clicks += num(row.clicks);
      item.conversions += num(row.conversions);

      if (!item.firstDate || row.date < item.firstDate) item.firstDate = row.date;
      if (!item.lastDate || row.date >= item.lastDate) {
        item.lastDate = row.date;
        item.status = row.status;
        item.type = row.type;
      }
    }

    return [...map.values()].map((item) => ({
      ...item,
      cpa: item.conversions > 0 ? item.spend / item.conversions : 0,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      convRate: item.clicks > 0 ? (item.conversions / item.clicks) * 100 : 0,
    }));
  };

  const groupByDate = (rows) => {
    const groups = new Map();

    for (const row of rows) {
      if (!row.date) continue;
      if (!groups.has(row.date)) groups.set(row.date, []);
      groups.get(row.date).push(row);
    }

    return [...groups.entries()]
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([date, dateRows]) => ({date, ...summarize(dateRows)}));
  };

  const destroyChart = (name) => {
    state.charts[name]?.destroy?.();
    delete state.charts[name];
  };

  const renderTrendChart = (rows) => {
    const canvas = document.getElementById('trendChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const series = groupByDate(rows);
    const metric = trendMetric?.value || 'spend';
    const def = metricDefs[metric] || metricDefs.spend;

    destroyChart('trend');
    state.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.map((x) => x.date),
        datasets: [{
          label: def.label,
          data: series.map((x) => def.value(x)),
          fill: false,
          tension: 0.25,
          pointRadius: series.length > 45 ? 0 : 2.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {mode:'index', intersect:false},
        plugins: {
          legend: {display:false},
          tooltip: {
            callbacks: {
              label: (ctx) => `${def.label}: ${def.format(ctx.parsed.y)}`,
            },
          },
        },
        scales: {y:{beginAtZero:true}},
      },
    });

    const badge = document.getElementById('trendBadge');
    if (badge) badge.textContent = `${state.startDate} → ${state.endDate}`;
  };

  const renderPeriodComparison = (current, previous, prevRange) => {
    const metrics = ['spend','conversions','cpa','ctr'];
    const container = document.getElementById('comparisonGrid');
    if (!container) return;

    container.innerHTML = metrics.map((key) => {
      const def = metricDefs[key];
      const cur = def.value(current);
      const prev = def.value(previous);
      const delta = deltaPercent(cur, prev);
      const cls = deltaClass(delta, def.direction);
      const deltaText = delta === null
        ? 'ไม่มีช่วงเทียบ'
        : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;

      return `
        <article class="compare-item">
          <div class="compare-head">
            <span>${def.label}</span>
            <span class="kpi-delta ${cls}">${deltaText}</span>
          </div>
          <strong>${def.format(cur)}</strong>
          <small>ช่วงก่อนหน้า ${def.format(prev)}</small>
        </article>
      `;
    }).join('');

    const label = document.getElementById('comparisonLabel');
    if (label) {
      label.textContent = prevRange.start && prevRange.end
        ? `เทียบ ${prevRange.start} → ${prevRange.end}`
        : 'ไม่มีช่วงข้อมูลก่อนหน้า';
    }
  };

  const renderChannelMix = (rows) => {
    const types = ['PMax','Search','Display','Video','Demand Gen'];
    const body = document.getElementById('channelMixBody');

    const present = types
      .map((type) => ({type, rows: rows.filter((r) => r.type === type)}))
      .filter((item) => item.rows.length);

    body.innerHTML = present.length
      ? present.map((item) => {
          const s = summarize(item.rows);
          return `<tr>
            <td><strong>${item.type}</strong></td>
            <td>${UI.money(s.spend)}</td>
            <td>${UI.number(s.conversions)}</td>
            <td>${s.conversions > 0 ? UI.money(s.cpa) : '-'}</td>
            <td>${UI.percent(s.ctr)}</td>
            <td>${UI.number(s.campaigns)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="table-empty">ไม่พบข้อมูล Channel ในช่วงที่เลือก</td></tr>';
  };

  const renderCampaignTable = (rows) => {
    let campaigns = aggregateCampaigns(rows);
    const sort = campaignSort?.value || 'spend_desc';

    const sorter = {
      spend_desc: (a,b) => b.spend - a.spend,
      conversions_desc: (a,b) => b.conversions - a.conversions,
      cpa_asc: (a,b) => {
        if (a.conversions <= 0 && b.conversions <= 0) return 0;
        if (a.conversions <= 0) return 1;
        if (b.conversions <= 0) return -1;
        return a.cpa - b.cpa;
      },
      ctr_desc: (a,b) => b.ctr - a.ctr,
      name_asc: (a,b) => a.campaign.localeCompare(b.campaign),
    }[sort] || ((a,b) => b.spend - a.spend);

    campaigns.sort(sorter);

    const body = document.getElementById('campaignBody');
    const badge = document.getElementById('campaignBadge');
    if (badge) badge.textContent = `${campaigns.length} campaigns`;

    body.innerHTML = campaigns.length
      ? campaigns.map((row) => `<tr>
          <td class="campaign-name">
            <strong>${row.campaign || '-'}</strong>
            <small>${row.game} · ${row.account}</small>
          </td>
          <td>${row.type}</td>
          <td><span class="status-pill ${UI.statusClass(row.status)}">${row.status}</span></td>
          <td>${UI.money(row.spend)}</td>
          <td>${UI.number(row.conversions)}</td>
          <td>${row.conversions > 0 ? UI.money(row.cpa) : '-'}</td>
          <td>${UI.percent(row.ctr)}</td>
          <td>${UI.percent(row.convRate)}</td>
          <td>${row.firstDate} → ${row.lastDate}</td>
        </tr>`).join('')
      : '<tr><td colspan="9" class="table-empty">ไม่พบ Campaign ในช่วงที่เลือก</td></tr>';
  };

  const render = () => {
    if (
      state.startDate &&
      state.endDate &&
      state.startDate > state.endDate
    ) {
      const badge = document.getElementById('updatedAt');
      if (badge) badge.textContent = 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด';
      return;
    }

    const currentRows = UI.filterCampaigns(state.allRows, scopeFilters(true));
    const current = summarize(currentRows);

    const prevRange = previousRange(state.startDate, state.endDate);
    const prevFilters = scopeFilters(false);
    const previousRows = UI.filterCampaigns(state.allRows, {
      ...prevFilters,
      startDate: prevRange.start,
      endDate: prevRange.end,
    });
    const previous = summarize(previousRows);

    const rangeLabel = `${state.startDate || '-'} → ${state.endDate || '-'}`;
    const updated = document.getElementById('updatedAt');
    if (updated) {
      updated.textContent = `ข้อมูลถึง ${state.availableEnd || '-'} · ช่วง ${rangeLabel}`;
    }

    const kpiMap = [
      ['spendKpi','spendDelta','spend'],
      ['convKpi','convDelta','conversions'],
      ['cpaKpi','cpaDelta','cpa'],
      ['ctrKpi','ctrDelta','ctr'],
      ['avgCpcKpi','avgCpcDelta','avgCpc'],
      ['convRateKpi','convRateDelta','convRate'],
      ['clickKpi','clickDelta','clicks'],
      ['impressionKpi','impressionDelta','impressions'],
      ['campaignKpi','campaignDelta','campaigns'],
    ];

    for (const [valueId, deltaId, key] of kpiMap) {
      const def = metricDefs[key];
      const curValue = def.value(current);
      const prevValue = def.value(previous);
      const valueEl = document.getElementById(valueId);
      if (valueEl) valueEl.textContent = def.format(curValue);
      renderDelta(deltaId, curValue, prevValue, def.direction);
    }

    renderTrendChart(currentRows);
    renderPeriodComparison(current, previous, prevRange);
    renderChannelMix(currentRows);
    renderCampaignTable(currentRows);
  };

  const resetFilters = () => {
    if (gameFilter) gameFilter.value = '';
    if (accountFilter) accountFilter.value = '';
    if (typeFilter) typeFilter.value = '';

    UI.fillSelectOptions(accountFilter, UI.accountOptions(state.allRows, ''));

    setRange('MTD');
    render();
  };

  async function loadData() {
    try {
      const updated = document.getElementById('updatedAt');
      if (updated) updated.textContent = 'กำลังโหลด Historical Google Ads...';

      // V5.8.0: one Campaign API fetch loads the full permission-scoped historical dataset.
      // Date/Game/Account/Type filters are client-side afterwards.
      const payload = await UI.fetchCampaigns(
        {},
        {startDate:'', endDate:'', limit:5000}
      );

      state.allRows = payload.rows || [];
      const dates = state.allRows.map((r) => r.date).filter(Boolean).sort();

      state.availableStart =
        payload.available_start_date ||
        dates[0] ||
        '';

      state.availableEnd =
        payload.available_end_date ||
        payload.data_date ||
        dates.at(-1) ||
        '';

      UI.fillSelectOptions(gameFilter, UI.gameOptions(state.allRows));
      UI.fillSelectOptions(accountFilter, UI.accountOptions(state.allRows, ''));
      UI.fillSelect(typeFilter, ['PMax','Search','Display','Video','Demand Gen']);

      setRange('MTD');
      render();
    } catch (error) {
      console.error('[Google Ads Overview V5.8.0]', error);

      if (Number(error?.httpStatus) === 401) {
        window.Auth?.redirectToLogin?.();
        return;
      }

      const updated = document.getElementById('updatedAt');
      if (updated) updated.textContent = 'โหลดข้อมูลไม่สำเร็จ';

      const body = document.getElementById('campaignBody');
      if (body) {
        body.innerHTML = `<tr><td colspan="9" class="table-empty">${error?.message || 'Google Ads API Error'}</td></tr>`;
      }
    }
  }

  const boot = async () => {
    document.getElementById('displayName').textContent =
      localStorage.getItem('display_name') ||
      localStorage.getItem('username') ||
      'User';

    document.getElementById('role').textContent =
      localStorage.getItem('role') || 'USER';

    document.querySelectorAll('.preset').forEach((button) => {
      button.addEventListener('click', () => {
        setRange(button.dataset.range);
        render();
      });
    });

    dateFrom?.addEventListener('change', () => {
      state.rangeMode = 'CUSTOM';
      state.startDate = dateFrom.value;
      document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
      render();
    });

    dateTo?.addEventListener('change', () => {
      state.rangeMode = 'CUSTOM';
      state.endDate = dateTo.value;
      document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
      render();
    });

    gameFilter?.addEventListener('change', () => {
      if (accountFilter) accountFilter.value = '';
      UI.fillSelectOptions(
        accountFilter,
        UI.accountOptions(state.allRows, gameFilter?.value || '')
      );
      render();
    });

    accountFilter?.addEventListener('change', render);
    typeFilter?.addEventListener('change', render);
    trendMetric?.addEventListener('change', render);
    campaignSort?.addEventListener('change', render);

    document.getElementById('resetFiltersButton')?.addEventListener('click', resetFilters);
    document.getElementById('logoutButton')?.addEventListener(
      'click',
      () => window.Auth.redirectToLogin()
    );

    await loadData();
  };

  boot();
})();
