'use strict';

const CACHE_PREFIX = 'ai_marketing_copilot_dashboard_cache_v3';
const state = { response:null, rows:{account:[],campaign:[],creative:[],creativeGroup:[]}, days:7, customFrom:'', customTo:'', filters:{game:'',account:'',objective:''}, charts:{} };
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
function parseDate(value){ if(!value) return null; const raw=String(value).trim(); const iso=/^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0]; const date=new Date(iso || raw); return Number.isNaN(date.getTime())?null:date; }
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

function hydrate(response){
  if(!response?.success || !response?.dashboard) throw new Error(response?.message || 'Dashboard payload ไม่ถูกต้อง');
  state.response=response;
  state.rows={account:rows(response.dashboard.account),campaign:rows(response.dashboard.campaign),creative:rows(response.dashboard.creative),creativeGroup:rows(response.dashboard.creative_group)};
  renderUser(response); buildFilterOptions(); renderAll();
  text('dashboardUpdatedAt',`อัปเดต ${formatDateTime(updatedAt(response) || new Date().toISOString())}`);
  el('loading')?.classList.add('hidden'); el('shell')?.classList.remove('hidden');
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
  destroyChart('trend'); state.charts.trend=new Chart(el('trendChart'),{type:'line',data:{labels:series.map(x=>x.date),datasets:[{label:'Spend',data:series.map(x=>x.spend),yAxisID:'y'},{label:'Results',data:series.map(x=>x.results),yAxisID:'y1'},{label:'Cost / Result',data:series.map(x=>x.cpr),yAxisID:'y'},{label:'CTR %',data:series.map(x=>x.ctr),yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,position:'left'},y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false}}}}});
}
function groupMetric(rowsToGroup,keyNames,metricName){ const map=new Map(); for(const r of rowsToGroup){ const key=String(field(r,keyNames,'ไม่ระบุ')); map.set(key,(map.get(key)||0)+metric(r,metricName)); } return [...map.entries()].sort((a,b)=>b[1]-a[1]); }
function donut(name,canvasId,entries){ if(!chartAvailable()) return; destroyChart(name); state.charts[name]=new Chart(el(canvasId),{type:'doughnut',data:{labels:entries.map(x=>x[0]),datasets:[{data:entries.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}}); }
function renderDistribution(){ const campaign=filtered('campaign'); donut('spendObjective','spendObjectiveChart',groupMetric(campaign,['Objective_Display','Objective'],'spend')); donut('resultsObjective','resultsObjectiveChart',groupMetric(campaign,['Objective_Display','Objective'],'results')); }
function campaignKey(r){ return String(field(r,['Campaign_ID','Campaign_Name','Entity_Name'],'ไม่ระบุ Campaign')); }
function creativeKey(r){ return String(field(r,['Ad_ID','Creative_ID','Ad_Name','Creative_Name','Entity_Name'],'ไม่ระบุ Creative')); }
function groupRows(rowsToGroup,keyFn){ const map=new Map(); for(const r of rowsToGroup){ const key=keyFn(r); if(!map.has(key)) map.set(key,[]); map.get(key).push(r); } return [...map.entries()].map(([key,list])=>({key,list,totals:aggregate(list),sample:list[0]})); }
function campaignStatus(item,medianCpr){ if(item.totals.results===0 && item.totals.spend>0) return 'ควรตรวจ'; if(medianCpr>0 && item.totals.cpr>medianCpr*1.3) return 'CPA สูง'; if(item.totals.ctr>0 && item.totals.ctr<0.7) return 'CTR ต่ำ'; return 'ปกติ'; }
function renderCampaignTable(){
  const grouped=groupRows(filtered('campaign'),campaignKey).sort((a,b)=>b.totals.spend-a.totals.spend); const cprs=grouped.map(x=>x.totals.cpr).filter(x=>x>0).sort((a,b)=>a-b); const median=cprs.length?cprs[Math.floor(cprs.length/2)]:0; text('campaignTableBadge',`${integer(grouped.length)} campaigns`);
  const body=el('campaignTableBody'); if(!grouped.length){ body.innerHTML='<tr><td colspan="11" class="table-empty">ไม่พบข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML=grouped.slice(0,50).map(item=>{ const r=item.sample; const status=campaignStatus(item,median); return `<tr><td>${escapeHtml(field(r,['Campaign_Name','Entity_Name'],item.key))}</td><td>${escapeHtml(field(r,['Game_Name','Game_ID'],'-'))}</td><td>${escapeHtml(field(r,['Account_Name','Ad_Account_Name'],'-'))}</td><td>${escapeHtml(field(r,['Objective_Display','Objective'],'-'))}</td><td>฿${money(item.totals.spend)}</td><td>${integer(item.totals.results)}</td><td>฿${money(item.totals.cpr)}</td><td>${percent(item.totals.ctr)}</td><td>${integer(item.totals.lpv)}</td><td>฿${money(item.totals.cplpv)}</td><td><span class="status-pill">${escapeHtml(status)}</span></td></tr>`; }).join('');
}
function renderCreativeTable(){
  const grouped=groupRows(filtered('creative'),creativeKey).sort((a,b)=>b.totals.spend-a.totals.spend); text('creativeTableBadge',`${integer(grouped.length)} creatives`); const body=el('creativeTableBody'); if(!grouped.length){ body.innerHTML='<tr><td colspan="9" class="table-empty">ไม่พบข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML=grouped.slice(0,50).map(item=>{ const r=item.sample; const ctr=item.totals.ctr || metric(r,'ctr'); const frequency=metric(r,'frequency'); return `<tr><td>${escapeHtml(field(r,['Creative_Group_Name'],'-'))}</td><td>${escapeHtml(field(r,['Ad_Name','Creative_Name','Entity_Name'],item.key))}</td><td>${escapeHtml(field(r,['Campaign_Name'],'-'))}</td><td>${escapeHtml(field(r,['Objective_Display','Objective'],'-'))}</td><td>฿${money(item.totals.spend)}</td><td>${integer(item.totals.results)}</td><td>฿${money(item.totals.cpr)}</td><td>${percent(ctr)}</td><td>${frequency?frequency.toFixed(2):'-'}</td></tr>`; }).join('');
}
function renderActions(){
  const campaigns=groupRows(filtered('campaign'),campaignKey).filter(x=>x.totals.spend>0); const actions=[];
  const noResult=campaigns.filter(x=>x.totals.results===0).sort((a,b)=>b.totals.spend-a.totals.spend)[0]; if(noResult) actions.push({level:'high',tag:'ตรวจด่วน',title:field(noResult.sample,['Campaign_Name','Entity_Name'],noResult.key),detail:`ใช้จ่าย ฿${money(noResult.totals.spend)} แต่ยังไม่มีผลลัพธ์ในช่วงที่เลือก`});
  const withResults=campaigns.filter(x=>x.totals.results>0); const best=[...withResults].sort((a,b)=>a.totals.cpr-b.totals.cpr)[0]; if(best) actions.push({level:'good',tag:'โอกาส',title:field(best.sample,['Campaign_Name','Entity_Name'],best.key),detail:`มี Cost / Result ต่ำสุดในชุดข้อมูลที่ ฿${money(best.totals.cpr)} ควรตรวจคุณภาพผลลัพธ์ก่อนพิจารณาเพิ่มงบ`});
  const worst=[...withResults].sort((a,b)=>b.totals.cpr-a.totals.cpr)[0]; if(worst && worst!==best) actions.push({level:'medium',tag:'เฝ้าระวัง',title:field(worst.sample,['Campaign_Name','Entity_Name'],worst.key),detail:`มี Cost / Result สูงสุดในชุดข้อมูลที่ ฿${money(worst.totals.cpr)} ควรตรวจ Audience และ Creative`});
  if(!actions.length) actions.push({level:'medium',tag:'ข้อมูลไม่พอ',title:'ยังไม่พบ Action ที่สรุปได้',detail:'ระบบจะแสดงคำแนะนำเมื่อมี Spend และ Results เพียงพอ โดยไม่สร้างข้อมูลขึ้นเอง'});
  el('actionList').innerHTML=actions.slice(0,4).map(a=>`<div class="action-card" data-level="${a.level}"><div class="action-head"><strong>${escapeHtml(a.title)}</strong><span class="action-tag">${escapeHtml(a.tag)}</span></div><p>${escapeHtml(a.detail)}</p></div>`).join('');
}
function renderAll(){ renderKpis(); renderTrend(); renderDistribution(); renderActions(); renderCampaignTable(); renderCreativeTable(); }

async function fetchDashboard(){ const url=window.APP_CONFIG?.DASHBOARD_URL; if(!url) throw new Error('ไม่พบ Dashboard URL'); const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:token()})}); const raw=await response.text(); if(!raw.trim()) throw new Error('Dashboard API ไม่ได้ส่งข้อมูลกลับมา'); let result; try{result=normalizeApiResult(JSON.parse(raw));}catch{throw new Error('Dashboard API ส่งข้อมูลที่อ่านไม่ได้');} if(!response.ok || !result?.success || !result?.dashboard){ const error=new Error(result?.message || `Dashboard API Error (${response.status})`); error.httpStatus=response.status; throw error; } return result; }
function saveCache(response){ localStorage.setItem(cacheKey(),JSON.stringify({saved_at:new Date().toISOString(),response})); }
function readCache(){ try{ const value=JSON.parse(localStorage.getItem(cacheKey())||'null'); return value?.response?.dashboard?value:null; }catch{return null;} }
function clearCache(){ Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k)); }
function setRefreshLoading(on){ const button=el('refreshDashboardButton'); if(!button)return; button.disabled=on; button.textContent=on?'กำลังรีเฟรช...':'รีเฟรชข้อมูล'; }
async function sync(){ setRefreshLoading(true); try{ const result=await fetchDashboard(); saveCache(result); hydrate(result); }catch(error){ console.error(error); if([401,403].includes(error.httpStatus)){ clearCache(); redirectLogin(); } else if(!state.response){ text('loadingMessage',error.message || 'ไม่สามารถโหลด Dashboard ได้'); } }finally{ setRefreshLoading(false); } }
function bindFilters(){
  document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{ document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active')); button.classList.add('active'); state.days=button.dataset.days; el('customRange').classList.toggle('hidden',state.days!=='custom'); if(state.days!=='custom') renderAll(); }));
  ['gameFilter','accountFilter','objectiveFilter'].forEach(id=>el(id).addEventListener('change',(e)=>{ state.filters[id.replace('Filter','')]=e.target.value; renderAll(); }));
  el('dateFrom').addEventListener('change',(e)=>{state.customFrom=e.target.value;if(state.customTo)renderAll();}); el('dateTo').addEventListener('change',(e)=>{state.customTo=e.target.value;if(state.customFrom)renderAll();});
  el('refreshDashboardButton').addEventListener('click',sync);
  el('logoutButton').addEventListener('click',()=>{clearCache();redirectLogin();});
}
async function start(){ if(!token() || (expiry() && parseDate(expiry())<=new Date())){ clearCache(); redirectLogin(); return; } bindFilters(); const cache=readCache(); if(cache){ hydrate(cache.response); sync(); } else await sync(); }
start();
