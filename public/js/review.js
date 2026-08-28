/**
 * ReviewPage — 监督搭档打卡独立页面
 * 当用户拥有活跃搭档时出现在导航栏中
 */
window.ReviewPage = {

  async render() {
    const app = document.getElementById('app');
    try {
      // 1. 获取当前搭档信息
      const partnerData = await API.partners.list();
      const partners = partnerData.partners || [];
      const activePartners = partners.filter(p => p.status === 'active');

      if (activePartners.length === 0) {
        app.innerHTML = `
          <div class="section">
            <h2 class="section-title">👀 监督搭档打卡</h2>
            <div class="empty-state">
              <div class="empty-icon">🤝</div>
              <div class="empty-text">你还没有活跃的搭档<br>去搭档页面邀请一位搭档吧！</div>
              <button class="btn btn-primary mt-2" onclick="App.navigate('partners')">去找搭档</button>
            </div>
          </div>
        `;
        return;
      }

      // 2. 加载所有搭档今日打卡
      const results = await Promise.all(
        activePartners.map(async p => {
          try {
            const data = await API.checkins.partnerToday(p.partner_id);
            return { partner: p, checkins: data.checkins || [] };
          } catch {
            return { partner: p, checkins: [] };
          }
        })
      );

      // 3. 时间格式工具
      const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date();
        let str = dateStr.trim();
        if (!str.endsWith('Z') && !str.includes('+')) str = str.replace(' ', 'T') + 'Z';
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date() : d;
      };
      const toBeijingTime = (dateStr) =>
        parseSafeDate(dateStr).toLocaleTimeString('zh-CN', {
          timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'
        });

      // 4. 渲染
      app.innerHTML = `
        <div class="section">
          <h2 class="section-title">👀 监督搭档打卡</h2>
          <p class="text-secondary" style="margin-bottom:1.5rem; font-size:0.9rem;">
            查看搭档今日打卡情况，并给予确认或质疑
          </p>

          ${results.map(({ partner, checkins }) => {
            const pendingCount = checkins.filter(c => !c.verified_status).length;
            return `
              <div class="glass-card" style="margin-bottom:1.5rem; padding:1.5rem;">
                <!-- 搭档信息头部 -->
                <div class="flex-between mb-2" style="align-items:center;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    ${App.renderAvatar({ username: partner.partner_username, avatar: partner.partner_avatar }, 42)}
                    <div>
                      <div style="font-weight:600;font-size:1rem;">${partner.partner_username}</div>
                      <div class="text-secondary" style="font-size:0.82rem;">今日打卡 ${checkins.length} 条</div>
                    </div>
                  </div>
                  ${pendingCount > 0 ? `<span class="badge badge-warning">⏳ ${pendingCount} 待审核</span>` : checkins.length > 0 ? `<span class="badge badge-success">✅ 已全部审核</span>` : `<span class="badge" style="background:rgba(255,255,255,0.1);">😴 未打卡</span>`}
                </div>

                <!-- 打卡列表 -->
                ${checkins.length === 0 ? `
                  <div style="text-align:center;padding:2rem 0;color:var(--text-secondary);">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">😴</div>
                    <div>搭档今天还没有提交打卡</div>
                  </div>
                ` : checkins.map(checkin => `
                  <div class="checkin-card glass-card" data-checkin-id="${checkin.id}" style="margin-top:1rem;">
                    <div class="checkin-header">
                      <h3>🎯 ${checkin.goal_title || '目标打卡'}</h3>
                      <span class="text-secondary">${toBeijingTime(checkin.created_at)}</span>
                    </div>
                    <div class="checkin-proof">
                      ${checkin.images && checkin.images.length > 0 ? `
                        <div class="checkin-images image-preview-grid">
                          ${checkin.images.map(img => `<div class="image-preview"><img src="${img}" alt="打卡图片" class="lightbox-img-trigger" data-src="${img}"></div>`).join('')}
                        </div>
                      ` : ''}
                      ${checkin.note ? `<div class="checkin-note">📝 ${checkin.note}</div>` : ''}
                    </div>
                    ${checkin.verified_status ? `
                      <div style="margin-top:0.75rem;">
                        <span class="badge ${checkin.verified_status === 'confirmed' ? 'badge-success' : 'badge-danger'}">
                          ${checkin.verified_status === 'confirmed' ? '✅ 已确认' : '❌ 已质疑'}
                        </span>
                        ${checkin.verify_comment ? `<div class="checkin-note" style="margin-top:0.5rem;">💬 ${checkin.verify_comment}</div>` : ''}
                      </div>
                    ` : `
                      <div class="verify-section">
                        <div class="form-group">
                          <label>💬 审核评论（选填）</label>
                          <input type="text" class="form-input" id="verify-comment-${checkin.id}" placeholder="给搭档留个评论...">
                        </div>
                        <div class="verify-actions">
                          <button class="btn btn-primary btn-sm btn-verify-confirm" data-checkin-id="${checkin.id}">✅ 确认</button>
                          <button class="btn btn-danger btn-sm btn-verify-question" data-checkin-id="${checkin.id}">❌ 质疑</button>
                        </div>
                      </div>
                    `}
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
      `;

      // 5. 绑定审核按钮事件
      document.querySelectorAll('.btn-verify-confirm').forEach(btn => {
        btn.addEventListener('click', () => this.handleVerify(btn.dataset.checkinId, 'confirmed'));
      });
      document.querySelectorAll('.btn-verify-question').forEach(btn => {
        btn.addEventListener('click', () => this.handleVerify(btn.dataset.checkinId, 'questioned'));
      });

    } catch (err) {
      app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载失败，请稍后重试</div></div>';
      App.showToast(err.message, 'error');
    }
  },

  async handleVerify(checkinId, status) {
    const comment = document.getElementById(`verify-comment-${checkinId}`)?.value?.trim() || '';
    try {
      await API.checkins.verify(checkinId, { verified_status: status, verify_comment: comment });
      App.showToast(status === 'confirmed' ? '已确认打卡 ✅' : '已提出质疑 ❌', status === 'confirmed' ? 'success' : 'warning');
      // 乐观更新：将审核区块替换为已审核状态
      const card = document.querySelector(`[data-checkin-id="${checkinId}"]`);
      if (card) {
        const verifySection = card.querySelector('.verify-section');
        if (verifySection) {
          verifySection.outerHTML = `
            <div style="margin-top:0.75rem;">
              <span class="badge ${status === 'confirmed' ? 'badge-success' : 'badge-danger'}">
                ${status === 'confirmed' ? '✅ 已确认' : '❌ 已质疑'}
              </span>
              ${comment ? `<div class="checkin-note" style="margin-top:0.5rem;">💬 ${comment}</div>` : ''}
            </div>
          `;
        }
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};
