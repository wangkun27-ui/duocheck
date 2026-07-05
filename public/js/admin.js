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

      // Safe Date parsing helper to prevent browser-specific exceptions
      const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date();
        const formatted = dateStr.replace(/-/g, '/').replace('T', ' ').split('.')[0];
        const d = new Date(formatted);
        return isNaN(d.getTime()) ? new Date(dateStr) : d;
      };

      app.innerHTML = `
        <div class="section">
          <h2 class="section-title">🛡️ 管理员后台仪表盘</h2>
          <div class="stats-row">
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.total_users || 0}</div>
              <div class="stat-label">👥 注册总人数</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.active_partnerships || 0}</div>
              <div class="stat-label">🤝 活跃搭档对数</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.total_goals || 0}</div>
              <div class="stat-label">🎯 目标总数</div>
            </div>
            <div class="stat-card glass-card">
              <div class="stat-num">${stats.total_checkins || 0}</div>
              <div class="stat-label">📸 累计打卡数</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">👥 用户管理 (${users.length})</h3>
          <div class="glass-card" style="padding: 15px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                  <th style="padding: 8px;">ID</th>
                  <th style="padding: 8px;">用户名</th>
                  <th style="padding: 8px;">角色</th>
                  <th style="padding: 8px;">注册时间</th>
                  <th style="padding: 8px;">操作</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" data-user-row-id="${u.id}">
                    <td style="padding: 8px; color: var(--text-secondary);">${u.id}</td>
                    <td style="padding: 8px; font-weight: 500;">${u.username}</td>
                    <td style="padding: 8px;">${u.is_admin ? '<span class="badge badge-warning">管理员</span>' : '<span class="badge badge-success">普通用户</span>'}</td>
                    <td style="padding: 8px; color: var(--text-secondary); font-size: 0.9em;">${parseSafeDate(u.created_at).toLocaleString('zh-CN')}</td>
                    <td style="padding: 8px;">
                      ${u.is_admin ? '-' : `<button class="btn btn-danger btn-sm btn-delete-user" data-id="${u.id}" data-name="${u.username}">🗑️ 删除用户</button>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">📸 动态打卡审核 (${checkins.length})</h3>
          <div id="admin-checkins-list" style="display: flex; flex-direction: column; gap: 15px;">
            ${checkins.length === 0 ? `
              <div class="empty-state"><div class="empty-text">暂无打卡动态记录</div></div>
            ` : checkins.map(c => `
              <div class="glass-card" style="padding: 15px; display: flex; flex-direction: column; gap: 10px;" data-checkin-id="${c.id}">
                <div class="flex-between">
                  <div>
                    <strong>👤 ${c.username}</strong>
                    <span style="color: var(--text-secondary); font-size: 0.9em; margin-left: 10px;">打卡目标: ${c.goal_title}</span>
                  </div>
                  <span style="font-size: 0.85em; color: var(--text-secondary);">${parseSafeDate(c.created_at).toLocaleString('zh-CN')}</span>
                </div>
                ${c.note ? `<p style="margin: 5px 0;">💬 ${c.note}</p>` : ''}
                ${c.images && c.images.length > 0 ? `
                  <div class="image-gallery" style="margin-top: 5px;">
                    ${c.images.map(img => `<img src="${img}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />`).join('')}
                  </div>
                ` : ''}
                <div class="flex-between" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                  <div>
                    <span class="badge ${c.verified_status === 'confirmed' ? 'badge-success' : c.verified_status === 'questioned' ? 'badge-danger' : 'badge-warning'}">
                      ${c.verified_status === 'confirmed' ? '已通过' : c.verified_status === 'questioned' ? '被质疑' : '未验证'}
                    </span>
                    ${c.verify_comment ? `<span style="color: var(--text-secondary); font-size: 0.9em; margin-left: 10px;">评语: ${c.verify_comment} (核验人: ${c.verified_username})</span>` : ''}
                  </div>
                  <button class="btn btn-danger btn-sm btn-delete-checkin" data-id="${c.id}">🗑️ 删除此动态</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">🎯 全站目标管理 (${goals.length})</h3>
          <div class="glass-card" style="padding: 15px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <th style="padding: 8px;">创建人</th>
                  <th style="padding: 8px;">目标标题</th>
                  <th style="padding: 8px;">描述</th>
                  <th style="padding: 8px;">状态</th>
                  <th style="padding: 8px;">操作</th>
                </tr>
              </thead>
              <tbody>
                ${goals.map(g => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 8px; font-weight: 500;">👤 ${g.username}</td>
                    <td style="padding: 8px;">${g.title}</td>
                    <td style="padding: 8px; color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.description || '-'}</td>
                    <td style="padding: 8px;">
                      <span class="badge ${g.status === 'active' ? 'badge-success' : g.status === 'completed' ? 'badge-info' : 'badge-danger'}">
                        ${g.status === 'active' ? '活跃中' : g.status === 'completed' ? '已完成' : '已放弃'}
                      </span>
                    </td>
                    <td style="padding: 8px;">
                      <select class="admin-goal-status-select" data-id="${g.id}" style="background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px;">
                        <option value="active" ${g.status === 'active' ? 'selected' : ''}>活跃中</option>
                        <option value="completed" ${g.status === 'completed' ? 'selected' : ''}>已完成</option>
                        <option value="abandoned" ${g.status === 'abandoned' ? 'selected' : ''}>强制废弃</option>
                      </select>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
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
          
          // Optimistic UI/DOM Patching: Update goal status badge color and text instantly without calling this.render()
          const row = select.closest('tr');
          if (row) {
            const badge = row.querySelector('.badge');
            if (badge) {
              badge.className = `badge ${status === 'active' ? 'badge-success' : status === 'completed' ? 'badge-info' : 'badge-danger'}`;
              badge.textContent = status === 'active' ? '活跃中' : status === 'completed' ? '已完成' : '已放弃';
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
            
            // Dynamic UI row removal
            const row = document.querySelector(`tr[data-user-row-id="${id}"]`);
            if (row) {
              row.style.transition = 'all 0.3s ease';
              row.style.background = 'rgba(239, 68, 68, 0.15)';
              row.style.opacity = '0';
              setTimeout(() => {
                row.remove();
              }, 300);
            }
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        });
      });
    });
  }
};
