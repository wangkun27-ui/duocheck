window.MessagesPage = {
  currentPartnershipId: null,
  currentPartnerName: null,
  refreshInterval: null,
  
  async render(partnershipId, partnerName) {
    if (!partnershipId) {
      document.getElementById('app').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-text">请从搭档列表选择一个搭档开始聊天</div>
          <button class="btn btn-primary mt-2" onclick="App.navigate('partners')">👥 查看搭档</button>
        </div>
      `;
      return;
    }
    
    this.currentPartnershipId = partnershipId;
    this.currentPartnerName = partnerName;
    
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="messages-container glass-card">
        <div class="messages-header">
          <button class="btn btn-ghost btn-sm" id="btn-back-msg">← 返回</button>
          <h3>💬 与 ${partnerName} 的对话</h3>
          <div></div>
        </div>
        <div class="messages-list" id="messages-list">
          <div class="spinner"></div>
        </div>
        <div class="message-input-area">
          <input type="text" class="form-input" id="msg-input" placeholder="输入消息...">
          <button class="btn btn-primary" id="btn-send-msg">发送</button>
        </div>
      </div>
    `;
    
    document.getElementById('btn-back-msg')?.addEventListener('click', () => {
      this.cleanup();
      App.navigate('partners');
    });
    
    document.getElementById('btn-send-msg')?.addEventListener('click', () => this.handleSend());
    document.getElementById('msg-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });
    
    await this.loadMessages();
    
    // Auto-refresh every 10 seconds
    this.refreshInterval = setInterval(() => this.loadMessages(), 10000);
  },
  
  async loadMessages() {
    if (!this.currentPartnershipId) return;
    try {
      const data = await API.messages.list(this.currentPartnershipId);
      const messages = data.messages || [];
      const list = document.getElementById('messages-list');
      if (!list) return;
      
      if (messages.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">💬</div>
            <div class="empty-text">还没有消息<br>发送第一条消息吧！</div>
          </div>
        `;
        return;
      }
      
      list.innerHTML = messages.map(msg => {
        const isSent = msg.sender_id === App.currentUser.id;
        const time = new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="message-bubble ${isSent ? 'sent' : 'received'}">
            <div class="message-content">${msg.content}</div>
            <div class="message-time">${time}</div>
          </div>
        `;
      }).join('');
      
      // Scroll to bottom
      list.scrollTop = list.scrollHeight;
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  },
  
  async handleSend() {
    const input = document.getElementById('msg-input');
    const content = input?.value?.trim();
    if (!content) return;
    
    input.value = '';
    
    // Optimistically add the message to the UI
    const list = document.getElementById('messages-list');
    const emptyState = list?.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble sent';
    bubble.innerHTML = `
      <div class="message-content">${content}</div>
      <div class="message-time">${time}</div>
    `;
    list?.appendChild(bubble);
    if (list) list.scrollTop = list.scrollHeight;
    
    try {
      await API.messages.send(this.currentPartnershipId, { content });
    } catch (err) {
      App.showToast('消息发送失败', 'error');
      bubble.style.opacity = '0.5';
    }
  },
  
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.currentPartnershipId = null;
    this.currentPartnerName = null;
  },
};
