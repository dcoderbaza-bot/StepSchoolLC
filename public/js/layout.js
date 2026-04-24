import { currentUser, logout, lang, toggleLang, t } from './api.js';

export function renderLayout(contentHtml, activePage) {
  if (!currentUser) return `<div class="login-page">${contentHtml}</div>`;

  const navs = {
    boss: [
      { id: 'dashboard', icon: '📊', name: t('dashboard') },
      { id: 'groups', icon: '👥', name: t('groups') },
      { id: 'payments', icon: '💳', name: t('payments') },
      { id: 'reports', icon: '📈', name: t('reports') }
    ],
    admin: [
      { id: 'dashboard', icon: '📊', name: t('dashboard') },
      { id: 'groups', icon: '👥', name: t('groups') },
      { id: 'teachers', icon: '👨‍🏫', name: t('teachers') },
      { id: 'students', icon: '👨‍🎓', name: t('students') },
      { id: 'payments', icon: '💳', name: t('payments') },
      { id: 'expenses', icon: '📉', name: t('expenses') },
      { id: 'salaries', icon: '💰', name: t('salaries') },
      { id: 'settings', icon: '⚙️', name: t('settings') }
    ],
    teacher: [
      { id: 'groups', icon: '👥', name: t('my_groups') },
      { id: 'lessons', icon: '📹', name: t('my_lessons') },
      { id: 'tests', icon: '📝', name: t('my_tests') },
      { id: 'salary', icon: '💰', name: t('my_salary') }
    ],
    student: [
      { id: 'lessons', icon: '📹', name: t('my_lessons') },
      { id: 'tests', icon: '📝', name: t('my_tests') },
      { id: 'results', icon: '📊', name: t('results') },
      { id: 'payments', icon: '💳', name: t('payments') }
    ]
  };

  const menu = navs[currentUser.role] || [];
  
  const sidebarHtml = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h2>Step School</h2>
        <span class="role-badge role-${currentUser.role}">${currentUser.role}</span>
      </div>
      <nav class="sidebar-nav">
        ${menu.map(item => `
          <a href="#${item.id}" class="nav-item ${activePage === item.id ? 'active' : ''}" onclick="window.closeSidebar()">
            <span class="icon">${item.icon}</span>
            <span>${item.name}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="logout-btn" onclick="window.handleLogout()">
          <span class="icon">🚪</span> ${t('logout')}
        </button>
      </div>
    </aside>
  `;

  return `
    <div class="layout">
      ${sidebarHtml}
      <main class="main-content">
        <header class="topbar">
          <button class="mobile-toggle" onclick="window.toggleSidebar()">☰</button>
          <h1>${menu.find(m => m.id === activePage)?.name || ''}</h1>
          <div class="topbar-right">
            <span style="font-weight:600;font-size:0.9rem">${currentUser.full_name}</span>
            <button class="lang-toggle" onclick="window.toggleAppLang()">${lang === 'uz' ? 'O\'Z' : 'EN'}</button>
          </div>
        </header>
        <div class="page-content" id="page-content">
          ${contentHtml}
        </div>
      </main>
    </div>
  `;
}

window.toggleSidebar = () => {
  document.getElementById('sidebar').classList.toggle('open');
};

window.closeSidebar = () => {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
};
