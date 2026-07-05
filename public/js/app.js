/**
 * DuoCheck 主应用 SPA 路由模块
 * 管理页面导航、用户认证状态、Toast 通知和模态框
 */
window.App = {
  currentPage: null,
  currentUser: null,

  async init() {
    const token = API.getToken();
    if (token) {
      try {
        const data = await API.auth.me();
        this.currentUser = data.user;
        this.showApp();
        this.preloadAllData(); // Preload all module data in background
        this.navigate('dashboard');
      } catch (e) {
        API.removeToken();
        this.showAuth();
      }
    } else {
      this.showAuth();
    }
    this.setupNavigation();
  },

  // Preload all API modules in background
  async preloadAllData() {
    try {
      console.log('[SPA Preload] Preloading page modules and caching in background...');
      const [dashData, meData, goalsData, partnersData] = await Promise.all([
        API.checkins.dashboard().catch(() => null),
        this.getMeCached().catch(() => null),
        API.goals.list().catch(() => null),
        API.partners.list().catch(() => null)
      ]);

      if (dashData) {
        window.DashboardPage.cache = dashData;
      }
      console.log('[SPA Preload] Cache populated successfully.');
    } catch (e) {
      console.warn('[SPA Preload] Preloading failed in background:', e);
    }
  },

  showAuth() {
    document.getElementById('main-nav').classList.add('hidden');
    AuthPage.render();
  },

  showApp() {
    const nav = document.getElementById('main-nav');
    nav.classList.remove('hidden');
    
    // Render username with admin badge next to it if user is admin
    const userDisplay = document.getElementById('user-display');
    if (this.currentUser.is_admin) {
      userDisplay.innerHTML = `👤 ${this.currentUser.username} <span class="badge badge-warning" style="margin-left: 5px; font-size: 0.8em; padding: 2px 6px;">管理员</span>`;
    } else {
      userDisplay.innerHTML = `👤 ${this.currentUser.username}`;
    }

    // Dynamically add/remove Admin panel link based on role
    const navLinks = nav.querySelector('.nav-links');
    let adminLink = navLinks.querySelector('a[data-page="admin"]');
    if (this.currentUser.is_admin) {
      if (!adminLink) {
        const li = document.createElement('li');
        li.innerHTML = '<a data-page="admin">🛡️ 管理后台</a>';
        navLinks.appendChild(li);
        // Re-setup navigation event listeners
        this.setupNavigation();
      }
    } else {
      if (adminLink) {
        adminLink.parentElement.remove();
      }
    }
  },

  setupNavigation() {
    // 导航链接点击处理
    document.querySelectorAll('.nav-links a').forEach(link => {
      // Avoid duplicate listeners by replacing them
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);
      newLink.addEventListener('click', (e) => {
        e.preventDefault();
        const page = newLink.dataset.page;
        if (page) this.navigate(page);
      });
    });
    // 退出登录按钮
    const logoutBtn = document.getElementById('btn-logout') || document.getElementById('logout-btn');
    // Clean listener
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    newLogoutBtn.addEventListener('click', () => {
      API.removeToken();
      this.currentUser = null;
      this.showAuth();
    });
  },

  // Cache data to prevent redundant requests on quick navigation
  cache: {
    me: null,
    meTime: 0
  },

  async getMeCached() {
    const now = Date.now();
    // Cache for 30 seconds
    if (this.cache.me && (now - this.cache.meTime < 30000)) {
      return this.cache.me;
    }
    const data = await API.auth.me();
    this.cache.me = data;
    this.cache.meTime = now;
    return data;
  },

  navigate(page, data = {}) {
    this.currentPage = page;
    // 更新导航激活状态
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });
    
    // 渲染对应页面
    const app = document.getElementById('app');
    
    // Synchronously render placeholder skeleton shells immediately to eliminate "loading spinners" and layout shift
    app.className = 'page-enter';
    switch (page) {
      case 'dashboard':
        app.innerHTML = `
          <div class="welcome-banner glass-card skeleton" style="height: 120px; margin-bottom: 2rem;"></div>
          <div class="stats-row" style="margin-bottom: 2rem;">
            <div class="stat-card glass-card skeleton" style="height: 100px;"></div>
            <div class="stat-card glass-card skeleton" style="height: 100px;"></div>
            <div class="stat-card glass-card skeleton" style="height: 100px;"></div>
            <div class="stat-card glass-card skeleton" style="height: 100px;"></div>
          </div>
          <div class="quick-actions" style="margin-bottom: 2rem; height: 50px;"></div>
        `;
        DashboardPage.render(); 
        break;
      case 'goals': 
        app.innerHTML = `
          <div class="section">
            <div class="flex-between mb-2">
              <h2 class="section-title">🎯 我的目标</h2>
              <button class="btn btn-primary" style="opacity: 0.5;">+ 新增目标</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div class="glass-card skeleton" style="height: 80px;"></div>
              <div class="glass-card skeleton" style="height: 80px;"></div>
            </div>
          </div>
        `;
        GoalsPage.render(); 
        break;
      case 'partners': 
        app.innerHTML = `
          <div class="section">
            <h2 class="section-title">🔍 搜索用户</h2>
            <div class="search-box skeleton" style="height: 50px; margin-bottom: 1.5rem;"></div>
            <div class="glass-card skeleton" style="height: 120px;"></div>
          </div>
        `;
        PartnersPage.render(); 
        break;
      case 'checkin': 
        app.innerHTML = `
          <div class="section">
            <h2 class="section-title">✅ 每日打卡</h2>
            <div class="glass-card skeleton" style="height: 200px;"></div>
          </div>
        `;
        CheckinPage.render(data.mode || 'checkin', data); 
        break;
      case 'messages': 
        app.innerHTML = `
          <div class="chat-container glass-card skeleton" style="height: 500px;"></div>
        `;
        MessagesPage.render(data.partnershipId, data.partnerName); 
        break;
      case 'admin': 
        app.innerHTML = `
          <div class="section">
            <h2 class="section-title">🛡️ 管理后台</h2>
            <div class="stats-row" style="margin-bottom: 2rem;">
              <div class="stat-card glass-card skeleton" style="height: 100px;"></div>
              <div class="stat-card glass-card skeleton" style="height: 100px;"></div>
            </div>
          </div>
        `;
        AdminPage.render(); 
        break;
      default: 
        DashboardPage.render();
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''} ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  showModal(title, content, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `
      <div class="modal-content glass-card">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="btn btn-ghost btn-sm modal-close">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost modal-close">取消</button>
          ${onConfirm ? '<button class="btn btn-primary modal-confirm">确认</button>' : ''}
        </div>
      </div>
    `;
    const close = () => { overlay.classList.remove('active'); };
    overlay.classList.add('active');
    overlay.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', close);
    });
    if (onConfirm) {
      overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
        const result = await onConfirm();
        if (result !== false) {
          close();
        }
      });
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  },
};

/**
 * 目标管理页面模块
 * 提供目标的增删改查和状态切换功能
 */
window.GoalsPage = {
  // Client memory cache for goals list
  cache: null,

  async render() {
    const app = document.getElementById('app');

    const drawUI = (goals) => {
      app.innerHTML = `
        <div class="section">
          <div class="flex-between mb-2">
            <h2 class="section-title">🎯 我的目标</h2>
            <button class="btn btn-primary" id="btn-add-goal">+ 新增目标</button>
          </div>
          <div id="goals-list">
            ${goals.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div class="empty-text">还没有设定目标<br>设定一个目标，开始你的打卡之旅吧！</div>
                <button class="btn btn-primary mt-2" id="btn-add-goal-empty">设定目标</button>
              </div>
            ` : goals.map(goal => `
              <div class="goal-card glass-card" data-goal-id="${goal.id}">
                <div class="goal-info">
                  <div class="goal-title">${goal.title}</div>
                  <div class="goal-desc">${goal.description || '暂无描述'}</div>
                  <div class="badge ${goal.status === 'active' ? 'badge-success' : goal.status === 'abandoned' ? 'badge-danger' : 'badge-secondary'}">
                    ${goal.status === 'active' ? '进行中' : goal.status === 'abandoned' ? '已取消' : '已暂停'}
                  </div>
                </div>
                <div class="goal-actions">
                  ${goal.status !== 'abandoned' ? `
                    <button class="btn btn-ghost btn-sm btn-edit-goal" data-id="${goal.id}" data-title="${goal.title}" data-desc="${goal.description || ''}">✏️ 编辑</button>
                    ${goal.status === 'active'
                      ? `<button class="btn btn-ghost btn-sm btn-pause-goal" data-id="${goal.id}">⏸️ 暂停</button>`
                      : `<button class="btn btn-ghost btn-sm btn-resume-goal" data-id="${goal.id}">▶️ 恢复</button>`
                    }
                    <button class="btn btn-danger btn-sm btn-cancel-goal" data-id="${goal.id}" data-title="${goal.title}">❌ 取消</button>
                  ` : `
                    <button class="btn btn-ghost btn-sm btn-resume-goal" data-id="${goal.id}">🔄 恢复</button>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 新增目标按钮处理
      const addBtn = document.getElementById('btn-add-goal') || document.getElementById('btn-add-goal-empty');
      if (addBtn) addBtn.addEventListener('click', () => this.showAddGoalModal());
      // 同时绑定主按钮（当空状态按钮存在时）
      const mainAddBtn = document.getElementById('btn-add-goal');
      if (mainAddBtn && mainAddBtn !== addBtn) mainAddBtn.addEventListener('click', () => this.showAddGoalModal());

      // 编辑按钮
      document.querySelectorAll('.btn-edit-goal').forEach(btn => {
        btn.addEventListener('click', () => {
          this.showEditGoalModal(btn.dataset.id, btn.dataset.title, btn.dataset.desc);
        });
      });
      // 暂停/恢复按钮
      document.querySelectorAll('.btn-pause-goal').forEach(btn => {
        btn.addEventListener('click', () => this.toggleGoalStatus(btn.dataset.id, 'paused'));
      });
      document.querySelectorAll('.btn-resume-goal').forEach(btn => {
        btn.addEventListener('click', () => this.toggleGoalStatus(btn.dataset.id, 'active'));
      });
      // 取消目标按钮
      document.querySelectorAll('.btn-cancel-goal').forEach(btn => {
        btn.addEventListener('click', () => this.cancelGoal(btn.dataset.id, btn.dataset.title));
      });
    };

    // Stale-While-Revalidate: Instant render from cache
    if (this.cache) {
      drawUI(this.cache);
    }

    try {
      const data = await API.goals.list();
      const goals = data.goals || [];
      this.cache = goals;
      drawUI(goals);
    } catch (err) {
      if (!this.cache) {
        app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载失败，请稍后重试</div></div>';
        App.showToast(err.message, 'error');
      }
    }
  },

  showAddGoalModal() {
    App.showModal('🎯 新增目标', `
      <div class="form-group">
        <label>目标名称</label>
        <input type="text" class="form-input" id="goal-title" placeholder="例如：每日运动30分钟">
      </div>
      <div class="form-group">
        <label>目标描述（选填）</label>
        <textarea class="form-input" id="goal-desc" placeholder="详细描述你的目标..."></textarea>
      </div>
    `, async () => {
      const title = document.getElementById('goal-title').value.trim();
      const description = document.getElementById('goal-desc').value.trim();
      if (!title) { App.showToast('请输入目标名称', 'warning'); return false; }
      try {
        await API.goals.create({ title, description });
        App.showToast('目标创建成功！', 'success');
        this.render();
        return true;
      } catch (err) {
        App.showToast(err.message, 'error');
        return false;
      }
    });
  },

  showEditGoalModal(id, currentTitle, currentDesc) {
    App.showModal('✏️ 编辑目标', `
      <div class="form-group">
        <label>目标名称</label>
        <input type="text" class="form-input" id="goal-title" value="${currentTitle}">
      </div>
      <div class="form-group">
        <label>目标描述</label>
        <textarea class="form-input" id="goal-desc">${currentDesc}</textarea>
      </div>
    `, async () => {
      const title = document.getElementById('goal-title').value.trim();
      const description = document.getElementById('goal-desc').value.trim();
      if (!title) { App.showToast('请输入目标名称', 'warning'); return false; }
      try {
        await API.goals.update(id, { title, description });
        App.showToast('目标已更新！', 'success');
        this.render();
        return true;
      } catch (err) {
        App.showToast(err.message, 'error');
        return false;
      }
    });
  },

  async toggleGoalStatus(id, status) {
    try {
      await API.goals.update(id, { status });
      App.showToast(status === 'paused' ? '目标已暂停' : '目标已恢复', 'success');
      this.cache = null;
      this.render();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  cancelGoal(id, title) {
    App.showModal('❌ 确认取消目标', `
      <p style="color:#f1f5f9">确定要取消目标 <strong>「${title}」</strong> 吗？</p>
      <p style="color:#94a3b8;font-size:0.9em">取消后可以随时恢复。</p>
    `, async () => {
      try {
        await API.goals.update(id, { status: 'abandoned' });
        App.showToast('目标已取消', 'success');
        this.cache = null;
        this.render();
        return true;
      } catch (err) {
        App.showToast(err.message, 'error');
        return false;
      }
    });
  },
};

// DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => App.init());
