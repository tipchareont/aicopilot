'use strict';

const D = window.CopilotData;
const $ = (id) => document.getElementById(id);

let response = null;
let sourceRows = [];
let all = [];
let view = [];

let page = 1;
const pageSize = 20;

let sortKey = 'spend';
let sortDir = 'desc';

let chart = null;
let detailChart = null;
let currentDetail = null;

let dateMeta = { min: '', max: '' };
let activeRange = { from: '', to: '', mode: 'all' };
let lastUpdated = '';

let applyFrame = 0;
let searchTimer = 0;

const FILTER_KEY = 'copilot_creative_filters_v5';

const value = (id) => $(id)?.value || '';
const setText = (id, v) => {
  if ($(id)) $(id).textContent = v;
};

function rowDate(row) {
  return row.__dateKey || (
    row.__dateKey = D.dateKey(
      D.field(row, ['Date', 'Data_Date', 'Report_Date'], '')
    )
  );
}

function dateMetaFromRows(rows) {
  let min = '';
  let max = '';

  for (const row of rows) {
    const d = rowDate(row);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }

  return { min, max };
}

function prepareDateMeta(rows) {
  dateMeta = dateMetaFromRows(rows);
}

function formatDateThai(v) {
  if (!v) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
  }).format(new Date(`${v}T00:00:00`));
}

function syncRangePills() {
  const selected = value('daysFilter') || 'all';

  document
    .querySelectorAll('[data-range]')
    .forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.range === selected
      );
    });
}

function bindRangePills() {
  document
    .querySelectorAll('[data-range]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const next = button.dataset.range || 'all';
        $('daysFilter').value = next;
        syncRangePills();
        syncDateControls();
        apply();
      })
    );
}

function dataCoverage() {
  if (!dateMeta.min || !dateMeta.max) return 'ไม่พบช่วงข้อมูล';
  return `ข้อมูลทั้งหมด ${formatDateThai(dateMeta.min)} – ${formatDateThai(dateMeta.max)}`;
}

function shiftDate(dateText, deltaDays) {
  if (!dateText) return '';
  const d = new Date(`${dateText}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return D.dateKey(d);
}

function representativeRow(items) {
  if (!items.length) return {};

  const sorted = [...items].sort((a, b) => {
    const da = rowDate(a) || '';
    const db = rowDate(b) || '';
    return db.localeCompare(da);
  });

  return (
    sorted.find((row) => D.thumbUrl(row)) ||
    sorted[0] ||
    items[0]
  );
}

function enrich(group) {
  const items = group.items || [];

  const dates = items
    .map(rowDate)
    .filter(Boolean)
    .sort();

  const campaigns = [
    ...new Set(
      items
        .map((item) => D.field(item, ['Campaign_Name', 'Campaign_ID'], ''))
        .filter(Boolean)
    ),
  ];

  const first = dates[0] || '';
  const last = dates.at(-1) || '';

  let ageDays = 0;
  if (first && last) {
    ageDays = Math.max(
      1,
      Math.round(
        (new Date(`${last}T00:00:00`) - new Date(`${first}T00:00:00`)) /
        86400000
      ) + 1
    );
  }

  const sample = representativeRow(items);

  return {
    ...group,
    items,
    sample,
    totals: D.aggregate(items),
    name: D.field(
      sample,
      ['Ad_Name', 'Creative_Name', 'Entity_Name'],
      group.key
    ),
    campaigns,
    campaignCount: campaigns.length,
    firstDate: first,
    lastDate: last,
    ageDays,
  };
}

function groupRows(rows) {
  return D.group(
    rows,
    (row) =>
      D.field(
        row,
        ['Ad_ID', 'Creative_ID', 'Ad_Name', 'Creative_Name', 'Entity_Name'],
        'Unknown Creative'
      )
  ).map(enrich);
}

function optionValues(rows, getter) {
  return [
    ...new Set(
      rows
        .map(getter)
        .filter(Boolean)
        .map(String)
    ),
  ].sort((a, b) => a.localeCompare(b, 'th'));
}

function fillOptions(id, vals, currentValue = value(id)) {
  const element = $(id);
  if (!element) return;

  const unique = [...new Set(vals.filter(Boolean).map(String))]
    .sort((a, b) => a.localeCompare(b, 'th'));

  element.innerHTML =
    '<option value="">ทั้งหมด</option>' +
    unique
      .map((v) => `<option value="${D.esc(v)}">${D.esc(v)}</option>`)
      .join('');

  element.value = unique.includes(currentValue)
    ? currentValue
    : '';
}

function buildFilters() {
  fillOptions(
    'gameFilter',
    optionValues(
      sourceRows,
      (row) => D.field(row, ['Game_Name', 'Game_ID'], '')
    )
  );

  refreshDependentOptions();
}

function refreshDependentOptions() {
  const game = value('gameFilter');
  const currentAccount = value('accountFilter');
  const currentObjective = value('objectiveFilter');

  const gameRows = sourceRows.filter((row) => {
    if (!game) return true;

    return String(
      D.field(row, ['Game_Name', 'Game_ID'], '')
    ) === game;
  });

  fillOptions(
    'accountFilter',
    optionValues(
      gameRows,
      (row) => D.field(row, ['Account_Name', 'Ad_Account_Name'], '')
    ),
    currentAccount
  );

  const account = value('accountFilter');

  const accountRows = gameRows.filter((row) => {
    if (!account) return true;

    return String(
      D.field(row, ['Account_Name', 'Ad_Account_Name'], '')
    ) === account;
  });

  fillOptions(
    'objectiveFilter',
    optionValues(
      accountRows,
      (row) => D.displayObjective(row)
    ),
    currentObjective
  );
}

function nonDateScopeRows() {
  const game = value('gameFilter');
  const account = value('accountFilter');
  const objective = value('objectiveFilter');

  return sourceRows.filter((row) => {
    if (
      game &&
      String(D.field(row, ['Game_Name', 'Game_ID'], '')) !== game
    ) {
      return false;
    }

    if (
      account &&
      String(D.field(row, ['Account_Name', 'Ad_Account_Name'], '')) !== account
    ) {
      return false;
    }

    if (
      objective &&
      String(D.displayObjective(row)) !== objective
    ) {
      return false;
    }

    return true;
  });
}

function selectedRange(scopeRows) {
  const mode = value('daysFilter') || 'all';
  const scopedMeta = dateMetaFromRows(scopeRows);

  if (mode === 'custom') {
    const from = value('dateFrom');
    const to = value('dateTo');

    return {
      mode,
      from,
      to,
      min: scopedMeta.min,
      max: scopedMeta.max,
    };
  }

  if (mode === 'all') {
    return {
      mode,
      from: scopedMeta.min,
      to: scopedMeta.max,
      min: scopedMeta.min,
      max: scopedMeta.max,
    };
  }

  const days = Number(mode);
  const to = scopedMeta.max;
  const from = to && Number.isFinite(days)
    ? shiftDate(to, -(days - 1))
    : '';

  return {
    mode,
    from,
    to,
    min: scopedMeta.min,
    max: scopedMeta.max,
  };
}

function syncDateControls(range = activeRange) {
  const custom = value('daysFilter') === 'custom';
  const wrap = $('customDateRange');

  syncRangePills();
  wrap?.classList.toggle('active', custom);

  const dateFrom = $('dateFrom');
  const dateTo = $('dateTo');

  if (dateFrom) {
    dateFrom.min = dateMeta.min || '';
    dateFrom.max = dateMeta.max || '';
  }

  if (dateTo) {
    dateTo.min = dateMeta.min || '';
    dateTo.max = dateMeta.max || '';
  }

  if (custom) {
    const scopedRows = nonDateScopeRows();
    const scopedMeta = dateMetaFromRows(scopedRows);

    if (dateFrom && !dateFrom.value) {
      dateFrom.value = scopedMeta.min || dateMeta.min || '';
    }

    if (dateTo && !dateTo.value) {
      dateTo.value = scopedMeta.max || dateMeta.max || '';
    }
  }

  const hint = $('dateRangeHint');

  if (hint) {
    if (custom) {
      hint.textContent =
        range.from && range.to
          ? `กำลังดู ${formatDateThai(range.from)} – ${formatDateThai(range.to)}`
          : 'เลือกวันที่เริ่มต้นและวันที่สิ้นสุด';
    } else if (range.from && range.to) {
      hint.textContent =
        `กำลังดู ${formatDateThai(range.from)} – ${formatDateThai(range.to)}`;
    } else {
      hint.textContent = 'ยังไม่มีช่วงวันที่ที่ใช้งานได้';
    }
  }
}

function inActiveDateRange(row, range) {
  const d = rowDate(row);

  // For any bounded/custom range, undated rows must NOT leak into the result.
  if (range.mode !== 'all') {
    if (!d) return false;
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  }

  // "All history" keeps valid rows, including legacy undated rows.
  if (!range.from && !range.to) return true;
  if (!d) return true;

  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;

  return true;
}

function currentFilterSummary() {
  const parts = [];

  const game = value('gameFilter');
  const account = value('accountFilter');
  const objective = value('objectiveFilter');

  if (game) parts.push(game);
  if (account) parts.push(account);
  if (objective) parts.push(objective);

  if (activeRange.from && activeRange.to) {
    parts.push(`${activeRange.from} → ${activeRange.to}`);
  }

  return parts.join(' · ') || 'ทุกข้อมูลที่มีสิทธิ์';
}

function applyNow() {
  const q = value('searchFilter').trim().toLowerCase();
  const reuse = value('reuseFilter');

  const scopedRows = nonDateScopeRows();
  activeRange = selectedRange(scopedRows);

  syncDateControls(activeRange);

  if (
    activeRange.mode === 'custom' &&
    activeRange.from &&
    activeRange.to &&
    activeRange.from > activeRange.to
  ) {
    view = [];
    render();
    setText('dateRangeHint', 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
    $('shell')?.setAttribute('aria-busy', 'false');
    return;
  }

  const datedRows = scopedRows.filter((row) =>
    inActiveDateRange(row, activeRange)
  );

  all = groupRows(datedRows);

  view = all
    .filter((creative) => {
      if (
        reuse === 'reused' &&
        creative.campaignCount <= 1
      ) {
        return false;
      }

      if (
        reuse === 'single' &&
        creative.campaignCount !== 1
      ) {
        return false;
      }

      const r = creative.sample;

      const hay = `
        ${creative.name}
        ${D.field(r, ['Creative_Group_Name'], '')}
        ${creative.campaigns.join(' ')}
      `.toLowerCase();

      return !q || hay.includes(q);
    });

  view.sort((a, b) => {
    const av =
      sortKey === 'name'
        ? a.name.toLowerCase()
        : (
          sortKey === 'campaignCount' ||
          sortKey === 'ageDays'
        )
          ? a[sortKey]
          : a.totals[sortKey];

    const bv =
      sortKey === 'name'
        ? b.name.toLowerCase()
        : (
          sortKey === 'campaignCount' ||
          sortKey === 'ageDays'
        )
          ? b[sortKey]
          : b.totals[sortKey];

    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  page = 1;

  saveFilters();
  render();
  renderCoverage();

  $('shell')?.setAttribute('aria-busy', 'false');
}

function apply() {
  if (applyFrame) cancelAnimationFrame(applyFrame);

  $('shell')?.setAttribute('aria-busy', 'true');

  applyFrame = requestAnimationFrame(() => {
    applyFrame = 0;
    applyNow();
  });
}

function saveFilters() {
  localStorage.setItem(
    FILTER_KEY,
    JSON.stringify({
      search: value('searchFilter'),
      game: value('gameFilter'),
      account: value('accountFilter'),
      objective: value('objectiveFilter'),
      days: value('daysFilter'),
      dateFrom: value('dateFrom'),
      dateTo: value('dateTo'),
      reuse: value('reuseFilter'),
      ranking: value('rankingMetric'),
    })
  );
}

function loadFilters() {
  try {
    const f = JSON.parse(
      localStorage.getItem(FILTER_KEY) || '{}'
    );

    $('searchFilter').value = f.search || '';
    $('gameFilter').value = f.game || '';

    refreshDependentOptions();

    $('accountFilter').value = f.account || '';
    refreshDependentOptions();

    $('objectiveFilter').value = f.objective || '';

    $('daysFilter').value = f.days || 'all';
    $('dateFrom').value = f.dateFrom || '';
    $('dateTo').value = f.dateTo || '';
    $('reuseFilter').value = f.reuse || '';
    $('rankingMetric').value = f.ranking || 'spend';
  } catch {}
}

function thumb(row, size = 'small') {
  const url = D.thumbUrl(row);

  if (url) {
    return `
      <a
        class="thumb${size === 'large' ? ' large' : ''}"
        href="${D.esc(url)}"
        target="_blank"
        rel="noopener noreferrer"
        title="เปิดรูป Creative"
      >
        <img
          src="${D.esc(url)}"
          alt="Creative thumbnail"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.parentElement.classList.add('thumb-error');this.remove()"
        >
        <span class="thumb-fallback">ไม่มีรูป</span>
      </a>
    `;
  }

  return `
    <div class="thumb${size === 'large' ? ' large' : ''} thumb-error">
      <span class="thumb-fallback">ไม่มีรูป</span>
    </div>
  `;
}

function renderMetrics() {
  const totals = D.aggregate(
    view.flatMap((creative) => creative.items)
  );

  const reuse = view.filter(
    (creative) => creative.campaignCount > 1
  ).length;

  const avg = view.length
    ? view.reduce(
        (sum, creative) => sum + creative.ageDays,
        0
      ) / view.length
    : 0;

  setText('creativeCount', D.integer(view.length));

  setText(
    'creativeNote',
    `${D.integer(
      view.filter((creative) => creative.totals.spend > 0).length
    )} รายการมี Spend`
  );

  setText('reuseCount', D.integer(reuse));

  setText(
    'reuseNote',
    `${
      view.length
        ? (reuse / view.length * 100).toFixed(1)
        : 0
    }% ของ Creative ที่แสดง`
  );

  setText(
    'avgAge',
    `${D.integer(avg)} วัน`
  );

  setText(
    'spendTotal',
    `฿${D.money(totals.spend)}`
  );

  setText(
    'spendNote',
    `${D.integer(view.length)} Creative`
  );

  setText(
    'resultsTotal',
    D.integer(totals.results)
  );

  setText(
    'resultNote',
    totals.results
      ? `CPA ฿${D.money(totals.cpr)}`
      : 'ยังไม่มี Results'
  );
}

function renderTable() {
  const totalPages = Math.max(
    1,
    Math.ceil(view.length / pageSize)
  );

  page = Math.min(page, totalPages);

  const items = view.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  setText(
    'tableBadge',
    `${D.integer(view.length)} creatives`
  );

  setText(
    'pageInfo',
    `หน้า ${page} / ${totalPages} · ${D.integer(view.length)} รายการ`
  );

  $('prevButton').disabled = page <= 1;
  $('nextButton').disabled = page >= totalPages;

  $('tableBody').innerHTML = items.length
    ? items.map((creative, i) => {
        const row = creative.sample;
        const index = (page - 1) * pageSize + i;

        const frequency = creative.items.length
          ? creative.items.reduce(
              (sum, item) =>
                sum + D.metric(item, 'frequency'),
              0
            ) / creative.items.length
          : 0;

        return `
          <tr>
            <td>${thumb(row)}</td>
            <td class="name-cell">
              <button
                class="row-button"
                data-index="${index}"
              >${D.esc(creative.name)}</button>
              <small>${D.esc(D.displayObjective(row) || '-')}</small>
            </td>
            <td>${D.esc(D.field(row, ['Creative_Group_Name'], '-'))}</td>
            <td>${creative.ageDays ? `${D.integer(creative.ageDays)} วัน` : '-'}</td>
            <td>฿${D.money(creative.totals.spend)}</td>
            <td>${D.integer(creative.totals.results)}</td>
            <td>${creative.totals.results ? `฿${D.money(creative.totals.cpr)}` : '-'}</td>
            <td>${D.percent(creative.totals.ctr)}</td>
            <td>${frequency ? frequency.toFixed(2) : '-'}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="9" class="empty">ไม่พบข้อมูลตามตัวกรอง</td></tr>';

  document
    .querySelectorAll('.row-button')
    .forEach((button) =>
      button.addEventListener(
        'click',
        () => openDetail(
          view[Number(button.dataset.index)]
        )
      )
    );
}

function rankValue(creative, metric) {
  if (
    metric === 'campaignCount' ||
    metric === 'ageDays'
  ) {
    return creative[metric];
  }

  return creative.totals[metric];
}

function renderChart() {
  if (!window.Chart) return;

  const metric = value('rankingMetric');

  const top = [...view]
    .sort(
      (a, b) =>
        rankValue(b, metric) -
        rankValue(a, metric)
    )
    .slice(0, 10);

  chart?.destroy();

  chart = new Chart(
    $('creativeChart'),
    {
      type: 'bar',
      data: {
        labels: top.map(
          (creative) =>
            creative.name.length > 34
              ? creative.name.slice(0, 34) + '…'
              : creative.name
        ),
        datasets: [{
          data: top.map(
            (creative) =>
              rankValue(creative, metric)
          ),
          label: metric,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                formatMetric(metric, ctx.raw),
            },
          },
        },
        scales: {
          x: { beginAtZero: true },
        },
      },
    }
  );

  setText(
    'rankingScope',
    `${currentFilterSummary()} · ${D.integer(view.length)} Creative`
  );
}

function formatMetric(metric, v) {
  if (
    metric === 'spend' ||
    metric === 'cpr'
  ) {
    return `฿${D.money(v)}`;
  }

  if (metric === 'ctr') {
    return D.percent(v);
  }

  if (metric === 'ageDays') {
    return `${D.integer(v)} วัน`;
  }

  return D.integer(v);
}

function renderReadiness() {
  const withImg = view.filter(
    (creative) =>
      creative.items.some(
        (row) => Boolean(D.thumbUrl(row))
      )
  ).length;

  const withDates = view.filter(
    (creative) =>
      creative.firstDate &&
      creative.lastDate
  ).length;

  const withCampaign = view.filter(
    (creative) =>
      creative.campaignCount > 0
  ).length;

  const line = (label, count) => `
    <div class="legend-item">
      <span>${label}</span>
      <strong>${D.integer(count)} / ${D.integer(view.length)}</strong>
    </div>
  `;

  $('dataReadiness').innerHTML =
    line('Thumbnail URL', withImg) +
    line('Creative Date', withDates) +
    line('Campaign Mapping', withCampaign) +
    `<p class="search-hint">
      ทุกตัวเลขในหน้านี้คำนวณจาก Filter และช่วงวันที่เดียวกัน
    </p>`;
}

function renderCoverage() {
  const updated = lastUpdated
    ? ` · อัปเดต ${new Intl.DateTimeFormat(
        'th-TH',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      ).format(new Date(lastUpdated))}`
    : '';

  setText(
    'updatedAt',
    `${dataCoverage()} · กำลังดู ${currentFilterSummary()}${updated}`
  );
}

function render() {
  renderMetrics();
  renderTable();
  renderChart();
  renderReadiness();
}

function dailySeries(creative, metric) {
  const groups = D.group(
    creative.items,
    rowDate
  )
    .filter((group) => group.key)
    .sort(
      (a, b) =>
        a.key.localeCompare(b.key)
    );

  return {
    labels: groups.map(
      (group) => group.key
    ),
    values: groups.map((group) => {
      if (metric === 'frequency') {
        return group.items.length
          ? group.items.reduce(
              (sum, row) =>
                sum +
                D.metric(row, 'frequency'),
              0
            ) / group.items.length
          : 0;
      }

      return D.aggregate(
        group.items
      )[metric] || 0;
    }),
  };
}

function renderDetailChart() {
  if (
    !currentDetail ||
    !window.Chart
  ) {
    return;
  }

  const metric = value('detailMetric');
  const series = dailySeries(
    currentDetail,
    metric
  );

  detailChart?.destroy();

  detailChart = new Chart(
    $('detailChart'),
    {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          label: metric,
          data: series.values,
          tension: 0.25,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                formatMetric(
                  metric,
                  ctx.raw
                ),
            },
          },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    }
  );
}

function renderCampaignUsage(creative) {
  const usage = D.group(
    creative.items,
    (row) =>
      D.field(
        row,
        ['Campaign_Name', 'Campaign_ID'],
        'Unknown Campaign'
      )
  )
    .map((group) => ({
      name: group.key,
      objective:
        D.displayObjective(group.sample) || '-',
      totals: D.aggregate(group.items),
    }))
    .sort(
      (a, b) =>
        b.totals.spend -
        a.totals.spend
    );

  setText(
    'campaignUsageBadge',
    `${D.integer(usage.length)} Campaign`
  );

  $('campaignUsage').innerHTML = usage.length
    ? usage.map((item) => `
        <div class="usage-item">
          <div>
            <strong>${D.esc(item.name)}</strong>
            <span>${D.esc(item.objective)}</span>
          </div>
          <div class="usage-metrics">
            <span>Spend <b>฿${D.money(item.totals.spend)}</b></span>
            <span>Results <b>${D.integer(item.totals.results)}</b></span>
            <span>CTR <b>${D.percent(item.totals.ctr)}</b></span>
            <span>CPA <b>${item.totals.results ? `฿${D.money(item.totals.cpr)}` : '-'}</b></span>
          </div>
        </div>
      `).join('')
    : '<div class="empty">ไม่พบ Campaign Mapping</div>';
}

function openDetail(creative) {
  currentDetail = creative;

  const row = creative.sample;

  const frequency = creative.items.length
    ? creative.items.reduce(
        (sum, item) =>
          sum +
          D.metric(item, 'frequency'),
        0
      ) / creative.items.length
    : 0;

  setText(
    'drawerTitle',
    creative.name
  );

  setText(
    'drawerSubtitle',
    D.field(
      row,
      ['Creative_Group_Name'],
      'ไม่พบ Creative Group'
    )
  );

  $('drawerPreview').innerHTML =
    thumb(row, 'large');

  const fields = [
    [
      'Creative Age',
      creative.ageDays
        ? `${D.integer(creative.ageDays)} วัน`
        : '-',
    ],
    ['First Seen', creative.firstDate || '-'],
    ['Last Seen', creative.lastDate || '-'],
    ['Spend', `฿${D.money(creative.totals.spend)}`],
    ['Results', D.integer(creative.totals.results)],
    [
      'Cost / Result',
      creative.totals.results
        ? `฿${D.money(creative.totals.cpr)}`
        : '-',
    ],
    ['CTR', D.percent(creative.totals.ctr)],
    [
      'Frequency',
      frequency
        ? frequency.toFixed(2)
        : '-',
    ],
    [
      'Thumbnail',
      creative.items.some(
        (item) => Boolean(D.thumbUrl(item))
      )
        ? 'พร้อม'
        : 'ยังไม่มี URL',
    ],
  ];

  $('drawerKpis').innerHTML =
    fields
      .map(
        ([label, val]) => `
          <div class="detail-item">
            <span>${label}</span>
            <strong>${D.esc(val)}</strong>
          </div>
        `
      )
      .join('');

  renderCampaignUsage(creative);
  renderDetailChart();

  $('drawer').classList.add('open');
}

function user() {
  setText(
    'displayName',
    localStorage.getItem('display_name') ||
    localStorage.getItem('username') ||
    '-'
  );

  setText(
    'role',
    (
      localStorage.getItem('role') ||
      'USER'
    ).toUpperCase()
  );
}

async function load(refresh = false) {
  $('refreshButton').disabled = true;
  $('refreshButton').textContent =
    'กำลังรีเฟรช...';

  try {
    response = await D.load({ refresh });

    sourceRows = D.rows(
      response,
      'creative'
    );

    prepareDateMeta(sourceRows);

    buildFilters();

    if (!refresh) {
      loadFilters();
    }

    const updated =
      response?.cache?.generated_at ||
      response?.cache?.data_date ||
      new Date().toISOString();

    lastUpdated = updated;

    syncDateControls();
    bindRangePills();
    apply();

    user();

    $('loading').classList.add('hidden');
    $('shell').classList.remove('hidden');
  } catch (error) {
    if ([401, 403].includes(error.httpStatus)) {
      window.Auth.redirectToLogin();
    } else {
      setText(
        'loadingMessage',
        error.message
      );
    }
  } finally {
    $('refreshButton').disabled = false;
    $('refreshButton').textContent =
      'รีเฟรชข้อมูล';
  }
}

$('searchFilter').addEventListener(
  'input',
  () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(
      apply,
      120
    );
  }
);

$('gameFilter').addEventListener(
  'change',
  () => {
    refreshDependentOptions();
    apply();
  }
);

$('accountFilter').addEventListener(
  'change',
  () => {
    refreshDependentOptions();
    apply();
  }
);

$('daysFilter').addEventListener(
  'change',
  () => {
    syncRangePills();
    syncDateControls();
    apply();
  }
);

[
  'objectiveFilter',
  'reuseFilter',
].forEach(
  (id) =>
    $(id).addEventListener(
      'change',
      () => {
        syncDateControls();
        apply();
      }
    )
);

[
  'dateFrom',
  'dateTo',
].forEach(
  (id) =>
    $(id).addEventListener(
      'change',
      apply
    )
);

$('rankingMetric').addEventListener(
  'change',
  () => {
    saveFilters();
    renderChart();
  }
);

$('detailMetric').addEventListener(
  'change',
  renderDetailChart
);

$('resetButton').addEventListener(
  'click',
  () => {
    localStorage.removeItem(FILTER_KEY);

    $('searchFilter').value = '';
    $('gameFilter').value = '';

    refreshDependentOptions();

    $('accountFilter').value = '';
    refreshDependentOptions();

    $('objectiveFilter').value = '';
    $('daysFilter').value = 'all';
    $('dateFrom').value = '';
    $('dateTo').value = '';
    $('reuseFilter').value = '';
    $('rankingMetric').value = 'spend';

    syncDateControls();
    apply();
  }
);

$('prevButton').addEventListener(
  'click',
  () => {
    page--;
    renderTable();
  }
);

$('nextButton').addEventListener(
  'click',
  () => {
    page++;
    renderTable();
  }
);

document
  .querySelectorAll('th.sortable')
  .forEach(
    (th) =>
      th.addEventListener(
        'click',
        () => {
          const key = th.dataset.sort;

          if (sortKey === key) {
            sortDir =
              sortDir === 'asc'
                ? 'desc'
                : 'asc';
          } else {
            sortKey = key;
            sortDir =
              key === 'name'
                ? 'asc'
                : 'desc';
          }

          apply();
        }
      )
  );

document
  .querySelectorAll('[data-close]')
  .forEach(
    (element) =>
      element.addEventListener(
        'click',
        () =>
          $('drawer').classList.remove('open')
      )
  );

$('refreshButton').addEventListener(
  'click',
  () => load(true)
);

$('logoutButton').addEventListener(
  'click',
  () =>
    window.Auth.redirectToLogin()
);

load();
