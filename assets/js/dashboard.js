'use strict';

const CACHE_PREFIX = 'ai_marketing_copilot_dashboard_cache_v11';
const MAX_PERSISTENT_CACHE_CHARS = 1000000;
let memoryCache = null;
const FILTER_KEY='ai_marketing_copilot_dashboard_filters_v5';
const state = { response:null, rows:{account:[],campaign:[],creative:[],creativeGroup:[],aiSummary:[]}, days:'all', customFrom:'', customTo:'', filters:{game:'',account:'',objective:''}, trendMetric:'spend', pages:{campaign:1,creative:1}, pageSize:10, charts:{}, meta:{minTs:null,maxTs:null}, currentRange:null, filteredCache:{}, renderFrame:0, renderToken:0, summaryFilters:{campaign:{sort:'spend_desc',objective:''},creative:{sort:'spend_desc',objective:'',top:'10'}} };
const el = (id) => document.getElementById(id);
const text = (id,value) => { const node=el(id); if(node) node.textContent=value ?? '-'; };
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const firstStored = (keys) => { for(const key of keys){ const value=localStorage.getItem(key); if(value) return value; } return ''; };
const token = () => window.Auth?.token?.() || firstStored(['session_token','token','auth_token']);
const sessionId = () => firstStored(['session_id','Session_ID','sessionId']);
const cacheKey = () => `${CACHE_PREFIX}:${firstStored(['username','Username']) || 'current_user'}`;
const expiry = () => firstStored(['session_expires_at','expires_at','Token_Expires_At','token_expires_at']);
const redirectLogin = () => window.Auth?.redirectToLogin?.() || (location.href='../index.html');

function num(value){ const n=Number(String(value ?? '').replaceAll(',','')); return Number.isFinite(n)?n:0; }
function money(value){ return new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(num(value)); }
function integer(value){ return new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(num(value)); }
function percent(value){ return `${num(value).toFixed(2)}%`; }
function safeDivide(a,b){ return num(b)>0 ? num(a)/num(b) : 0; }
function displayObjectiveValue(value){ const raw=String(value ?? '').trim(); if(!raw) return ''; const upper=raw.toUpperCase(); if(['SALE','SALES','CONVERSION'].includes(upper)) return 'Conversion'; if(upper==='AWARENESS') return 'Awareness'; if(upper==='TRAFFIC') return 'Traffic'; if(upper==='ENGAGEMENT') return 'Engagement'; if(upper==='LEADS') return 'Leads'; return raw; }
function displayObjective(row){ return displayObjectiveValue(field(row,['Objective_Display','Objective'],'')); }
function isConversionObjective(row){ return displayObjective(row).toUpperCase()==='CONVERSION'; }
function completeRegisterMetric(row){
  const direct=field(row,['Complete_Register','Complete_Registers','Complete_Registration','Complete_Registrations','Complete Register','CompleteRegister','New_Register','New_Registers'],null);
  if(direct!==null && direct!=='') return num(direct);
  const resultType=String(field(row,['Result_Type','ResultType','result_type','Meta_Result_Type'],'')).toLowerCase().replace(/[\s_-]+/g,'');
  const completeTypes=['completeregistration','completedregistration','completeregister','completedregister','registrationcomplete','newregister'];
  if(completeTypes.includes(resultType)) return metric(row,'results');
  return !resultType && isConversionObjective(row) ? metric(row,'results') : 0;
}
function conversionSpendMetric(row){
  const direct=field(row,['Conversion_Spend'],null);
  if(direct!==null && direct!=='') return num(direct);
  return isConversionObjective(row) ? metric(row,'spend') : 0;
}
function conversionCompleteRegisterMetric(row){
  const direct=field(row,['Conversion_Complete_Register'],null);
  if(direct!==null && direct!=='') return num(direct);
  return isConversionObjective(row) ? completeRegisterMetric(row) : 0;
}
function parseDate(value){
  if(!value) return null;
  const raw=String(value).trim().replace(' ','T');
  let normalized=raw;
  if(/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += 'T00:00:00';
  else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) normalized += '+07:00';
  const date=new Date(normalized);
  return Number.isNaN(date.getTime())?null:date;
}
function dateKey(value){ const d=parseDate(value); if(!d) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDateTime(value){ const d=parseDate(value); return d ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(d) : String(value || '-'); }
function field(row,names,fallback=''){ for(const name of names){ if(row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') return row[name]; } return fallback; }
function metric(row,name){
  const map={spend:['Spend','Amount_Spent'],impressions:['Impressions'],clicks:['Clicks','Link_Clicks'],lpv:['Landing_Page_Views','LandingPageViews','LPV'],results:['Results','Result'],reach:['Reach'],ctr:['CTR','Ctr'],frequency:['Frequency'],cpr:['Cost_Per_Result','CostPerResult'],cplpv:['Cost_Per_Landing_Page_View','Cost_Per_LPV','CostPerLandingPageView']};
  return num(field(row,map[name] || [name],0));
}
function prepareRow(row){
  const parsed=parseDate(field(row,['Date','Data_Date','date'],''));
  row.__ts=parsed ? parsed.getTime() : null;
  row.__game=String(field(row,['Game_Name','Game_ID'],''));
  row.__account=String(field(row,['Account_Name','Ad_Account_Name','Entity_Name'],''));
  row.__objective=displayObjective(row);
  return row;
}
function prepareRows(list){ return list.map(prepareRow); }
function prepareDateMeta(){
  let minTs=null;
  let maxTs=null;

  for(const type of ['account','campaign','creative']){
    for(const row of state.rows[type]){
      if(row.__ts===null) continue;
      minTs=minTs===null ? row.__ts : Math.min(minTs,row.__ts);
      maxTs=maxTs===null ? row.__ts : Math.max(maxTs,row.__ts);
    }
  }

  state.meta={minTs,maxTs};
}
function updatedAt(response){ return response?.cache?.generated_at || response?.cache?.data_date || field(response?.dashboard?.account?.rows?.[0],['Data_Updated_At','Date'],''); }
function rows(section){ return Array.isArray(section?.rows)?section.rows:[]; }
function normalizeApiResult(value){ let result=value; if(Array.isArray(result)) result=result[0]; if(result && typeof result==='object' && Object.keys(result).length===1 && typeof result.body==='string'){ try{result=JSON.parse(result.body);}catch{} } if(typeof result==='string') result=JSON.parse(result); return result; }

function saveFilterState(){ localStorage.setItem(FILTER_KEY,JSON.stringify({days:state.days,customFrom:state.customFrom,customTo:state.customTo,filters:state.filters,trendMetric:state.trendMetric,summaryFilters:state.summaryFilters})); }
function loadFilterState(){ try{ const v=JSON.parse(localStorage.getItem(FILTER_KEY)||'null'); if(!v)return; state.days=v.days||'all'; state.customFrom=v.customFrom||''; state.customTo=v.customTo||''; state.filters={...state.filters,...(v.filters||{})}; state.trendMetric=v.trendMetric||'spend'; state.summaryFilters={campaign:{...state.summaryFilters.campaign,...(v.summaryFilters?.campaign||{})},creative:{...state.summaryFilters.creative,...(v.summaryFilters?.creative||{})}}; }catch{} }
function resetFilterState(){ state.days='all'; state.customFrom=''; state.customTo=''; state.filters={game:'',account:'',objective:''}; state.trendMetric='spend'; state.pages={campaign:1,creative:1}; state.summaryFilters={campaign:{sort:'spend_desc',objective:''},creative:{sort:'spend_desc',objective:'',top:'10'}}; localStorage.removeItem(FILTER_KEY); document.querySelectorAll('.preset').forEach(x=>x.classList.toggle('active',x.dataset.days==='all')); el('customRange').classList.add('hidden'); el('dateFrom').value=''; el('dateTo').value=''; if(el('trendMetric'))el('trendMetric').value='spend'; if(el('campaignSummarySort'))el('campaignSummarySort').value='spend_desc'; if(el('campaignSummaryObjective'))el('campaignSummaryObjective').value=''; if(el('creativeSummarySort'))el('creativeSummarySort').value='spend_desc'; if(el('creativeSummaryObjective'))el('creativeSummaryObjective').value=''; if(el('creativeSummaryTop'))el('creativeSummaryTop').value='10'; buildFilterOptions(); renderAll(); }
function hydrate(response){
  if(!response?.success || !response?.dashboard) throw new Error(response?.message || 'Dashboard payload ไม่ถูกต้อง');
  const nextRows={
    account:prepareRows(rows(response.dashboard.account)),
    campaign:prepareRows(rows(response.dashboard.campaign)),
    creative:prepareRows(rows(response.dashboard.creative)),
    creativeGroup:prepareRows(rows(response.dashboard.creative_group)),
    aiSummary:rows(response.dashboard.ai_summary)
  };
  state.rows=nextRows;
  prepareDateMeta();
  state.response=response;
  renderUser(response);
  buildFilterOptions();
  // Reveal the page before heavy rendering so a widget error cannot trap users on the loading screen.
  el('loading')?.classList.add('hidden');
  el('shell')?.classList.remove('hidden');
  try {
    renderAll();
  } catch (error) {
    console.error('Dashboard render error:', error);
    text('dashboardUpdatedAt','โหลดข้อมูลสำเร็จ แต่บางส่วนแสดงผลไม่ครบ');
  }
  const coverage=dataCoverage();
  const coverageText=coverage
    ? `ข้อมูล ${formatDate(coverage.from)} – ${formatDate(coverage.to)}`
    : 'ไม่พบช่วงข้อมูล';
  text(
    'dashboardUpdatedAt',
    `${coverageText} · อัปเดต ${formatDateTime(updatedAt(response) || new Date().toISOString())}`
  );
}


function renderUser(response){ const user=response?.user || {}; const username=user.username || firstStored(['username','Username']) || '-'; const display=firstStored(['display_name','displayName']) || username; const role=firstStored(['role','user_role']) || 'USER'; text('displayName',display); text('role',String(role).toUpperCase()); }
function uniqueSorted(values){ return [...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'th')); }
function optionHtml(values,current){ return '<option value="">ทั้งหมด</option>'+values.map(v=>`<option value="${escapeHtml(v)}" ${v===current?'selected':''}>${escapeHtml(v)}</option>`).join(''); }
function buildFilterOptions(){
  const all=[...state.rows.account,...state.rows.campaign,...state.rows.creative];
  const games=uniqueSorted(all.map(r=>field(r,['Game_Name','Game_ID'])));
  const accounts=uniqueSorted(all.map(r=>field(r,['Account_Name','Ad_Account_Name','Entity_Name'])));
  const objectives=uniqueSorted(all.map(r=>displayObjective(r)));
  el('gameFilter').innerHTML=optionHtml(games,state.filters.game); el('accountFilter').innerHTML=optionHtml(accounts,state.filters.account); el('objectiveFilter').innerHTML=optionHtml(objectives,state.filters.objective);
  if(el('campaignSummaryObjective')) el('campaignSummaryObjective').innerHTML=optionHtml(objectives,state.summaryFilters.campaign.objective);
  if(el('creativeSummaryObjective')) el('creativeSummaryObjective').innerHTML=optionHtml(objectives,state.summaryFilters.creative.objective);
}
function latestDataDate(){ return state.meta.maxTs===null ? new Date() : new Date(state.meta.maxTs); }
function dataCoverage(){
  if(state.meta.minTs===null || state.meta.maxTs===null) return null;
  return {from:new Date(state.meta.minTs),to:new Date(state.meta.maxTs)};
}
function activeRange(){
  let from;
  let to;

  if(state.days==='custom' && state.customFrom && state.customTo){
    from=parseDate(state.customFrom);
    to=parseDate(state.customTo);
  }else if(state.days==='all' && state.meta.minTs!==null && state.meta.maxTs!==null){
    from=new Date(state.meta.minTs);
    to=new Date(state.meta.maxTs);
  }else{
    to=latestDataDate();
    from=new Date(to);
    from.setDate(from.getDate()-(Number(state.days)-1));
  }

  from=from || new Date(0);
  to=to || new Date();
  from.setHours(0,0,0,0);
  to.setHours(23,59,59,999);

  return {from,to,fromTs:from.getTime(),toTs:to.getTime()};
}
function withinDate(row,range){
  return row.__ts===null || (row.__ts>=range.fromTs && row.__ts<=range.toTs);
}
function matches(row){
  const range=state.currentRange || activeRange();
  if(!withinDate(row,range)) return false;
  return (
    (!state.filters.game || row.__game===state.filters.game)
    && (!state.filters.account || row.__account===state.filters.account)
    && (!state.filters.objective || row.__objective===state.filters.objective)
  );
}
function filtered(type){
  if(!state.filteredCache[type]){
    state.filteredCache[type]=state.rows[type].filter(matches);
  }
  return state.filteredCache[type];
}
function aggregate(rowsToSum){
  const totals=rowsToSum.reduce((a,r)=>{ a.spend+=metric(r,'spend'); a.impressions+=metric(r,'impressions'); a.clicks+=metric(r,'clicks'); a.lpv+=metric(r,'lpv'); a.results+=metric(r,'results'); a.reach+=metric(r,'reach'); a.completeRegister+=completeRegisterMetric(r); a.conversionSpend+=conversionSpendMetric(r); a.conversionCompleteRegister+=conversionCompleteRegisterMetric(r); return a; },{spend:0,impressions:0,clicks:0,lpv:0,results:0,reach:0,completeRegister:0,conversionSpend:0,conversionCompleteRegister:0});
  totals.cpr=safeDivide(totals.spend,totals.results); totals.ctr=safeDivide(totals.clicks,totals.impressions)*100; totals.cplpv=safeDivide(totals.spend,totals.lpv); totals.cpcr=safeDivide(totals.spend,totals.completeRegister); totals.conversionCpcr=safeDivide(totals.conversionSpend,totals.conversionCompleteRegister); return totals;
}
function aggregateConversion(rowsToSum){ const totals=aggregate(rowsToSum); return {spend:totals.conversionSpend,completeRegister:totals.conversionCompleteRegister,cpcr:totals.conversionCpcr}; }
function accountMetricRows(){ const account=filtered('account'); return account.length?account:filtered('campaign'); }
function previousRangeRows(){
  if(state.days==='all') return [];

  const current=state.currentRange || activeRange();
  const span=Math.max(1,Math.round((current.toTs-current.fromTs)/86400000)+1);
  const to=new Date(current.from);
  to.setDate(to.getDate()-1);
  to.setHours(23,59,59,999);
  const from=new Date(to);
  from.setDate(from.getDate()-(span-1));
  from.setHours(0,0,0,0);
  const fromTs=from.getTime();
  const toTs=to.getTime();

  return state.rows.account.filter(row=>{
    if(row.__ts===null || row.__ts<fromTs || row.__ts>toTs) return false;
    return (
      (!state.filters.game || row.__game===state.filters.game)
      && (!state.filters.account || row.__account===state.filters.account)
      && (!state.filters.objective || row.__objective===state.filters.objective)
    );
  });
}
function setDelta(id,current,previous,lowerBetter=false){ const node=el(id); if(!node) return; if(!previous){ node.textContent='ไม่มีช่วงเทียบ'; node.className='kpi-delta neutral'; return; } const change=((current-previous)/Math.abs(previous))*100; node.textContent=`${change>=0?'+':''}${change.toFixed(1)}%`; const good=lowerBetter?change<0:change>0; node.className=`kpi-delta ${Math.abs(change)<0.1?'neutral':good?'positive':'negative'}`; }
function renderKpis(){
  const totals=aggregate(accountMetricRows()); const prev=aggregate(previousRangeRows()); const conversionTotals=aggregateConversion(accountMetricRows()); const prevConversion=aggregateConversion(previousRangeRows());
  text('spendKpi',`฿${money(totals.spend)}`); text('resultsKpi',integer(totals.completeRegister)); text('cprKpi',`฿${money(totals.cpcr)}`); text('conversionResultsKpi',integer(conversionTotals.completeRegister)); text('conversionCprKpi',`฿${money(conversionTotals.cpcr)}`); text('ctrKpi',percent(totals.ctr)); text('clicksKpi',integer(totals.clicks)); text('lpvKpi',integer(totals.lpv)); text('cplpvKpi',`฿${money(totals.cplpv)}`); text('impressionsKpi',integer(totals.impressions));
  setDelta('spendDelta',totals.spend,prev.spend,false); setDelta('resultsDelta',totals.completeRegister,prev.completeRegister,false); setDelta('cprDelta',totals.cpcr,prev.cpcr,true); setDelta('conversionResultsDelta',conversionTotals.completeRegister,prevConversion.completeRegister,false); setDelta('conversionCprDelta',conversionTotals.cpcr,prevConversion.cpcr,true); setDelta('ctrDelta',totals.ctr,prev.ctr,false);
}
function byDate(rowsToGroup){ const map=new Map(); for(const r of rowsToGroup){ const key=dateKey(field(r,['Date','Data_Date','date'])) || 'ไม่ระบุวันที่'; if(!map.has(key)) map.set(key,[]); map.get(key).push(r); } return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,list])=>({date,...aggregate(list)})); }
function destroyChart(name){ state.charts[name]?.destroy?.(); }
function chartAvailable(){ return typeof Chart !== 'undefined'; }
function renderTrend(){
  const series=byDate(accountMetricRows()); text('trendBadge',state.days==='all'?'ย้อนหลังทั้งหมด':state.days==='custom'?'กำหนดเอง':`${state.days} วัน`); if(!chartAvailable()) return;
  const config={spend:{label:'Spend',suffix:'฿',value:x=>x.spend},results:{label:'Complete Register ทั้งหมด',suffix:'',value:x=>x.completeRegister},cpr:{label:'Blended Cost / Complete Register',suffix:'฿',value:x=>x.cpcr},conversionResults:{label:'Conversion Complete Register',suffix:'',value:x=>x.conversionCompleteRegister},conversionCpr:{label:'Conversion Cost / Complete Register',suffix:'฿',value:x=>x.conversionCpcr},ctr:{label:'CTR',suffix:'%',value:x=>x.ctr},clicks:{label:'Clicks',suffix:'',value:x=>x.clicks},lpv:{label:'LPV',suffix:'',value:x=>x.lpv},impressions:{label:'Impressions',suffix:'',value:x=>x.impressions}}[state.trendMetric] || {label:'Spend',suffix:'฿',value:x=>x.spend};
  destroyChart('trend'); state.charts.trend=new Chart(el('trendChart'),{type:'line',data:{labels:series.map(x=>x.date),datasets:[{label:config.label,data:series.map(config.value),fill:false,tension:.28,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${config.label}: ${config.suffix}${new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(ctx.parsed.y)}`}}},scales:{y:{beginAtZero:true}}}});
}
function groupMetric(rowsToGroup,keyNames,metricName){ const map=new Map(); for(const r of rowsToGroup){ const key=typeof keyNames==='function'?String(keyNames(r) || 'ไม่ระบุ'):String(field(r,keyNames,'ไม่ระบุ')); map.set(key,(map.get(key)||0)+metric(r,metricName)); } return [...map.entries()].sort((a,b)=>b[1]-a[1]); }
function donut(name,canvasId,entries){ if(!chartAvailable()) return; destroyChart(name); state.charts[name]=new Chart(el(canvasId),{type:'doughnut',data:{labels:entries.map(x=>x[0]),datasets:[{data:entries.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom'}}}}); }
function renderDistribution(){ const campaign=filtered('campaign'); donut('spendObjective','spendObjectiveChart',groupMetric(campaign,(r)=>displayObjective(r),'spend')); donut('resultsObjective','resultsObjectiveChart',groupMetric(campaign,(r)=>displayObjective(r),'results')); }
function campaignKey(r){ return String(field(r,['Campaign_ID','Campaign_Name','Entity_Name'],'ไม่ระบุ Campaign')); }
function creativeKey(r){ return String(field(r,['Ad_ID','Creative_ID','Ad_Name','Creative_Name','Entity_Name'],'ไม่ระบุ Creative')); }
function groupRows(rowsToGroup,keyFn){ const map=new Map(); for(const r of rowsToGroup){ const key=keyFn(r); if(!map.has(key)) map.set(key,[]); map.get(key).push(r); } return [...map.entries()].map(([key,list])=>({key,list,totals:aggregate(list),sample:list[0]})); }
function campaignStatus(item){
  const rows = Array.isArray(item?.list)
    ? item.list
    : [];

  const scoredRows = rows
    .filter((row) =>
      field(
        row,
        [
          'Intelligence_Status',
          'Status',
        ],
        ''
      )
    )
    .sort((a, b) =>
      String(
        field(
          b,
          [
            'Intelligence_Data_Date',
            'Date',
            'Data_Date',
          ],
          ''
        )
      ).localeCompare(
        String(
          field(
            a,
            [
              'Intelligence_Data_Date',
              'Date',
              'Data_Date',
            ],
            ''
          )
        )
      )
    );

  const row =
    scoredRows[0] ||
    item?.sample ||
    {};

  const rawStatus = String(
    field(
      row,
      [
        'Intelligence_Status',
        'Status',
      ],
      'INSUFFICIENT_DATA'
    )
  )
    .trim()
    .toUpperCase();

  const map = {
    GOOD: {
      label: '🟢 Good',
      cls: 'good',
    },

    NORMAL: {
      label: '🟢 Normal',
      cls: 'good',
    },

    WATCH: {
      label: '🟡 Watch',
      cls: 'watch',
    },

    CRITICAL: {
      label: '🔴 Critical',
      cls: 'critical',
    },

    INSUFFICIENT_DATA: {
      label: 'ข้อมูลไม่พอ',
      cls: '',
    },
  };

  return (
    map[rawStatus] ||
    map.INSUFFICIENT_DATA
  );
}
function paginate(items,type){ const totalPages=Math.max(1,Math.ceil(items.length/state.pageSize)); state.pages[type]=Math.min(Math.max(1,state.pages[type]),totalPages); const start=(state.pages[type]-1)*state.pageSize; return {items:items.slice(start,start+state.pageSize),totalPages}; }
function sortGroupedItems(items, mode){
  const list=[...items];
  const [key,dir]=(mode||'spend_desc').split('_');
  list.sort((a,b)=>{
    let av; let bv;
    if(key==='name'){ av=String(field(a.sample,['Campaign_Name','Entity_Name','Ad_Name','Creative_Name'],a.key)).toLowerCase(); bv=String(field(b.sample,['Campaign_Name','Entity_Name','Ad_Name','Creative_Name'],b.key)).toLowerCase(); }
    else if(key==='results'){ av=a.totals.results; bv=b.totals.results; }
    else { av=a.totals.spend; bv=b.totals.spend; }
    if(av<bv) return dir==='asc'?-1:1;
    if(av>bv) return dir==='asc'?1:-1;
    return 0;
  });
  return list;
}
function renderCampaignTable(){
  let grouped=groupRows(filtered('campaign'),campaignKey);
  if(state.summaryFilters.campaign.objective){ grouped=grouped.filter(item=>displayObjective(item.sample)===state.summaryFilters.campaign.objective); }
  grouped=sortGroupedItems(grouped,state.summaryFilters.campaign.sort);
  text('campaignTableBadge',`${integer(grouped.length)} campaigns`);
  const page=paginate(grouped,'campaign'); text('campaignPageInfo',`หน้า ${state.pages.campaign} / ${page.totalPages} · ${integer(grouped.length)} รายการ`); if(el('campaignPrev')) el('campaignPrev').disabled=state.pages.campaign<=1; if(el('campaignNext')) el('campaignNext').disabled=state.pages.campaign>=page.totalPages;
  const body=el('campaignTableBody'); if(!grouped.length){ body.innerHTML='<tr><td colspan="11" class="table-empty">ไม่พบข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML=page.items.map(item=>{ const r=item.sample; const status=campaignStatus(item); return `<tr><td>${escapeHtml(field(r,['Campaign_Name','Entity_Name'],item.key))}</td><td>${escapeHtml(field(r,['Game_Name','Game_ID'],'-'))}</td><td>${escapeHtml(field(r,['Account_Name','Ad_Account_Name'],'-'))}</td><td>${escapeHtml(displayObjective(r)||'-')}</td><td>฿${money(item.totals.spend)}</td><td>${integer(item.totals.results)}</td><td>฿${money(item.totals.cpr)}</td><td>${percent(item.totals.ctr)}</td><td>${integer(item.totals.lpv)}</td><td>฿${money(item.totals.cplpv)}</td><td><span class="status-pill ${status.cls}">${status.label}</span></td></tr>`; }).join('');
}
function renderCreativeTable(){
  let grouped=groupRows(filtered('creative'),creativeKey);
  if(state.summaryFilters.creative.objective){ grouped=grouped.filter(item=>displayObjective(item.sample)===state.summaryFilters.creative.objective); }
  grouped=sortGroupedItems(grouped,state.summaryFilters.creative.sort);
  if(state.summaryFilters.creative.top!=='all'){ grouped=grouped.slice(0,Number(state.summaryFilters.creative.top)||10); }
  text('creativeTableBadge',`${integer(grouped.length)} creatives`); const page=paginate(grouped,'creative'); text('creativePageInfo',`หน้า ${state.pages.creative} / ${page.totalPages} · ${integer(grouped.length)} รายการ`); if(el('creativePrev')) el('creativePrev').disabled=state.pages.creative<=1; if(el('creativeNext')) el('creativeNext').disabled=state.pages.creative>=page.totalPages; const body=el('creativeTableBody'); if(!grouped.length){ body.innerHTML='<tr><td colspan="9" class="table-empty">ไม่พบข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML=page.items.map(item=>{ const r=item.sample; const ctr=item.totals.ctr || metric(r,'ctr'); const frequency=metric(r,'frequency'); const name=field(r,['Ad_Name','Creative_Name','Entity_Name'],item.key); const thumbUrl=field(r,['Thumbnail_URL','Image_URL','Creative_Thumbnail_URL','Picture_URL','picture','thumbnail_url'],''); const thumb=thumbUrl?`<div class="thumb"><img src="${escapeHtml(thumbUrl)}" alt="Creative thumbnail" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:9px" onerror="this.parentElement.textContent='IMG'"></div>`:'<div class="thumb">IMG</div>'; return `<tr><td>${escapeHtml(field(r,['Creative_Group_Name'],'-'))}</td><td><div class="creative-cell">${thumb}<span>${escapeHtml(name)}</span></div></td><td>${escapeHtml(field(r,['Campaign_Name'],'-'))}</td><td>${escapeHtml(displayObjective(r)||'-')}</td><td>฿${money(item.totals.spend)}</td><td>${integer(item.totals.results)}</td><td>฿${money(item.totals.cpr)}</td><td>${percent(ctr)}</td><td>${frequency?frequency.toFixed(2):'-'}</td></tr>`; }).join('');
}

function cleanAiText(value){
  return String(value ?? '')
    .replace(/\r\n/g,'\n')
    .replace(/\r/g,'\n')
    .trim();
}

function shortAiText(value,fallback='ยังไม่มีข้อมูล'){
  const raw=cleanAiText(value);
  if(!raw) return fallback;

  const shortMatch=raw.match(/(?:^|\n)\s*สรุปสั้น\s*:\s*([^\n]+)/i);
  let result=shortMatch?.[1]?.trim() || '';

  if(!result){
    const ignoredHeading=/^(ประเด็นสำคัญ|รายละเอียด|เหตุผล|สิ่งที่ควรทำ|สัญญาณที่พบ|ผลกระทบ|ลำดับความสำคัญ|รายการที่ต้องทำ)\s*:/i;

    result=raw
      .split('\n')
      .map(line=>line.trim())
      .filter(Boolean)
      .map(line=>line.replace(/^[•●▪■☐□\-–—🔹]+\s*/,'').trim())
      .find(line=>line && !ignoredHeading.test(line)) || fallback;
  }

  return result
    .replace(/^สรุปสั้น\s*:\s*/i,'')
    .replace(/\s+/g,' ')
    .trim() || fallback;
}

function getAiStatusState(summary){
  const status=String(
    field(summary,['Overall_Status'],'INSUFFICIENT_DATA')
  ).trim().toUpperCase();

  const health=num(field(summary,['Overall_Health_Score'],0));

  const statusMap={
    CRITICAL:{
      level:'high',
      statusLabel:'ต้องดำเนินการ'
    },
    WATCH:{
      level:'medium',
      statusLabel:'ควรตรวจสอบ'
    },
    GOOD:{
      level:'good',
      statusLabel:'สถานการณ์ดี'
    },
    NORMAL:{
      level:'good',
      statusLabel:'สถานการณ์ปกติ'
    },
    INSUFFICIENT_DATA:{
      level:'insufficient',
      statusLabel:'ข้อมูลยังไม่เพียงพอ'
    }
  };

  return {
    status,
    health,
    ...(statusMap[status] || statusMap.INSUFFICIENT_DATA)
  };
}

function buildAiCard({title,tag,level,value,fallback}){
  const content=shortAiText(value,fallback);
  const showToggle=content.length>120;

  return `
    <article class="action-card ai-compact-card" data-level="${level}">
      <div class="action-head">
        <strong>${escapeHtml(title)}</strong>
        <span class="action-tag">${escapeHtml(tag)}</span>
      </div>

      <p class="ai-card-text">${escapeHtml(content)}</p>

      ${showToggle ? `
        <button
          type="button"
          class="ai-card-toggle"
          aria-expanded="false"
        >อ่านทั้งหมด</button>
      ` : ''}
    </article>
  `;
}

function bindAiCardToggles(container){
  container.querySelectorAll('.ai-card-toggle').forEach(button=>{
    button.addEventListener('click',()=>{
      const card=button.closest('.ai-compact-card');
      if(!card) return;

      const expanded=card.classList.toggle('is-expanded');
      button.textContent=expanded ? 'ย่อข้อความ' : 'อ่านทั้งหมด';
      button.setAttribute('aria-expanded',String(expanded));

      applyAiPanelExactHeight();
    });
  });
}

function selectAiSummary(){
  let list=[...state.rows.aiSummary];

  if(state.filters.game){
    list=list.filter(row=>String(field(row,['Game_Name','Game_ID']))===state.filters.game);
  }

  if(state.filters.account){
    list=list.filter(row=>String(field(row,['Account_Name','Account_ID']))===state.filters.account);
  }

  return list.sort((a,b)=>{
    const dateCompare=String(field(b,['Summary_Date'],'')).localeCompare(String(field(a,['Summary_Date'],'')));
    if(dateCompare!==0) return dateCompare;
    return String(field(b,['Generated_At'],'')).localeCompare(String(field(a,['Generated_At'],'')));
  })[0] || null;
}

let aiPanelResizeFrame=0;
let aiPanelResizeObserver=null;

function getTrendPanel(){
  const trendCanvas=el('trendChart');
  return el('performanceTrendPanel')
    || trendCanvas?.closest('[data-panel="performance-trend"]')
    || trendCanvas?.closest('.dashboard-card')
    || trendCanvas?.closest('.panel')
    || trendCanvas?.parentElement?.parentElement
    || null;
}

function getAiPanel(){
  const actionList=el('actionList');
  return el('aiIntelligencePanel')
    || actionList?.closest('[data-panel="ai-intelligence"]')
    || actionList?.closest('.dashboard-card')
    || actionList?.closest('.panel')
    || actionList?.parentElement?.parentElement
    || null;
}

function applyAiPanelExactHeight(){
  const trendPanel=getTrendPanel();
  const aiPanel=getAiPanel();
  const actionList=el('actionList');

  if(!trendPanel || !aiPanel || !actionList) return;

  const isResponsiveLayout=window.matchMedia('(max-width: 1180px)').matches;

  if(isResponsiveLayout){
    aiPanel.style.height='';
    aiPanel.style.minHeight='';
    aiPanel.style.maxHeight='';
    aiPanel.style.display='';
    aiPanel.style.flexDirection='';
    aiPanel.style.overflow='';

    actionList.style.flex='';
    actionList.style.minHeight='';
    actionList.style.maxHeight='';
    actionList.style.overflowY='';
    actionList.style.overflowX='';
    actionList.style.paddingRight='';
    return;
  }

  const trendHeight=Math.round(trendPanel.getBoundingClientRect().height);
  if(trendHeight<=0) return;

  aiPanel.style.height=`${trendHeight}px`;
  aiPanel.style.minHeight=`${trendHeight}px`;
  aiPanel.style.maxHeight=`${trendHeight}px`;
  aiPanel.style.display='flex';
  aiPanel.style.flexDirection='column';
  aiPanel.style.overflow='hidden';

  actionList.style.flex='1 1 auto';
  actionList.style.minHeight='0';
  actionList.style.maxHeight='100%';
  actionList.style.overflowY='auto';
  actionList.style.overflowX='hidden';
  actionList.style.paddingRight='6px';
}

function syncAiPanelHeight(){
  cancelAnimationFrame(aiPanelResizeFrame);

  aiPanelResizeFrame=requestAnimationFrame(()=>{
    applyAiPanelExactHeight();

    window.setTimeout(applyAiPanelExactHeight,80);
    window.setTimeout(applyAiPanelExactHeight,300);

    const trendPanel=getTrendPanel();

    if(trendPanel && !aiPanelResizeObserver && 'ResizeObserver' in window){
      aiPanelResizeObserver=new ResizeObserver(()=>{
        applyAiPanelExactHeight();
      });

      aiPanelResizeObserver.observe(trendPanel);
    }
  });
}

function renderActions(){
  const container=el('actionList');
  if(!container) return;

  const summary=selectAiSummary();
  const badge=el('aiSummaryBadge');

  if(!summary){
    if(badge) badge.textContent='ยังไม่มี AI Summary';

    container.className='ai-placeholder';
    container.innerHTML='<div><strong>ยังไม่มีข้อมูลวิเคราะห์จาก AI</strong><p>รอ AI Intelligence Builder สร้างข้อมูล หรือไม่มีข้อมูลตรงกับ Game และ Account ที่เลือก</p></div>';

    syncAiPanelHeight();
    return;
  }

  const statusState=getAiStatusState(summary);
  const summaryDate=field(summary,['Summary_Date'],'-');
  const game=field(summary,['Game_Name','Game_ID'],'-');
  const account=field(summary,['Account_Name','Account_ID'],'-');

  if(badge) badge.textContent=`AI · ${summaryDate}`;

  container.className='action-list ai-compact-list';
  container.innerHTML=[
    `<div class="ai-compact-meta">
      <span>${escapeHtml(game)}</span>
      <span>${escapeHtml(account)}</span>
      <strong>Health ${integer(statusState.health)}/100</strong>
    </div>`,

    buildAiCard({
      title:'ภาพรวม',
      tag:statusState.statusLabel,
      level:statusState.level,
      value:field(summary,['Executive_Summary'],''),
      fallback:'ยังไม่มีข้อมูลสรุปภาพรวม'
    }),

    buildAiCard({
      title:'โอกาสสำคัญ',
      tag:'โอกาส',
      level:'good',
      value:field(summary,['Biggest_Opportunity'],''),
      fallback:'ยังไม่พบโอกาสที่ชัดเจน'
    }),

    buildAiCard({
      title:'ความเสี่ยงสำคัญ',
      tag:'ความเสี่ยง',
      level:statusState.level,
      value:field(summary,['Biggest_Risk'],''),
      fallback:'ไม่พบความเสี่ยงสำคัญ'
    }),

    buildAiCard({
      title:'สิ่งที่ควรทำ',
      tag:'ทำก่อน',
      level:statusState.level,
      value:field(summary,['Recommended_Action'],''),
      fallback:'ติดตาม Performance ตามรอบปกติ'
    })
  ].join('');

  bindAiCardToggles(container);
  syncAiPanelHeight();
}

function renderAll(){
  const token=++state.renderToken;
  if(state.renderFrame) cancelAnimationFrame(state.renderFrame);

  el('shell')?.setAttribute('aria-busy','true');

  state.renderFrame=requestAnimationFrame(()=>{
    if(token!==state.renderToken) return;

    state.currentRange=activeRange();
    state.filteredCache={};
    state.pages.campaign=Math.max(1,state.pages.campaign);
    state.pages.creative=Math.max(1,state.pages.creative);

    renderKpis();
    renderActions();
    saveFilterState();

    requestAnimationFrame(()=>{
      if(token!==state.renderToken) return;

      renderTrend();
      renderDistribution();
      renderCampaignTable();
      renderCreativeTable();
      syncAiPanelHeight();

      el('shell')?.setAttribute('aria-busy','false');
      state.renderFrame=0;
    });
  });
}

async function fetchDashboard(){ const url=window.APP_CONFIG?.DASHBOARD_URL; if(!url) throw new Error('ไม่พบ Dashboard URL'); console.info('[AI Marketing Copilot v4.9.0] POST',url); const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:token()})}); const raw=await response.text(); if(!raw.trim()) throw new Error('Dashboard API ไม่ได้ส่งข้อมูลกลับมา'); let result; try{result=normalizeApiResult(JSON.parse(raw));}catch{throw new Error('Dashboard API ส่งข้อมูลที่อ่านไม่ได้');} console.info('[AI Marketing Copilot v4.9.0] Dashboard API response',response.status,result); if(!response.ok || !result?.success || !result?.dashboard){ const error=new Error(result?.message || `Dashboard API Error (${response.status})`); error.httpStatus=Number(result?.http_status || response.status || 500); throw error; } return result; }
function cleanupDashboardCaches({keepCurrent=true}={}){
  const currentKey=cacheKey();
  Object.keys(localStorage)
    .filter(key=>key.startsWith('ai_marketing_copilot_dashboard_cache_'))
    .forEach(key=>{
      if(keepCurrent && key===currentKey)return;
      try{localStorage.removeItem(key);}catch{}
    });
}
function saveCache(response){
  const cache={saved_at:new Date().toISOString(),response};
  memoryCache=cache;

  let serialized;
  try{
    serialized=JSON.stringify(cache);
  }catch(error){
    console.warn('[AI Marketing Copilot v4.9.0] ไม่สามารถแปลง Dashboard Cache ได้',error);
    return false;
  }

  if(serialized.length>MAX_PERSISTENT_CACHE_CHARS){
    cleanupDashboardCaches({keepCurrent:false});
    console.info(`[AI Marketing Copilot v4.9.0] ข้าม Browser Cache เพราะข้อมูลมีขนาด ${serialized.length.toLocaleString()} ตัวอักษร`);
    return false;
  }

  cleanupDashboardCaches({keepCurrent:true});

  try{
    localStorage.setItem(cacheKey(),serialized);
    return true;
  }catch(error){
    cleanupDashboardCaches({keepCurrent:false});
    console.warn('[AI Marketing Copilot v4.9.0] Browser Cache เต็ม จึงใช้ข้อมูลจาก API โดยตรง',error);
    return false;
  }
}
function readCache(){
  if(memoryCache?.response?.dashboard)return memoryCache;
  try{
    const value=JSON.parse(localStorage.getItem(cacheKey())||'null');
    return value?.response?.dashboard?value:null;
  }catch{return null;}
}
function clearCache(){
  memoryCache=null;
  cleanupDashboardCaches({keepCurrent:false});
}
function setRefreshLoading(on){ const button=el('refreshDashboardButton'); if(!button)return; button.disabled=on; button.textContent=on?'กำลังรีเฟรช...':'รีเฟรชข้อมูล'; }
async function sync(){ setRefreshLoading(true); try{ const result=await fetchDashboard(); hydrate(result); saveCache(result); }catch(error){ console.error(error); if([401,403].includes(error.httpStatus)){ clearCache(); redirectLogin(); } else if(!state.response){ text('loadingMessage',error.message || 'ไม่สามารถโหลด Dashboard ได้'); } }finally{ setRefreshLoading(false); } }
function on(id,event,handler){ const node=el(id); if(node) node.addEventListener(event,handler); }
function bindFilters(){
  document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{ document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active')); button.classList.add('active'); state.days=button.dataset.days; state.pages={campaign:1,creative:1}; el('customRange')?.classList.toggle('hidden',state.days!=='custom'); if(state.days!=='custom') renderAll(); }));
  ['gameFilter','accountFilter','objectiveFilter'].forEach(id=>on(id,'change',(e)=>{ state.filters[id.replace('Filter','')]=e.target.value; state.pages={campaign:1,creative:1}; renderAll(); }));
  on('dateFrom','change',(e)=>{state.customFrom=e.target.value;if(state.customTo)renderAll();});
  on('dateTo','change',(e)=>{state.customTo=e.target.value;if(state.customFrom)renderAll();});
  on('trendMetric','change',(e)=>{state.trendMetric=e.target.value;renderTrend();saveFilterState();});
  on('campaignSummarySort','change',(e)=>{state.summaryFilters.campaign.sort=e.target.value;state.pages.campaign=1;saveFilterState();renderCampaignTable();});
  on('campaignSummaryObjective','change',(e)=>{state.summaryFilters.campaign.objective=e.target.value;state.pages.campaign=1;saveFilterState();renderCampaignTable();});
  on('creativeSummarySort','change',(e)=>{state.summaryFilters.creative.sort=e.target.value;state.pages.creative=1;saveFilterState();renderCreativeTable();});
  on('creativeSummaryObjective','change',(e)=>{state.summaryFilters.creative.objective=e.target.value;state.pages.creative=1;saveFilterState();renderCreativeTable();});
  on('creativeSummaryTop','change',(e)=>{state.summaryFilters.creative.top=e.target.value;state.pages.creative=1;saveFilterState();renderCreativeTable();});
  on('resetFiltersButton','click',resetFilterState);
  on('campaignPrev','click',()=>{state.pages.campaign--;renderCampaignTable();});
  on('campaignNext','click',()=>{state.pages.campaign++;renderCampaignTable();});
  on('creativePrev','click',()=>{state.pages.creative--;renderCreativeTable();});
  on('creativeNext','click',()=>{state.pages.creative++;renderCreativeTable();});
  on('refreshDashboardButton','click',sync);
  on('logoutButton','click',()=>{clearCache();redirectLogin();});
}

async function start(){
  try {
    if(!token()){ clearCache(); redirectLogin(); return; }
    console.info('[AI Marketing Copilot v4.9.0] Session token found. Calling Dashboard API.');
    cleanupDashboardCaches({keepCurrent:true});
    loadFilterState(); bindFilters();
    document.querySelectorAll('.preset').forEach(x=>x.classList.toggle('active',x.dataset.days===String(state.days)));
    el('customRange')?.classList.toggle('hidden',state.days!=='custom');
    if(el('dateFrom')) el('dateFrom').value=state.customFrom;
    if(el('dateTo')) el('dateTo').value=state.customTo;
    if(el('trendMetric')) el('trendMetric').value=state.trendMetric;
    if(el('campaignSummarySort')) el('campaignSummarySort').value=state.summaryFilters.campaign.sort;
    if(el('campaignSummaryObjective')) el('campaignSummaryObjective').value=state.summaryFilters.campaign.objective;
    if(el('creativeSummarySort')) el('creativeSummarySort').value=state.summaryFilters.creative.sort;
    if(el('creativeSummaryObjective')) el('creativeSummaryObjective').value=state.summaryFilters.creative.objective;
    if(el('creativeSummaryTop')) el('creativeSummaryTop').value=state.summaryFilters.creative.top;
    const cache=readCache();
    if(cache){ hydrate(cache.response); sync(); } else await sync();
  } catch(error) {
    console.error('Dashboard startup error:',error);
    text('loadingMessage',error?.message || 'เกิดข้อผิดพลาดขณะเปิด Dashboard');
  }
}

window.addEventListener('resize',syncAiPanelHeight);

if(document.fonts?.ready){
  document.fonts.ready.then(syncAiPanelHeight).catch(()=>{});
}

start();
