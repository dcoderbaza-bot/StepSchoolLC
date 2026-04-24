import { api, setAuth, t, toast } from '../api.js';

export async function renderAuth() {
  try {
    const res = await api('/auth/status');
    if (!res.setup) return renderSetup();
    return renderLogin();
  } catch (e) {
    return `<div class="empty-state">Server xatosi: ${e.message}</div>`;
  }
}

function renderLogin() {
  return `
    <div class="login-box">
      <div class="login-logo">
        <h1>Step School</h1>
        <p>Boshqaruv tizimiga kirish</p>
      </div>
      <form onsubmit="window.handleLogin(event)">
        <div class="form-group">
          <label>${t('username')}</label>
          <input type="text" id="username" class="form-control" required autofocus>
        </div>
        <div class="form-group">
          <label>${t('password')}</label>
          <input type="password" id="password" class="form-control" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:0.8rem; font-size:1rem; margin-top:1rem;">
          ${t('login')}
        </button>
      </form>
    </div>
  `;
}

function renderSetup() {
  return `
    <div class="login-box">
      <div class="login-logo">
        <h1>${t('setup_title')}</h1>
        <p>${t('boss_setup')}</p>
      </div>
      <form onsubmit="window.handleSetup(event)">
        <div class="form-group">
          <label>${t('full_name')}</label>
          <input type="text" id="full_name" class="form-control" required autofocus>
        </div>
        <div class="form-group">
          <label>${t('username')}</label>
          <input type="text" id="username" class="form-control" required>
        </div>
        <div class="form-group">
          <label>${t('password')}</label>
          <input type="password" id="password" class="form-control" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:0.8rem; font-size:1rem; margin-top:1rem;">
          Tizimni ishga tushirish
        </button>
      </form>
    </div>
  `;
}

window.handleLogin = async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    setAuth(data);
    toast(t('welcome') + ', ' + data.user.full_name);
    window.location.hash = ''; // let router redirect based on role
    window.render();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.handleSetup = async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const full_name = document.getElementById('full_name').value;
  try {
    const data = await api('/auth/setup', { method: 'POST', body: { username, password, full_name } });
    setAuth(data);
    toast('Tizim muvaffaqiyatli sozlandi!');
    window.location.hash = '';
    window.render();
  } catch (err) {
    toast(err.message, 'error');
  }
};
