window.AdminPage = {
  async render() {
    const app = document.getElementById('app');
    try {
      const [stats, usersData, checkinsData, goalsData] = await Promise.all([
        API.admin.stats(),
        API.admin.users(),
        API.admin.checkins(),
        API.admin.goals()
      ]);

      const users = usersData.users || [];
      const checkins = checkinsData.checkins || [];
      const goals = goalsData.goals || [];

      const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date();
        // Ensure the string is treated as UTC (add 'Z' if no timezone info present)
        let str = dateStr.trim();
        if (!str.endsWith('Z') && !str.includes('+')) {
          str = str.replace(' ', 'T') + 'Z';
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date() : d;
      };

      // Format a date to Beijing time (UTC+8) date string
      const toBeijingDateStr = (dateStr) => {
        const d = parseSafeDate(dateStr);
        return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
      };

      app.innerHTML = `
        <!-- Stats Overview -->
        <div class="section">
          <h2 class="section-title">🛡️ 管理员后台</h2>
          <div class="stats-row">
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.total_users || 0}</div>
              <div class="stat-label">👥 注册用户</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.active_partnerships || 0}</div>
              <div class="stat-label">🤝 活跃搭档</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.total_goals || 0}</div>
              <div class="stat-label">🎯 全站目标</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.total_checkins || 0}</div>
              <div class="stat-label">📸 累计打卡</div>
            </div>
          </div>
        </div>

        <!-- User Management -->
        <div class="section">
          <h3 class="section-title">👥 用户管理 <span class="badge badge-info">${users.length}</span></h3>
          <div class="admin-card-list">
            ${users.length === 0 ? `<div class="empty-state"><div class="empty-text">暂无用户</div></div>` :
              users.map(u => `
                <div class="admin-user-card glass-card" data-user-row-id="${u.id}">
                  <div class="admin-card-main">
                    <div class="admin-card-avatar">${u.username.charAt(0).toUpperCase()}</div>
                    <div class="admin-card-info">
                      <div class="admin-card-name">${u.username}
                        ${u.is_admin ? '<span class="badge badge-warning" style="margin-left:6px;font-size:0.7em;">管理员</span>' : ''}
                      </div>
                      <div class="admin-card-meta">用户ID: ${u.id} · 注册时间: ${toBeijingDateStr(u.created_at)}</div>
                    </div>
                  </div>
                  <div class="admin-card-actions">
                    ${u.is_admin ? '<span class="badge badge-warning">受保护</span>' :
                      `<button class="btn btn-danger btn-sm btn-delete-user" data-id="${u.id}" data-name="${u.username}">🗑️ 删除</button>`}
                  </div>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- Checkin Review -->
        <div class="section">
          <h3 class="section-title">📸 打卡动态审核 <span class="badge badge-info">${checkins.length}</span></h3>
          <div id="admin-checkins-list" class="admin-card-list">
            ${checkins.length === 0 ? `
              <div class="empty-state"><div class="empty-text">暂无打卡动态记录</div></div>
            ` : checkins.map(c => `
              <div class="admin-checkin-card glass-card" data-checkin-id="${c.id}">
                <div class="admin-checkin-header">
                  <div class="admin-checkin-user">
                    <strong>👤 ${c.username}</strong>
                    <span class="badge ${c.verified_status === 'confirmed' ? 'badge-success' : c.verified_status === 'questioned' ? 'badge-danger' : 'badge-warning'}" style="margin-left:8px;">
                      ${c.verified_status === 'confirmed' ? '✅ 已通过' : c.verified_status === 'questioned' ? '❌ 被质疑' : '⏳ 未验证'}
                    </span>
                  </div>
                  <span class="admin-checkin-date">${toBeijingDateStr(c.created_at)}</span>
                </div>
                <div class="admin-checkin-goal">🎯 ${c.goal_title}</div>
                ${c.note ? `<p class="admin-checkin-note">💬 ${c.note}</p>` : ''}
                ${c.images && c.images.length > 0 ? `
                  <div class="admin-checkin-images">
                    ${c.images.map(img => `<img src="${img}" class="admin-thumb" />`).join('')}
                  </div>
                ` : ''}
                ${c.verify_comment ? `
                  <div class="admin-checkin-comment">评语: ${c.verify_comment} (核验人: ${c.verified_username})</div>
                ` : ''}
                <div class="admin-card-actions" style="margin-top: 0.75rem; border-top: 1px solid var(--glass-border); padding-top: 0.75rem;">
                  <button class="btn btn-danger btn-sm btn-delete-checkin" data-id="${c.id}">🗑️ 删除动态</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Goal Management -->
        <div class="section">
          <h3 class="section-title">🎯 全站目标管理 <span class="badge badge-info">${goals.length}</span></h3>
          <div class="admin-card-list">
            ${goals.length === 0 ? `<div class="empty-state"><div class="empty-text">暂无目标</div></div>` :
              goals.map(g => `
                <div class="admin-goal-card glass-card">
                  <div class="admin-card-main">
                    <div class="admin-card-info">
                      <div class="admin-card-name">${g.title}</div>
                      <div class="admin-card-meta">👤 ${g.username}${g.description ? ' · ' + g.description.slice(0, 30) + (g.description.length > 30 ? '…' : '') : ''}</div>
                    </div>
                  </div>
                  <div class="admin-card-actions">
                    <span class="badge ${g.status === 'active' ? 'badge-success' : g.status === 'completed' ? 'badge-info' : 'badge-danger'}" style="margin-right:8px;">
                      ${g.status === 'active' ? '活跃' : g.status === 'completed' ? '完成' : '放弃'}
                    </span>
                    <select class="admin-goal-status-select form-input" data-id="${g.id}" style="width:auto; padding:0.3rem 1.8rem 0.3rem 0.6rem; font-size:0.8rem; background-color:#0f172a; color:#ffffff;">
                      <option value="active" ${g.status === 'active' ? 'selected' : ''} style="background-color:#0f172a; color:#ffffff;">活跃中</option>
                      <option value="completed" ${g.status === 'completed' ? 'selected' : ''} style="background-color:#0f172a; color:#ffffff;">已完成</option>
                      <option value="abandoned" ${g.status === 'abandoned' ? 'selected' : ''} style="background-color:#0f172a; color:#ffffff;">强制废弃</option>
                    </select>
                    <button class="btn btn-danger btn-sm btn-delete-admin-goal" data-id="${g.id}" data-title="${g.title}">🗑️ 删除</button>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      `;

      this.bindEvents();
    } catch (err) {
      app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载管理后台失败</div></div>';
      App.showToast(err.message, 'error');
    }
  },

  bindEvents() {
    // Delete goal in admin panel
    document.querySelectorAll('.btn-delete-admin-goal').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        App.showModal('⚠️ 确认彻底删除目标', `<p>确定要删除目标 「${title}」 吗？相关打卡记录也会一并清除。</p>`, async () => {
          try {
            await API.admin.deleteGoal(id);
            App.showToast('目标已成功删除', 'success');
            const card = btn.closest('.admin-goal-card');
            if (card) {
              card.style.transition = 'all 0.3s ease';
              card.style.opacity = '0';
              setTimeout(() => card.remove(), 300);
            }
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        });
      });
    });
    // Delete checkin click handler
    document.querySelectorAll('.btn-delete-checkin').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        App.showModal('⚠️ 确认删除', '<p>确定要删除此打卡动态吗？此操作不可逆。</p>', async () => {
          try {
            await API.admin.deleteCheckin(id);
            App.showToast('已成功删除动态', 'success');
            // Optimistic UI/DOM Patching: Fade out and remove checkin card instantly without reloading the entire page
            const card = document.querySelector(`[data-checkin-id="${id}"]`);
            if (card) {
              card.style.transition = 'all 0.3s ease';
              card.style.opacity = '0';
              card.style.transform = 'scale(0.95)';
              setTimeout(() => card.remove(), 300);
            }
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        });
      });
    });

    // Update goal status dropdown change handler
    document.querySelectorAll('.admin-goal-status-select').forEach(select => {
      select.addEventListener('change', async () => {
        const id = select.dataset.id;
        const status = select.value;
        try {
          await API.admin.updateGoal(id, { status });
          App.showToast('已成功更新目标状态', 'success');
          
          // Optimistic UI: Update goal status badge in card layout
          const card = select.closest('.admin-goal-card');
          if (card) {
            const badge = card.querySelector('.badge');
            if (badge) {
              badge.className = `badge ${status === 'active' ? 'badge-success' : status === 'completed' ? 'badge-info' : 'badge-danger'}`;
              badge.textContent = status === 'active' ? '活跃' : status === 'completed' ? '完成' : '放弃';
            }
          }
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });

    // Delete user handler
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        App.showModal('⚠️ 警告：彻底删除用户', `
          <p style="color:#ef4444; font-weight: 600;">确定要彻底删除用户 「${name}」 吗？</p>
          <p style="color:#94a3b8; font-size: 0.9em;">此操作将永久清除该用户及其所有的搭档请求、伙伴关系、打卡动态、目标记录、留言！且不可恢复。</p>
        `, async () => {
          try {
            await API.admin.deleteUser(id);
            App.showToast('已成功彻底删除用户', 'success');
            
            // Optimistic UI: fade out and remove user card
            const card = document.querySelector(`[data-user-row-id="${id}"]`);
            if (card) {
              card.style.transition = 'all 0.3s ease';
              card.style.background = 'rgba(239, 68, 68, 0.15)';
              card.style.opacity = '0';
              setTimeout(() => card.remove(), 300);
            }
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        });
      });
    });
  }
};
