window.AuthPage = {
  isLogin: true,
  
  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-container">
        <div class="auth-card glass-card">
          <h1 class="auth-title">DuoCheck 🔥</h1>
          <p class="auth-subtitle">搭档打卡，互相监督，一起进步</p>
          <div id="auth-form">
            ${this.renderForm()}
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  },
  
  renderForm() {
    return `
      <form id="auth-form-el" class="auth-form">
        <div class="form-group">
          <label>👤 用户名</label>
          <input type="text" class="form-input" id="auth-username" placeholder="请输入用户名" required>
        </div>
        <div class="form-group">
          <label>🔒 密码</label>
          <input type="password" class="form-input" id="auth-password" placeholder="请输入密码" required>
        </div>
        ${!this.isLogin ? `
          <div class="form-group">
            <label>🔒 确认密码</label>
            <input type="password" class="form-input" id="auth-password-confirm" placeholder="请再次输入密码" required>
          </div>
        ` : ''}
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;">
          ${this.isLogin ? '🚀 登录' : '✨ 注册'}
        </button>
      </form>
      <div class="auth-toggle">
        ${this.isLogin 
          ? '还没有账号？<span id="auth-toggle-btn">立即注册</span>' 
          : '已有账号？<span id="auth-toggle-btn">去登录</span>'
        }
      </div>
    `;
  },
  
  bindEvents() {
    const form = document.getElementById('auth-form-el');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (this.isLogin) this.handleLogin();
        else this.handleRegister();
      });
    }
    const toggleBtn = document.getElementById('auth-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.isLogin = !this.isLogin;
        const formContainer = document.getElementById('auth-form');
        formContainer.style.opacity = '0';
        formContainer.style.transform = 'translateY(10px)';
        setTimeout(() => {
          formContainer.innerHTML = this.renderForm();
          this.bindEvents();
          requestAnimationFrame(() => {
            formContainer.style.transition = 'opacity 0.3s, transform 0.3s';
            formContainer.style.opacity = '1';
            formContainer.style.transform = 'translateY(0)';
          });
        }, 200);
      });
    }
  },
  
  async handleLogin() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!username || !password) {
      App.showToast('请填写用户名和密码', 'warning');
      return;
    }
    try {
      const data = await API.auth.login({ username, password });
      API.setToken(data.token);
      App.currentUser = data.user;
      App.showApp();
      App.preloadAllData(); // Trigger preload immediately on login
      App.navigate('dashboard');
      App.showToast(`欢迎回来，${data.user.username}！`, 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },
  
  async handleRegister() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('auth-password-confirm').value;
    if (!username || !password) {
      App.showToast('请填写用户名和密码', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      App.showToast('两次输入的密码不一致', 'error');
      return;
    }
    if (password.length < 6) {
      App.showToast('密码至少需要6个字符', 'warning');
      return;
    }
    try {
      const data = await API.auth.register({ username, password });
      API.setToken(data.token);
      App.currentUser = data.user;
      App.showApp();
      App.preloadAllData(); // Trigger preload immediately on register
      App.navigate('dashboard');
      App.showToast(`注册成功，欢迎 ${data.user.username}！`, 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },
};
