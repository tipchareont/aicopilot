'use strict';

window.Auth = (() => {
  const AUTH_KEYS = [
    'session_token',
    'session_id',
    'session_expires_at',
    'username',
    'display_name',
    'role',
  ];

  const LEGACY_AUTH_KEYS = [
    'token',
    'auth_token',
    'Session_ID',
    'sessionId',
    'expires_at',
    'Token_Expires_At',
    'token_expires_at',
    'Username',
    'displayName',
    'user_role',
  ];

  const firstStored = (keys) => {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
    return '';
  };

  const parseBangkokDateTime = (value) => {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    let normalized = raw.replace(' ', 'T');

    // Backend เก็บเวลาเป็น Asia/Bangkok แต่ไม่มี timezone suffix
    // จึงต้องเติม +07:00 ก่อน Parse เพื่อไม่ให้ Browser ตีความเป็นเวลาเครื่อง
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) {
      normalized += '+07:00';
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      normalized += 'T23:59:59+07:00';
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const clearDashboardCache = () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ai_marketing_copilot_dashboard_cache_')) {
        localStorage.removeItem(key);
      }
    }
  };

  const save = (result) => {
    const session = result?.session || {};
    const user = result?.user || {};

    const sessionToken = String(
      session.session_token || result?.Session_Token || ''
    ).trim();

    const sessionId = String(
      session.session_id || result?.Session_ID || ''
    ).trim();

    const expiresAt = String(
      session.expires_at || result?.Token_Expires_At || ''
    ).trim();

    if (!sessionToken) {
      throw new Error('Login สำเร็จแต่ไม่พบ Session Token');
    }

    localStorage.setItem('session_token', sessionToken);
    localStorage.setItem('session_id', sessionId);
    localStorage.setItem('session_expires_at', expiresAt);
    localStorage.setItem(
      'username',
      String(user.username || result?.Username || '').trim()
    );
    localStorage.setItem(
      'display_name',
      String(user.display_name || result?.Display_Name || '').trim()
    );
    localStorage.setItem(
      'role',
      String(user.role || result?.Role || 'USER').trim()
    );
  };

  const clear = () => {
    [...AUTH_KEYS, ...LEGACY_AUTH_KEYS].forEach((key) => {
      localStorage.removeItem(key);
    });
  };

  const token = () =>
    firstStored(['session_token', 'token', 'auth_token']);

  const expiry = () =>
    firstStored([
      'session_expires_at',
      'expires_at',
      'Token_Expires_At',
      'token_expires_at',
    ]);

  const isExpired = () => {
    const value = expiry();
    if (!value) return false;

    const parsed = parseBangkokDateTime(value);
    if (!parsed) return false;

    return parsed.getTime() <= Date.now();
  };

  const hasUsableSession = () => Boolean(token()) && !isExpired();

  const loginPath = () => {
    const path = location.pathname.replace(/\/+/g, '/');
    return /(\/dashboard\/|\/campaign\/|\/creative\/|\/ai-chat\/)/.test(path)
      ? '../index.html'
      : 'index.html';
  };

  const redirectToLogin = () => {
    clearDashboardCache();
    clear();
    location.replace(loginPath());
  };

  return {
    save,
    clear,
    token,
    expiry,
    isExpired,
    hasUsableSession,
    parseBangkokDateTime,
    clearDashboardCache,
    redirectToLogin,
  };
})();
