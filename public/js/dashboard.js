window.DashboardPage = {
  // Store dashboard response in client-side memory cache
  cache: null,

  async render() {
    const app = document.getElementById('app');

    // UI drawing helper function
    const drawUI = (dashData, meData) => {
      const stats = meData.stats || {};
      const streak = dashData.streak || 0;
      const todayGoals = dashData.goals || [];
      const partnerActivities = dashData.partnerActivity?.goals?.filter(g => g.checked_in).map(g => ({
        partner_username: dashData.partnerActivity.partner_username,
        goal_title: g.goal?.title || '目标',
        note: g.checkin?.note,
        verified: g.checkin?.verified_status !== null && g.checkin?.verified_status !== undefined,
        partner_id: dashData.partnerActivity.partner_id,
        checkin_id: g.checkin?.id
      })) || [];
      const dissolved = dashData.dissolvedPartnerships || [];
      const partnerFeed = dashData.partnerFeed || [];
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
          <div class="stat-card glass-card clickable-stat" id="stat-total-checkins" title="点击跳转至打卡页面">
            <div class="stat-value">${stats.total_checkins || 0}</div>
            <div class="stat-label">✅ 总打卡</div>
          </div>
          <div class="stat-card glass-card clickable-stat" id="stat-active-goals" title="点击跳转至目标页面">
            <div class="stat-value">${stats.active_goals || 0}</div>
            <div class="stat-label">🎯 活跃目标</div>
          </div>
          <div class="stat-card glass-card clickable-stat" id="stat-my-partner" title="点击跳转至搭档页面">
            <div class="stat-value" style="font-size: ${dashData.partnerActivity?.partner_username ? '1.5rem' : '1.8rem'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${dashData.partnerActivity?.partner_username || '暂无'}
            </div>
            <div class="stat-label">🤝 我的搭档</div>
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
          <h3 class="section-title">⚡ 搭档动态与通知</h3>
          <div id="partner-activities">
            ${partnerFeed.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">暂无搭档新动态<br>搭档打卡、留言、审核通过与质疑都会在这里实时提醒！</div>
              </div>
            ` : partnerFeed.map(item => {
              const parseSafeTime = (dateStr) => {
                if (!dateStr) return '';
                let str = dateStr.trim();
                if (!str.endsWith('Z') && !str.includes('+')) str = str.replace(' ', 'T') + 'Z';
                const d = new Date(str);
                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
              };

              if (item.type === 'partner_checkin') {
                const isVerified = item.verified_status !== null && item.verified_status !== undefined;
                return `
                  <div class="activity-card glass-card">
                    <div class="activity-header">
                      <span>📸 <strong>${item.partner_username}</strong> 提交了新打卡</span>
                      <span class="badge ${isVerified ? (item.verified_status === 'confirmed' ? 'badge-success' : 'badge-danger') : 'badge-warning'}">
                        ${isVerified ? (item.verified_status === 'confirmed' ? '已通过' : '已质疑') : '待审核'}
                      </span>
                    </div>
                    <div class="activity-body">
                      <div class="activity-goal">🎯 目标：「${item.goal_title}」</div>
                      ${item.note ? `<div class="activity-note">📝 说明：${item.note}</div>` : ''}
                    </div>
                    <div class="flex-between mt-1" style="align-items:center;">
                      <span class="text-secondary" style="font-size:0.75rem;">${parseSafeTime(item.time)}</span>
                      ${!isVerified ? `
                        <button class="btn btn-primary btn-sm btn-review" data-partner-id="${item.partner_id}">👀 去审核</button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }

              if (item.type === 'partner_confirmed') {
                return `
                  <div class="activity-card glass-card" style="border-left: 3px solid var(--success);">
                    <div class="activity-header">
                      <span>🎉 <strong>${item.partner_username}</strong> 确认通过了你的打卡</span>
                      <span class="badge badge-success">✅ 验证通过</span>
                    </div>
                    <div class="activity-body">
                      <div class="activity-goal">🎯 目标：「${item.goal_title}」</div>
                      ${item.verify_comment ? `<div class="activity-note">💬 评语：${item.verify_comment}</div>` : ''}
                    </div>
                    <div class="text-secondary" style="font-size:0.75rem; margin-top:0.3rem;">${parseSafeTime(item.time)}</div>
                  </div>
                `;
              }

              if (item.type === 'partner_questioned') {
                return `
                  <div class="activity-card glass-card" style="border-left: 3px solid var(--danger);">
                    <div class="activity-header">
                      <span>⚠️ <strong>${item.partner_username}</strong> 质疑了你的打卡</span>
                      <span class="badge badge-danger">❌ 被质疑</span>
                    </div>
                    <div class="activity-body">
                      <div class="activity-goal">🎯 目标：「${item.goal_title}」</div>
                      ${item.verify_comment ? `<div class="activity-note" style="color:var(--warning);font-weight:500;">💬 质疑评语：${item.verify_comment}</div>` : ''}
                    </div>
                    <div class="flex-between mt-1" style="align-items:center;">
                      <span class="text-secondary" style="font-size:0.75rem;">${parseSafeTime(item.time)}</span>
                      <button class="btn btn-primary btn-sm btn-recheckin" data-goal-id="${item.goal_id}">🔄 去重新打卡</button>
                    </div>
                  </div>
                `;
              }

              if (item.type === 'partner_message') {
                return `
                  <div class="activity-card glass-card" style="border-left: 3px solid var(--primary-light);">
                    <div class="activity-header">
                      <span>💬 <strong>${item.partner_username}</strong> 发来新留言</span>
                      <span class="badge badge-info">新消息</span>
                    </div>
                    <div class="activity-body">
                      <div class="activity-note" style="font-size:0.9rem; color:var(--text-primary);">「${item.content}」</div>
                    </div>
                    <div class="flex-between mt-1" style="align-items:center;">
                      <span class="text-secondary" style="font-size:0.75rem;">${parseSafeTime(item.time)}</span>
                      <button class="btn btn-secondary btn-sm btn-reply-msg" data-partnership-id="${item.partnership_id}" data-partner-name="${item.partner_username}">💬 去回复</button>
                    </div>
                  </div>
                `;
              }

              return '';
            }).join('')}
          </div>
        </div>
      `;
      
      // Bind event handlers
      document.getElementById('qa-checkin')?.addEventListener('click', () => App.navigate('checkin'));
      document.getElementById('qa-partners')?.addEventListener('click', () => App.navigate('partners'));
      document.getElementById('qa-add-goal')?.addEventListener('click', () => {
        GoalsPage.showAddGoalModal();
      });

      // Interactive Stat Card Navigation
      document.getElementById('stat-total-checkins')?.addEventListener('click', () => App.navigate('checkin'));
      document.getElementById('stat-active-goals')?.addEventListener('click', () => App.navigate('goals'));
      document.getElementById('stat-my-partner')?.addEventListener('click', () => App.navigate('partners'));
      
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

      document.querySelectorAll('.btn-recheckin').forEach(btn => {
        btn.addEventListener('click', () => {
          App.navigate('checkin', { mode: 'checkin', goalId: btn.dataset.goalId });
        });
      });

      document.querySelectorAll('.btn-reply-msg').forEach(btn => {
        btn.addEventListener('click', () => {
          App.navigate('messages', {
            partnershipId: btn.dataset.partnershipId,
            partnerName: btn.dataset.partnerName
          });
        });
      });
    };

    // Fetch fresh data from API and render UI
    try {
      const [dashData, meData] = await Promise.all([
        API.checkins.dashboard(),
        App.getMeCached()
      ]);
      
      this.cache = dashData;
      drawUI(dashData, meData);
    } catch (err) {
      app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载仪表盘失败</div></div>';
      App.showToast(err.message, 'error');
    }
  },
};
