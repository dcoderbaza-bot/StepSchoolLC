// === UNIVERSAL ROBUST API HANDLER V8 ===
const DB_KEY = 'step_school_v8_db';
const IS_SERVER = window.location.protocol.startsWith('http');
const API_BASE = '/api';

// --- STANDALONE SIMULATION LOGIC ---
function initDB() {
  if (localStorage.getItem(DB_KEY)) return;
  const initialData = {
    users: [{ id: 1, full_name: 'Step School Boss', username: 'StepSchool', password: 'admin', role: 'boss', active: 1 }],
    groups: [{ id: 101, name: 'Elementary', level: 'A1', teacher_id: null, monthly_price: 470000, days: 'Du-Ch-Ju', time: '14:00', room: '1-xona', active: 1 }],
    group_students: [], payments: [], expenses: [], salaries: [], attendance: [], results: [],
    settings: { school_name: 'Step School', telegram: 'https://t.me/step_schooll', language: 'uz' }
  };
  localStorage.setItem(DB_KEY, JSON.stringify(initialData));
}
if (!IS_SERVER) initDB();

function getDB() {
  let db = JSON.parse(localStorage.getItem(DB_KEY)) || {};
  ['users', 'groups', 'group_students', 'payments', 'expenses', 'salaries', 'attendance', 'results', 'settings'].forEach(k => { if (!db[k]) db[k] = []; });
  return db;
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

// --- API CALL HANDLER ---
window.api = async (path, options = {}) => {
  if (IS_SERVER) {
    // REAL CLOUD BACKEND
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.token}` },
        body: options.body ? JSON.stringify(options.body) : null
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    } catch (err) {
      console.error('Remote API Error:', err);
      throw err;
    }
  } else {
    // LOCAL STANDALONE SIMULATION
    const db = getDB();
    const method = options.method || 'GET';
    const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null;
    await new Promise(r => setTimeout(r, 100));

    if (path === '/auth/status') return { setup: db.users.some(u => u.role === 'boss') };
    if (path === '/auth/login') {
      const user = db.users.find(u => u.username === body.username && u.password === body.password);
      if (!user) throw { error: 'Login yoki parol noto\'g\'ri!' };
      return { token: 'tk_'+user.id, user };
    }
    
    // Default return for simulation
    if (path.includes('/admin/teachers')) return db.users.filter(u => u.role !== 'student');
    if (path.includes('/admin/students')) return db.users.filter(u => u.role === 'student');
    if (path.includes('/admin/groups')) return db.groups;
    if (path.includes('/admin/reports')) return { income: 0, expense: 0, profit: 0, student_count: db.users.filter(u=>u.role==='student').length, teacher_count: 0, group_count: db.groups.length };
    
    return [];
  }
};

// --- UTILS ---
window.token = localStorage.getItem('token');
window.currentUser = JSON.parse(localStorage.getItem('user') || 'null');
window.lang = localStorage.getItem('lang') || 'uz';

window.T = {
  uz: { dashboard: '📊 Bosh sahifa', groups: '👥 Guruhlar', students: '👨‍🎓 O\'quvchilar', teachers: '👨‍🏫 O\'qituvchilar', payments: '💳 To\'lovlar', expenses: '📉 Xarajatlar', salaries: '💰 Oyliklar', settings: '⚙️ Sozlamalar', reports: '📈 Hisobotlar', welcome: 'Xush kelibsiz', logout: 'Chiqish', login: 'Kirish' },
  en: { dashboard: '📊 Dashboard', groups: '👥 Groups', students: '👨‍🎓 Students', teachers: '👨‍🏫 Teachers', payments: '💳 Payments', expenses: '📉 Expenses', salaries: '💰 Salaries', settings: '⚙️ Settings', reports: '📈 Reports', welcome: 'Welcome', logout: 'Logout', login: 'Login' }
};
window.t = (key) => (window.T[window.lang] && window.T[window.lang][key]) || key;

window.setAuth = (data) => { 
  window.token = data.token; 
  window.currentUser = data.user; 
  localStorage.setItem('token', data.token); 
  localStorage.setItem('user', JSON.stringify(data.user)); 
};
window.handleLogout = () => { localStorage.clear(); window.location.hash = '#login'; window.location.reload(); };
window.fmt = (num) => new Intl.NumberFormat('uz-UZ').format(num) + ' sum';
window.fmtDate = (d) => new Date(d).toLocaleDateString();
