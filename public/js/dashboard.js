window.DashboardPage = {
  // Store dashboard response in client-side memory cache
  cache: null,

  async render() {
    const app = document.getElementById('app');

    // UI drawing helper function
    const drawUI = (dashData, meData) => {
      const stats = meData.stats || {};
      const streak = dashData.streak || 0;
      const todayGoals = dashData.today_goals || [];
      const partnerActivities = dashData.partner_activities || [];
      const dissolved = dashData.dissolved_partnerships || [];
      const fireEmojis = streak > 0 ? '🔥'.repeat(Math.min(streak, 10)) : '';

      app.innerHTML = `
        ${dissolved.length > 0 ? `
          <div class="dissolved-warning glass-card">
            <h3>⚠️ 搭档关系已解除</h3>
            <p>以下搭档因未打卡已自动解除合作关系：</p>
            <ul>${dissolved.map(d => `<li>${d.partner_username || d.username || '未知用户'}</li>`).join('')}</ul>
          </div>
        ` : ''}
        
        <div class="welcome-banner glass-card">
          <h2>👋 欢迎回来，${App.currentUser.username}！</h2>
          <div class="streak-display">
            <span class="streak-fire">${fireEmojis || '🔥'}</span>
            <span class="streak-text">连续打卡 <strong>${streak}</strong> 天</span>
          </div>
        </div>
        
        <div class="stats-row">
          <div class="stat-card glass-card">
            <div class="stat-value">${streak}</div>
            <div class="stat-label">🔥 连续打卡</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-value">${stats.total_checkins || 0}</div>
            <div class="stat-label">✅ 总打卡</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-value">${stats.active_goals || 0}</div>
            <div class="stat-label">🎯 活跃目标</div>
          </div>
          <div class="stat-card glass-card">
            <div class="stat-value">${stats.partner_count || 0}</div>
            <div class="stat-label">👥 搭档数量</div>
          </div>
        </div>
        
        <div class="quick-actions">
          <button class="btn btn-primary" id="qa-checkin">📸 去打卡</button>
          <button class="btn btn-secondary" id="qa-partners">👥 查看搭档</button>
          <button class="btn btn-ghost" id="qa-add-goal">🎯 新增目标</button>
        </div>
        
        <div class="section">
          <h3 class="section-title">📋 今日目标</h3>
          <div id="today-goals">
            ${todayGoals.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div class="empty-text">还没有设定目标<br>快去设定一个吧！</div>
              </div>
            ` : todayGoals.map(goal => `
              <div class="goal-card glass-card">
                <div class="goal-info">
                  <div class="goal-title">${goal.title}</div>
                  <div class="goal-desc">${goal.description || ''}</div>
                </div>
                <div class="goal-status ${goal.checked_in ? 'checked' : 'unchecked'}">
                  ${goal.checked_in 
                    ? '<span class="badge badge-success">✅ 已打卡</span>' 
                    : `<button class="btn btn-primary btn-sm btn-quick-checkin" data-goal-id="${goal.id}">📸 打卡</button>`
                  }
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="section">
          <h3 class="section-title">👥 搭档动态</h3>
          <div id="partner-activities">
            ${partnerActivities.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">还没有搭档动态<br>去找一个搭档互相监督吧！</div>
              </div>
            ` : partnerActivities.map(activity => `
              <div class="activity-card glass-card">
                <div class="activity-header">
                  <strong>${activity.partner_username || activity.username}</strong>
                  <span class="badge ${activity.verified ? 'badge-success' : 'badge-warning'}">
                    ${activity.verified ? '已验证' : '待审核'}
                  </span>
                </div>
                <div class="activity-body">
                  <div class="activity-goal">🎯 ${activity.goal_title || '目标'}</div>
                  ${activity.note ? `<div class="activity-note">${activity.note}</div>` : ''}
                </div>
                ${!activity.verified ? `
                  <button class="btn btn-ghost btn-sm btn-review" data-partner-id="${activity.partner_id}">👀 去审核</button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      // Bind event handlers
      document.getElementById('qa-checkin')?.addEventListener('click', () => App.navigate('checkin'));
      document.getElementById('qa-partners')?.addEventListener('click', () => App.navigate('partners'));
      document.getElementById('qa-add-goal')?.addEventListener('click', () => {
        GoalsPage.showAddGoalModal();
      });
      
      document.querySelectorAll('.btn-quick-checkin').forEach(btn => {
        btn.addEventListener('click', () => {
          App.navigate('checkin', { mode: 'checkin', goalId: btn.dataset.goalId });
        });
      });
      
      document.querySelectorAll('.btn-review').forEach(btn => {
        btn.addEventListener('click', () => {
          App.navigate('checkin', { mode: 'review', partnerId: btn.dataset.partnerId });
        });
      });
    };

    // Stale-While-Revalidate (SWR): 
    // 1. If we have cached dashboard and me stats, render immediately (0ms wait)
    if (this.cache && App.cache.me) {
      drawUI(this.cache, App.cache.me);
    }

    // 2. Fetch fresh data in the background and patch the DOM silently
    try {
      const [dashData, meData] = await Promise.all([
        API.checkins.dashboard(),
        App.getMeCached() // Use caching to lower backend load
      ]);
      
      // Save to cache
      this.cache = dashData;
      
      // Re-draw UI silently with fresh data without layout flashing
      drawUI(dashData, meData);
    } catch (err) {
      if (!this.cache) {
        app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载仪表盘失败</div></div>';
        App.showToast(err.message, 'error');
      }
    }
  },
};
