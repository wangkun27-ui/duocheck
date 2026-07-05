const api = require('../../utils/api.js');

Page({
  data: {
    partners: [],
    pendingRequests: [],
    searchQuery: '',
    searchResults: []
  },

  onShow() {
    this.loadPartnersData();
  },

  async loadPartnersData() {
    try {
      const partnersData = await api.partners.list();
      const requestsData = await api.partners.getRequests();
      
      const partners = partnersData.partners || [];
      const requests = requestsData.requests || [];
      const pendingRequests = requests.filter(r => r.status === 'pending');

      this.setData({ partners, pendingRequests });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  onInputSearch(e) {
    this.setData({ searchQuery: e.detail.value });
  },

  async handleSearch() {
    const q = this.data.searchQuery;
    if (!q.trim()) {
      wx.showToast({ title: '请输入搜索用户名', icon: 'none' });
      return;
    }

    try {
      const data = await api.partners.search(q.trim());
      this.setData({ searchResults: data.users || [] });
    } catch (err) {
      wx.showToast({ title: err.message || '搜索失败', icon: 'none' });
    }
  },

  async sendRequest(e) {
    const userId = e.currentTarget.dataset.id;
    try {
      await api.partners.request(userId);
      wx.showToast({ title: '已发送搭档请求', icon: 'success' });
      this.setData({ searchResults: [] });
      this.loadPartnersData();
    } catch (err) {
      wx.showToast({ title: err.message || '发送失败', icon: 'none' });
    }
  },

  async respondRequest(e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;

    try {
      await api.partners.respondRequest(id, action);
      wx.showToast({ title: action === 'accept' ? '已接受邀请' : '已拒绝邀请', icon: 'success' });
      this.loadPartnersData();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  gotoSupervise(e) {
    const partnerId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/checkin/checkin?mode=review&partner_id=${partnerId}` });
  },

  gotoChat(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: `/pages/messages/messages?partnership_id=${id}&partner_name=${name}` });
  },

  dissolvePartner(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '解散关系',
      content: `确定要与搭档 「${name}」 解散监督关系吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.partners.remove(id);
            wx.showToast({ title: '关系已解散', icon: 'success' });
            this.loadPartnersData();
          } catch (err) {
            wx.showToast({ title: err.message || '解散失败', icon: 'none' });
          }
        }
      }
    });
  }
});
