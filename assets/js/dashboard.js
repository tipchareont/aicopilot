'use strict';

const CACHE_PREFIX = 'ai_marketing_copilot_dashboard_cache_v4';
const FILTER_KEY='ai_marketing_copilot_dashboard_filters_v1';
const state = { response:null, rows:{account:[],campaign:[],creative:[],creativeGroup:[],aiSummary:[]}, days:7, customFrom:'', customTo:'', filters:{game:'',account:'',objective:''}, trendMetric:'spend', pages:{campaign:1,creative:1}, pageSize:10, charts:{} };
const el = (id) => document.getElementById(id);
const text = (id,value) => { const node=el(id); if(node) node.textContent=value ?? '-'; };
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const firstStored = (keys) => { for(const key of keys){ const value=localStorage.getItem(key); if(value) return value; } return ''; };
const token = () => window.Auth?.token?.() || firstStored(['session_token','token','auth_token']);
const sessionId = () => firstStored(['session_id','Session_ID','sessionId']);
const cacheKey = () => `${CACHE_PREFIX}:${sessionId() || firstStored(['username','Username']) || 'anonymous'}`;
const expiry = () => firstStored(['session_expires_at','expires_at','Token_Expires_At','token_expires_at']);
const redirectLogin = () => window.Auth?.redirectToLogin?.() || (location.href='../index.html');

function num(value){ const n=Number(String(value ?? '').replaceAll(',','')); return Number.isFinite(n)?n:0; }
function money(value){ return new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(num(value)); }
function integer(value){ return new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(num(value)); }
function percent(value){ return `${num(value).toFixed(2)}%`; }
function safeDivide(a,b){ return num(b)>0 ? num(a)/num(b) : 0; }
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
function updatedAt(response){ return response?.cache?.generated_at || response?.cache?.data_date || field(response?.dashboard?.account?.rows?.[0],['Data_Updated_At','Date'],''); }
function rows(section){ return Array.isArray(section?.rows)?section.rows:[]; }
function normalizeApiResult(value){ let result=value; if(Array.isArray(result)) result=result[0]; if(result && typeof result==='object' && Object.keys(result).length===1 && typeof result.body==='string'){ try{result=JSON.parse(result.body);}catch{} } if(typeof result==='string') result=JSON.parse(result); return result; }

function saveFilterState(){ localStorage.setItem(FILTER_KEY,JSON.stringify({days:state.days,customFrom:state.customFrom,customTo:state.customTo,filters:state.filters,trendMetric:state.trendMetric})); }
function loadFilterState(){ try{ const v=JSON.parse(localStorage.getItem(FILTER_KEY)||'null'); if(!v)return; state.days=v.days||7; state.customFrom=v.customFrom||''; state.customTo=v.customTo||''; state.filters={...state.filters,...(v.filters||{})}; state.trendMetric=v.trendMetric||'spend'; }catch{} }
function resetFilterState(){ state.days=7; state.customFrom=''; state.customTo=''; state.filters={game:'',account:'',objective:''}; state.trendMetric='spend'; state.pages={campaign:1,creative:1}; localStorage.removeItem(FILTER_KEY); document.querySelectorAll('.preset').forEach(x=>x.classList.toggle('active',x.dataset.days==='7')); el('customRange').classList.add('hidden'); el('dateFrom').value=''; el('dateTo').value=''; if(el('trendMetric'))el('trendMetric').value='spend'; buildFilterOptions(); renderAll(); }
function hydrate(response){
  if(!response?.success || !response?.dashboard) throw new Error(response?.message || 'Dashboard payload ไม่ถูกต้อง');
  const nextRows={account:rows(response.dashboard.account),campaign:rows(response.dashboard.campaign),creative:rows(response.dashboard.creative),creativeGroup:rows(response.dashboard.creative_group),aiSummary:rows(response.dashboard.ai_summary)};
  state.rows=nextRows;
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
  text('dashboardUpdatedAt',`อัปเดต ${formatDateTime(updatedAt(response) || new Date().toISOString())}`);
}


function renderUser(response){ const user=response?.user || {}; const username=user.username || firstStored(['username','Username']) || '-'; const display=firstStored(['display_name','displayName']) || username; const role=firstStored(['role','user_role']) || 'USER'; text('displayName',display); text('role',String(role).toUpperCase()); }
function uniqueSorted(values){ return [...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'th')); }
function optionHtml(values,current){ return '<option value="">ทั้งหมด</option>'+values.map(v=>`<option value="${escapeHtml(v)}" ${v===current?'selected':''}>${escapeHtml(v)}</option>`).join(''); }
function buildFilterOptions(){
  const all=[...state.rows.account,...state.rows.campaign,...state.rows.creative];
  const games=uniqueSorted(all.map(r=>field(r,['Game_Name','Game_ID'])));
  const accounts=uniqueSorted(all.map(r=>field(r,['Account_Name','Ad_Account_Name','Entity_Name'])));
  const objectives=uniqueSorted(all.map(r=>field(r,['Objective_Display','Objective'])));
  el('gameFilter').innerHTML=optionHtml(games,state.filters.game); el('accountFilter').innerHTML=optionHtml(accounts,state.filters.account); el('objectiveFilter').innerHTML=optionHtml(objectives,state.filters.objective);
}
function latestDataDate(){ const all=[...state.rows.account,...state.rows.campaign,...state.rows.creative]; const dates=all.map(r=>parseDate(field(r,['Date','Data_Date','date']))).filter(Boolean).sort((a,b)=>b-a); return dates[0] || new Date(); }
function activeRange(){
  if(state.days==='custom' && state.customFrom && state.customTo) return {from:parseDate(state.customFrom),to:parseDate(state.customTo)};
  const to=latestDataDate(); const from=new Date(to); from.setDate(from.getDate()-(Number(state.days)-1)); from.setHours(0,0,0,0); to.setHours(23,59,59,999); return {from,to};
}
function withinDate(row,range){ const d=parseDate(field(row,['Date','Data_Date','date'])); if(!d) return true; return d>=range.from && d<=range.to; }
function matches(row){
  const range=activeRange(); if(!withinDate(row,range)) return false;
  const game=String(field(row,['Game_Name','Game_ID'])); const account=String(field(row,['Account_Name','Ad_Account_Name','Entity_Name'])); const objective=String(field(row,['Objective_Display','Objective']));
  return (!state.filters.game || game===state.filters.game) && (!state.filters.account || account===state.filters.account) && (!state.filters.objective || objective===state.filters.objective);
}
function filtered(type){ return state.rows[type].filter(matches); }
function aggregate(rowsToSum){
  const totals=rowsToSum.reduce((a,r)=>{ a.spend+=metric(r,'spend'); a.impressions+=metric(r,'impressions'); a.clicks+=metric(r,'clicks'); a.lpv+=metric(r,'lpv'); a.results+=metric(r,'results'); a.reach+=metric(r,'reach'); return a; },{spend:0,impressions:0,clicks:0,lpv:0,results:0,reach:0});
  totals.cpr=safeDivide(totals.spend,totals.results); totals.ctr=safeDivide(totals.clicks,totals.impressions)*100; totals.cplpv=safeDivide(totals.spend,totals.lpv); return totals;
}
function accountMetricRows(){ const account=filtered('account'); return account.length?account:filtered('campaign'); }
function previousRangeRows(){
  const current=activeRange(); const span=Math.max(1,Math.round((current.to-current.from)/86400000)+1); const to=new Date(current.from); to.setDate(to.getDate()-1); to.setHours(23,59,59,999); const from=new Date(to); from.setDate(from.getDate()-(span-1)); from.setHours(0,0,0,0);
  return state.rows.account.filter(r=>{ const d=parseDate(field(r,['Date','Data_Date','date'])); if(!d || d<from || d>to) return false; const game=String(field(r,['Game_Name','Game_ID'])); const account=String(field(r,['Account_Name','Ad_Account_Name','Entity_Name'])); const objective=String(field(r,['Objective_Display','Objective'])); return (!state.filters.game||game===state.filters.game)&&(!state.filters.account||account===state.filters.account)&&(!state.filters.objective||objective===state.filters.objective); });
}
function setDelta(id,current,previous,lowerBetter=false){ const node=el(id); if(!node) return; if(!previous){ node.textContent='ไม่มีช่วงเทียบ'; node.className='kpi-delta neutral'; return; } const change=((current-previous)/Math.abs(previous))*100; node.textContent=`${change>=0?'+':''}${change.toFixed(1)}%`; const good=lowerBetter?change<0:change>0; node.className=`kpi-delta ${Math.abs(change)<0.1?'neutral':good?'positive':'negative'}`; }
function renderKpis(){
  const totals=aggregate(accountMetricRows()); const prev=aggregate(previousRangeRows());
  text('spendKpi',`฿${money(totals.spend)}`); text('resultsKpi',integer(totals.results)); text('cprKpi',`฿${money(totals.cpr)}`); text('ctrKpi',percent(totals.ctr)); text('clicksKpi',integer(totals.clicks)); text('lpvKpi',integer(totals.lpv)); text('cplpvKpi',`฿${money(totals.cplpv)}`); text('impressionsKpi',integer(totals.impressions));
  setDelta('spendDelta',totals.spend,prev.spend,false); setDelta('resultsDelta',totals.results,prev.results,false); setDelta('cprDelta',totals.cpr,prev.cpr,true); setDelta('ctrDelta',totals.ctr,prev.ctr,false);
}
function byDate(rowsToGroup){ const map=new Map(); for(const r of rowsToGroup){ const key=dateKey(field(r,['Date','Data_Date','date'])) || 'ไม่ระบุวันที่'; if(!map.has(key)) map.set(key,[]); map.get(key).push(r); } return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,list])=>({date,...aggregate(list)})); }
function destroyChart(name){ state.charts[name]?.destroy?.(); }
function chartAvailable(){ return typeof Chart !== 'undefined'; }
function renderTrend(){
  const series=byDate(accountMetricRows()); text('trendBadge',state.days==='custom'?'กำหนดเอง':`${state.days} วัน`); if(!chartAvailable()) return;
  const config={spend:{label:'Spend',suffix:'฿',value:x=>x.spend},results:{label:'Results',suffix:'',value:x=>x.results},cpr:{label:'Cost / Result',suffix:'฿',value:x=>x.cpr},ctr:{label:'CTR',suffix:'%',value:x=>x.ctr},clicks:{label:'Clicks',suffix:'',value:x=>x.clicks},lpv:{label:'LPV',suffix:'',value:x=>x.lpv}}[state.trendMetric] || {label:'Spend',suffix:'฿',value:x=>x.spend};
  destroyChart('trend'); state.charts.trend=new Chart(el('trendChart'),{type:'line',data:{labels:series.map(x=>x.date),datasets:[{label:config.label,data:series.map(config.value),fill:false,tension:.28,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${config.label}: ${config.suffix}${new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(ctx.parsed.y)}`}}},scales:{y:{beginAtZero:true}}}});
}
function groupMetric(rowsToGroup,keyNames,metricName){ const map=new Map(); for(const r of rowsToGroup){ const key=String(field(r,keyNames,'ไม่ระบุ')); map.set(key,(map.get(key)||0)+metric(r,metricName)); } return [...map.entries()].sort((a,b)=>b[1]-a[1]); }
function donut(name,canvasId,entries){ if(!chartAvailable()) return; destroyChart(name); state.charts[name]=new Chart(el(canvasId),{type:'doughnut',data:{labels:entries.map(x=>x[0]),datasets:[{data:entries.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}}); }
function renderDistribution(){ const campaign=filtered('campaign'); donut('spendObjective','spendObjectiveChart',groupMetric(campaign,['Objective_Display','Objective'],'spend')); donut('resultsObjective','resultsObjectiveChart',groupMetric(campaign,['Objective_Display','Objective'],'results')); }
function campaignKey(r){ return String(field(r,['Campaign_ID','Campaign_Name','Entity_Name'],'ไม่ระบุ Campaign')); }
function creativeKey(r){ return String(field(r,['Ad_ID','Creative_ID','Ad_Name','Creative_Name','Entity_Name'],'ไม่ระบุ Creative')); }
function groupRows(rowsToGroup,keyFn){ const map=new Map(); for(const r of rowsToGroup){ const key=keyFn(r); if(!map.has(key)) map.set(key,[]); map.get(key).push(r); } return [...map.entries()].map(([key,list])=>({key,list,totals:aggregate(list),sample:list[0]})); }
function campaignStatus(item,medianCpr){ if(item.totals.results===0 && item.totals.spend>0) return {label:'🔴 Critical',cls:'critical'}; if(medianCpr>0 && item.totals.cpr>medianCpr*1.3) return {label:'🟡 Watch',cls:'watch'}; if(item.totals.ctr>0 && item.totals.ctr<0.7) return {label:'🟡 Watch',cls:'watch'}; return {label:'🟢 Healthy',cls:'good'}; }
function paginate(items,type){ const totalPages=Math.max(1,Math.ceil(items.length/state.pageSize)); state.pages[type]=Math.min(Math.max(1,state.pages[type]),totalPages); const start=(state.pages[type]-1)*state.pageSize; return {items:items.slice(start,start+state.pageSize),totalPages}; }
function renderCampaignTable(){
  const grouped=groupRows(filtered('campaign'),campaignKey).sort((a,b)=>b.totals.spend-a.totals.spend); const cprs=grouped.map(x=>x.totals.cpr).filter(x=>x>0).sort((a,b)=>a-b); const median=cprs.length?cprs[Math.floor(cprs.length/2)]:0; text('campaignTableBadge',`${integer(grouped.length)} campaigns`);
  const page=paginate(grouped,'campaign'); text('campaignPageInfo',`หน้า ${state.pages.campaign} / ${page.totalPages} · ${integer(grouped.length)} รายการ`); if(el('campaignPrev')) el('campaignPrev').disabled=state.pages.campaign<=1; if(el('campaignNext')) el('campaignNext').disabled=state.pages.campaign>=page.totalPages;
  const body=el('campaignTableBody'); if(!grouped.length){ body.innerHTML='<tr><td colspan="11" class="table-empty">ไม่พบข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML=page.items.map(item=>{ const r=item.sample; const status=campaignStatus(item,median); return `<tr><td>${escapeHtml(field(r,['Campaign_Name','Entity_Name'],item.key))}</td><td>${escapeHtml(field(r,['Game_Name','Game_ID'],'-'))}</td><td>${escapeHtml(field(r,['Account_Name','Ad_Account_Name'],'-'))}</td><td>${escapeHtml(field(r,['Objective_Display','Objective'],'-'))}</td><td>฿${money(item.totals.spend)}</td><td>${integer(item.totals.results)}</td><td>฿${money(item.totals.cpr)}</td><td>${percent(item.totals.ctr)}</td><td>${integer(item.totals.lpv)}</td><td>฿${money(item.totals.cplpv)}</td><td><span class="status-pill ${status.cls}">${status.label}</span></td></tr>`; }).join('');
}
function renderCreativeTable(){
  const grouped=groupRows(filtered('creative'),creativeKey).sort((a,b)=>b.totals.spend-a.totals.spend); text('creativeTableBadge',`${integer(grouped.length)} creatives`); const page=paginate(grouped,'creative'); text('creativePageInfo',`หน้า ${state.pages.creative} / ${page.totalPages} · ${integer(grouped.length)} รายการ`); if(el('creativePrev')) el('creativePrev').disabled=state.pages.creative<=1; if(el('creativeNext')) el('creativeNext').disabled=state.pages.creative>=page.totalPages; const body=el('creativeTableBody'); if(!grouped.length){ body.innerHTML='<tr><td colspan="9" class="table-empty">ไม่พบข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML=page.items.map(item=>{ const r=item.sample; const ctr=item.totals.ctr || metric(r,'ctr'); const frequency=metric(r,'frequency'); const name=field(r,['Ad_Name','Creative_Name','Entity_Name'],item.key); const thumbUrl=field(r,['Thumbnail_URL','Image_URL','Creative_Thumbnail_URL','Picture_URL','picture','thumbnail_url'],''); const thumb=thumbUrl?`<div class="thumb"><img src="${escapeHtml(thumbUrl)}" alt="Creative thumbnail" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:9px" onerror="this.parentElement.textContent='IMG'"></div>`:'<div class="thumb">IMG</div>'; return `<tr><td>${escapeHtml(field(r,['Creative_Group_Name'],'-'))}</td><td><div class="creative-cell">${thumb}<span>${escapeHtml(name)}</span></div></td><td>${escapeHtml(field(r,['Campaign_Name'],'-'))}</td><td>${escapeHtml(field(r,['Objective_Display','Objective'],'-'))}</td><td>฿${money(item.totals.spend)}</td><td>${integer(item.totals.results)}</td><td>฿${money(item.totals.cpr)}</td><td>${percent(ctr)}</td><td>${frequency?frequency.toFixed(2):'-'}</td></tr>`; }).join('');
}
function cleanAiText(value){
  return String(value ?? '')
    .replace(/\r\n/g,'\n')
    .replace(/^สรุปสั้น\s*:\s*/i,'')
    .trim();
}
function aiTextHtml(value,fallback='ยังไม่มีข้อมูล'){
  const textValue=cleanAiText(value) || fallback;
  return escapeHtml(textValue)
    .replace(/\n{3,}/g,'\n\n')
    .replace(/^(ประเด็นสำคัญ|รายละเอียด|เหตุผล|สิ่งที่ควรทำ|สัญญาณที่พบ|ผลกระทบ|ลำดับความสำคัญ|รายการที่ต้องทำ)\s*:\s*/gim,'<strong>$1</strong><br>')
    .replace(/^[•●▪■☐□-]\s*/gim,'• ')
    .replace(/\n/g,'<br>');
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
function renderActions(){
  const container=el('actionList');
  if(!container) return;

  const summary=selectAiSummary();
  const badge=el('aiSummaryBadge');

  if(!summary){
    if(badge) badge.textContent='ยังไม่มี AI Summary';
    container.className='ai-placeholder';
    container.innerHTML='<div><strong>ยังไม่มีข้อมูลวิเคราะห์จาก AI</strong><p>รอ AI Intelligence Builder สร้างข้อมูล หรือไม่มีข้อมูลตรงกับ Game และ Account ที่เลือก</p></div>';
    return;
  }

  const health=num(field(summary,['Overall_Health_Score'],0));
  const status=String(field(summary,['Overall_Status'],'NORMAL')).toUpperCase();
  const summaryDate=field(summary,['Summary_Date'],'-');
  const game=field(summary,['Game_Name','Game_ID'],'-');
  const account=field(summary,['Account_Name','Account_ID'],'-');
  const level=status==='CRITICAL'?'high':(status==='WATCH'||health<75?'medium':'good');
  const statusLabel=level==='high'?'ต้องดำเนินการ':level==='medium'?'ควรตรวจสอบ':'สถานการณ์ปกติ';

  if(badge) badge.textContent=`AI · ${summaryDate}`;
  container.className='action-list';
  container.innerHTML=[
    `<div class="ai-summary-meta"><div><span>เกม</span><strong>${escapeHtml(game)}</strong></div><div><span>บัญชี</span><strong>${escapeHtml(account)}</strong></div><div><span>Health Score</span><strong>${integer(health)} / 100</strong></div></div>`,
    `<article class="action-card" data-level="${level}"><div class="action-head"><strong>ภาพรวม</strong><span class="action-tag">${statusLabel}</span></div><p>${aiTextHtml(field(summary,['Executive_Summary'],''))}</p></article>`,
    `<article class="action-card" data-level="good"><div class="action-head"><strong>โอกาสสำคัญ</strong><span class="action-tag">Opportunity</span></div><p>${aiTextHtml(field(summary,['Biggest_Opportunity'],''))}</p></article>`,
    `<article class="action-card" data-level="${level}"><div class="action-head"><strong>ความเสี่ยงสำคัญ</strong><span class="action-tag">Risk</span></div><p>${aiTextHtml(field(summary,['Biggest_Risk'],''),'ไม่พบความเสี่ยงสำคัญ')}</p></article>`,
    `<article class="action-card" data-level="${level}"><div class="action-head"><strong>สิ่งที่ควรทำ</strong><span class="action-tag">Action</span></div><p>${aiTextHtml(field(summary,['Recommended_Action'],''),'ติดตาม Performance ตามรอบปกติ')}</p></article>`,
  ].join('');
}
function renderAll(){ state.pages.campaign=Math.max(1,state.pages.campaign); state.pages.creative=Math.max(1,state.pages.creative); renderKpis(); renderTrend(); renderDistribution(); renderActions(); renderCampaignTable(); renderCreativeTable(); saveFilterState(); }

async function fetchDashboard(){ const url=window.APP_CONFIG?.DASHBOARD_URL; if(!url) throw new Error('ไม่พบ Dashboard URL'); const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:token()})}); const raw=await response.text(); if(!raw.trim()) throw new Error('Dashboard API ไม่ได้ส่งข้อมูลกลับมา'); let result; try{result=normalizeApiResult(JSON.parse(raw));}catch{throw new Error('Dashboard API ส่งข้อมูลที่อ่านไม่ได้');} if(!response.ok || !result?.success || !result?.dashboard){ const error=new Error(result?.message || `Dashboard API Error (${response.status})`); error.httpStatus=Number(result?.http_status || response.status || 500); throw error; } return result; }
function saveCache(response){ localStorage.setItem(cacheKey(),JSON.stringify({saved_at:new Date().toISOString(),response})); }
function readCache(){ try{ const value=JSON.parse(localStorage.getItem(cacheKey())||'null'); return value?.response?.dashboard?value:null; }catch{return null;} }
function clearCache(){ Object.keys(localStorage).filter(k=>k.startsWith('ai_marketing_copilot_dashboard_cache_')).forEach(k=>localStorage.removeItem(k)); }
function setRefreshLoading(on){ const button=el('refreshDashboardButton'); if(!button)return; button.disabled=on; button.textContent=on?'กำลังรีเฟรช...':'รีเฟรชข้อมูล'; }
async function sync(){ setRefreshLoading(true); try{ const result=await fetchDashboard(); saveCache(result); hydrate(result); }catch(error){ console.error(error); if([401,403].includes(error.httpStatus)){ clearCache(); redirectLogin(); } else if(!state.response){ text('loadingMessage',error.message || 'ไม่สามารถโหลด Dashboard ได้'); } }finally{ setRefreshLoading(false); } }
function on(id,event,handler){ const node=el(id); if(node) node.addEventListener(event,handler); }
function bindFilters(){
  document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{ document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active')); button.classList.add('active'); state.days=button.dataset.days; state.pages={campaign:1,creative:1}; el('customRange')?.classList.toggle('hidden',state.days!=='custom'); if(state.days!=='custom') renderAll(); }));
  ['gameFilter','accountFilter','objectiveFilter'].forEach(id=>on(id,'change',(e)=>{ state.filters[id.replace('Filter','')]=e.target.value; state.pages={campaign:1,creative:1}; renderAll(); }));
  on('dateFrom','change',(e)=>{state.customFrom=e.target.value;if(state.customTo)renderAll();});
  on('dateTo','change',(e)=>{state.customTo=e.target.value;if(state.customFrom)renderAll();});
  on('trendMetric','change',(e)=>{state.trendMetric=e.target.value;renderTrend();saveFilterState();});
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
    if(!token() || window.Auth?.isExpired?.()){ clearCache(); redirectLogin(); return; }
    loadFilterState(); bindFilters();
    document.querySelectorAll('.preset').forEach(x=>x.classList.toggle('active',x.dataset.days===String(state.days)));
    el('customRange')?.classList.toggle('hidden',state.days!=='custom');
    if(el('dateFrom')) el('dateFrom').value=state.customFrom;
    if(el('dateTo')) el('dateTo').value=state.customTo;
    if(el('trendMetric')) el('trendMetric').value=state.trendMetric;
    const cache=readCache();
    if(cache){ hydrate(cache.response); sync(); } else await sync();
  } catch(error) {
    console.error('Dashboard startup error:',error);
    text('loadingMessage',error?.message || 'เกิดข้อผิดพลาดขณะเปิด Dashboard');
  }
}
start();
