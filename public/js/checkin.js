window.CheckinPage = {
  selectedImages: {},  // goalId -> File[]
  
  async render(mode = 'checkin', data = {}) {
    const app = document.getElementById('app');
    
    if (mode === 'review') {
      await this.renderReview(data.partnerId);
      return;
    }
    
    try {
      const goalsData = await API.goals.list();
      const goals = (goalsData.goals || []).filter(g => g.status === 'active');
      
      // Get today's checkins for each goal
      const today = new Date();
      const month = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      
      app.innerHTML = `
        <div class="section">
          <h2 class="section-title">📸 今日打卡</h2>
          ${goals.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🎯</div>
              <div class="empty-text">还没有活跃目标<br>先去设定一个目标吧！</div>
              <button class="btn btn-primary mt-2" onclick="App.navigate('goals')">🎯 设定目标</button>
            </div>
          ` : goals.map(goal => `
            <div class="checkin-card glass-card" data-goal-id="${goal.id}">
              <div class="checkin-header">
                <h3>🎯 ${goal.title}</h3>
                ${goal.description ? `<p class="text-secondary">${goal.description}</p>` : ''}
              </div>
              <div id="checkin-content-${goal.id}">
                <div class="image-upload-area" id="upload-area-${goal.id}">
                  <div class="upload-icon">📸</div>
                  <div class="upload-text">点击或拖拽上传图片（最多3张）</div>
                  <input type="file" id="file-input-${goal.id}" accept="image/*" multiple hidden>
                </div>
                <div class="image-preview-grid" id="preview-grid-${goal.id}"></div>
                <div class="form-group mt-1">
                  <label>📝 打卡说明</label>
                  <textarea class="form-input" id="checkin-note-${goal.id}" placeholder="记录今天的完成情况..."></textarea>
                </div>
                <button class="btn btn-primary btn-checkin" data-goal-id="${goal.id}">✅ 提交打卡</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      // Setup image upload for each goal
      goals.forEach(goal => {
        this.selectedImages[goal.id] = [];
        this.setupImageUpload(goal.id);
      });
      
      // Checkin submit buttons
      document.querySelectorAll('.btn-checkin').forEach(btn => {
        btn.addEventListener('click', () => this.handleCheckin(btn.dataset.goalId));
      });
      
      // If specific goal was passed, scroll to it
      if (data.goalId) {
        const el = document.querySelector(`[data-goal-id="${data.goalId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
    } catch (err) {
      app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载失败</div></div>';
      App.showToast(err.message, 'error');
    }
  },
  
  setupImageUpload(goalId) {
    const area = document.getElementById(`upload-area-${goalId}`);
    const fileInput = document.getElementById(`file-input-${goalId}`);
    if (!area || !fileInput) return;
    
    area.addEventListener('click', () => fileInput.click());
    
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      this.addImages(goalId, e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', () => {
      this.addImages(goalId, fileInput.files);
      fileInput.value = '';
    });
  },
  
  addImages(goalId, files) {
    const current = this.selectedImages[goalId] || [];
    const remaining = 3 - current.length;
    if (remaining <= 0) {
      App.showToast('最多只能上传3张图片', 'warning');
      return;
    }
    const newFiles = Array.from(files).slice(0, remaining);
    this.selectedImages[goalId] = [...current, ...newFiles];
    this.renderPreviews(goalId);
    
    if (this.selectedImages[goalId].length >= 3) {
      const area = document.getElementById(`upload-area-${goalId}`);
      if (area) area.style.display = 'none';
    }
  },
  
  renderPreviews(goalId) {
    const grid = document.getElementById(`preview-grid-${goalId}`);
    if (!grid) return;
    const images = this.selectedImages[goalId] || [];
    grid.innerHTML = images.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="image-preview">
          <img src="${url}" alt="预览">
          <button class="remove-btn" data-goal-id="${goalId}" data-index="${idx}">&times;</button>
        </div>
      `;
    }).join('');
    
    grid.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gid = btn.dataset.goalId;
        const idx = parseInt(btn.dataset.index);
        this.selectedImages[gid].splice(idx, 1);
        this.renderPreviews(gid);
        const area = document.getElementById(`upload-area-${gid}`);
        if (area) area.style.display = '';
      });
    });
  },
  
  async handleCheckin(goalId) {
    const note = document.getElementById(`checkin-note-${goalId}`)?.value?.trim() || '';
    const images = this.selectedImages[goalId] || [];
    
    if (!note && images.length === 0) {
      App.showToast('请至少提供一张图片或文字说明', 'warning');
      return;
    }
    
    const formData = new FormData();
    formData.append('goal_id', goalId);
    formData.append('note', note);
    images.forEach(img => formData.append('images', img));
    
    try {
      await API.checkins.create(formData);
      App.showToast('打卡成功！🎉', 'success');
      // Replace the checkin form with success state
      const content = document.getElementById(`checkin-content-${goalId}`);
      if (content) {
        content.innerHTML = `
          <div class="checkin-proof">
            <div class="badge badge-success">✅ 已打卡</div>
            ${images.length > 0 ? `
              <div class="checkin-images image-preview-grid">
                ${images.map(f => `<div class="image-preview"><img src="${URL.createObjectURL(f)}" alt="打卡图片"></div>`).join('')}
              </div>
            ` : ''}
            ${note ? `<div class="checkin-note">📝 ${note}</div>` : ''}
          </div>
        `;
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },
  
  async renderReview(partnerId) {
    const app = document.getElementById('app');
    try {
      const data = await API.checkins.partnerToday(partnerId);
      const checkins = data.checkins || [];
      
      // Safe Date parsing helper to prevent browser-specific exceptions
      const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date();
        // Replace dashes with slashes (e.g. '2024-05-01' -> '2024/05/01') because iOS/Safari date parser throws patterns match error on dashes
        const formatted = dateStr.replace(/-/g, '/').replace('T', ' ').split('.')[0];
        const d = new Date(formatted);
        return isNaN(d.getTime()) ? new Date(dateStr) : d;
      };
      
      app.innerHTML = `
        <div class="section">
          <div class="flex-between mb-2">
            <h2 class="section-title">👀 审核搭档打卡</h2>
            <button class="btn btn-ghost" id="btn-back-partners">← 返回</button>
          </div>
          ${checkins.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">😴</div>
              <div class="empty-text">搭档今天还没有打卡记录</div>
            </div>
          ` : checkins.map(checkin => `
            <div class="checkin-card glass-card" data-checkin-id="${checkin.id}">
              <div class="checkin-header">
                <h3>🎯 ${checkin.goal_title || '目标打卡'}</h3>
                <span class="text-secondary">${parseSafeDate(checkin.created_at).toLocaleTimeString('zh-CN')}</span>
              </div>
              <div class="checkin-proof">
                ${checkin.images && checkin.images.length > 0 ? `
                  <div class="checkin-images image-preview-grid">
                    ${checkin.images.map(img => `<div class="image-preview"><img src="${img}" alt="打卡图片"></div>`).join('')}
                  </div>
                ` : ''}
                ${checkin.note ? `<div class="checkin-note">📝 ${checkin.note}</div>` : ''}
              </div>
              ${checkin.verified_status ? `
                <div class="badge ${checkin.verified_status === 'confirmed' ? 'badge-success' : 'badge-danger'}">
                  ${checkin.verified_status === 'confirmed' ? '✅ 已确认' : '❌ 已质疑'}
                </div>
                ${checkin.verify_comment ? `<div class="checkin-note">💬 ${checkin.verify_comment}</div>` : ''}
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
      
      document.getElementById('btn-back-partners')?.addEventListener('click', () => App.navigate('partners'));
      
      document.querySelectorAll('.btn-verify-confirm').forEach(btn => {
        btn.addEventListener('click', () => this.handleVerify(btn.dataset.checkinId, 'confirmed'));
      });
      document.querySelectorAll('.btn-verify-question').forEach(btn => {
        btn.addEventListener('click', () => this.handleVerify(btn.dataset.checkinId, 'questioned'));
      });
      
    } catch (err) {
      app.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><div class="empty-text">加载失败</div></div>';
      App.showToast(err.message, 'error');
    }
  },
  
  async handleVerify(checkinId, status) {
    const comment = document.getElementById(`verify-comment-${checkinId}`)?.value?.trim() || '';
    try {
      await API.checkins.verify(checkinId, { verified_status: status, verify_comment: comment });
      App.showToast(status === 'confirmed' ? '已确认打卡 ✅' : '已提出质疑 ❌', status === 'confirmed' ? 'success' : 'warning');
      // Update the UI for this checkin
      const card = document.querySelector(`[data-checkin-id="${checkinId}"]`);
      if (card) {
        const verifySection = card.querySelector('.verify-section');
        if (verifySection) {
          verifySection.innerHTML = `
            <div class="badge ${status === 'confirmed' ? 'badge-success' : 'badge-danger'}">
              ${status === 'confirmed' ? '✅ 已确认' : '❌ 已质疑'}
            </div>
            ${comment ? `<div class="checkin-note mt-1">💬 ${comment}</div>` : ''}
          `;
        }
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },
};
