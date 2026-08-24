'use strict';

const form = document.getElementById('loginForm');
const button = document.getElementById('loginButton');
const message = document.getElementById('loginMessage');
const progress = document.getElementById('loginProgress');
const progressTitle = document.getElementById('loginProgressTitle');
const progressDetail = document.getElementById('loginProgressDetail');
const elapsed = document.getElementById('loginElapsed');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

let loginTimer = null;
let loginStartedAt = 0;

function formatElapsed(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function loginProgressMessage(seconds) {
  if (seconds < 10) {
    return {
      title: 'กำลังเชื่อมต่อระบบ',
      detail: 'กำลังส่งข้อมูลเข้าสู่ระบบอย่างปลอดภัย...',
    };
  }

  if (seconds < 30) {
    return {
      title: 'กำลังตรวจสอบบัญชี',
      detail: 'กำลังตรวจสอบ Username, Session และสถานะผู้ใช้งาน...',
    };
  }

  if (seconds < 75) {
    return {
      title: 'กำลังตรวจสอบสิทธิ์',
      detail: 'กำลังเตรียมสิทธิ์ Game / Account และข้อมูลสำหรับ Workspace...',
    };
  }

  if (seconds < 180) {
    return {
      title: 'ระบบยังทำงานอยู่',
      detail: 'การเตรียม Session และสิทธิ์อาจใช้เวลาสักครู่ กรุณารอโดยไม่ต้องกด Login ซ้ำ...',
    };
  }

  return {
    title: 'ระบบกำลังประมวลผลต่อเนื่อง',
    detail: 'ใช้เวลานานกว่าปกติ แต่คำขอยังทำงานอยู่ กรุณาอย่าปิดหรือรีเฟรชหน้านี้...',
  };
}

function updateLoginProgress() {
  if (!loginStartedAt) return;

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - loginStartedAt) / 1000)
  );

  const state = loginProgressMessage(seconds);

  elapsed.textContent = formatElapsed(seconds);
  progressTitle.textContent = state.title;
  progressDetail.textContent = state.detail;
}

function startLoginProgress() {
  loginStartedAt = Date.now();
  progress.classList.remove('hidden');
  usernameInput.disabled = true;
  passwordInput.disabled = true;
  updateLoginProgress();

  clearInterval(loginTimer);
  loginTimer = setInterval(updateLoginProgress, 1000);
}

function stopLoginProgress() {
  clearInterval(loginTimer);
  loginTimer = null;
  loginStartedAt = 0;
  progress.classList.add('hidden');
  usernameInput.disabled = false;
  passwordInput.disabled = false;
  elapsed.textContent = '00:00';
}

function show(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function normalizeApiResult(value) {
  let result = value;

  if (Array.isArray(result)) result = result[0];

  if (
    result &&
    typeof result === 'object' &&
    Object.keys(result).length === 1 &&
    typeof result.body === 'string'
  ) {
    try {
      result = JSON.parse(result.body);
    } catch {}
  }

  if (typeof result === 'string') {
    result = JSON.parse(result);
  }

  return result;
}

async function readJsonResponse(response) {
  const raw = await response.text();

  if (!raw.trim()) {
    throw new Error('Login API ไม่ได้ส่งข้อมูลกลับมา');
  }

  try {
    return normalizeApiResult(JSON.parse(raw));
  } catch {
    throw new Error('Login API ส่งข้อมูลที่อ่านไม่ได้');
  }
}

// หากมี Token ให้ Dashboard API เป็นผู้ตรวจ Session จริง
if (window.Auth?.token?.()) {
  location.replace('dashboard/index.html');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const url = window.APP_CONFIG?.LOGIN_URL;

  if (!username || !password) {
    show('กรุณากรอก Username และ Password', 'error');
    return;
  }

  if (!url || url.includes('PASTE_N8N')) {
    show('กรุณาใส่ Login Production URL ใน config.js', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'กำลังเข้าสู่ระบบ...';
  show('');
  startLoginProgress();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await readJsonResponse(response);

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Login ไม่สำเร็จ');
    }

    window.Auth.clearDashboardCache();
    window.Auth.save(result);

    console.info('[AI Marketing Copilot v5.7.2] Login saved session', {
      hasToken: Boolean(window.Auth.token()),
      expiresAt: window.Auth.expiry?.() || '',
    });

    if (!window.Auth.token()) {
      throw new Error('ระบบไม่สามารถบันทึก Session ได้');
    }

    progressTitle.textContent = 'เข้าสู่ระบบสำเร็จ';
    progressDetail.textContent = 'กำลังเปิด Dashboard...';

    show(
      `เข้าสู่ระบบสำเร็จ: ${
        result?.user?.display_name || result?.user?.username || username
      }`,
      'success'
    );

    location.replace('dashboard/index.html');
  } catch (error) {
    console.error('Login error:', error);
    stopLoginProgress();
    show(error?.message || 'เชื่อมต่อระบบไม่ได้', 'error');
    button.disabled = false;
    button.textContent = 'เข้าสู่ระบบ';
  }
});
