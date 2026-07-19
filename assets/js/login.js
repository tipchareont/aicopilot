'use strict';

const form = document.getElementById('loginForm');
const button = document.getElementById('loginButton');
const message = document.getElementById('loginMessage');

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

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
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

    console.info('[AI Marketing Copilot v4.2.0] Login saved session', {
      hasToken: Boolean(window.Auth.token()),
      expiresAt: window.Auth.expiry?.() || '',
    });

    if (!window.Auth.token()) {
      throw new Error('ระบบไม่สามารถบันทึก Session ได้');
    }

    show(
      `เข้าสู่ระบบสำเร็จ: ${
        result?.user?.display_name || result?.user?.username || username
      }`,
      'success'
    );

    location.replace('dashboard/index.html');
  } catch (error) {
    console.error('Login error:', error);
    show(error?.message || 'เชื่อมต่อระบบไม่ได้', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'เข้าสู่ระบบ';
  }
});
