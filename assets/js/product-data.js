'use strict';
window.CopilotData=(()=>{
 const PREFIX='ai_marketing_copilot_dashboard_cache_v3';
 const first=(keys)=>{for(const k of keys){const v=localStorage.getItem(k);if(v)return v;}return ''};
 const token=()=>window.Auth?.token?.()||first(['session_token','token','auth_token']);
 const sid=()=>first(['session_id','Session_ID','sessionId']);
 const cacheKey=()=>`${PREFIX}:${sid()||first(['username','Username'])||'anonymous'}`;
 const parseDate=(v)=>{if(!v)return null;const raw=String(v).trim();const iso=/^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0];const d=new Date(iso||raw);return Number.isNaN(d.getTime())?null:d};
 const normalize=(v)=>{let r=v;if(Array.isArray(r))r=r[0];if(r&&typeof r==='object'&&Object.keys(r).length===1&&typeof r.body==='string'){try{r=JSON.parse(r.body)}catch{}}if(typeof r==='string')r=JSON.parse(r);return r};
 async function fetchFresh(){const url=window.APP_CONFIG?.DASHBOARD_URL;if(!url)throw new Error('ไม่พบ Dashboard URL');const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:token()})});const raw=await res.text();if(!raw.trim())throw new Error('Dashboard API ไม่ได้ส่งข้อมูลกลับมา');let out;try{out=normalize(JSON.parse(raw))}catch{throw new Error('Dashboard API ส่งข้อมูลที่อ่านไม่ได้')}if(!res.ok||!out?.success||!out?.dashboard){const e=new Error(out?.message||`Dashboard API Error (${res.status})`);e.httpStatus=res.status;throw e}localStorage.setItem(cacheKey(),JSON.stringify({saved_at:new Date().toISOString(),response:out}));return out}
 function readCache(){try{return JSON.parse(localStorage.getItem(cacheKey())||'null')?.response||null}catch{return null}}
 async function load({refresh=false}={}){if(!token())throw Object.assign(new Error('Session หมดอายุ'),{httpStatus:401});if(!refresh){const c=readCache();if(c?.dashboard){fetchFresh().catch(()=>{});return c}}return fetchFresh()}
 const rows=(r,key)=>Array.isArray(r?.dashboard?.[key]?.rows)?r.dashboard[key].rows:[];
 const field=(row,names,fallback='')=>{for(const n of names){if(row?.[n]!==undefined&&row?.[n]!==null&&row?.[n]!=='')return row[n]}return fallback};
 const num=(v)=>{const n=Number(String(v??'').replaceAll(',',''));return Number.isFinite(n)?n:0};
 const metric=(row,name)=>{const map={spend:['Spend','Amount_Spent'],impressions:['Impressions'],clicks:['Clicks','Link_Clicks'],lpv:['Landing_Page_Views','LandingPageViews','LPV'],results:['Results','Result'],reach:['Reach'],ctr:['CTR','Ctr'],frequency:['Frequency'],cpr:['Cost_Per_Result','CostPerResult'],cplpv:['Cost_Per_Landing_Page_View','Cost_Per_LPV','CostPerLandingPageView']};return num(field(row,map[name]||[name],0))};
 const aggregate=(list)=>{const t={spend:0,impressions:0,clicks:0,lpv:0,results:0,reach:0};for(const r of list)for(const k of Object.keys(t))t[k]+=metric(r,k);t.ctr=t.impressions?t.clicks/t.impressions*100:0;t.cpr=t.results?t.spend/t.results:0;t.cplpv=t.lpv?t.spend/t.lpv:0;return t};
 const group=(list,keyFn)=>{const m=new Map;for(const r of list){const k=String(keyFn(r));if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return[...m.entries()].map(([key,items])=>({key,items,sample:items[0],totals:aggregate(items)}))};
 const dateKey=(v)=>{const d=parseDate(v);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''};
 const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
 const money=(v)=>new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(num(v));
 const integer=(v)=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(num(v));
 const percent=(v)=>`${num(v).toFixed(2)}%`;
 const thumbUrl=(r)=>field(r,['Thumbnail_URL','Image_URL','Creative_Thumbnail_URL','Picture_URL','picture','thumbnail_url'],'');
 return{load,rows,field,num,metric,aggregate,group,dateKey,parseDate,esc,money,integer,percent,thumbUrl,token};
})();
