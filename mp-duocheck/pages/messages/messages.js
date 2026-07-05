const api = require('../../utils/api.js');

Page({
  data: {
    partnershipId: null,
    partnerName: '',
    messages: [],
    currentUserId: null,
    inputContent: '',
    scrollTop: 0,
    lastMessageId: '',
    pollingTimer: null
  },

  onLoad(options) {
    const user = wx.getStorageSync('user');
    this.setData({
      partnershipId: options.partnership_id,
      partnerName: options.partner_name,
      currentUserId: user ? user.id : null
    });

    wx.setNavigationBarTitle({ title: `与 ${options.partner_name} 留言` });
    this.loadMessages();

    // Start 10s auto refresh
    const timer = setInterval(() => {
      this.loadMessages();
    }, 10000);
    this.setData({ pollingTimer: timer });
  },

  onUnload() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
    }
  },

  async loadMessages() {
    try {
      const data = await api.messages.list(this.data.partnershipId);
      const messages = (data.messages || []).map(msg => {
        const time = new Date(msg.created_at);
        return {
          ...msg,
          timeFormatted: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
        };
      });

      this.setData({ messages });
      this.scrollToBottom();
    } catch (err) {
      // Slently fail during polling
    }
  },

  onInputContent(e) {
    this.setData({ inputContent: e.detail.value });
  },

  async sendMessage() {
    const content = this.data.inputContent;
    if (!content.trim()) return;

    try {
      await api.messages.send(this.data.partnershipId, content.trim());
      this.setData({ inputContent: '' });
      await this.loadMessages();
    } catch (err) {
      wx.showToast({ title: err.message || '发送失败', icon: 'none' });
    }
  },

  scrollToBottom() {
    const len = this.data.messages.length;
    if (len > 0) {
      const lastId = `msg-${this.data.messages[len - 1].id}`;
      this.setData({ lastMessageId: lastId });
    }
  }
});
