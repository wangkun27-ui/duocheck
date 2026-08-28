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
      console.log('[SPA Preload] Preloading me data...');
      await this.getMeCached().catch(() => null);
    } catch (e) {
      console.warn('[SPA Preload] Preloading failed in background:', e);
    }
  },

  renderAvatar(user, sizePx = 36) {
    const username = (typeof user === 'string' ? user : (user?.username || '?')).trim();
    const avatarUrl = typeof user === 'object' ? user?.avatar : null;
    const initial = username.charAt(0).toUpperCase();

    if (avatarUrl) {
      return `<img src="${avatarUrl}" class="user-avatar-img" alt="${username}" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.2);" title="${username}">`;
    } else {
      return `<div class="user-avatar-placeholder" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:linear-gradient(135deg, #6366f1, #8b5cf6);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:${Math.round(sizePx * 0.45)}px;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.2);" title="${username}">${initial}</div>`;
    }
  },

  changeAvatarPrompt() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        App.showToast('头像文件过大，请选择 10MB 独立图片', 'warning');
        return;
      }
      try {
        App.showToast('正在上传头像到云端...', 'info');
        const url = await API.auth.uploadCloudinaryAvatar(file);
        await API.auth.updateAvatar(url);
        if (this.currentUser) this.currentUser.avatar = url;
        App.showToast('头像更换成功！🎉', 'success');
        this.showApp();
        if (this.currentPage) this.navigate(this.currentPage);
      } catch (err) {
        App.showToast(err.message || '上传头像失败', 'error');
      }
    };
    input.click();
  },

  showApp() {
    const nav = document.getElementById('main-nav');
    const mobileNav = document.getElementById('mobile-nav');
    nav.classList.remove('hidden');
    if (mobileNav) mobileNav.classList.remove('hidden');
    
    // Render user avatar + username with click-to-change feature
    const userDisplay = document.getElementById('user-display');
    const avatarHtml = this.renderAvatar(this.currentUser, 32);
    userDisplay.innerHTML = `
      <div id="btn-change-avatar" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:3px 8px;border-radius:20px;transition:background 0.2s;" title="点击更换头像">
        ${avatarHtml}
        <span style="font-weight:500;">${this.currentUser.username}</span>
        ${this.currentUser.is_admin ? '<span class="badge badge-warning" style="font-size: 0.75em; padding: 2px 6px;">管理员</span>' : ''}
        <span style="font-size:0.8em;opacity:0.6;">📷</span>
      </div>
    `;

    document.getElementById('btn-change-avatar')?.addEventListener('click', () => this.changeAvatarPrompt());

    // Dynamically add/remove Admin panel link based on role for both desktop & mobile
    const navLinks = nav.querySelector('.nav-links');
    let adminLink = navLinks.querySelector('a[data-page="admin"]');
    
    const mobileNavLinks = mobileNav ? mobileNav.querySelector('.mobile-nav-links') : null;
    let mobileAdminLink = mobileNavLinks ? mobileNavLinks.querySelector('a[data-page="admin"]') : null;

    if (this.currentUser.is_admin) {
      if (!adminLink) {
        const li = document.createElement('li');
        li.innerHTML = '<a data-page="admin">🛡️ 管理后台</a>';
        navLinks.appendChild(li);
      }
      if (mobileNavLinks && !mobileAdminLink) {
        const li = document.createElement('li');
        li.innerHTML = '<a data-page="admin"><span class="nav-icon">🛡️</span><span class="nav-label">后台</span></a>';
        mobileNavLinks.appendChild(li);
      }
    } else {
      if (adminLink) adminLink.parentElement.remove();
      if (mobileAdminLink) mobileAdminLink.parentElement.remove();
    }
    this.setupNavigation();
    // Async: show/hide review nav based on whether user has an active partner
    this.updateReviewNavVisibility();
  },

  async updateReviewNavVisibility() {
    try {
      const data = await API.partners.list();
      const hasPartner = (data.partners || []).some(p => p.status === 'active');
      const desktopLi = document.getElementById('nav-review-li');
      const mobileLi  = document.getElementById('mobile-nav-review-li');
      if (desktopLi) desktopLi.classList.toggle('hidden', !hasPartner);
      if (mobileLi)  mobileLi.classList.toggle('hidden', !hasPartner);
      if (hasPartner) this.setupNavigation(); // re-bind new visible link
    } catch { /* silently ignore */ }
  },

  showAuth() {
    document.getElementById('main-nav').classList.add('hidden');
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) mobileNav.classList.add('hidden');
    AuthPage.render();
  },

  setupNavigation() {
    // 导航链接点击处理（同时支持 Desktop 和 Mobile Bottom Tab）
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
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
    if (logoutBtn) {
      const newLogoutBtn = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
      newLogoutBtn.addEventListener('click', () => {
        API.removeToken();
        this.currentUser = null;
        this.showAuth();
      });
    }
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
    // 更新导航激活状态（桌面端和手机端同步更新）
    document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
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
      case 'review':
        app.innerHTML = `
          <div class="section">
            <h2 class="section-title">👀 监督搭档打卡</h2>
            <div class="glass-card skeleton" style="height: 200px;"></div>
          </div>
        `;
        ReviewPage.render();
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

  showImageLightbox(src, allSrcs = []) {
    // Remove any existing lightbox
    const existing = document.getElementById('lightbox-overlay');
    if (existing) existing.remove();

    const srcs = allSrcs.length > 0 ? allSrcs : [src];
    let current = srcs.indexOf(src);
    if (current === -1) current = 0;

    const overlay = document.createElement('div');
    overlay.id = 'lightbox-overlay';

    const render = () => {
      overlay.innerHTML = `
        <div class="lightbox-backdrop"></div>
        <div class="lightbox-container">
          <button class="lightbox-close" id="lb-close">✕</button>
          ${srcs.length > 1 ? `<button class="lightbox-arrow lightbox-prev" id="lb-prev">‹</button>` : ''}
          <div class="lightbox-img-wrap">
            <img src="${srcs[current]}" class="lightbox-img" alt="打卡图片" draggable="false">
          </div>
          ${srcs.length > 1 ? `<button class="lightbox-arrow lightbox-next" id="lb-next">›</button>` : ''}
          ${srcs.length > 1 ? `<div class="lightbox-dots">${srcs.map((_, i) => `<span class="lightbox-dot${i === current ? ' active' : ''}"></span>`).join('')}</div>` : ''}
        </div>
      `;
      overlay.querySelector('#lb-close').onclick = () => overlay.remove();
      overlay.querySelector('.lightbox-backdrop').onclick = () => overlay.remove();
      if (srcs.length > 1) {
        overlay.querySelector('#lb-prev').onclick = (e) => { e.stopPropagation(); current = (current - 1 + srcs.length) % srcs.length; render(); };
        overlay.querySelector('#lb-next').onclick = (e) => { e.stopPropagation(); current = (current + 1) % srcs.length; render(); };
      }
    };

    render();
    document.body.appendChild(overlay);

    // Keyboard: left/right/escape
    const onKey = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
      if (e.key === 'ArrowLeft' && srcs.length > 1) { current = (current - 1 + srcs.length) % srcs.length; render(); }
      if (e.key === 'ArrowRight' && srcs.length > 1) { current = (current + 1) % srcs.length; render(); }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKey));
  },
};

// Global delegated click handler: open lightbox for any .lightbox-img-trigger
document.addEventListener('click', (e) => {
  const img = e.target.closest('.lightbox-img-trigger');
  if (!img) return;
  const src = img.dataset.src || img.src;
  // Collect all sibling images in the same .image-preview-grid
  const grid = img.closest('.image-preview-grid');
  const allSrcs = grid
    ? [...grid.querySelectorAll('.lightbox-img-trigger')].map(i => i.dataset.src || i.src)
    : [src];
  App.showImageLightbox(src, allSrcs);
});

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
                    <button class="btn btn-danger btn-sm btn-delete-goal" data-id="${goal.id}" data-title="${goal.title}">🗑️ 删除</button>
                  ` : `
                    <button class="btn btn-ghost btn-sm btn-resume-goal" data-id="${goal.id}">🔄 恢复</button>
                    <button class="btn btn-danger btn-sm btn-delete-goal" data-id="${goal.id}" data-title="${goal.title}">🗑️ 删除</button>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 新增目标按钮（顶部或空状态下的按钮）
      document.querySelectorAll('#btn-add-goal, #btn-add-goal-empty').forEach(btn => {
        btn.addEventListener('click', () => this.showAddGoalModal());
      });

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
      // 彻底删除目标按钮
      document.querySelectorAll('.btn-delete-goal').forEach(btn => {
        btn.addEventListener('click', () => this.deleteGoal(btn.dataset.id, btn.dataset.title));
      });
    };

    // Fetch fresh goals from backend
    try {
      const data = await API.goals.list();
      const goals = data.goals || [];
      drawUI(goals);
    } catch (err) {
      app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载失败，请稍后重试</div></div>';
      App.showToast(err.message, 'error');
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
      if (window.DashboardPage) window.DashboardPage.cache = null;
      this.render();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  deleteGoal(id, title = '') {
    App.showModal(
      '⚠️ 确认彻底删除目标',
      `<p>确定要彻底删除目标 ${title ? '「<strong>' + title + '</strong>」' : ''} 吗？</p><p class="text-secondary" style="font-size:0.85rem;">删除后相关打卡记录也会一并清除，且无法恢复。</p>`,
      async () => {
        try {
          await API.goals.delete(id);
          App.showToast('目标已成功删除', 'success');
          this.cache = null;
          if (window.DashboardPage) window.DashboardPage.cache = null;
          await this.render();
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      }
    );
  },
};

// DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => App.init());
