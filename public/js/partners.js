window.PartnersPage = {
  // Client memory cache for partners list and requests
  cache: null,

  async render() {
    const app = document.getElementById('app');

    const drawUI = (partners, pendingRequests) => {
      app.innerHTML = `
        <div class="section">
          <h2 class="section-title">🔍 搜索用户</h2>
          <div class="search-box">
            <input type="text" class="form-input" id="search-input" placeholder="输入用户名搜索...">
            <button class="btn btn-secondary" id="btn-search">搜索</button>
          </div>
          <div id="search-results" class="search-results"></div>
        </div>
        
        ${pendingRequests.length > 0 ? `
          <div class="section">
            <h3 class="section-title">📨 待处理的邀请 <span class="badge badge-warning">${pendingRequests.length}</span></h3>
            <div id="pending-requests">
              ${pendingRequests.map(req => `
                <div class="partner-card glass-card" data-request-id="${req.id}">
                  <div class="partner-info">
                    <div class="partner-name">👤 ${req.from_username || req.username}</div>
                    <div class="partner-streak">想与你成为打卡搭档</div>
                  </div>
                  <div class="partner-actions">
                    <button class="btn btn-primary btn-sm btn-accept" data-id="${req.id}">✅ 接受</button>
                    <button class="btn btn-danger btn-sm btn-reject" data-id="${req.id}">❌ 拒绝</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="section">
          <h3 class="section-title">👥 我的搭档</h3>
          <div id="partners-list">
            ${partners.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">还没有搭档？<br>去搜索一个用户，邀请 TA 成为你的搭档吧！</div>
              </div>
            ` : partners.map(p => `
              <div class="partner-card glass-card">
                <div class="partner-info">
                  <div class="partner-name">👤 ${p.partner_username}</div>
                  <div class="partner-streak">🔥 连续 ${p.streak || 0} 天 · 今日打卡 ${p.today_checkins || 0} 次</div>
                </div>
                <div class="partner-actions">
                  <button class="btn btn-primary btn-sm btn-supervise" data-partner-id="${p.partner_id}">👀 监督</button>
                  <button class="btn btn-secondary btn-sm btn-message" data-partnership-id="${p.partnership_id}" data-partner-name="${p.partner_username}">💬 留言</button>
                  <button class="btn btn-danger btn-sm btn-dissolve" data-id="${p.partnership_id}" data-name="${p.partner_username}">解除</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      this.bindEvents();
    };

    // Stale-While-Revalidate: Instant render from cache
    if (this.cache) {
      drawUI(this.cache.partners, this.cache.pendingRequests);
    }

    try {
      const [partnersData, requestsData] = await Promise.all([
        API.partners.list(),
        API.partners.getRequests()
      ]);
      const partners = partnersData.partners || [];
      const requests = requestsData.requests || [];
      const pendingRequests = requests.filter(r => r.status === 'pending');

      // Update cache
      this.cache = { partners, pendingRequests };
      
      drawUI(partners, pendingRequests);
    } catch (err) {
      if (!this.cache) {
        app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载搭档列表失败</div></div>';
        App.showToast(err.message, 'error');
      }
    }
  },
  
  bindEvents() {
    // Search
    document.getElementById('btn-search')?.addEventListener('click', () => this.handleSearch());
    document.getElementById('search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });
    
    // Accept/Reject requests
    document.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', () => this.handleRespond(btn.dataset.id, 'accept'));
    });
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => this.handleRespond(btn.dataset.id, 'reject'));
    });
    
    // Supervise (review partner checkins)
    document.querySelectorAll('.btn-supervise').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigate('checkin', { mode: 'review', partnerId: btn.dataset.partnerId });
      });
    });
    
    // Message
    document.querySelectorAll('.btn-message').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigate('messages', { 
          partnershipId: btn.dataset.partnershipId, 
          partnerName: btn.dataset.partnerName 
        });
      });
    });
    
    // Dissolve
    document.querySelectorAll('.btn-dissolve').forEach(btn => {
      btn.addEventListener('click', () => this.handleDissolve(btn.dataset.id, btn.dataset.name));
    });
  },
  
  async handleSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) { App.showToast('请输入搜索关键词', 'warning'); return; }
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await API.users.search(query);
      const users = data.users || [];
      if (users.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state"><div class="empty-text">未找到相关用户</div></div>';
        return;
      }
      resultsDiv.innerHTML = users.map(u => `
        <div class="search-item glass-card">
          <span>👤 ${u.username}</span>
          <button class="btn btn-primary btn-sm btn-invite" data-user-id="${u.id}">📨 邀请</button>
        </div>
      `).join('');
      
      document.querySelectorAll('.btn-invite').forEach(btn => {
        btn.addEventListener('click', () => this.handleSendRequest(btn.dataset.userId, btn));
      });
    } catch (err) {
      resultsDiv.innerHTML = '';
      App.showToast(err.message, 'error');
    }
  },
  
  async handleSendRequest(userId, btn) {
    try {
      btn.disabled = true;
      btn.textContent = '已发送';
      await API.partners.request({ to_user_id: userId });
      App.showToast('邀请已发送！', 'success');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '📨 邀请';
      App.showToast(err.message, 'error');
    }
  },
  
  async handleRespond(requestId, action) {
    try {
      await API.partners.respondRequest(requestId, { action });
      App.showToast(action === 'accept' ? '已接受邀请！🎉' : '已拒绝邀请', action === 'accept' ? 'success' : 'info');
      this.render();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },
  
  handleDissolve(partnershipId, partnerName) {
    App.showModal(
      '⚠️ 确认解除搭档',
      `<p>确定要解除与 <strong>${partnerName}</strong> 的搭档关系吗？</p><p class="text-secondary">解除后需要重新邀请才能恢复合作。</p>`,
      async () => {
        try {
          await API.partners.remove(partnershipId);
          App.showToast('搭档关系已解除', 'success');
          this.render();
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      }
    );
  },
};
