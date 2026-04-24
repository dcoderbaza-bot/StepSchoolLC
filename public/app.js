(function () {
  const state = {
    token: localStorage.getItem('step_token') || '',
    user: JSON.parse(localStorage.getItem('step_user') || 'null'),
    authMode: 'login',
    activeView: 'overview',
    loading: false,
    data: {
      overview: null,
      reports: null,
      teachers: [],
      students: [],
      groups: [],
      payments: []
    }
  };

  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('uz-UZ').format(Number(value || 0)) + ' so\'m';
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('uz-UZ');
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'So\'rov bajarilmadi');
    }

    return data;
  }

  function saveAuth(auth) {
    state.token = auth.token;
    state.user = auth.user;
    localStorage.setItem('step_token', auth.token);
    localStorage.setItem('step_user', JSON.stringify(auth.user));
  }

  function clearAuth() {
    state.token = '';
    state.user = null;
    localStorage.removeItem('step_token');
    localStorage.removeItem('step_user');
  }

  function toast(message, type = 'success') {
    const stack = toastRoot.querySelector('.toast-stack') || toastRoot.appendChild(document.createElement('div'));
    stack.className = 'toast-stack';

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function openModal(title, body, footer = '') {
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="section-header">
            <div>
              <h3>${esc(title)}</h3>
            </div>
            <button class="btn btn-ghost" data-close-modal>Yopish</button>
          </div>
          <div>${body}</div>
          ${footer ? `<div class="inline-actions" style="margin-top:18px">${footer}</div>` : ''}
        </div>
      </div>
    `;

    modalRoot.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
    modalRoot.querySelector('.modal-backdrop')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
  }

  function closeModal() {
    modalRoot.innerHTML = '';
  }

  async function bootstrap() {
    if (!state.token) {
      render();
      return;
    }

    try {
      const profile = await api('/auth/me');
      state.user = profile.user;
      localStorage.setItem('step_user', JSON.stringify(profile.user));
    } catch (_error) {
      clearAuth();
      toast('Sessiya tugagan. Qayta kiring.', 'error');
      render();
      return;
    }

    await loadDashboard();
    render();
  }

  async function loadDashboard() {
    if (!state.user || !['boss', 'admin'].includes(state.user.role)) {
      return;
    }

    state.loading = true;
    render();

    try {
      const [overview, reports, teachers, students, groups, payments] = await Promise.all([
        api('/admin/overview'),
        api('/admin/reports'),
        api('/admin/teachers'),
        api('/admin/students'),
        api('/admin/groups'),
        api('/admin/payments')
      ]);

      state.data = { overview, reports, teachers, students, groups, payments };
    } catch (error) {
      toast(error.message || 'Dashboard ma\'lumotlarini yuklab bo\'lmadi', 'error');
    } finally {
      state.loading = false;
      render();
    }
  }

  function render() {
    if (!state.user) {
      renderAuth();
      return;
    }

    if (!['boss', 'admin'].includes(state.user.role)) {
      renderLimitedAccess();
      return;
    }

    const view = state.activeView;
    app.innerHTML = `
      <div class="shell">
        <div class="layout">
          <aside class="sidebar">
            <div class="brand">
              <h2>Step School</h2>
              <p>CRM va boshqaruv paneli</p>
            </div>
            <div class="user-chip">
              <strong>${esc(state.user.full_name)}</strong>
              <span>${esc(state.user.role)}</span>
            </div>
            <div class="nav">
              ${navButton('overview', 'Boshqaruv paneli', view)}
              ${navButton('teachers', 'Xodimlar', view)}
              ${navButton('students', 'O\'quvchilar', view)}
              ${navButton('groups', 'Guruhlar', view)}
              ${navButton('payments', 'To\'lovlar', view)}
            </div>
            <div class="sidebar-footer">
              <button class="btn btn-secondary" id="logout-btn">Chiqish</button>
            </div>
          </aside>
          <main class="main">
            <section class="topbar">
              <div>
                <h1>${getViewTitle(view)}</h1>
                <p>Step School uchun yig'ilgan, deploymentga tayyor va sodda boshqaruv oqimi.</p>
              </div>
              <div class="actions">
                <button class="btn btn-secondary" id="refresh-btn">Yangilash</button>
                ${getPrimaryAction(view)}
              </div>
            </section>
            ${state.loading ? `<section class="section"><div class="empty">Yuklanmoqda...</div></section>` : renderView(view)}
          </main>
        </div>
      </div>
    `;

    wireCommonEvents();
  }

  function navButton(view, label, activeView) {
    return `<button data-nav="${view}" class="${view === activeView ? 'active' : ''}">${label}</button>`;
  }

  function getViewTitle(view) {
    return {
      overview: 'Boshqaruv paneli',
      teachers: 'Xodimlar',
      students: 'O\'quvchilar',
      groups: 'Guruhlar',
      payments: 'To\'lovlar'
    }[view];
  }

  function getPrimaryAction(view) {
    const buttons = {
      teachers: '<button class="btn btn-primary" data-create="teacher">Xodim qo\'shish</button>',
      students: '<button class="btn btn-primary" data-create="student">O\'quvchi qo\'shish</button>',
      groups: '<button class="btn btn-primary" data-create="group">Guruh qo\'shish</button>',
      payments: '<button class="btn btn-primary" data-create="payment">To\'lov kiritish</button>'
    };
    return buttons[view] || '';
  }

  function renderView(view) {
    switch (view) {
      case 'teachers':
        return renderTeachers();
      case 'students':
        return renderStudents();
      case 'groups':
        return renderGroups();
      case 'payments':
        return renderPayments();
      default:
        return renderOverview();
    }
  }

  function renderOverview() {
    const metrics = state.data.overview?.metrics || state.data.reports || {};
    const recent = state.data.overview?.recent_payments || [];

    return `
      <section class="grid">
        <div class="stats-grid">
          ${statCard('Kirim', formatMoney(metrics.income))}
          ${statCard('Chiqim', formatMoney(metrics.expense))}
          ${statCard('Foyda', formatMoney(metrics.profit))}
          ${statCard('O\'quvchilar', metrics.student_count || 0)}
          ${statCard('Xodimlar', metrics.teacher_count || 0)}
          ${statCard('Guruhlar', metrics.group_count || 0)}
        </div>
        <section class="table-card">
          <div class="section-header">
            <div>
              <h3>So'nggi to'lovlar</h3>
              <p>Oxirgi 5 ta yozuv</p>
            </div>
          </div>
          ${recent.length ? tableMarkup(
            ['O\'quvchi', 'Summa', 'Turi', 'Sana'],
            recent.map((item) => [
              esc(item.student_name || '-'),
              formatMoney(item.amount),
              badge(item.type || 'cash', 'accent'),
              formatDate(item.date)
            ])
          ) : '<div class="empty">Hozircha to\'lov yozuvlari yo\'q.</div>'}
        </section>
      </section>
    `;
  }

  function renderTeachers() {
    return `
      <section class="table-card">
        <div class="section-header">
          <div>
            <h3>Xodimlar ro'yxati</h3>
            <p>Teacher, admin va boshqa rollarni boshqarish</p>
          </div>
        </div>
        ${state.data.teachers.length ? tableMarkup(
          ['F.I.SH', 'Username', 'Rol', 'Telefon', 'Oylik/Foiz', 'Amallar'],
          state.data.teachers.map((teacher) => [
            esc(teacher.full_name),
            esc(teacher.username),
            badge(teacher.role, 'accent'),
            esc(teacher.phone || '-'),
            teacher.role === 'teacher' ? `${teacher.salary_percent || 0}%` : formatMoney(teacher.fixed_salary || 0),
            rowActions('teacher', teacher.id)
          ])
        ) : '<div class="empty">Xodimlar topilmadi.</div>'}
      </section>
    `;
  }

  function renderStudents() {
    return `
      <section class="table-card">
        <div class="section-header">
          <div>
            <h3>O'quvchilar ro'yxati</h3>
            <p>Login, aloqa va statusni boshqarish</p>
          </div>
        </div>
        ${state.data.students.length ? tableMarkup(
          ['F.I.SH', 'Username', 'Telefon', 'Qo\'shimcha telefon', 'Amallar'],
          state.data.students.map((student) => [
            esc(student.full_name),
            esc(student.username),
            esc(student.phone || '-'),
            esc(student.phone2 || '-'),
            rowActions('student', student.id)
          ])
        ) : '<div class="empty">O\'quvchilar topilmadi.</div>'}
      </section>
    `;
  }

  function renderGroups() {
    return `
      <section class="table-card">
        <div class="section-header">
          <div>
            <h3>Guruhlar ro'yxati</h3>
            <p>Dars jadvali, narx va biriktirilgan xodimlar</p>
          </div>
        </div>
        ${state.data.groups.length ? tableMarkup(
          ['Nomi', 'Daraja', 'O\'qituvchi', 'Yordamchi', 'Jadval', 'Narx', 'Amallar'],
          state.data.groups.map((group) => [
            esc(group.name),
            badge(group.level || '-', 'accent'),
            esc(group.teacher_name || '-'),
            esc(group.support_teacher_name || '-'),
            `${esc(group.days || '-')}${group.time ? `<br><span class="muted">${esc(group.time)}</span>` : ''}`,
            formatMoney(group.monthly_price || 0),
            rowActions('group', group.id)
          ])
        ) : '<div class="empty">Guruhlar topilmadi.</div>'}
      </section>
    `;
  }

  function renderPayments() {
    return `
      <section class="table-card">
        <div class="section-header">
          <div>
            <h3>To'lovlar</h3>
            <p>Yangi to'lov qo'shish va tarixni ko'rish</p>
          </div>
        </div>
        ${state.data.payments.length ? tableMarkup(
          ['O\'quvchi', 'Summa', 'Turi', 'Izoh', 'Sana'],
          state.data.payments.map((payment) => [
            esc(payment.student_name || '-'),
            formatMoney(payment.amount),
            badge(payment.type || 'cash', 'green'),
            esc(payment.note || '-'),
            formatDate(payment.date)
          ])
        ) : '<div class="empty">To\'lovlar mavjud emas.</div>'}
      </section>
    `;
  }

  function statCard(label, value) {
    return `
      <div class="stat-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }

  function badge(label, tone) {
    return `<span class="badge badge-${tone}">${esc(label)}</span>`;
  }

  function rowActions(type, id) {
    return `
      <div class="inline-actions">
        <button class="btn btn-secondary" data-edit="${type}" data-id="${id}">Tahrirlash</button>
        <button class="btn btn-danger" data-delete="${type}" data-id="${id}">O'chirish</button>
      </div>
    `;
  }

  function tableMarkup(headers, rows) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAuth() {
    app.innerHTML = `
      <div class="shell">
        <div class="auth-shell auth-shell-brand">
          <section class="auth-card">
            <div class="brand-lockup">
              <div class="brand-mark" aria-hidden="true">
                <span class="brand-block brand-a"></span>
                <span class="brand-block brand-b"></span>
                <span class="brand-block brand-c"></span>
                <span class="brand-block brand-d"></span>
              </div>
              <div class="brand-copy">
                <div class="brand-wordmark">Step School</div>
                <div class="brand-subline">Learning system</div>
              </div>
            </div>
            <div class="auth-intro">
              <div class="auth-kicker">${state.authMode === 'login' ? 'Secure Access' : 'Initial Setup'}</div>
              <h2>${state.authMode === 'login' ? 'Tizimga kirish' : 'Boss profilini yaratish'}</h2>
              <p>${state.authMode === 'login' ? 'Platformaga kirish uchun login va parolni kiriting.' : 'Markazning birinchi boshqaruv profilini shu yerda yarating.'}</p>
            </div>
            <form id="auth-form" class="stack">
              ${state.authMode === 'setup' ? `
                <div class="field">
                  <label>To'liq ism</label>
                  <input class="input" name="full_name" required>
                </div>
              ` : ''}
              <div class="field">
                <label>Username</label>
                <input class="input" name="username" required>
              </div>
                <div class="field">
                  <label>Parol</label>
                  <input class="input" type="password" name="password" required minlength="6">
                </div>
              <div class="auth-actions">
                <button class="btn btn-primary btn-auth-main" type="submit">${state.authMode === 'login' ? 'Kirish' : 'Yaratish'}</button>
                <button class="btn btn-secondary btn-auth-switch" type="button" id="toggle-auth">${state.authMode === 'login' ? 'Setup rejimi' : 'Login rejimi'}</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    `;

    document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
    document.getElementById('toggle-auth')?.addEventListener('click', async () => {
      if (state.authMode === 'login') {
        const status = await api('/auth/status').catch(() => ({ setup: true }));
        state.authMode = status.setup ? 'login' : 'setup';
      } else {
        state.authMode = 'login';
      }
      render();
    });

    api('/auth/status')
      .then((status) => {
        if (!status.setup) {
          state.authMode = 'setup';
          render();
        }
      })
      .catch(() => {});
  }

  function renderLimitedAccess() {
    app.innerHTML = `
      <div class="shell">
        <section class="section" style="max-width:720px; margin: 0 auto;">
          <div class="section-header">
            <div>
              <h3>Xush kelibsiz, ${esc(state.user.full_name)}</h3>
              <p>Siz tizimga ${esc(state.user.role)} sifatida kirdingiz.</p>
            </div>
            <button class="btn btn-secondary" id="logout-btn">Chiqish</button>
          </div>
          <p class="muted">Bu frontend hozircha admin va boss boshqaruvi uchun optimallashtirilgan. Teacher/student uchun alohida modul keyingi bosqichda qo'shilishi mumkin.</p>
        </section>
      </div>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', logout);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const endpoint = state.authMode === 'login' ? '/auth/login' : '/auth/setup';

    try {
      const auth = await api(endpoint, { method: 'POST', body: payload });
      saveAuth(auth);
      toast('Muvaffaqiyatli bajarildi');
      await loadDashboard();
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function wireCommonEvents() {
    app.querySelectorAll('[data-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeView = button.dataset.nav;
        render();
      });
    });

    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
      await loadDashboard();
      toast('Ma\'lumotlar yangilandi');
    });

    app.querySelectorAll('[data-create]').forEach((button) => {
      button.addEventListener('click', () => openEntityModal(button.dataset.create));
    });

    app.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => openEntityModal(button.dataset.edit, button.dataset.id));
    });

    app.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => handleDelete(button.dataset.delete, button.dataset.id));
    });
  }

  function openEntityModal(type, id = '') {
    const entity = findEntity(type, id);
    const titleMap = {
      teacher: id ? 'Xodimni tahrirlash' : 'Yangi xodim',
      student: id ? 'O\'quvchini tahrirlash' : 'Yangi o\'quvchi',
      group: id ? 'Guruhni tahrirlash' : 'Yangi guruh',
      payment: 'Yangi to\'lov'
    };

    openModal(titleMap[type], getEntityForm(type, entity), `
      <button class="btn btn-secondary" data-close-modal>Bekor qilish</button>
      <button class="btn btn-primary" id="modal-save-btn">Saqlash</button>
    `);

    modalRoot.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#modal-save-btn')?.addEventListener('click', () => saveEntity(type, id));
  }

  function findEntity(type, id) {
    const map = {
      teacher: state.data.teachers,
      student: state.data.students,
      group: state.data.groups
    };
    return map[type]?.find((item) => item.id === id) || null;
  }

  function getTeacherOptions(selectedId) {
    return `<option value="">Tanlanmagan</option>${state.data.teachers
      .filter((item) => ['teacher', 'support_teacher'].includes(item.role))
      .map((item) => `<option value="${item.id}" ${selectedId === item.id ? 'selected' : ''}>${esc(item.full_name)} (${esc(item.role)})</option>`)
      .join('')}`;
  }

  function getEntityForm(type, entity) {
    if (type === 'teacher') {
      return `
        <div class="stack">
          <div class="field"><label>F.I.SH</label><input class="input" id="f-full-name" value="${esc(entity?.full_name || '')}"></div>
          <div class="field"><label>Username</label><input class="input" id="f-username" value="${esc(entity?.username || '')}"></div>
          <div class="field"><label>Parol ${entity ? '(o\'zgartirmasangiz bo\'sh qoldiring)' : ''}</label><input class="input" type="password" id="f-password"></div>
          <div class="field"><label>Rol</label>
            <select class="select" id="f-role">
              ${['teacher', 'admin', 'support_teacher', 'manager', 'cleaner'].map((role) => `<option value="${role}" ${(entity?.role || 'teacher') === role ? 'selected' : ''}>${role}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Telefon</label><input class="input" id="f-phone" value="${esc(entity?.phone || '')}"></div>
          <div class="field"><label>Foiz</label><input class="input" id="f-salary-percent" type="number" value="${esc(entity?.salary_percent || 40)}"></div>
          <div class="field"><label>Fiks oylik</label><input class="input" id="f-fixed-salary" type="number" value="${esc(entity?.fixed_salary || 0)}"></div>
        </div>
      `;
    }

    if (type === 'student') {
      return `
        <div class="stack">
          <div class="field"><label>F.I.SH</label><input class="input" id="f-full-name" value="${esc(entity?.full_name || '')}"></div>
          <div class="field"><label>Username</label><input class="input" id="f-username" value="${esc(entity?.username || '')}"></div>
          <div class="field"><label>Parol ${entity ? '(o\'zgartirmasangiz bo\'sh qoldiring)' : ''}</label><input class="input" type="password" id="f-password"></div>
          <div class="field"><label>Telefon</label><input class="input" id="f-phone" value="${esc(entity?.phone || '')}"></div>
          <div class="field"><label>Qo'shimcha telefon</label><input class="input" id="f-phone2" value="${esc(entity?.phone2 || '')}"></div>
        </div>
      `;
    }

    if (type === 'group') {
      return `
        <div class="stack">
          <div class="field"><label>Nomi</label><input class="input" id="g-name" value="${esc(entity?.name || '')}"></div>
          <div class="field"><label>Daraja</label><input class="input" id="g-level" value="${esc(entity?.level || 'Beginner')}"></div>
          <div class="field"><label>Asosiy o'qituvchi</label><select class="select" id="g-teacher-id">${getTeacherOptions(entity?.teacher_id || '')}</select></div>
          <div class="field"><label>Yordamchi o'qituvchi</label><select class="select" id="g-support-teacher-id">${getTeacherOptions(entity?.support_teacher_id || '')}</select></div>
          <div class="field"><label>Kunlar</label><input class="input" id="g-days" value="${esc(entity?.days || '')}"></div>
          <div class="field"><label>Vaqt</label><input class="input" id="g-time" value="${esc(entity?.time || '')}" placeholder="14:00"></div>
          <div class="field"><label>Xona</label><input class="input" id="g-room" value="${esc(entity?.room || '')}"></div>
          <div class="field"><label>Oylik narx</label><input class="input" id="g-price" type="number" value="${esc(entity?.monthly_price || 0)}"></div>
        </div>
      `;
    }

    return `
      <div class="stack">
        <div class="field"><label>O'quvchi</label>
          <select class="select" id="p-student-id">
            <option value="">Tanlang</option>
            ${state.data.students.map((student) => `<option value="${student.id}">${esc(student.full_name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Summa</label><input class="input" id="p-amount" type="number"></div>
        <div class="field"><label>Turi</label>
          <select class="select" id="p-type">
            <option value="cash">cash</option>
            <option value="card">card</option>
            <option value="transfer">transfer</option>
          </select>
        </div>
        <div class="field"><label>Izoh</label><textarea class="textarea" id="p-note"></textarea></div>
      </div>
    `;
  }

  async function saveEntity(type, id) {
    try {
      if (type === 'teacher') {
        const payload = {
          full_name: document.getElementById('f-full-name').value.trim(),
          username: document.getElementById('f-username').value.trim(),
          password: document.getElementById('f-password').value,
          role: document.getElementById('f-role').value,
          phone: document.getElementById('f-phone').value.trim(),
          salary_percent: Number(document.getElementById('f-salary-percent').value || 0),
          fixed_salary: Number(document.getElementById('f-fixed-salary').value || 0)
        };
        await api(id ? `/admin/teachers/${id}` : '/admin/teachers', { method: id ? 'PUT' : 'POST', body: payload });
      } else if (type === 'student') {
        const payload = {
          full_name: document.getElementById('f-full-name').value.trim(),
          username: document.getElementById('f-username').value.trim(),
          password: document.getElementById('f-password').value,
          phone: document.getElementById('f-phone').value.trim(),
          phone2: document.getElementById('f-phone2').value.trim()
        };
        await api(id ? `/admin/students/${id}` : '/admin/students', { method: id ? 'PUT' : 'POST', body: payload });
      } else if (type === 'group') {
        const payload = {
          name: document.getElementById('g-name').value.trim(),
          level: document.getElementById('g-level').value.trim(),
          teacher_id: document.getElementById('g-teacher-id').value,
          support_teacher_id: document.getElementById('g-support-teacher-id').value,
          days: document.getElementById('g-days').value.trim(),
          time: document.getElementById('g-time').value.trim(),
          room: document.getElementById('g-room').value.trim(),
          monthly_price: Number(document.getElementById('g-price').value || 0)
        };
        await api(id ? `/admin/groups/${id}` : '/admin/groups', { method: id ? 'PUT' : 'POST', body: payload });
      } else {
        const payload = {
          student_id: document.getElementById('p-student-id').value,
          amount: Number(document.getElementById('p-amount').value || 0),
          type: document.getElementById('p-type').value,
          note: document.getElementById('p-note').value.trim()
        };
        await api('/admin/payments', { method: 'POST', body: payload });
      }

      closeModal();
      await loadDashboard();
      toast('Ma\'lumot saqlandi');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleDelete(type, id) {
    const confirmed = window.confirm('Bu yozuvni o\'chirishni tasdiqlaysizmi?');
    if (!confirmed) return;

    const routeMap = {
      teacher: `/admin/teachers/${id}`,
      student: `/admin/students/${id}`,
      group: `/admin/groups/${id}`
    };

    try {
      await api(routeMap[type], { method: 'DELETE' });
      await loadDashboard();
      toast('Yozuv o\'chirildi');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function logout() {
    clearAuth();
    state.data = {
      overview: null,
      reports: null,
      teachers: [],
      students: [],
      groups: [],
      payments: []
    };
    state.activeView = 'overview';
    render();
  }

  bootstrap();
})();
