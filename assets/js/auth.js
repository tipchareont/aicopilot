'use strict';

window.Auth = (() => {
  const AUTH_KEYS = ['session_token','session_id','session_expires_at','username','display_name','role'];
  const LEGACY_AUTH_KEYS = ['token','auth_token','Session_ID','sessionId','expires_at','Token_Expires_At','token_expires_at','Username','displayName','user_role'];
  const PROTECTED_ROUTES = new Set(['dashboard','campaign','creative','creative-weekly','scale-advisor','ai-chat','workspace']);
  const WORKSPACE_CACHE_VERSION = 5;
  let redirectInProgress = false;
  const firstStored = (keys) => { for (const key of keys) { const value=localStorage.getItem(key); if(value)return value; } return ''; };
  const currentRoute = () => { const segments=location.pathname.replace(/\/+$/,'').split('/').filter(Boolean); return segments.at(-1)==='index.html'?(segments.at(-2)||''):(segments.at(-1)||''); };
  const isProtectedRoute = () => PROTECTED_ROUTES.has(currentRoute());
  const parseBangkokDateTime = (value) => { if(!value)return null;let normalized=String(value).trim().replace(' ','T');if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized))normalized+='+07:00';else if(/^\d{4}-\d{2}-\d{2}$/.test(normalized))normalized+='T23:59:59+07:00';const parsed=new Date(normalized);return Number.isNaN(parsed.getTime())?null:parsed; };
  const workspaceCacheKey = (username='') => `ai_marketing_copilot_workspace_cache_v5_${String(username||localStorage.getItem('username')||'user').trim().toLowerCase()}`;
  const clearDashboardCache = () => { for(const key of Object.keys(localStorage)){if(key.startsWith('ai_marketing_copilot_dashboard_cache_')||key.startsWith('ai_marketing_copilot_workspace_cache_'))localStorage.removeItem(key);} };
  const saveWorkspaceBootstrap = (bootstrap) => { if(!bootstrap||typeof bootstrap!=='object')return;try{localStorage.setItem(workspaceCacheKey(bootstrap?.profile?.username),JSON.stringify({cache_version:WORKSPACE_CACHE_VERSION,saved_at:Date.now(),data:bootstrap}));}catch{} };
  const workspaceBootstrap = () => { try{const parsed=JSON.parse(localStorage.getItem(workspaceCacheKey())||'null');return Number(parsed?.cache_version||0)===WORKSPACE_CACHE_VERSION?parsed.data:null;}catch{return null;} };
  const mergeWorkspaceBootstrap = (patch) => { const current=workspaceBootstrap()||{};const next={...current,...(patch||{})};saveWorkspaceBootstrap(next);return next; };
  const save = (result) => { const session=result?.session||{},user=result?.user||{};const sessionToken=String(session.session_token||result?.Session_Token||'').trim(),sessionId=String(session.session_id||result?.Session_ID||'').trim(),expiresAt=String(session.expires_at||result?.Token_Expires_At||'').trim();if(!sessionToken)throw new Error('Login สำเร็จแต่ไม่พบ Session Token');localStorage.setItem('session_token',sessionToken);localStorage.setItem('session_id',sessionId);localStorage.setItem('session_expires_at',expiresAt);localStorage.setItem('username',String(user.username||result?.Username||'').trim());localStorage.setItem('display_name',String(user.display_name||result?.Display_Name||'').trim());localStorage.setItem('role',String(user.role||result?.Role||'USER').trim());saveWorkspaceBootstrap(result?.bootstrap); };
  const clear = () => { [...AUTH_KEYS,...LEGACY_AUTH_KEYS].forEach(key=>localStorage.removeItem(key)); };
  const token = () => firstStored(['session_token','token','auth_token']);
  const expiry = () => firstStored(['session_expires_at','expires_at','Token_Expires_At','token_expires_at']);
  const isExpired = () => { const value=expiry();if(!value)return false;const parsed=parseBangkokDateTime(value);return parsed?parsed.getTime()<=Date.now():false; };
  const hasUsableSession = () => Boolean(token())&&!isExpired();
  const loginPath = () => isProtectedRoute()?'../index.html':'index.html';
  const redirectToLogin = () => { if(redirectInProgress)return;redirectInProgress=true;clearDashboardCache();clear();const target=new URL(loginPath(),location.href);if(target.href===location.href)target.pathname=target.pathname.replace(/\/[^/]+\/index\.html$/,'/index.html');location.replace(target.href); };
  const requireUsableSession = () => { if(!isProtectedRoute()||hasUsableSession())return true;redirectToLogin();return false; };
  return {save,clear,token,expiry,isExpired,hasUsableSession,parseBangkokDateTime,clearDashboardCache,workspaceCacheKey,saveWorkspaceBootstrap,workspaceBootstrap,mergeWorkspaceBootstrap,currentRoute,isProtectedRoute,requireUsableSession,redirectToLogin};
})();
window.Auth.requireUsableSession();
