'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? '').trim();
  const upper = (value) => clean(value).toUpperCase();
  const esc = (value) => clean(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = (value, digits = 0) => Number(value || 0).toLocaleString('th-TH',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const money = (value) => `฿${num(value,2)}`;
  const dateText = (value) => { const v=clean(value).slice(0,10); if(!v)return '-'; const [y,m,d]=v.split('-'); return y&&m&&d?`${d}/${m}/${y}`:v; };
  const state = { data:null, selected:null, tab:'decisions', loading:false };
  const CACHE_VERSION = 9;
  const cacheKey = () => `ai_marketing_copilot_action_center_v9_${clean(localStorage.getItem('username')||'user').toLowerCase()}`;
  const todayBangkok = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

  function readCache(){try{const x=JSON.parse(localStorage.getItem(cacheKey())||'null');return Number(x?.version||0)===CACHE_VERSION&&x?.data?x:null}catch{return null}}
  function clearLegacyCaches(){try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i)||'';if(key.startsWith('ai_marketing_copilot_action_center_')&&key!==cacheKey())localStorage.removeItem(key);}}catch{}}
  function saveCache(data){try{clearLegacyCaches();localStorage.setItem(cacheKey(),JSON.stringify({version:CACHE_VERSION,saved_at:Date.now(),data}))}catch{}}
  function showApp(){ $('loading').classList.add('hidden'); $('shell').classList.remove('hidden'); }
  function setUser(){ $('displayName').textContent=localStorage.getItem('display_name')||localStorage.getItem('username')||'-'; $('role').textContent=localStorage.getItem('role')||'-'; $('actionOwner').value=localStorage.getItem('display_name')||localStorage.getItem('username')||''; }

  async function request(payload){
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),45000);
    try{
      const baseUrl=window.APP_CONFIG.ACTION_MANAGEMENT_URL; const requestUrl=`${baseUrl}${baseUrl.includes('?')?'&':'?'}_ts=${Date.now()}`;
      const response=await fetch(requestUrl,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({session_token:window.Auth.token(),...payload}),signal:controller.signal});
      let data=null; try{data=await response.json()}catch{}
      if(response.status===401){window.Auth.redirectToLogin();throw new Error('Session หมดอายุ')}
      if(!response.ok||data?.success===false)throw new Error(data?.message||`Action API Error (${response.status})`);
      return data;
    }catch(error){if(error?.name==='AbortError')throw new Error('Action API ใช้เวลาตอบนานเกิน 45 วินาที');throw error}finally{clearTimeout(timeout)}
  }

  function uniqueOptions(id, rows, getter){const s=$(id),current=s.value,values=[...new Set(rows.map(getter).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));s.innerHTML='<option value="">ทั้งหมด</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');s.value=values.includes(current)?current:'';}

  const STATUS_LABELS = Object.freeze({
    CRITICAL:'ต้องแก้เร่งด่วน',
    WATCH:'เฝ้าระวัง',
    NORMAL:'ปกติ',
    GOOD:'ผลดี',
    INSUFFICIENT_DATA:'ข้อมูลไม่เพียงพอ',
    PLANNED:'วางแผนแล้ว',
    IN_PROGRESS:'กำลังดำเนินการ',
    PENDING_REVIEW:'รอตรวจผล',
    OUTCOME_READY:'มีผลพร้อมตรวจ',
    CLOSED:'ปิด Action แล้ว',
    CANCELLED:'ยกเลิกแล้ว',
    DISMISSED:'ไม่ดำเนินการ',
    PENDING:'รอผล',
    IMPROVED:'ผลดีขึ้น',
    WORSE:'ผลแย่ลง',
    STABLE:'ผลทรงตัว',
    INCONCLUSIVE:'ยังสรุปไม่ได้',
    OPPORTUNITY:'โอกาสที่ควรพิจารณา'
  });

  const ACTION_TYPE_LABELS = Object.freeze({
    CREATIVE_REFRESH:'ปรับหรือเปลี่ยน Creative',
    CREATIVE_VARIATION:'สร้าง Creative Variation',
    BUDGET_REDUCE:'ลด Spend / Budget',
    BUDGET_INCREASE:'เพิ่ม Spend / Budget',
    AUDIENCE_ADJUST:'ปรับกลุ่มเป้าหมาย',
    PLACEMENT_ADJUST:'ปรับ Placement',
    LANDING_PAGE_FIX:'ปรับ Landing Page',
    TRACKING_CHECK:'ตรวจสอบ Tracking',
    CAMPAIGN_RESTRUCTURE:'ปรับโครงสร้าง Campaign',
    MONITOR_ONLY:'ติดตามผลต่อ',
    OTHER:'การดำเนินการอื่น'
  });

  const METRIC_LABELS = Object.freeze({
    COST_PER_COMPLETE_REGISTER:'Cost / Complete Register',
    COST_PER_REGISTER:'Cost / Complete Register',
    COST_PER_ENGAGEMENT:'Cost / Engagement',
    COST_PER_RESULT:'Cost / Result',
    COST_PER_LPV:'Cost / Landing Page View',
    COST_PER_LANDING_PAGE_VIEW:'Cost / Landing Page View',
    COST_PER_LINK_CLICK:'Cost / Link Click',
    CTR:'CTR',
    LINK_CTR:'Link CTR',
    CVR_LPV_TO_REG:'CVR LPV → Register',
    FREQUENCY:'Frequency',
    CPC:'CPC',
    CPM:'CPM',
    RESULTS:'จำนวนผลลัพธ์',
    COMPLETE_REGISTER:'Complete Register',
    LANDING_PAGE_VIEWS:'Landing Page Views',
    SPEND:'Spend',
    GOOGLE_CPA:'Google Ads CPA',
    GOOGLE_CONVERSIONS:'Google Ads Conversions',
    TREND:'Trend 7D'
  });

  const statusLabel = (value) => STATUS_LABELS[upper(value)] || clean(value).replace(/_/g,' ') || '-';
  const actionTypeLabel = (value) => ACTION_TYPE_LABELS[upper(value)] || clean(value).replace(/_/g,' ') || '-';
  const metricLabel = (value) => METRIC_LABELS[upper(value)] || clean(value).replace(/_/g,' ') || '-';
  const hasValue = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(String(value).replace(/,/g,'')));
  const toNumber = (value) => hasValue(value) ? Number(String(value).replace(/,/g,'')) : null;

  const COST_METRICS = new Set([
    'COST_PER_COMPLETE_REGISTER','COST_PER_REGISTER','COST_PER_ENGAGEMENT','COST_PER_RESULT',
    'COST_PER_LPV','COST_PER_LANDING_PAGE_VIEW','COST_PER_LINK_CLICK','CPC','CPM','GOOGLE_CPA'
  ]);
  const HIGHER_IS_BETTER_METRICS = new Set(['CTR','LINK_CTR','CVR_LPV_TO_REG','GOOGLE_CONVERSIONS','RESULTS','COMPLETE_REGISTER','LANDING_PAGE_VIEWS']);

  function metricDirection(metric, explicit){
    const direct=upper(explicit);
    if(direct==='HIGHER_IS_BETTER'||direct==='LOWER_IS_BETTER')return direct;
    const key=upper(metric);
    if(HIGHER_IS_BETTER_METRICS.has(key))return 'HIGHER_IS_BETTER';
    return 'LOWER_IS_BETTER';
  }

  function directionLabel(metric, explicit){
    const direct=upper(explicit);
    if(direct==='SIGNAL_ONLY')return 'Signal สำหรับระบุปัญหา — ไม่ใช้เป็น KPI วัด Outcome';
    return metricDirection(metric,explicit)==='HIGHER_IS_BETTER'?'↑ KPI นี้ยิ่งสูงยิ่งดี':'↓ KPI นี้ยิ่งต่ำยิ่งดี';
  }

  function formatMetricValue(metric,value){
    if(!hasValue(value))return '-';
    const key=upper(metric),n=toNumber(value);
    if(COST_METRICS.has(key))return money(n);
    if(key==='CTR'||key==='LINK_CTR'||key==='CVR_LPV_TO_REG')return `${num(n*100,2)}%`;
    if(key==='GOOGLE_CONVERSIONS'||key==='RESULTS'||key==='COMPLETE_REGISTER'||key==='LANDING_PAGE_VIEWS')return num(n,0);
    return num(n,2);
  }

  const ISSUE_TITLES = Object.freeze({
    HIGH_COST_PER_REGISTER:'ต้นทุนต่อการลงทะเบียนสูงกว่าระดับที่ควรเป็น',
    HIGH_COST_PER_COMPLETE_REGISTER:'ต้นทุนต่อการลงทะเบียนสูงกว่าระดับที่ควรเป็น',
    HIGH_COST_PER_ENGAGEMENT:'ต้นทุนต่อ Engagement สูงกว่าระดับที่ควรเป็น',
    HIGH_COST_PER_LPV:'ต้นทุนต่อ Landing Page View สูงกว่าระดับที่ควรเป็น',
    HIGH_CPM:'ต้นทุนต่อ 1,000 Impressions สูงกว่าระดับที่ควรเป็น',
    HIGH_FREQUENCY:'Frequency สูง ควรตรวจความถี่ในการเห็นโฆษณา',
    LOW_CTR:'CTR ต่ำกว่าระดับที่ควรเป็น',
    LOW_CVR:'CVR จาก Landing Page View → Register ต่ำกว่าระดับที่ควรเป็น',
    LOW_CVR_LPV_TO_REG:'CVR จาก Landing Page View → Register ต่ำกว่าระดับที่ควรเป็น',
    NEGATIVE_TREND:'แนวโน้ม Performance แย่ลงต่อเนื่อง',
    GOOGLE_CPA_WORSENING:'Google Ads CPA 7 วันล่าสุดสูงขึ้น',
    GOOGLE_NO_CONVERSION_7D:'มี Spend แต่ไม่เกิด Google Ads Conversions ใน 7 วันล่าสุด',
    GOOGLE_SCALE_SIGNAL:'พบ Campaign ที่มีสัญญาณพร้อมพิจารณา Scale'
  });

  function issueTitle(row){
    const type=upper(row?.Issue_Type);
    if(ISSUE_TITLES[type])return ISSUE_TITLES[type];
    if(type.includes('TREND'))return 'แนวโน้ม Performance แย่ลงต่อเนื่อง';
    if(type.includes('FREQUENCY'))return 'Frequency สูง ควรตรวจความถี่ในการเห็นโฆษณา';
    if(type.includes('CTR'))return 'CTR ต่ำกว่าระดับที่ควรเป็น';
    if(type.includes('ENGAGEMENT')&&type.includes('COST'))return 'ต้นทุนต่อ Engagement สูงกว่าระดับที่ควรเป็น';
    if(type.includes('LPV')&&type.includes('COST'))return 'ต้นทุนต่อ Landing Page View สูงกว่าระดับที่ควรเป็น';
    if((type.includes('REGISTER')||type.includes('CPA'))&&type.includes('COST'))return 'ต้นทุนต่อการลงทะเบียนสูงกว่าระดับที่ควรเป็น';
    if(type.includes('GOOGLE')&&type.includes('CPA'))return 'Google Ads CPA สูงขึ้นเมื่อเทียบช่วงก่อนหน้า';
    return row?.Issue_Status==='OPPORTUNITY'?'โอกาสที่ระบบพบและควรพิจารณา':'Performance มีสัญญาณที่ควรตรวจสอบ';
  }

  function issueSnapshot(row){
    const metric=clean(row?.Issue_Snapshot_Metric);
    const value=hasValue(row?.Issue_Snapshot_Value)?toNumber(row.Issue_Snapshot_Value):null;
    const date=clean(row?.Issue_Snapshot_Date);
    const status=upper(row?.Issue_Snapshot_Status||row?.Issue_Status);
    const direction=upper(row?.Issue_Snapshot_Direction);
    const compareLabel=clean(row?.Issue_Snapshot_Compare_Label);
    const compareValue=hasValue(row?.Issue_Snapshot_Compare_Value)?toNumber(row.Issue_Snapshot_Compare_Value):null;
    const reason=clean(row?.Issue_Snapshot_Reason);
    return {metric,value,date,status,direction,compareLabel,compareValue,reason,available:!!(metric&&date&&value!==null)};
  }

  function compareValueText(snapshot){
    if(snapshot.compareValue===null)return '-';
    if(upper(snapshot.compareLabel)==='P25')return formatMetricValue(snapshot.metric,snapshot.compareValue);
    if(upper(snapshot.metric)==='TREND')return num(snapshot.compareValue,2);
    return formatMetricValue(snapshot.metric,snapshot.compareValue);
  }

  function issueSnapshotPanel(row){
    const snap=issueSnapshot(row);
    if(!snap.available){
      return `<section class="issue-snapshot-card is-legacy"><div class="issue-snapshot-head"><div><span class="eyebrow">ค่าปัญหา ณ วันที่ระบบแจ้ง</span><h4>ไม่มี Snapshot จากระบบรุ่นเดิม</h4></div><span class="issue-badge watch">Legacy Data</span></div><p class="issue-snapshot-note">Action นี้ถูกสร้างก่อนเพิ่ม Issue Snapshot จึงไม่แสดงตัวเลขย้อนหลังโดยการเดาหรือคำนวณแทนข้อมูลที่ไม่ได้ถูกเก็บไว้</p></section>`;
    }
    const metricText=metricLabel(snap.metric);
    const valueText=formatMetricValue(snap.metric,snap.value);
    const compareText=snap.compareLabel&&snap.compareValue!==null?compareValueText(snap):'';
    let relation='';
    if(snap.compareLabel&&snap.compareValue!==null){
      if(upper(snap.compareLabel)==='P25'){
        relation=`${valueText} ${snap.value<snap.compareValue?'&lt;':snap.value>snap.compareValue?'&gt;':'='} ${compareText}`;
      }else{
        relation=`${metricText} ${valueText} · ${esc(snap.compareLabel)} ${esc(compareText)}`;
      }
    }
    return `<section class="issue-snapshot-card is-${statusClass(snap.status)}">
      <div class="issue-snapshot-head">
        <div><span class="eyebrow">ค่าที่ระบบตรวจพบ • ${dateText(snap.date)}</span><h4>${esc(metricText)} <strong>${esc(valueText)}</strong></h4></div>
        <span class="issue-badge ${statusClass(snap.status)}">${esc(statusLabel(snap.status))}</span>
      </div>
      <div class="issue-snapshot-grid">
        <div><span>ค่าปัญหา ณ วันที่แจ้ง</span><strong>${esc(valueText)}</strong><small>${esc(directionLabel(snap.metric,snap.direction))}</small></div>
        ${snap.compareLabel?`<div><span>เกณฑ์ / ค่าเทียบ</span><strong>${esc(snap.compareLabel)}${compareText?` ${esc(compareText)}`:''}</strong>${relation?`<small>${relation}</small>`:''}</div>`:''}
      </div>
      ${snap.reason?`<div class="issue-snapshot-reason"><strong>เหตุผลจากระบบ ณ วันนั้น</strong><p>${esc(snap.reason)}</p></div>`:''}
    </section>`;
  }

  function currentDecisionMetricPanel(row){
    const metric=clean(row?.Status_Driver_Metric||row?.Issue_Metric);
    const value=hasValue(row?.Status_Driver_Value)?toNumber(row.Status_Driver_Value):null;
    if(!metric||value===null)return '';
    const direction=metricDirection(metric,row?.Metric_Direction);
    return `<div class="decision-current-metric"><span>ค่าที่ทำให้ระบบแจ้ง</span><strong>${esc(metricLabel(metric))} ${esc(formatMetricValue(metric,value))}</strong><small>${esc(directionLabel(metric,direction))}</small></div>`;
  }

  function isLegacyTrend(row){
    return upper(row?.Baseline_Metric)==='TREND'||(upper(row?.Issue_Type)==='NEGATIVE_TREND'&&upper(row?.Baseline_Metric)==='TREND');
  }

  function outcomeExplanation(metric,direction,status,change){
    const label=metricLabel(metric),dir=metricDirection(metric,direction),s=upper(status),n=toNumber(change);
    if(s==='INCONCLUSIVE')return `ยังมีข้อมูลไม่เพียงพอที่จะสรุปผลของ ${label}`;
    if(s==='PENDING')return `กำลังรอข้อมูลเพื่อประเมิน ${label}`;
    const movement=n===null?'':`${n>0?'เพิ่มขึ้น':n<0?'ลดลง':'เปลี่ยนแปลง'} ${num(Math.abs(n),2)}%`;
    const why=dir==='HIGHER_IS_BETTER'?'KPI นี้ยิ่งสูงยิ่งดี':'KPI นี้ยิ่งต่ำยิ่งดี';
    if(s==='IMPROVED')return `${label}${movement?` ${movement}`:''} → ดีขึ้น เพราะ${why}`;
    if(s==='WORSE')return `${label}${movement?` ${movement}`:''} → แย่ลง เพราะ${why}`;
    if(s==='STABLE')return `${label}${movement?` ${movement}`:''} → ยังใกล้เคียงเดิม (${why})`;
    return `${label} • ${why}`;
  }

  function statusClass(value){const v=upper(value);if(v==='CRITICAL'||v==='WORSE')return 'critical';if(v==='WATCH'||v==='PENDING'||v==='INCONCLUSIVE')return 'watch';if(v==='IMPROVED')return 'improved';if(v==='STABLE')return 'stable';return v.toLowerCase().replace(/_/g,'-');}
  function changeLabel(status, change){
    const v=upper(status), n=toNumber(change);
    if(v==='INCONCLUSIVE')return 'ยังสรุปไม่ได้';
    if(v==='PENDING')return 'รอผล';
    if(n===null)return statusLabel(v);
    const pct=num(Math.abs(n),2);
    if(v==='IMPROVED')return `ดีขึ้น ${pct}%`;
    if(v==='WORSE')return `แย่ลง ${pct}%`;
    if(v==='STABLE')return `เปลี่ยนแปลง ${pct}%`;
    return `${statusLabel(v)} ${num(n,2)}%`;
  }

  function parseReviewReason(reason, day){
    const text=clean(reason);
    const valueMatch=new RegExp(`(?:→|->)\\s*${day}D\\s*(-?[\\d,.]+)`,'i').exec(text);
    const spendMatch=/\|\s*Spend\s*(-?[\d,.]+)/i.exec(text);
    const resultMatch=/\|\s*Results\s*(-?[\d,.]+)/i.exec(text);
    return {
      value:valueMatch?toNumber(valueMatch[1]):null,
      spend:spendMatch?toNumber(spendMatch[1]):null,
      results:resultMatch?toNumber(resultMatch[1]):null
    };
  }

  function reviewData(row, day){
    const reason=clean(row[`Review_${day}D_Reason`]);
    const parsed=parseReviewReason(reason,day);
    const directValue=row[`Review_${day}D_Value`];
    return {
      day,
      date:row[`Review_${day}D_Date`],
      value:hasValue(directValue)?toNumber(directValue):parsed.value,
      change:hasValue(row[`Review_${day}D_Change_Pct`])?toNumber(row[`Review_${day}D_Change_Pct`]):null,
      status:upper(row[`Review_${day}D_Status`]||'PENDING'),
      reason,
      spend:parsed.spend,
      results:parsed.results
    };
  }

  function similarCases(cases){if(!Array.isArray(cases)||!cases.length)return '';return `<details class="similar-box"><summary>🧠 เคสใกล้เคียง ${cases.length} เคส</summary><div class="similar-list">${cases.map(c=>`<div class="similar-case"><strong>${esc(actionTypeLabel(c.Action_Type))} · ${esc(statusLabel(c.Outcome_Status))}</strong><span>${esc(c.Action_Detail||'-')}</span><br/>ผล 7 วัน: ${esc(c.Baseline_Value)} → ${esc(c.Review_7D_Value)} (${esc(changeLabel(c.Outcome_Status,c.Review_7D_Change_Pct))})</div>`).join('')}</div></details>`;}

  function decisionCard(row){
    const status=upper(row.Issue_Status),active=row.has_active_action===true;
    const platform=upper(row.Platform||'META');
    const priority=row.Priority_Score!==null&&row.Priority_Score!==undefined&&row.Priority_Score!==''?`<span class="issue-badge watch">ลำดับความสำคัญ ${num(row.Priority_Score)}</span>`:'';
    const context=[row.Game_Name||row.Game_ID,row.Account_Name||row.Account_ID,row.Objective,row.Phase].filter(Boolean).join(' · ');
    const problemTitle=issueTitle(row);
    const heading=status==='OPPORTUNITY'?'💡 โอกาสที่ระบบพบ':'⚠️ ปัญหาที่ระบบพบ';
    return `<article class="decision-card is-${status.toLowerCase()}">
      <div class="decision-head">
        <div class="decision-title"><h3>${esc(row.Entity_Name||'-')}</h3><p>${esc(context)}</p></div>
        <div class="badge-row"><span class="issue-badge">${esc(platform)}</span><span class="issue-badge ${statusClass(status)}">${esc(statusLabel(status))}</span>${priority}${active?'<span class="action-status">มี Action แล้ว</span>':''}</div>
      </div>
      <div class="problem-panel">
        <span class="problem-eyebrow">${heading}</span>
        <strong class="problem-title">${esc(problemTitle)}</strong>
        <div class="problem-evidence"><span>รายละเอียดที่ตรวจพบ</span><p>${esc(row.Issue_Reason||'-')}</p></div>
        ${currentDecisionMetricPanel(row)}
      </div>
      <div class="decision-recommendation"><strong>${platform==='GOOGLE'?'คำแนะนำจาก Google Intelligence':'คำแนะนำจาก AI'}</strong>${esc(row.AI_Recommendation||'-')}</div>
      ${similarCases(row.similar_cases)}
      <div class="decision-actions"><button class="button-primary" data-record="${esc(row.Decision_Key)}" ${(!row.can_manage||active)?'disabled':''} type="button">${active?'บันทึกแล้ว':'บันทึก Action'}</button><button class="button-danger-ghost" data-dismiss="${esc(row.Decision_Key)}" ${(!row.can_manage||active)?'disabled':''} type="button">ไม่ดำเนินการ</button></div>
    </article>`;
  }

  function checkpoint(label,metric,direction,review,legacy=false){
    const ready=clean(review.date)!=='';
    if(legacy&&ready){
      return `<div class="checkpoint is-watch"><div class="checkpoint-label">${esc(label)}</div><div class="checkpoint-date">${dateText(review.date)}</div><div class="legacy-metric-note"><strong>ข้อมูล Legacy</strong><span>Action นี้ถูกสร้างก่อนระบบเปลี่ยนจาก Trend เป็น KPI จริง จึงไม่ใช้ตัวเลขเดิมเพื่อสรุปผล</span></div></div>`;
    }
    const valueText=formatMetricValue(metric,review.value);
    const explain=ready?outcomeExplanation(metric,direction,review.status,review.change):'';
    return `<div class="checkpoint is-${statusClass(review.status)}">
      <div class="checkpoint-label">${esc(label)}</div>
      ${ready?`
        <div class="checkpoint-date">${dateText(review.date)}</div>
        <div class="checkpoint-value"><span>${esc(metricLabel(metric))}</span><strong>${esc(valueText)}</strong></div>
        <span class="outcome-badge ${statusClass(review.status)}">${esc(changeLabel(review.status,review.change))}</span>
        <p class="checkpoint-explanation">${esc(explain)}</p>
      `:'<div class="checkpoint-waiting">รอครบกำหนดประเมิน</div>'}
    </div>`;
  }

  function outcomeNote(reason){
    const text=clean(reason);
    const marker='เป็นผลลัพธ์ที่เกิดหลัง Action';
    const idx=text.indexOf(marker);
    if(idx>=0)return text.slice(idx);
    const parts=text.split(/\.\s+/).filter(Boolean);
    return parts.length>1?parts.slice(1).join('. '):'ผลลัพธ์นี้เกิดหลัง Action แต่ยังควรพิจารณาปัจจัยอื่นร่วมด้วยก่อนสรุปเหตุและผล';
  }

  function outcomeSummary(row){
    const outcome=upper(row.Outcome_Status||'PENDING');
    if(outcome==='PENDING')return `<section class="outcome-summary is-pending"><div class="outcome-summary-head"><div><span class="eyebrow">สรุปผลหลังทำ Action</span><h4>กำลังรอข้อมูล</h4></div><span class="outcome-badge pending">รอผล</span></div><p class="outcome-pending-text">ระบบจะสรุปผลเมื่อมีข้อมูลครบตามรอบ 1 / 3 / 7 วัน</p></section>`;

    const review7=reviewData(row,7);
    const legacy=isLegacyTrend(row);
    if(legacy){
      return `<section class="outcome-summary is-watch"><div class="outcome-summary-head"><div><span class="eyebrow">สรุปผล Action เก่า</span><h4>ไม่ใช้ค่า Trend เดิมเพื่อสรุป KPI</h4></div><span class="outcome-badge watch">Legacy Data</span></div><div class="legacy-outcome-warning"><strong>เหตุผล</strong><p>Action นี้ถูกบันทึกก่อนปรับระบบ Outcome ให้ติดตาม KPI จริงตาม Objective ตัวเลข Trend เดิมจึงไม่ควรตีความว่าเป็นต้นทุนหรือ Performance KPI หลัง Action</p></div></section>`;
    }

    const baseline=hasValue(row.Baseline_Value)?toNumber(row.Baseline_Value):null;
    const metric=row.Baseline_Metric;
    const metricText=metricLabel(metric);
    const direction=metricDirection(metric,row.Metric_Direction);
    const resultText=outcome==='IMPROVED'?'ผลหลัง Action ดีขึ้นเมื่อเทียบกับช่วงก่อนทำ':outcome==='WORSE'?'ผลหลัง Action แย่ลงเมื่อเทียบกับช่วงก่อนทำ':outcome==='STABLE'?'ผลหลัง Action ใกล้เคียงกับช่วงก่อนทำ':'ข้อมูลช่วงหลัง Action ยังไม่เพียงพอสำหรับสรุปว่าดีขึ้นหรือแย่ลง';
    const spendText=review7.spend!==null?money(review7.spend):'-';
    const resultsText=review7.results!==null?num(review7.results):'-';
    const explain=outcomeExplanation(metric,direction,outcome,review7.change);
    return `<section class="outcome-summary is-${statusClass(outcome)}">
      <div class="outcome-summary-head"><div><span class="eyebrow">สรุปผลหลังทำ Action</span><h4>${esc(resultText)}</h4></div><span class="outcome-badge ${statusClass(outcome)}">${esc(statusLabel(outcome))}</span></div>
      <div class="outcome-result-grid">
        <div class="outcome-result-item"><span>KPI ที่ใช้วัด</span><strong>${esc(metricText)}</strong><small>${esc(directionLabel(metric,direction))}</small></div>
        <div class="outcome-result-item"><span>ก่อนทำ → หลัง 7 วัน</span><strong>${esc(formatMetricValue(metric,baseline))} → ${esc(formatMetricValue(metric,review7.value))}</strong></div>
        <div class="outcome-result-item"><span>การเปลี่ยนแปลง</span><strong>${esc(changeLabel(outcome,review7.change))}</strong><small>${esc(explain)}</small></div>
        <div class="outcome-result-item"><span>ข้อมูลช่วง 7 วัน</span><strong>Spend ${spendText} · Results ${resultsText}</strong></div>
      </div>
      <div class="outcome-interpretation"><strong>ข้อควรเข้าใจ</strong><p>${esc(outcomeNote(row.Outcome_Reason))}</p></div>
    </section>`;
  }

  function actionCard(row){
    const status=upper(row.Action_Status),outcome=upper(row.Outcome_Status||'PENDING');
    const platform=upper(row.Platform||(upper(row.Action_Source).startsWith('GOOGLE')?'GOOGLE':'META'));
    const review1=reviewData(row,1),review3=reviewData(row,3),review7=reviewData(row,7);
    const isClosed=status==='CLOSED';
    const legacy=isLegacyTrend(row);
    const metric=row.Baseline_Metric||row.Issue_Metric;
    const direction=metricDirection(metric,row.Metric_Direction);
    const problemTitle=issueTitle(row);
    const actionButtons=[
      ...(['PLANNED'].includes(status)?[`<button class="button-primary" data-update="${esc(row.Action_ID)}" data-status="IN_PROGRESS" type="button">เริ่มดำเนินการ</button>`]:[]),
      ...(['OUTCOME_READY'].includes(status)?[`<button class="button-primary" data-update="${esc(row.Action_ID)}" data-status="CLOSED" type="button">ตรวจผลแล้วและปิด Action</button>`]:[]),
      ...(!['CLOSED','CANCELLED','DISMISSED'].includes(status)?[`<button class="button-secondary" data-update="${esc(row.Action_ID)}" data-status="CANCELLED" type="button">ยกเลิก Action</button>`]:[])
    ].join('');
    const dropdownLabel=isClosed?'ดูรายละเอียด Action ที่ปิดแล้ว':'ดูรายละเอียดและผลลัพธ์';
    return `<article class="action-card${isClosed?' is-closed':''}">
      <div class="action-head">
        <div class="action-title">
          <h3>${esc(row.Entity_Name||'-')}</h3>
          <p>${esc(actionTypeLabel(row.Action_Type))} · ผู้รับผิดชอบ: ${esc(row.Owner||'-')} · เริ่ม ${dateText(row.Action_Date)}</p>
        </div>
        <div class="badge-row">
          <span class="issue-badge">${esc(platform)}</span>
          <span class="action-status ${statusClass(status)}">${esc(statusLabel(status))}</span>
          <span class="outcome-badge ${statusClass(outcome)}">${esc(statusLabel(outcome))}</span>
        </div>
      </div>
      <details class="action-details">
        <summary>
          <span>${esc(dropdownLabel)}</span>
          <span class="action-details-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="action-details-body">
          <div class="problem-panel action-problem-panel">
            <span class="problem-eyebrow">⚠️ ปัญหาที่ Action นี้กำลังแก้</span>
            <strong class="problem-title">${esc(problemTitle)}</strong>
            <div class="problem-evidence"><span>เหตุผลที่ระบบตรวจพบ</span><p>${esc(row.Issue_Reason||'-')}</p></div>
          </div>
          ${issueSnapshotPanel(row)}
          <div class="action-context">
            <div class="action-context-main">
              <span>สิ่งที่ทีมดำเนินการ</span>
              <strong>${esc(row.Action_Detail||'-')}</strong>
            </div>
            <div class="baseline-grid">
              <div>
                <span>Baseline ก่อนเริ่ม Action • ${dateText(row.Baseline_Start_Date)}–${dateText(row.Baseline_End_Date)}</span>
                <strong>${esc(metricLabel(metric))} ${esc(formatMetricValue(metric,row.Baseline_Value))}</strong>
                <small>${legacy?'ข้อมูล Legacy — ไม่ใช้ Trend เดิมสรุป KPI':esc(directionLabel(metric,direction))}</small>
              </div>
              <div><span>ข้อมูลช่วง Baseline</span><strong>Spend ${money(row.Baseline_Spend||0)} · ${platform==='GOOGLE'?'Google Ads Conversions':'Results'} ${num(row.Baseline_Results||0)}</strong></div>
            </div>
          </div>
          <div class="checkpoint-section">
            <div class="section-label">ผลตามช่วงเวลาหลังทำ Action</div>
            <div class="action-progress">
              ${checkpoint('หลัง 1 วัน',metric,direction,review1,legacy)}
              ${checkpoint('หลัง 3 วัน',metric,direction,review3,legacy)}
              ${checkpoint('หลัง 7 วัน',metric,direction,review7,legacy)}
            </div>
          </div>
          ${outcomeSummary(row)}
          <div class="action-meta">
            <span>${esc(row.Game_Name||row.Game_ID)}</span>
            <span>${esc(row.Account_Name||row.Account_ID)}</span>
            <span>${esc(row.Objective)}</span>
            <span>${esc(row.Issue_Type)}</span>
          </div>
          ${actionButtons?`<div class="action-actions">${actionButtons}</div>`:''}
        </div>
      </details>
    </article>`;
  }

  function patternCard(row){return `<article class="pattern-card"><strong>${esc(actionTypeLabel(row.Action_Type))} · ${esc(row.Issue_Type)}</strong><span>${esc(row.Objective)} · ตัวอย่าง ${num(row.Sample_Size)} เคส</span><span>ผลดีขึ้น ${num(row.Improved_Count)} เคส · อัตราสำเร็จ ${num(row.Success_Rate_Pct,1)}%</span><span>การเปลี่ยนแปลงเฉลี่ย ${num(row.Average_Change_Pct,2)}%</span></article>`;}

  function filteredDecisions(){const q=upper($('searchFilter').value),g=$('gameFilter').value,a=$('accountFilter').value,s=upper($('statusFilter').value);return (state.data?.decisions||[]).filter(r=>(!q||upper(`${r.Entity_Name} ${r.Issue_Reason}`).includes(q))&&(!g||(r.Game_Name||r.Game_ID)===g)&&(!a||(r.Account_Name||r.Account_ID)===a)&&(!s||upper(r.Issue_Status)===s));}
  function actionMatchesFilters(r){const q=upper($('searchFilter').value),g=$('gameFilter').value,a=$('accountFilter').value,s=upper($('statusFilter').value);return (!q||upper(`${r.Entity_Name} ${r.Action_Detail}`).includes(q))&&(!g||(r.Game_Name||r.Game_ID)===g)&&(!a||(r.Account_Name||r.Account_ID)===a)&&(!s||upper(r.Action_Status)===s||upper(r.Outcome_Status)===s);}
  function filteredActions(){return (state.data?.actions||[]).filter(r=>upper(r.Action_Status)!=='CLOSED'&&actionMatchesFilters(r));}
  function filteredClosedActions(){return (state.data?.actions||[]).filter(r=>upper(r.Action_Status)==='CLOSED'&&actionMatchesFilters(r));}

  function render(){
    const d=state.data||{},summary=d.summary||{};
    $('needsActionCount').textContent=num(summary.needs_action);
    $('inProgressCount').textContent=num(summary.in_progress);
    $('outcomeReadyCount').textContent=num(summary.outcome_ready);
    $('improvedCount').textContent=num(summary.improved);
    $('totalActionCount').textContent=num(summary.total_actions);
    $('dataDateBadge').textContent=`Data: ${d.data_date||'-'}`;

    const decisions=filteredDecisions();
    const actions=filteredActions();
    const closedActions=filteredClosedActions();
    const patterns=d.learning_patterns||[];

    $('decisionResultBadge').textContent=`${num(decisions.length)} ปัญหา`;
    $('actionResultBadge').textContent=`${num(actions.length)} รายการ`;
    $('closedActionResultBadge').textContent=`${num(closedActions.length)} รายการ`;
    $('patternResultBadge').textContent=`${num(patterns.length)} รูปแบบ`;

    $('decisionList').innerHTML=decisions.length
      ?decisions.map(decisionCard).join('')
      :'<div class="empty-state">ไม่มีปัญหาที่ตรงกับตัวกรอง</div>';

    $('actionList').innerHTML=actions.length
      ?actions.map(actionCard).join('')
      :'<div class="empty-state">ไม่มี Action ที่กำลังติดตามหรือรอตรวจผล</div>';

    $('closedActionList').innerHTML=closedActions.length
      ?closedActions.map(actionCard).join('')
      :'<div class="empty-state">ยังไม่มี Action ที่ปิดแล้ว</div>';

    $('patternGrid').innerHTML=patterns.length
      ?patterns.map(patternCard).join('')
      :'<div class="empty-state">ยังไม่มี Action ที่ครบ Review 7 วันใน Source of Truth</div>';

    bindDynamic();
  }
  function bindDynamic(){document.querySelectorAll('[data-record]').forEach(b=>b.addEventListener('click',()=>selectDecision(b.dataset.record)));document.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',()=>dismissDecision(b.dataset.dismiss)));document.querySelectorAll('[data-update]').forEach(b=>b.addEventListener('click',()=>updateAction(b.dataset.update,b.dataset.status)));}
  function selectDecision(key){const row=(state.data?.decisions||[]).find(r=>r.Decision_Key===key);if(!row)return;state.selected=row;$('selectedIssue').innerHTML=`<strong>${esc(row.Entity_Name)}</strong><p><b>ปัญหาที่พบ:</b> ${esc(issueTitle(row))}<br/><span>${esc(row.Issue_Reason||'-')}</span></p>`;$('actionDate').value=todayBangkok();$('saveActionButton').disabled=!row.can_manage;$('actionMessage').textContent='';window.scrollTo({top:document.body.scrollHeight/4,behavior:'smooth'});}
  function clearSelection(){state.selected=null;$('selectedIssue').innerHTML='<strong>ยังไม่ได้เลือกปัญหา</strong><p>กด “บันทึก Action” จากรายการด้านซ้าย</p>';$('actionForm').reset();$('actionOwner').value=localStorage.getItem('display_name')||localStorage.getItem('username')||'';$('saveActionButton').disabled=true;$('actionMessage').textContent='';}
  function applyMutation(row){if(!row)return;const status=upper(row.Action_Status);let actions=[...(state.data.actions||[])].filter(x=>x.Action_ID!==row.Action_ID);if(!['CANCELLED','DISMISSED'].includes(status))actions.unshift(row);state.data.actions=actions;if(status==='DISMISSED'){state.data.decisions=(state.data.decisions||[]).filter(d=>d.Decision_Key!==row.Decision_Key);}else{const active=!['CANCELLED','CLOSED'].includes(status);state.data.decisions=(state.data.decisions||[]).map(d=>d.Decision_Key===row.Decision_Key?{...d,has_active_action:active}:d);}const s=state.data.summary||{};s.total_actions=actions.length;s.needs_action=(state.data.decisions||[]).filter(d=>!d.has_active_action).length;s.in_progress=actions.filter(a=>['IN_PROGRESS','PENDING_REVIEW'].includes(upper(a.Action_Status))).length;s.outcome_ready=actions.filter(a=>upper(a.Action_Status)==='OUTCOME_READY').length;s.improved=actions.filter(a=>upper(a.Outcome_Status)==='IMPROVED').length;state.data.summary=s;saveCache(state.data);render();}

  async function createAction(event){event.preventDefault();if(!state.selected)return;const btn=$('saveActionButton');btn.disabled=true;$('actionMessage').className='form-message';$('actionMessage').textContent='กำลังบันทึก Action และ Baseline...';try{const r=await request({action:'CREATE_ACTION',decision_key:state.selected.Decision_Key,game_id:state.selected.Game_ID,account_id:state.selected.Account_ID,platform:state.selected.Platform||'META',action_type:$('actionType').value,action_detail:$('actionDetail').value,action_date:$('actionDate').value,owner:$('actionOwner').value,expected_result:$('expectedResult').value,user_note:$('userNote').value});applyMutation(r.action);$('actionMessage').className='form-message success';$('actionMessage').textContent='บันทึก Action เรียบร้อย ระบบจะ Review ผลที่ 1 / 3 / 7 วัน';clearSelection();}catch(e){$('actionMessage').className='form-message error';$('actionMessage').textContent=e.message;btn.disabled=false;}}
  async function dismissDecision(key){const row=(state.data?.decisions||[]).find(d=>d.Decision_Key===key);if(!row||!confirm(`เลือกไม่ดำเนินการกับปัญหา “${row.Entity_Name}” ใช่หรือไม่?`))return;try{const r=await request({action:'DISMISS_DECISION',decision_key:key,game_id:row.Game_ID,account_id:row.Account_ID,platform:row.Platform||'META',dismiss_reason:'ทีมตรวจสอบแล้วและเลือกไม่ดำเนินการในรอบนี้'});applyMutation(r.action);}catch(e){alert(e.message)}}
  async function updateAction(id,status){
    const row=(state.data?.actions||[]).find(a=>a.Action_ID===id);
    if(!row){alert('ไม่พบ Action ที่ต้องการแก้ไข');return;}
    if(!confirm(`เปลี่ยนสถานะ Action เป็น “${statusLabel(status)}” ใช่หรือไม่?`))return;
    try{
      const r=await request({
        action:'UPDATE_ACTION',
        action_id:id,
        action_status:status,
        game_id:row.Game_ID||'',
        account_id:row.Account_ID||'',
        platform:row.Platform||((String(row.Action_Source||'').toUpperCase().startsWith('GOOGLE'))?'GOOGLE':'META')
      });
      applyMutation(r.action);
    }catch(e){alert(e.message)}
  }

  function setTab(tab){state.tab=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('decisionsView').classList.toggle('hidden',tab!=='decisions');$('actionsView').classList.toggle('hidden',tab!=='actions');$('closedActionsView').classList.toggle('hidden',tab!=='closed');$('learningView').classList.toggle('hidden',tab!=='learning');}
  async function load(refresh=false){
    if(state.loading)return;
    state.loading=true;
    const refreshButton=$('refreshButton');
    const previousButtonText=refreshButton?.textContent||'รีเฟรชข้อมูล';
    let cacheVisible=false;
    if(refresh){try{localStorage.removeItem(cacheKey());}catch{}}
    if(refreshButton){refreshButton.disabled=true;refreshButton.textContent=refresh?'กำลังรีเฟรช...':'กำลังอัปเดต...';}
    $('loadingMessage').textContent=refresh?'กำลังรีเฟรช Action Center...':'กำลังโหลด Action Center...';
    try{
      if(!refresh){
        const cached=readCache();
        if(cached?.data){
          state.data=cached.data;
          cacheVisible=true;
          $('cacheUpdatedAt').textContent=`Local cache: ${new Date(cached.saved_at).toLocaleString('th-TH')} · กำลังตรวจข้อมูลใหม่`;
          prepareFilters();render();setUser();showApp();
        }
      }
      const data=await request({action:'GET_ACTION_CENTER',cache_bust:Date.now()});
      if(!Array.isArray(data?.actions)||!Array.isArray(data?.decisions))throw new Error('Action API ส่งข้อมูลไม่ครบ');
      state.data=data;
      saveCache(data);
      const generatedAt=data.generated_at?new Date(data.generated_at):new Date();
      $('cacheUpdatedAt').textContent=`อัปเดตล่าสุด: ${generatedAt.toLocaleString('th-TH')} · ${num(data.action_row_count ?? data.actions.length)} Actions`;
      prepareFilters();render();setUser();showApp();
    }catch(e){
      if(cacheVisible||state.data){
        $('cacheUpdatedAt').textContent='แสดงข้อมูลจาก Local cache · รีเฟรช Backend ไม่สำเร็จ';
        console.error('Action Center background refresh failed:',e);
      }else{
        $('loadingMessage').textContent=e.message||'โหลด Action Center ไม่สำเร็จ';
      }
    }finally{
      state.loading=false;
      if(refreshButton){refreshButton.disabled=false;refreshButton.textContent=previousButtonText;}
    }
  }
  function prepareFilters(){const rows=[...(state.data?.decisions||[]),...(state.data?.actions||[])];uniqueOptions('gameFilter',rows,r=>clean(r.Game_Name||r.Game_ID));uniqueOptions('accountFilter',rows,r=>clean(r.Account_Name||r.Account_ID));}

  $('actionForm').addEventListener('submit',createAction);$('clearSelectionButton').addEventListener('click',clearSelection);$('refreshButton').addEventListener('click',()=>load(true));$('logoutButton').addEventListener('click',()=>window.Auth.redirectToLogin());$('resetFiltersButton').addEventListener('click',()=>{$('searchFilter').value='';$('gameFilter').value='';$('accountFilter').value='';$('statusFilter').value='';render();});['searchFilter','gameFilter','accountFilter','statusFilter'].forEach(id=>$(id).addEventListener(id==='searchFilter'?'input':'change',render));document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('actionDate').value=todayBangkok();setTab('decisions');load(false);
})();
