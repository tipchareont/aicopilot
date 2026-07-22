'use strict';

(() => {
  const state = {
    overview: null,
    preview: null,
    activeRequestId: '',
    pollTimer: null,
    pollInFlight: false,
    pollFailures: 0,
    overviewLoading: false,
    overviewPromise: null,
    healthLoading: false,
    activityLoading: false,
    healthLoaded: false,
    activityLoaded: false,
    startingRepair: false,
    permissionsResolved: false,
    permissionError: '',
  };

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? '').trim();
  const escapeHtml = (value) => clean(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const VIEW_CONFIG = {
    profile:{title:'My Workspace',subtitle:'ข้อมูลผู้ใช้และสิทธิ์การเข้าถึงระบบ',primary:true},
    access:{title:'My Workspace',subtitle:'ข้อมูลผู้ใช้และสิทธิ์การเข้าถึงระบบ',primary:true},
    health:{title:'Data Health',subtitle:'ตรวจสอบช่วงข้อมูล วันที่ขาด และเวลาที่อัปเดตล่าสุด',primary:false},
    repair:{title:'Data Repair',subtitle:'สร้างคำขอ Backfill ภายใต้สิทธิ์ Game และ Account',primary:false},
    activity:{title:'Repair Activity',subtitle:'ติดตามประวัติคำขอและสถานะ Data Repair',primary:false},
    checking:{title:'กำลังตรวจสอบสิทธิ์',subtitle:'ระบบกำลังตรวจสอบสิทธิ์ของบัญชีนี้',primary:false},
    denied:{title:'ไม่มีสิทธิ์ใช้งาน',subtitle:'บัญชีนี้ไม่ได้รับสิทธิ์สำหรับฟีเจอร์ที่ร้องขอ',primary:false},
  };

  const PERMISSION_LEVELS = [
    {key:'VIEWER',label:'Viewer',scope:'เฉพาะ Game / Account ที่ได้รับมอบหมาย',view:true,health:true,repair:false,force:false},
    {key:'EDITOR',label:'Editor',scope:'เฉพาะ Game / Account ที่ได้รับมอบหมาย',view:true,health:true,repair:true,force:false},
    {key:'GAME_OWNER',label:'Game Owner',scope:'เฉพาะเกมและ Account ที่เป็นเจ้าของ',view:true,health:true,repair:true,force:false},
    {key:'MANAGER',label:'Manager',scope:'ทุก META Account ที่ Active',view:true,health:true,repair:true,force:true},
    {key:'DEVELOPER',label:'Developer',scope:'ทุก META Account ที่ Active',view:true,health:true,repair:true,force:true},
    {key:'ADMIN',label:'Admin',scope:'ทุก META Account ที่ Active',view:true,health:true,repair:true,force:true},
  ];

  const normalizePermissionLevel = (value) => {
    const upper=clean(value).toUpperCase();
    if (['OWNER','GAME OWNER'].includes(upper)) return 'GAME_OWNER';
    if (upper==='DEV') return 'DEVELOPER';
    return upper;
  };

  const formatDate = (value) => {
    const text=clean(value).slice(0,10); if(!text)return '-';
    const [y,m,d]=text.split('-'); return y&&m&&d?`${d}/${m}/${y}`:text;
  };
  const formatDateTime = (value) => {
    if(!value)return '-'; const parsed=window.Auth.parseBangkokDateTime(value)||new Date(value);
    if(Number.isNaN(parsed.getTime()))return clean(value);
    return new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}).format(parsed);
  };

  const WORKSPACE_CACHE_VERSION = 5;
  const cacheKey = () => `ai_marketing_copilot_workspace_cache_v5_${clean(localStorage.getItem('username')||'user').toLowerCase()}`;
  const readLocalCache = () => {
    try {
      const parsed=JSON.parse(localStorage.getItem(cacheKey())||'null');
      if(!parsed?.data||Number(parsed.cache_version||0)!==WORKSPACE_CACHE_VERSION)return null;
      return parsed.data;
    } catch { return null; }
  };
  const saveLocalCache = (data) => {
    try { localStorage.setItem(cacheKey(),JSON.stringify({cache_version:WORKSPACE_CACHE_VERSION,saved_at:Date.now(),data})); } catch {}
  };

  const request = async (payload) => {
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),45000);
    let response;
    try {
      response=await fetch(window.APP_CONFIG.USER_CONTROL_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:window.Auth.token(),...payload}),signal:controller.signal});
    } catch(error) {
      if(error?.name==='AbortError')throw new Error('API ใช้เวลาตอบนานเกิน 45 วินาที');
      throw error;
    } finally { clearTimeout(timeout); }
    let data=null; try{data=await response.json()}catch{}
    if(response.status===401){window.Auth.redirectToLogin();throw new Error('Session หมดอายุ')}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error(`User Control API ไม่คืนข้อมูลที่ถูกต้อง (${response.status})`);
    if(!response.ok||data.success===false)throw new Error(data.message||`User Control API Error (${response.status})`);
    return data;
  };


  const refreshSessionSnapshot = async () => {
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(window.APP_CONFIG.SESSION_VALIDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:window.Auth.token()}),signal:controller.signal});
      let data=null;try{data=await response.json()}catch{}
      if(response.status===401||!response.ok||data?.success===false){window.Auth.redirectToLogin();throw new Error(data?.message||'Session หมดอายุ')}
      if(!data?.bootstrap)throw new Error('Session Snapshot ไม่มี Bootstrap Data');
      window.Auth.saveWorkspaceBootstrap(data.bootstrap);
      return data.bootstrap;
    }catch(error){if(error?.name==='AbortError')throw new Error('Session API ใช้เวลาตอบนานเกิน 30 วินาที');throw error}finally{clearTimeout(timeout)}
  };

  const setStatusChip = (element,status) => {
    if(!element)return; const value=clean(status||'UNKNOWN').toUpperCase();
    element.textContent=value;element.className='status-chip';
    if(['HEALTHY','COMPLETED','SUCCESS','READY'].includes(value))element.classList.add('status-healthy');
    else if(['SYNCING','QUEUED','VALIDATING','BACKFILL_RUNNING','MIGRATION_RUNNING','SUMMARY_REBUILDING','RUNNING'].includes(value))element.classList.add('status-running');
    else if(['MISSING_DATA','STALE','PARTIAL'].includes(value))element.classList.add('status-warning');
    else if(['FAILED','REJECTED','ERROR'].includes(value))element.classList.add('status-failed');
    else element.classList.add('status-neutral');
  };

  const getAccess=()=>Array.isArray(state.overview?.access)?state.overview.access:[];
  const selectedAccess=(prefix)=>{const id=$(`${prefix}Account`)?.value||'';return getAccess().find(r=>clean(r.account_id)===clean(id))||null};

  const hasViewAccess=()=>getAccess().some(row=>row.permissions?.can_view===true);
  const hasRepairAccess=()=>getAccess().some(row=>row.permissions?.can_repair_missing===true||row.permissions?.can_force_refresh===true);
  const viewAllowed=(view)=>{
    if(['profile','access'].includes(view))return true;
    if(view==='health')return hasViewAccess();
    if(['repair','activity'].includes(view))return hasRepairAccess();
    return false;
  };
  const requestedFeatureLabel=(view)=>({health:'Data Health',repair:'Data Repair',activity:'Repair Activity'}[view]||'Data Management');
  const notifyPermissionUpdate=()=>window.dispatchEvent(new CustomEvent('workspace-permissions-updated',{detail:{access:getAccess(),role:state.overview?.profile?.role||localStorage.getItem('role')||''}}));

  const renderProfile = () => {
    const profile=state.overview?.profile||{};
    const display=profile.display_name||localStorage.getItem('display_name')||profile.username||localStorage.getItem('username')||'-';
    const role=profile.role||localStorage.getItem('role')||'-';
    $('displayName').textContent=display;$('role').textContent=role;
    $('welcomeTitle').textContent=`สวัสดี ${display}`;
    $('welcomeSubtitle').textContent=getAccess().length?`คุณเข้าถึง ${getAccess().length} Account และใช้สิทธิ์ระดับ ${role}`:(state.overview?.success===true?(state.overview?.access_message||'บัญชีนี้ยังไม่มี Game หรือ Account ที่ได้รับมอบหมาย'):'กำลังซิงก์ขอบเขต Game และ Account ล่าสุด');
    $('profileAvatar').textContent=clean(display||'U').charAt(0).toUpperCase();
    $('profileDisplayName').textContent=display;
    $('profileUsername').textContent=(profile.username||localStorage.getItem('username'))?`@${profile.username||localStorage.getItem('username')}`:'-';
    $('profileRoleBadge').textContent=role;
    $('profileUserId').textContent=profile.user_id||'-';
    $('profileStatus').textContent=profile.user_status||'ACTIVE';
    $('profileLastLogin').textContent=formatDateTime(profile.last_login_at);
    $('profileSessionExpiry').textContent=formatDateTime(profile.session_expires_at||localStorage.getItem('session_expires_at'));
  };

  const renderAccess = () => {
    const rows=getAccess(),profile=state.overview?.profile||{};
    const activeLevels=new Set([normalizePermissionLevel(profile.role||localStorage.getItem('role')),...rows.map(r=>normalizePermissionLevel(r.access_level))].filter(Boolean));
    const activeLabels=PERMISSION_LEVELS.filter(l=>activeLevels.has(l.key)).map(l=>l.label);
    $('currentPermissionBadge').textContent=activeLabels.length?`Active: ${activeLabels.join(' + ')}`:'กำลังซิงก์';
    $('permissionMatrixBody').innerHTML=PERMISSION_LEVELS.map(level=>{const current=activeLevels.has(level.key);const cell=a=>`<td class="permission-cell ${a?'yes':'no'}">${a?'✓':'—'}</td>`;return `<tr class="${current?'permission-current':'permission-muted'}"><td><span class="access-badge">${escapeHtml(level.label)}</span>${current?'<span class="permission-current-label">สิทธิ์ของคุณ</span>':''}</td><td class="permission-scope">${escapeHtml(level.scope)}</td>${cell(level.view)}${cell(level.health)}${cell(level.repair)}${cell(level.force)}</tr>`}).join('');
    $('accessCountBadge').textContent=`${rows.length} Account`;
    $('accessTableBody').innerHTML=rows.length?rows.map(row=>`<tr><td><strong>${escapeHtml(row.game_name||row.game_id)}</strong><br><small>${escapeHtml(row.game_id)}</small></td><td>${escapeHtml(row.account_name||row.account_id)}<br><small>${escapeHtml(row.account_id)}</small></td><td><span class="access-badge">${escapeHtml(row.access_level)}</span></td><td class="${row.permissions?.can_view?'permission-yes':'permission-no'}">${row.permissions?.can_view?'✓':'—'}</td><td class="${row.permissions?.can_repair_missing?'permission-yes':'permission-no'}">${row.permissions?.can_repair_missing?'✓':'—'}</td><td class="${row.permissions?.can_force_refresh?'permission-yes':'permission-no'}">${row.permissions?.can_force_refresh?'✓':'—'}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">กำลังซิงก์สิทธิ์ Game และ Account</td></tr>';
  };

  const populateAccessSelects = () => {
    const access=getAccess();
    ['health','repair'].forEach(prefix=>{
      const game=$(`${prefix}Game`),account=$(`${prefix}Account`); if(!game||!account)return;
      const currentGame=game.value; const games=[...new Map(access.map(r=>[r.game_id,r])).values()];
      if(!games.length){
        game.innerHTML='<option value="">ไม่มี Game ที่ได้รับสิทธิ์</option>';
        account.innerHTML='<option value="">ไม่มี Account ที่ได้รับสิทธิ์</option>';
        game.disabled=true;account.disabled=true;
        if(prefix==='health')renderHealth();else syncRepairPermissions();
        return;
      }
      game.disabled=false;account.disabled=false;
      game.innerHTML=games.map(r=>`<option value="${escapeHtml(r.game_id)}">${escapeHtml(r.game_name||r.game_id)}</option>`).join('');
      if(games.some(r=>r.game_id===currentGame))game.value=currentGame;
      const renderAccounts=()=>{
        const filtered=access.filter(r=>r.game_id===game.value),current=account.value;
        account.innerHTML=filtered.map(r=>`<option value="${escapeHtml(r.account_id)}">${escapeHtml(r.account_name||r.account_id)}</option>`).join('');
        if(filtered.some(r=>r.account_id===current))account.value=current;
        if(prefix==='health')renderHealth();else syncRepairPermissions();
      };
      game.onchange=renderAccounts;account.onchange=prefix==='health'?renderHealth:syncRepairPermissions;renderAccounts();
    });
  };

  const renderHealth = () => {
    const access=selectedAccess('health'),rows=Array.isArray(state.overview?.health)?state.overview.health:[],health=rows.find(r=>clean(r.account_id)===clean(access?.account_id))||{};
    $('healthFrom').textContent=formatDate(health.data_from);$('healthTo').textContent=formatDate(health.data_to);$('healthMissingCount').textContent=Number(health.missing_days_count||0).toLocaleString('th-TH');$('healthUpdatedAt').textContent=formatDateTime(health.last_updated_at);setStatusChip($('healthStatusBadge'),health.status||'UNKNOWN');
    const missing=Array.isArray(health.missing_dates)?health.missing_dates:[],zero=Array.isArray(health.verified_zero_dates)?health.verified_zero_dates:[];
    const chips=[...missing.map(d=>`<span class="date-chip missing">${formatDate(d)}</span>`),...zero.slice(-30).map(d=>`<span class="date-chip zero">Zero: ${formatDate(d)}</span>`)];
    $('missingDateList').innerHTML=chips.length?chips.join(''):'<span class="empty-inline">ไม่พบวันที่ขาดในช่วง Coverage ปัจจุบัน</span>';
  };

  const renderActivity = () => {
    const rows=Array.isArray(state.overview?.repair_requests)?state.overview.repair_requests:[];
    $('activityTableBody').innerHTML=rows.length?rows.map(row=>`<tr><td>${escapeHtml(formatDateTime(row.updated_at||row.started_at))}</td><td>${escapeHtml(row.request_mode||'DATA_REPAIR')}</td><td>DATA_REPAIR</td><td>${escapeHtml(row.request_id)}</td><td>${escapeHtml(`${row.status||'-'} · ${row.game_id||'-'} · ${row.start_date||'-'} ถึง ${row.end_date||'-'}`)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">ยังไม่มีคำขอ Data Repair</td></tr>';
  };

  const syncRepairPermissions=()=>{const access=selectedAccess('repair'),canForce=Boolean(access?.permissions?.can_force_refresh);$('forceRefreshRow').classList.toggle('hidden',!canForce);if(!canForce)$('forceRefresh').checked=false;$('reasonRow').classList.toggle('hidden',!$('forceRefresh').checked);state.preview=null;$('startRepairButton').disabled=true;setStatusChip($('previewStatusBadge'),'รอ Preview')};
  const renderPreview=(preview)=>{state.preview=preview;$('previewSelectedCount').textContent=preview.selected_dates_count||0;$('previewExistingCount').textContent=preview.existing_dates_count||0;$('previewZeroCount').textContent=preview.verified_zero_dates_count||0;$('previewRepairCount').textContent=preview.repair_dates_count||0;setStatusChip($('previewStatusBadge'),preview.allowed?'READY':'REJECTED');$('startRepairButton').disabled=!preview.allowed;const ranges=Array.isArray(preview.recommended_missing_ranges)?preview.recommended_missing_ranges:[];$('previewDetail').innerHTML=[`<p><strong>${escapeHtml(preview.message||'')}</strong></p>`,ranges.length?`<ul>${ranges.map(r=>`<li>${formatDate(r.start_date)} – ${formatDate(r.end_date)}</li>`).join('')}</ul>`:'',preview.force_refresh?'<p>คำขอนี้จะ Refresh วันที่ที่มีข้อมูลอยู่แล้ว และต้องมีเหตุผลประกอบ</p>':''].join('');$('repairMessage').textContent=preview.allowed?'ตรวจสอบผ่าน สามารถเริ่มซ่อมข้อมูลได้':(preview.message||'คำขอไม่ผ่านเงื่อนไข');$('repairMessage').className=`form-message ${preview.allowed?'success':'error'}`};

  const previewRepair=async()=>{if(!hasRepairAccess())throw new Error('บัญชีนี้ไม่มีสิทธิ์ใช้ Data Repair');const access=selectedAccess('repair'),start=$('repairStartDate').value,end=$('repairEndDate').value;if(!access||!start||!end)throw new Error('กรุณาเลือก Game, Account และช่วงวันที่');const result=await request({action:'PREVIEW_REPAIR',game_id:access.game_id,account_id:access.account_id,start_date:start,end_date:end,force_refresh:$('forceRefresh').checked,reason:$('repairReason').value});renderPreview(result.preview||result)};
  const startRepair=async()=>{if(state.startingRepair)return;if(!state.preview?.allowed)throw new Error('กรุณา Preview และแก้เงื่อนไขให้ผ่านก่อน');state.startingRepair=true;try{const access=selectedAccess('repair');const result=await request({action:'START_REPAIR',game_id:access.game_id,account_id:access.account_id,start_date:$('repairStartDate').value,end_date:$('repairEndDate').value,force_refresh:$('forceRefresh').checked,reason:$('repairReason').value});if(!result.request_id)throw new Error('Backend ไม่คืน Request ID');state.activeRequestId=result.request_id;localStorage.setItem('active_repair_request_id',result.request_id);$('repairProgressPanel').classList.remove('hidden');$('repairRequestId').textContent=result.request_id;updateRepairProgress(result.status||'QUEUED',result.message||'ระบบรับคำขอแล้ว');startPolling()}finally{state.startingRepair=false}};

  const updateRepairProgress=(status,message)=>{const upper=clean(status).toUpperCase(),map={QUEUED:10,VALIDATING:20,BACKFILL_RUNNING:45,MIGRATION_RUNNING:70,SUMMARY_REBUILDING:85,COMPLETED:100,FAILED:100,REJECTED:100};setStatusChip($('repairStatusBadge'),upper);$('repairProgressBar').style.width=`${map[upper]||15}%`;$('repairProgressMessage').textContent=message||upper};
  const stopPolling=()=>{clearTimeout(state.pollTimer);state.pollTimer=null;state.pollInFlight=false};
  const schedulePoll=(ms)=>{clearTimeout(state.pollTimer);state.pollTimer=setTimeout(runRepairPoll,ms)};
  const runRepairPoll=async()=>{if(!state.activeRequestId||state.pollInFlight)return;if(document.hidden){schedulePoll(30000);return}state.pollInFlight=true;try{const result=await request({action:'REPAIR_STATUS',request_id:state.activeRequestId}),repair=result?.repair_request;if(!repair||typeof repair!=='object')throw new Error('Backend ไม่คืนสถานะคำขอ');const status=clean(repair.status).toUpperCase();updateRepairProgress(status,repair.message||repair.error_message||`สถานะ: ${status}`);state.pollFailures=0;if(['COMPLETED','FAILED','REJECTED'].includes(status)){if(result.bootstrap_patch&&typeof result.bootstrap_patch==='object'){state.overview={...(state.overview||{}),...result.bootstrap_patch};saveLocalCache(state.overview);renderHealth();renderActivity();populateAccessSelects()}stopPolling();localStorage.removeItem('active_repair_request_id');state.activeRequestId='';return}schedulePoll(30000)}catch(error){state.pollFailures+=1;const delay=Math.min(30000*(2**Math.min(state.pollFailures,2)),120000);$('repairProgressMessage').textContent=`${error.message} · ระบบจะลองใหม่ใน ${Math.round(delay/1000)} วินาที`;if(state.pollFailures>=5){stopPolling();$('repairProgressMessage').textContent=`${error.message} · หยุดเช็กอัตโนมัติเพื่อป้องกัน API Limit งาน Backend อาจยังทำงานอยู่`;return}schedulePoll(delay)}finally{state.pollInFlight=false}};
  const startPolling=()=>{stopPolling();state.pollFailures=0;schedulePoll(5000)};

  const routeViewFromUrl=()=>{const requested=clean(new URLSearchParams(location.search).get('view')).toLowerCase();return VIEW_CONFIG[requested]?requested:'profile'};
  const setSectionLoading=(view,loading)=>document.querySelector(`[data-section="${view}"]`)?.classList.toggle('is-loading',loading);

  const loadOverview=async(force=false)=>{
    if(!force)return state.overview;
    if(state.overviewPromise)return state.overviewPromise;
    state.overviewLoading=true;$('refreshButton').disabled=true;setStatusChip($('systemStatus'),'SYNCING');
    state.overviewPromise=(async()=>{try{const result=await refreshSessionSnapshot();state.overview={...(state.overview||{}),...result};state.permissionsResolved=true;state.permissionError='';saveLocalCache(state.overview);renderProfile();renderAccess();populateAccessSelects();renderHealth();renderActivity();notifyPermissionUpdate();setStatusChip($('systemStatus'),result.system_status||'READY');return state.overview}catch(error){state.permissionError=error.message||'ไม่สามารถโหลด Session Snapshot ได้';setStatusChip($('systemStatus'),state.overview?'STALE':'ERROR');throw error}finally{state.overviewLoading=false;$('refreshButton').disabled=false}})();
    try{return await state.overviewPromise}finally{state.overviewPromise=null}
  };

  const loadHealth=async()=>{if(!hasViewAccess())throw new Error('บัญชีนี้ไม่มี Game หรือ Account ที่ได้รับสิทธิ์ดู Data Health');state.healthLoaded=true;populateAccessSelects();renderHealth()};
  const loadActivity=async()=>{if(!hasRepairAccess())throw new Error('บัญชีนี้ไม่มีสิทธิ์ดู Repair Activity');state.activityLoaded=true;renderActivity()};

  const ensureViewData=(view)=>{
    if(view==='health')loadHealth(false).catch(e=>{$('missingDateList').innerHTML=`<span class="empty-inline">${escapeHtml(e.message)}</span>`});
    if(view==='activity')loadActivity(false).catch(e=>{$('activityTableBody').innerHTML=`<tr><td colspan="5" class="empty">${escapeHtml(e.message)}</td></tr>`});
  };
  const activateView=(view,updateUrl=false)=>{
    const requested=VIEW_CONFIG[view]?view:'profile';
    const isProtected=['health','repair','activity'].includes(requested);
    let selected=requested;

    if(isProtected&&!state.permissionsResolved){
      selected='checking';
    }else if(isProtected&&!viewAllowed(requested)){
      selected='denied';
    }

    const config=VIEW_CONFIG[selected];
    document.querySelectorAll('.workspace-section').forEach(section=>section.classList.toggle('active',section.dataset.section===selected));
    document.querySelectorAll('.workspace-tab').forEach(button=>button.classList.toggle('active',button.dataset.tab===selected));
    $('workspaceHero').classList.toggle('hidden',!config.primary);
    $('workspacePrimaryTabs').classList.toggle('hidden',!config.primary);
    $('workspacePageTitle').textContent=config.title;
    $('workspacePageSubtitle').textContent=config.subtitle;

    if(selected==='denied'){
      const feature=requestedFeatureLabel(requested);
      if($('deniedFeatureName'))$('deniedFeatureName').textContent=feature;
      if($('deniedMessage'))$('deniedMessage').textContent=`บัญชีนี้ไม่มีสิทธิ์ใช้งาน ${feature} เมนูนี้จึงไม่แสดงใน Sidebar และระบบจะไม่เรียก API ของฟีเจอร์ดังกล่าว`;
    }

    if(selected==='checking'){
      if($('permissionCheckMessage'))$('permissionCheckMessage').textContent=state.permissionError||'กำลังตรวจสอบ Role, Game และ Account ของบัญชีนี้';
    }

    if(updateUrl&&['profile','access','health','repair','activity'].includes(requested)){
      const url=new URL(location.href);
      if(requested==='profile')url.searchParams.delete('view');
      else url.searchParams.set('view',requested);
      history.replaceState({view:requested},'',url);
    }

    if(['profile','access','health','repair','activity'].includes(selected))ensureViewData(selected);
  };

  const renderInstant=()=>{
    const cached=readLocalCache();
    state.permissionsResolved=Boolean(cached);
    state.overview=cached||{profile:{username:localStorage.getItem('username')||'',display_name:localStorage.getItem('display_name')||'',role:localStorage.getItem('role')||'',session_expires_at:localStorage.getItem('session_expires_at')||'',user_status:'ACTIVE'},access:[]};
    renderProfile();renderAccess();populateAccessSelects();notifyPermissionUpdate();
    $('loading').classList.add('hidden');$('shell').classList.remove('hidden');
  };

  const bindEvents=()=>{document.querySelectorAll('.workspace-tab').forEach(b=>b.addEventListener('click',()=>activateView(b.dataset.tab,true)));addEventListener('popstate',()=>activateView(routeViewFromUrl(),false));$('refreshButton').addEventListener('click',async()=>{try{await loadOverview(true)}catch(error){$('welcomeSubtitle').textContent=`โหลด Session Snapshot ไม่สำเร็จ: ${error.message}`}});$('logoutButton').addEventListener('click',()=>{fetch(window.APP_CONFIG.LOGOUT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_token:window.Auth.token()}),keepalive:true}).catch(()=>{});window.Auth.clearDashboardCache();window.Auth.clear();location.replace('../index.html')});$('backToWorkspaceButton')?.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.delete('view');history.replaceState({view:'profile'},'',url);activateView('profile',false)});$('forceRefresh').addEventListener('change',()=>{$('reasonRow').classList.toggle('hidden',!$('forceRefresh').checked);state.preview=null;$('startRepairButton').disabled=true});$('previewRepairButton').addEventListener('click',async()=>{try{$('repairMessage').textContent='กำลังตรวจสอบ Coverage...';$('repairMessage').className='form-message';await previewRepair()}catch(error){$('repairMessage').textContent=error.message;$('repairMessage').className='form-message error'}});$('startRepairButton').addEventListener('click',async()=>{try{$('startRepairButton').disabled=true;await startRepair()}catch(error){$('repairMessage').textContent=error.message;$('repairMessage').className='form-message error';$('startRepairButton').disabled=!state.preview?.allowed}})};

  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.activeRequestId&&!state.pollTimer&&!state.pollInFlight)schedulePoll(1000)});
  bindEvents();renderInstant();
  if(!state.permissionsResolved){window.Auth.redirectToLogin();return}
  activateView(routeViewFromUrl(),false);setStatusChip($('systemStatus'),state.overview?.system_status||'READY');
  const saved=clean(localStorage.getItem('active_repair_request_id'));if(saved&&!state.activeRequestId){state.activeRequestId=saved;$('repairProgressPanel').classList.remove('hidden');$('repairRequestId').textContent=saved;updateRepairProgress('RUNNING','กำลังตรวจสอบสถานะคำขอเดิม');startPolling()}
})();
