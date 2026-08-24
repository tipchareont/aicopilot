"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const D = window.CopilotData;
  let response = null;
  let allRows = [];
  let activeView = 'ACTIONABLE';

  const labels = {
    SCALE_READY:'พร้อม Scale',
    TEST_SCALE:'ทดลอง Scale',
    GOOGLE_SCALE_SIGNAL:'Google Scale Signal',
    HOLD:'Hold',
    HOLD_REVIEW:'Hold & Review',
    DO_NOT_SCALE:'ห้าม Scale',
    INSUFFICIENT_DATA:'ข้อมูลไม่พอ',
  };

  const arr = (v) => Array.isArray(v) ? v : [];
  const clean = (v) => String(v ?? '').trim();
  const upper = (v) => clean(v).toUpperCase();
  const esc = (v) => D.esc(v);
  const value = (row, names, fallback='') => D.field(row, names, fallback);

  const decision = (row) => upper(value(row,['Advisor_Decision'],'INSUFFICIENT_DATA'));
  const platform = (row) => upper(value(row,['Platform'],'META')) || 'META';
  const gameName = (row) => clean(value(row,['Game_Name','Game_ID'],'Unknown Game'));
  const gameKey = (row) => clean(value(row,['Game_ID','Game_Name'],'UNKNOWN'));
  const account = (row) => clean(value(row,['Account_Name','Account_ID'],'-'));
  const campaign = (row) => clean(value(row,['Campaign_Name'],'-'));

  function showApp(){ $('loading').classList.add('hidden'); $('shell').classList.remove('hidden'); }
  function setUser(){ $('displayName').textContent=localStorage.getItem('display_name')||localStorage.getItem('username')||'-'; $('role').textContent=localStorage.getItem('role')||'-'; }

  function stateOf(row){
    const d=decision(row);
    if(['SCALE_READY','TEST_SCALE','GOOGLE_SCALE_SIGNAL'].includes(d)) return 'ready';
    if(['HOLD','HOLD_REVIEW'].includes(d)) return 'hold';
    if(d==='DO_NOT_SCALE') return 'stop';
    return 'insufficient';
  }

  function simpleRecommendation(row){
    const recommendation=clean(value(row,['Recommendation'],''));
    if(recommendation) return recommendation;
    const d=decision(row);
    if(d==='SCALE_READY') return 'เพิ่มงบตาม Step ที่ระบบแนะนำ และเช็ก Metric หลักทุกวัน';
    if(d==='TEST_SCALE') return 'ลองเพิ่มงบแบบค่อยเป็นค่อยไป แล้วดูผลหลังการเปลี่ยนแปลง';
    if(d==='GOOGLE_SCALE_SIGNAL') return 'พิจารณาทดสอบ Scale แบบค่อยเป็นค่อยไป และติดตาม Google Ads Conversions กับ CPA';
    if(d==='DO_NOT_SCALE') return 'ยังไม่ควรเพิ่มงบ ให้แก้ปัญหาก่อน';
    if(d==='INSUFFICIENT_DATA') return 'รอข้อมูลให้ผ่าน Minimum Sample ก่อน';
    return 'พักการเพิ่มงบไว้ก่อน และติดตาม Metric ที่ระบบระบุ';
  }

  function normalizeText(text){
    return clean(text)
      .replace(/CPA 7D[^•\\n]*14D/gi,'CPA 7 วันล่าสุดเทียบกับ 7 วันก่อนหน้า')
      .replace(/7D[^•\\n]*14D/gi,'7 วันล่าสุดเทียบกับ 7 วันก่อนหน้า');
  }

  function metricPack(row){
    const baseline=row.Baseline||{};
    const mainLabel=clean(value(row,['Main_Metric_Label','Main_Metric'],'Main Metric'));
    const metricValue=value(baseline,['value_7d'],value(row,['Trend_7D'],'-'));
    const spend=value(row,['Spend'],'');
    const p=platform(row);
    let results='-';
    let cost='-';
    if(p==='GOOGLE'){
      const conv=value(row,['Conversions','Google_Conversions'],'');
      const cpa=value(row,['CPA','Google_CPA'],'');
      results=conv!==''?D.integer(conv):'-';
      cost=cpa!==''?`฿${D.money(cpa)}`:'-';
    }else{
      const cr=D.metric(row,'completeRegister');
      const cpcr=D.metric(row,'cpcr');
      results=cr?D.integer(cr):'-';
      cost=cr?`฿${D.money(cpcr)}`:'-';
    }
    return [
      {label:mainLabel,value:metricValue!==''?String(metricValue):'-'},
      {label:'Spend ล่าสุด',value:spend!==''?`฿${D.money(spend)}`:'-'},
      {label:p==='GOOGLE'?'Google Ads Conversions':'Complete Register',value:results},
      {label:p==='GOOGLE'?'Google CPA':'Cost / Complete Register',value:cost},
    ];
  }

  function renderCard(row){
    const d=decision(row), s=stateOf(row), p=platform(row);
    const reasons=arr(row.Reasons).map(normalizeText).filter(Boolean);
    const risks=arr(row.Risks).map(normalizeText).filter(Boolean);
    const monitors=arr(row.Metrics_To_Monitor).filter(Boolean);
    const budget=D.num(value(row,['Recommended_Budget_Step_Pct']));
    const metrics=metricPack(row);
    const objective=D.displayObjective(value(row,['Objective'],''))||'-';
    const phase=clean(value(row,['Phase'],''));

    return `<article class="advisor-compact-card" data-state="${s}">
      <div class="advisor-compact-main">
        <div class="advisor-compact-title">
          <strong>${esc(campaign(row))}</strong>
          <small>${esc(account(row))} · ${esc(objective)}${phase?` · ${esc(phase)}`:''}</small>
        </div>
        ${metrics.map(m=>`<div class="advisor-metric-box"><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join('')}
        <div class="advisor-state">
          <span class="advisor-pill ${p==='GOOGLE'?'google':'meta'}">${esc(p)}</span>
          <span class="advisor-pill ${s==='ready'?'good':s==='hold'?'watch':s==='stop'?'danger':'muted'}">${esc(labels[d]||d)}</span>
          ${p==='GOOGLE'?'<span class="advisor-pill muted">Budget Step: ไม่กำหนด</span>':`<span class="advisor-pill muted">Budget Step ${budget>0?'+':''}${D.integer(budget)}%</span>`}
        </div>
      </div>
      <div class="advisor-quick-rec"><strong>คำแนะนำ:</strong>${esc(simpleRecommendation(row))}</div>
      <details class="advisor-card-details">
        <summary>ดูเหตุผล / ความเสี่ยง / Metrics ที่ต้องเฝ้าดู</summary>
        <div class="advisor-detail-grid">
          <section class="advisor-detail-box"><h4>เหตุผล</h4>${reasons.length?`<ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="search-hint">ไม่มีข้อมูลเพิ่ม</div>'}</section>
          <section class="advisor-detail-box"><h4>ความเสี่ยง</h4>${risks.length?`<ul>${risks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="search-hint">ยังไม่พบ Risk เพิ่มเติม</div>'}</section>
          <section class="advisor-detail-box"><h4>Metrics ที่ต้องเฝ้าดู</h4>${monitors.length?`<div>${monitors.map(x=>`<span class="advisor-pill muted" style="margin:0 5px 5px 0">${esc(x)}</span>`).join('')}</div>`:'<div class="search-hint">ไม่มีข้อมูลเพิ่ม</div>'}</section>
        </div>
      </details>
    </article>`;
  }

  function rowPassesBaseFilter(row){
    const q=upper($('searchFilter').value);
    const g=$('gameFilter').value;
    const a=$('accountFilter').value;
    const d=$('decisionFilter').value;
    const rowGame=clean(value(row,['Game_Name','Game_ID']));
    const rowAccount=clean(value(row,['Account_Name','Account_ID']));
    return (!q||upper(campaign(row)).includes(q))&&(!g||rowGame===g)&&(!a||rowAccount===a)&&(!d||decision(row)===d);
  }

  function visibleRows(){
    return allRows.filter(row=>{
      if(!rowPassesBaseFilter(row)) return false;
      const s=stateOf(row);
      if(activeView==='ACTIONABLE'&&s==='insufficient') return false;
      if(activeView==='READY'&&s!=='ready') return false;
      if(activeView==='HOLD'&&s!=='hold') return false;
      if(activeView==='STOP'&&s!=='stop') return false;
      return true;
    });
  }

  function render(){
    const baseRows=allRows.filter(rowPassesBaseFilter);
    const rows=visibleRows();
    const insufficient=baseRows.filter(r=>stateOf(r)==='insufficient');

    $('scaleReadyCount').textContent=D.integer(baseRows.filter(r=>decision(r)==='SCALE_READY').length);
    $('testScaleCount').textContent=D.integer(baseRows.filter(r=>['TEST_SCALE','GOOGLE_SCALE_SIGNAL'].includes(decision(r))).length);
    $('holdCount').textContent=D.integer(baseRows.filter(r=>stateOf(r)==='hold').length);
    $('blockedCount').textContent=D.integer(baseRows.filter(r=>stateOf(r)==='stop').length);
    $('insufficientCount').textContent=D.integer(insufficient.length);
    $('resultBadge').textContent=`${D.integer(rows.length)} campaigns`;
    $('insufficientSummary').textContent=`ข้อมูลไม่เพียงพอ ${D.integer(insufficient.length)} Campaign — กดเพื่อดู`;

    const actionable=rows.filter(r=>stateOf(r)!=='insufficient');
    const groups=new Map();
    for(const row of actionable){
      const key=`${platform(row)}||${gameKey(row)}`;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(row);
    }

    const priority={ready:0,hold:1,stop:2};
    for(const list of groups.values()) list.sort((a,b)=>priority[stateOf(a)]-priority[stateOf(b)]||campaign(a).localeCompare(campaign(b),'th'));

    $('advisorGroupList').innerHTML=groups.size?[...groups.values()].map(list=>{
      const first=list[0], p=platform(first);
      const ready=list.filter(r=>stateOf(r)==='ready').length;
      const hold=list.filter(r=>stateOf(r)==='hold').length;
      const stop=list.filter(r=>stateOf(r)==='stop').length;
      return `<section class="advisor-game-group">
        <div class="advisor-game-head">
          <div class="advisor-game-title"><span class="advisor-pill ${p==='GOOGLE'?'google':'meta'}">${esc(p)}</span><h3>${esc(gameName(first))}</h3><span class="advisor-pill muted">${D.integer(list.length)} Campaigns</span></div>
          <div class="advisor-game-counts">${ready?`<span class="advisor-pill good">${ready} Scale</span>`:''}${hold?`<span class="advisor-pill watch">${hold} Hold</span>`:''}${stop?`<span class="advisor-pill danger">${stop} Stop</span>`:''}</div>
        </div>
        <div class="advisor-compact-list">${list.map(renderCard).join('')}</div>
      </section>`;
    }).join(''):'<div class="empty">ไม่พบ Campaign ที่ตรงกับตัวกรองใน View นี้</div>';

    $('insufficientList').innerHTML=insufficient.length?insufficient.map(renderCard).join(''):'<div class="empty">ไม่มี Campaign กลุ่มข้อมูลไม่เพียงพอในตัวกรองนี้</div>';
    $('insufficientWrap').style.display=['READY','HOLD','STOP'].includes(activeView)?'none':'';
  }

  function uniqueOptions(id,rows,getter){
    const select=$(id), current=select.value;
    const values=[...new Set(rows.map(getter).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
    select.innerHTML='<option value="">ทั้งหมด</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    select.value=values.includes(current)?current:'';
  }

  async function load(refresh=false){
    $('loadingMessage').textContent=refresh?'กำลังรีเฟรชข้อมูลล่าสุด...':'กำลังอ่าน Scale Advisor Cache...';
    if(!window.Auth?.hasUsableSession?.()) return window.Auth.redirectToLogin();
    try{
      response=await D.load({refresh});
      const metaRows=D.rows(response,'scale_advisor');
      const googleRows=Array.isArray(response?.dashboard?.google_ads_scale_advisor?.rows)?response.dashboard.google_ads_scale_advisor.rows:[];
      allRows=[...metaRows,...googleRows];

      uniqueOptions('gameFilter',allRows,row=>clean(value(row,['Game_Name','Game_ID'])));
      uniqueOptions('accountFilter',allRows,row=>clean(value(row,['Account_Name','Account_ID'])));

      const meta=response?.scale_up_advisor_cache||{}, googleMeta=response?.google_ads_intelligence_cache||{};
      const dates=[meta.data_date,googleMeta.data_date,allRows[0]?.Date].filter(Boolean).sort();
      $('dataDateBadge').textContent=`Data: ${dates.at(-1)||'-'}`;
      $('updatedAt').textContent=meta.generated_at?`Updated: ${new Date(meta.generated_at).toLocaleString('th-TH')}`:'Updated: -';

      setUser(); render(); showApp();
    }catch(error){
      if(Number(error.httpStatus)===401) return window.Auth.redirectToLogin();
      $('loadingMessage').textContent=error.message||'ไม่สามารถโหลดข้อมูลได้';
    }
  }

  ['searchFilter','gameFilter','accountFilter','decisionFilter'].forEach(id=>$(id).addEventListener(id==='searchFilter'?'input':'change',render));
  $('resetButton').addEventListener('click',()=>{ $('searchFilter').value=''; $('gameFilter').value=''; $('accountFilter').value=''; $('decisionFilter').value=''; activeView='ACTIONABLE'; document.querySelectorAll('.advisor-view-tab').forEach(x=>x.classList.toggle('is-active',x.dataset.view==='ACTIONABLE')); render(); });
  document.querySelectorAll('.advisor-view-tab').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.advisor-view-tab').forEach(x=>x.classList.remove('is-active')); btn.classList.add('is-active'); activeView=btn.dataset.view||'ACTIONABLE'; render(); }));
  $('refreshButton').addEventListener('click',()=>load(true));
  $('logoutButton').addEventListener('click',()=>window.Auth.redirectToLogin());
  load(false);
})();
